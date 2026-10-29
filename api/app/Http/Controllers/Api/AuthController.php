<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\CarrierProfile;
use App\Models\Organization;
use App\Models\OrgMember;
use App\Models\ShipperProfile;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    // POST /api/v1/auth/register
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role'     => ['required', Rule::in(['shipper', 'carrier', 'receiver'])],
            'company_name' => ['sometimes', 'nullable', 'string', 'max:200'],
            'invite_token' => ['sometimes', 'nullable', 'string', 'size:64'],
        ]);

        // Joining an existing company by invitation: no company of their own; their role comes from the invite
        $invitation = null;
        if (!empty($data['invite_token'])) {
            $invitation = \App\Models\OrgInvitation::where('token', $data['invite_token'])
                ->whereNull('accepted_at')->where('expires_at', '>', now())->first();
            if (!$invitation) {
                throw ValidationException::withMessages(['invite_token' => ['This invitation has expired or was already used.']]);
            }
            if (strtolower($invitation->email) !== strtolower($data['email'])) {
                throw ValidationException::withMessages(['email' => ['Use the email address the invitation was sent to.']]);
            }
            $data['role'] = \App\Models\Organization::find($invitation->org_id)?->type ?? $data['role'];
        }

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => $data['password'],
            'role'     => $data['role'],
        ]);

        if ($invitation) {
            \App\Models\OrgMember::create([
                'org_id' => $invitation->org_id, 'user_id' => $user->id,
                'role' => $invitation->role, 'status' => 'active', 'joined_at' => now(),
            ]);
            $invitation->update(['accepted_at' => now()]);
            $user->update(['current_org_id' => $invitation->org_id]);
            $user->load('currentOrg');
        }
        // Otherwise they're starting a company: create their solo org
        elseif (in_array($data['role'], ['carrier', 'shipper'])) {
            $org = $this->createSoloOrg($user, $data['role']);
            $user->update(['current_org_id' => $org->id]);
            $user->setRelation('currentOrg', $org);
        }

        // Carriers get an auto-created profile
        if ($user->role === 'carrier') {
            CarrierProfile::create([
                'user_id' => $user->id,
                'org_id'  => $user->current_org_id,
            ]);
        }

        // Shippers get a profile shell so verification status can attach (company owners only)
        if ($user->role === 'shipper' && !$invitation) {
            ShipperProfile::create([
                'user_id'      => $user->id,
                'org_id'       => $user->current_org_id,
                'company_name' => $request->input('company_name') ?: null,
            ]);
        }

        \App\Services\PersonChecks::refresh($user);

        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Registration verification email failed', [
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);
        }

        $user->load('currentOrg', 'carrierProfile');
        $token = $user->createToken('web')->plainTextToken;

        return response()->json([
            'token' => $token,
            'data'  => new UserResource($user),
        ], 201);
    }

    // POST /api/v1/auth/login
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (! Auth::attempt($credentials)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        /** @var User $user */
        $user = Auth::user();

        if ($user->status === 'deactivated') {
            Auth::guard('web')->logout();
            throw ValidationException::withMessages([
                'email' => ['This account has been deactivated. Contact support.'],
            ]);
        }

        $user->load('currentOrg', 'carrierProfile');

        $user->tokens()->delete();
        $token = $user->createToken('web')->plainTextToken;

        return response()->json([
            'token' => $token,
            'data'  => new UserResource($user),
        ]);
    }

    // POST /api/v1/auth/logout
    public function logout(Request $request): JsonResponse
    {
        $accessToken = $request->user()->currentAccessToken();
        if ($accessToken instanceof \Laravel\Sanctum\PersonalAccessToken) {
            $accessToken->delete();
        }

        return response()->json(['message' => 'Logged out.']);
    }

    // GET /api/v1/user
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load('currentOrg', 'carrierProfile');

        return response()->json(['data' => new UserResource($user)]);
    }

    // POST /api/v1/auth/email/verify  { token }
    public function verifyEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'min:32', 'max:128'],
        ]);

        $payload = \Illuminate\Support\Facades\Cache::pull('email_verify:'.$validated['token']);
        if (!$payload || empty($payload['user_id'])) {
            return response()->json(['message' => 'Invalid or expired verification link.'], 403);
        }

        $user = User::findOrFail($payload['user_id']);

        if (($payload['email'] ?? null) !== $user->getEmailForVerification()) {
            return response()->json(['message' => 'Email has changed. Request a new verification email.'], 403);
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
            event(new Verified($user));

            if ($user->isShipper() && $user->shipperProfile) {
                $profile = $user->shipperProfile;
                $status = 'incomplete';
                if ($profile->company_name && $profile->ein) {
                    $status = $profile->ein_verified_at ? 'verified' : (
                        $profile->verification_status === 'submitted' ? 'submitted' : 'incomplete'
                    );
                }
                $profile->update(['verification_status' => $status]);
            }
        }

        return response()->json(['message' => 'Email verified successfully.']);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function createSoloOrg(User $user, string $type): Organization
    {
        $orgName = $user->name . "'s " . ucfirst($type);
        $baseSlug = Str::slug($user->name . '-' . $type);
        $slug = $baseSlug;
        $i = 1;
        while (Organization::where('slug', $slug)->exists()) {
            $slug = $baseSlug . '-' . $i++;
        }

        $org = Organization::create([
            'name'     => $orgName,
            'slug'     => $slug,
            'type'     => $type,
            'status'   => 'active',
            'owner_id' => $user->id,
        ]);

        OrgMember::create([
            'org_id'    => $org->id,
            'user_id'   => $user->id,
            'role'      => 'owner',
            'status'    => 'active',
            'joined_at' => now(),
        ]);

        return $org;
    }
}
