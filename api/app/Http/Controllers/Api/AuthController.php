<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Organization;
use App\Models\OrgMember;
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
            'role'     => ['required', Rule::in(['shipper', 'broker', 'carrier', 'receiver', 'factor'])],
            // The legal business name is the company's name; required unless joining a company by invitation
            'company_name' => [Rule::requiredIf(fn () => !$request->filled('invite_token') && !$request->filled('claim_org_id')),
                'nullable', 'string', 'max:200'],
            'invite_token' => ['sometimes', 'nullable', 'string', 'size:64'],
            // Claiming a company another business listed (e.g. a shipper listed this receiver)
            'claim_org_id' => ['sometimes', 'nullable', 'integer', Rule::exists('organizations', 'id')->where('status', 'listed')->whereNull('owner_id')],
        ], [
            'company_name.required' => 'Enter your legal business name.',
        ]);
        $companyName = trim((string) ($data['company_name'] ?? ''));

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
            // The invitation went to this address, so accepting it proves the email
            $user->forceFill(['email_verified_at' => now()])->save();
            $user->update(['current_org_id' => $invitation->org_id]);
            $user->load('currentOrg');
        }
        // Claiming a listed company: it becomes theirs once approved (at once when their verified email is a listed contact)
        elseif (!empty($data['claim_org_id'])) {
            app(\App\Services\OrgDirectory::class)->requestClaim($user, \App\Models\Organization::find($data['claim_org_id']), $data['role']);
            $user->refresh();
        }
        // Otherwise they're starting a company: create their solo org
        elseif (in_array($data['role'], ['carrier', 'shipper', 'broker', 'factor', 'receiver'])) {
            // The person signing up owns the new company; everyone else joins by invitation
            $org = $this->createSoloOrg($user, $data['role'], $companyName);
            // Factors and receivers don't need Shipmater approval (docs/noa-factoring.md)
            if (in_array($data['role'], ['factor', 'receiver'], true)) {
                $org->update(['verification_status' => 'not_required']);
            }
            $user->update(['current_org_id' => $org->id]);
            $user->setRelation('currentOrg', $org);
        }

        // A new carrier company starts as an owner-operator; a new shipper company's business verification starts incomplete
        if (isset($org) && $org->type === 'carrier') {
            $org->update(['carrier_type' => 'sole_proprietor']);
        }
        if (isset($org) && $org->type === 'shipper') {
            $org->update(['shipper_verification_status' => 'incomplete']);
        }

        // The person's legal name starts as the name they signed up with
        \App\Services\PersonChecks::identity($user)->fill(\App\Services\PersonChecks::splitName($user->name))->save();

        \App\Services\PersonChecks::refresh($user);

        if (!$user->hasVerifiedEmail()) try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Registration verification email failed', [
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);
        }

        $user->load('currentOrg');
        $token = $user->createToken('web')->plainTextToken;

        return response()->json([
            'token' => $token,
            'data'  => new UserResource($user),
        ], 201);
    }

    // POST /api/v1/auth/email/resend — sign-up step: send the verification link again
    public function resendVerification(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Your email is already verified.', 'verified' => true]);
        }

        // Outside local development, a log mailer means nothing is actually sent
        $mailer = config('mail.default');
        if (in_array($mailer, ['log', 'array'], true) && !app()->environment('local')) {
            return response()->json(['message' => 'Email can\'t be sent right now. Please contact support.'], 503);
        }

        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Verification email failed', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'We couldn\'t send the email. Try again in a minute.'], 502);
        }

        return response()->json(['message' => "We sent a new link to {$user->email}."]);
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

        $user->load('currentOrg');

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
        $user->load('currentOrg');

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
            // A claim on a listed company is approved now if this address is one of its contacts
            app(\App\Services\OrgDirectory::class)->autoApprove($user);

            // The owner's verified email counts toward their shipper company's business verification
            foreach (Organization::where('type', 'shipper')->where('owner_id', $user->id)->get() as $org) {
                $status = 'incomplete';
                if ($org->name && $org->tax_id) {
                    $status = $org->shipper_ein_verified_at ? 'verified' : (
                        $org->shipper_verification_status === 'submitted' ? 'submitted' : 'incomplete'
                    );
                }
                $org->update(['shipper_verification_status' => $status]);
            }
        }

        return response()->json(['message' => 'Email verified successfully.']);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function createSoloOrg(User $user, string $type, string $companyName): Organization
    {
        $orgName = $companyName;
        $baseSlug = Str::slug($companyName . '-' . $type) ?: Str::slug($user->name . '-' . $type);
        $slug = $baseSlug;
        $i = 1;
        while (Organization::where('slug', $slug)->exists()) {
            $slug = $baseSlug . '-' . $i++;
        }

        $org = Organization::create([
            'name'       => $orgName,
            'legal_name' => $orgName,
            'slug'       => $slug,
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
