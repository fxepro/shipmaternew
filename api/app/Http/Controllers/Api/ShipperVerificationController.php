<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShipperDocument;
use App\Models\ShipperProfile;
use App\Models\User;
use App\Services\SmsOtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class ShipperVerificationController extends Controller
{
    public function __construct(private SmsOtpService $sms) {}

    // ── Email ───────────────────────────────────────────────────────────────

    public function resendEmail(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! filter_var($user->email, FILTER_VALIDATE_EMAIL)) {
            return response()->json(['message' => 'Your account has no valid email address.'], 422);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email is already verified.']);
        }

        $mailer = config('mail.default');
        if (in_array($mailer, ['log', 'array'], true)) {
            return response()->json([
                'message' => 'Email delivery is not configured on the server (MAIL_MAILER is "'.$mailer.'"). Set Brevo SMTP on Railway before verification emails can be sent.',
            ], 503);
        }

        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Verification email failed', [
                'user_id' => $user->id,
                'email'   => $user->email,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Could not send verification email: '.$e->getMessage(),
            ], 502);
        }

        return response()->json([
            'message' => 'Verification email sent to '.$user->email.'. Check inbox and spam.',
            'email'   => $user->email,
        ]);
    }

    // ── Phone OTP ───────────────────────────────────────────────────────────

    public function sendPhoneCode(Request $request): JsonResponse
    {
        abort_unless($request->user()->isShipper(), 403);

        $validated = $request->validate([
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
        ]);

        $user = $request->user();
        $profile = ShipperProfile::firstOrCreate(
            ['user_id' => $user->id],
            ['org_id' => $user->current_org_id]
        );

        $rawPhone = $validated['phone'] ?? $profile->phone;
        if (!trim((string) $rawPhone)) {
            return response()->json(['message' => 'Add a phone number on your Profile tab first.'], 422);
        }

        try {
            $e164 = $this->sms->normalizeE164((string) $rawPhone, $profile->phone_country_code);
            $result = $this->sms->send($e164, $user->id);
            $profile->update([
                'phone'      => $rawPhone,
                'phone_e164' => $e164,
            ]);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($result);
    }

    public function confirmPhoneCode(Request $request): JsonResponse
    {
        abort_unless($request->user()->isShipper(), 403);

        $validated = $request->validate([
            'code' => ['required', 'string', 'min:4', 'max:10'],
        ]);

        $user = $request->user();
        $profile = $user->shipperProfile;
        if (!$profile?->phone_e164 && !$profile?->phone) {
            return response()->json(['message' => 'Request a verification code first.'], 422);
        }

        $phone = $profile->phone_e164 ?: $profile->phone;

        try {
            $ok = $this->sms->confirm($phone, $user->id, $validated['code']);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if (!$ok) {
            return response()->json(['message' => 'Invalid or expired code.'], 422);
        }

        $profile->update(['phone_verified_at' => now()]);
        $this->refreshStatus($profile, $user);

        return response()->json([
            'message' => 'Phone number verified.',
            'data'    => [
                'phone_verified' => true,
            ],
        ]);
    }

    // ── Business / EIN documents ────────────────────────────────────────────

    public function listDocuments(Request $request): JsonResponse
    {
        abort_unless($request->user()->isShipper(), 403);
        $profile = $request->user()->shipperProfile;
        if (!$profile) {
            return response()->json(['data' => []]);
        }

        return response()->json([
            'data' => $profile->documents()->orderByDesc('created_at')->get()->map(fn ($d) => $this->shapeDoc($d)),
        ]);
    }

    public function uploadDocument(Request $request): JsonResponse
    {
        abort_unless($request->user()->isShipper(), 403);

        $validated = $request->validate([
            'document' => ['required', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,webp'],
            'type'     => ['required', 'in:w9,articles,other,coi,hazmat_reg,hipaa_baa'],
            'name'     => ['sometimes', 'string', 'max:255'],
            'expiry'   => ['sometimes', 'nullable', 'date'],
        ]);

        $user = $request->user();
        $profile = ShipperProfile::firstOrCreate(
            ['user_id' => $user->id],
            ['org_id' => $user->current_org_id]
        );

        $file = $request->file('document');
        $disk = $this->documentDisk();
        $path = $file->storeAs(
            "shipper-docs/{$profile->id}",
            time().'_'.$file->getClientOriginalName(),
            $disk
        );

        $doc = ShipperDocument::create([
            'shipper_profile_id' => $profile->id,
            'type'               => $validated['type'],
            'name'               => $validated['name'] ?? $file->getClientOriginalName(),
            'url'                => $path,
            'mime_type'          => $file->getMimeType(),
            'size'               => $file->getSize(),
        ]);

        // Compliance documents are also the current COI / HazMat registration / HIPAA BAA on the profile
        if (in_array($validated['type'], ['coi', 'hazmat_reg', 'hipaa_baa'], true)) {
            $profile->update(array_filter([
                "{$validated['type']}_url"    => $path,
                "{$validated['type']}_expiry" => $validated['expiry'] ?? null,
            ], fn ($v) => $v !== null));
        }

        return response()->json(['data' => $this->shapeDoc($doc)], 201);
    }

    public function submitBusiness(Request $request): JsonResponse
    {
        abort_unless($request->user()->isShipper(), 403);

        $user = $request->user();
        $profile = $user->shipperProfile;

        if (!$profile) {
            return response()->json(['message' => 'Save your business profile first.'], 422);
        }
        if (!$profile->company_name || !$profile->ein) {
            return response()->json(['message' => 'Save legal business name and tax ID (EIN) first.'], 422);
        }
        if (!$user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Verify your email before submitting business verification.'], 422);
        }
        if ($profile->ein_verified_at) {
            return response()->json(['message' => 'Business is already verified.']);
        }

        $hasW9 = $profile->documents()->where('type', 'w9')->exists();
        if (!$hasW9) {
            return response()->json(['message' => 'Upload a W-9 (or equivalent tax form) before submitting.'], 422);
        }

        $profile->update([
            'verification_status'       => 'submitted',
            'verification_submitted_at' => now(),
            'verification_notes'        => null,
        ]);

        return response()->json([
            'message' => 'Business verification submitted for review.',
            'data'    => [
                'verification_status' => 'submitted',
            ],
        ]);
    }

    // ── Admin queue ─────────────────────────────────────────────────────────

    public function pendingReview(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $rows = ShipperProfile::query()
            ->where('verification_status', 'submitted')
            ->whereNull('ein_verified_at')
            ->with(['user', 'documents'])
            ->orderBy('verification_submitted_at')
            ->get()
            ->map(function (ShipperProfile $p) {
                return [
                    'id'                        => $p->id,
                    'user_id'                   => $p->user_id,
                    'name'                      => $p->user?->name,
                    'email'                     => $p->user?->email,
                    'email_verified'            => (bool) $p->user?->email_verified_at,
                    'phone'                     => $p->phone,
                    'phone_verified'            => (bool) $p->phone_verified_at,
                    'company'                   => $p->company_name,
                    'ein'                       => $p->ein,
                    'business_type'             => $p->business_type,
                    'verification_status'       => $p->verification_status,
                    'verification_submitted_at' => $p->verification_submitted_at?->toISOString(),
                    'documents'                 => $p->documents->map(fn ($d) => $this->shapeDoc($d))->values(),
                    'member_since'              => $p->user?->created_at?->format('M Y'),
                ];
            });

        return response()->json(['data' => $rows]);
    }

    public function reviewShipper(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $validated = $request->validate([
            'action' => ['required', 'in:approve,reject'],
            'notes'  => ['nullable', 'string', 'max:500'],
        ]);

        $profile = ShipperProfile::with('user')->findOrFail($id);

        if ($validated['action'] === 'approve') {
            if (!$profile->company_name || !$profile->ein) {
                return response()->json(['message' => 'Shipper is missing company name or EIN.'], 422);
            }
            $profile->update([
                'ein_verified_at'     => now(),
                'verification_status' => 'verified',
                'verification_notes'  => $validated['notes'] ?? null,
            ]);
            return response()->json(['message' => 'Shipper business verified.', 'status' => 'verified']);
        }

        $profile->update([
            'ein_verified_at'           => null,
            'verification_status'       => 'incomplete',
            'verification_submitted_at' => null,
            'verification_notes'        => $validated['notes'] ?? 'Rejected — please re-submit with corrected documents.',
        ]);

        return response()->json(['message' => 'Shipper verification rejected.', 'status' => 'incomplete']);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private function refreshStatus(ShipperProfile $profile, User $user): void
    {
        if (!$profile->company_name || !$profile->ein) {
            $status = 'incomplete';
        } elseif (!$user->email_verified_at) {
            $status = 'incomplete';
        } elseif (!$profile->ein_verified_at) {
            $status = $profile->verification_status === 'submitted' ? 'submitted' : 'incomplete';
        } else {
            $status = 'verified';
        }
        $profile->update(['verification_status' => $status]);
    }

    private function documentDisk(): string
    {
        $r2 = config('filesystems.disks.r2');
        if (!empty($r2['key']) && !empty($r2['bucket'])) {
            return 'r2';
        }
        return 'public';
    }

    private function shapeDoc(ShipperDocument $d): array
    {
        $url = ShipperDocument::fileUrl($d->url);

        return [
            'id'          => $d->id,
            'type'        => $d->type,
            'name'        => $d->name,
            'url'         => $url,
            'mime_type'   => $d->mime_type,
            'size'        => $d->size,
            'verified_at' => $d->verified_at?->toISOString(),
            'created_at'  => $d->created_at?->toISOString(),
        ];
    }
}
