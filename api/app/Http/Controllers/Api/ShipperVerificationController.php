<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShipperDocument;
use App\Models\Organization;
use App\Models\PersonIdentity;
use App\Services\PersonChecks;
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
        abort_unless($request->user()->postsLoads(), 403);

        $validated = $request->validate([
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
        ]);

        $user = $request->user();
        $me = PersonChecks::identity($user);

        $rawPhone = $validated['phone'] ?? $me->phone;
        if (!trim((string) $rawPhone)) {
            return response()->json(['message' => 'Add a phone number on your Profile tab first.'], 422);
        }

        try {
            $e164 = $this->sms->normalizeE164((string) $rawPhone, $me->phone_country_code);
            $result = $this->sms->send($e164, $user->id);
            $me->update([
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
        abort_unless($request->user()->postsLoads(), 403);

        $validated = $request->validate([
            'code' => ['required', 'string', 'min:4', 'max:10'],
        ]);

        $user = $request->user();
        $me = PersonIdentity::where('user_id', $user->id)->first();
        if (!$me?->phone_e164 && !$me?->phone) {
            return response()->json(['message' => 'Request a verification code first.'], 422);
        }

        $phone = $me->phone_e164 ?: $me->phone;

        try {
            $ok = $this->sms->confirm($phone, $user->id, $validated['code']);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if (!$ok) {
            return response()->json(['message' => 'Invalid or expired code.'], 422);
        }

        // The company's contact phone is verified (counts toward business verification)
        if ($org = $this->shipper($user)) {
            $org->update(['shipper_phone_verified_at' => now()]);
            $this->refreshStatus($org);
        }

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
        abort_unless($request->user()->postsLoads(), 403);
        $org = $this->shipper($request->user());
        if (!$org) {
            return response()->json(['data' => []]);
        }

        return response()->json([
            'data' => $org->shipperDocuments()->orderByDesc('created_at')->get()->map(fn ($d) => $this->shapeDoc($d)),
        ]);
    }

    public function uploadDocument(Request $request): JsonResponse
    {
        abort_unless($request->user()->postsLoads(), 403);

        $validated = $request->validate([
            'document' => ['required', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,webp'],
            'type'     => ['required', 'in:w9,articles,other,coi,hazmat_reg,hipaa_baa'],
            'name'     => ['sometimes', 'string', 'max:255'],
            'expiry'   => ['sometimes', 'nullable', 'date'],
        ]);

        $user = $request->user();
        $org = $this->shipper($user);
        abort_unless($org, 422, 'You are not part of a shipper company.');
        abort_unless($user->canDo('company.profile'), 403, "Your role can't do this. Ask your company's owner if you need it.");

        $file = $request->file('document');
        $disk = $this->documentDisk();
        $path = $file->storeAs(
            "shipper-docs/org-{$org->id}",
            time().'_'.$file->getClientOriginalName(),
            $disk
        );

        $doc = ShipperDocument::create([
            'shipper_id'         => $org->id,
            'type'               => $validated['type'],
            'name'               => $validated['name'] ?? $file->getClientOriginalName(),
            'url'                => $path,
            'mime_type'          => $file->getMimeType(),
            'size'               => $file->getSize(),
        ]);

        // Compliance documents are also the company's current COI / HazMat registration / HIPAA BAA
        if (in_array($validated['type'], ['coi', 'hazmat_reg', 'hipaa_baa'], true)) {
            $org->update(array_filter([
                "shipper_{$validated['type']}_url"    => $path,
                "shipper_{$validated['type']}_expiry" => $validated['expiry'] ?? null,
            ], fn ($v) => $v !== null));
        }

        return response()->json(['data' => $this->shapeDoc($doc)], 201);
    }

    public function submitBusiness(Request $request): JsonResponse
    {
        abort_unless($request->user()->postsLoads(), 403);

        $user = $request->user();
        $org = $this->shipper($user);

        if (!$org) {
            return response()->json(['message' => 'Save your business profile first.'], 422);
        }
        abort_unless($user->canDo('company.profile'), 403, "Your role can't do this. Ask your company's owner if you need it.");
        if (!$org->name || !$org->tax_id) {
            return response()->json(['message' => 'Save legal business name and tax ID (EIN) first.'], 422);
        }
        if (!$user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Verify your email before submitting business verification.'], 422);
        }
        if ($org->shipper_ein_verified_at) {
            return response()->json(['message' => 'Business is already verified.']);
        }

        $hasW9 = $org->shipperDocuments()->where('type', 'w9')->exists();
        if (!$hasW9) {
            return response()->json(['message' => 'Upload a W-9 (or equivalent tax form) before submitting.'], 422);
        }

        $org->update([
            'shipper_verification_status' => 'submitted',
            'verification_submitted_at'   => now(),
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

        $rows = Organization::query()
            ->where('type', 'shipper')
            ->where('shipper_verification_status', 'submitted')
            ->whereNull('shipper_ein_verified_at')
            ->with(['owner', 'shipperDocuments'])
            ->orderBy('verification_submitted_at')
            ->get()
            ->map(function (Organization $o) {
                $owner = $o->owner;
                return [
                    'id'                        => $o->id,   // the shipper company
                    'user_id'                   => $owner?->id,
                    'name'                      => $owner?->name,
                    'email'                     => $owner?->email,
                    'email_verified'            => (bool) $owner?->email_verified_at,
                    'phone'                     => $o->phone ?: PersonIdentity::where('user_id', $o->owner_id)->value('phone'),
                    'phone_verified'            => (bool) $o->shipper_phone_verified_at,
                    'company'                   => $o->name,
                    'ein'                       => $o->tax_id,
                    'business_type'             => $o->business_type,
                    'verification_status'       => $o->shipper_verification_status,
                    'verification_submitted_at' => $o->verification_submitted_at?->toISOString(),
                    'documents'                 => $o->shipperDocuments->map(fn ($d) => $this->shapeDoc($d))->values(),
                    'member_since'              => $o->created_at?->format('M Y'),
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

        $org = Organization::where('type', 'shipper')->findOrFail($id);

        if ($validated['action'] === 'approve') {
            if (!$org->name || !$org->tax_id) {
                return response()->json(['message' => 'Shipper is missing company name or EIN.'], 422);
            }
            $org->update([
                'shipper_ein_verified_at'     => now(),
                'shipper_verification_status' => 'verified',
                'verification_notes'          => $validated['notes'] ?? null,
            ]);
            return response()->json(['message' => 'Shipper business verified.', 'status' => 'verified']);
        }

        $org->update([
            'shipper_ein_verified_at'     => null,
            'shipper_verification_status' => 'incomplete',
            'verification_submitted_at'   => null,
            'verification_notes'          => $validated['notes'] ?? 'Rejected — please re-submit with corrected documents.',
        ]);

        return response()->json(['message' => 'Shipper verification rejected.', 'status' => 'incomplete']);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private function shipper(User $user): ?Organization
    {
        return PersonChecks::companyOf($user, ['shipper', 'broker']);
    }

    private function refreshStatus(Organization $org): void
    {
        $owner = User::find($org->owner_id);
        if (!$org->name || !$org->tax_id || !$owner?->email_verified_at) {
            $status = 'incomplete';
        } elseif (!$org->shipper_ein_verified_at) {
            $status = $org->shipper_verification_status === 'submitted' ? 'submitted' : 'incomplete';
        } else {
            $status = 'verified';
        }
        $org->update(['shipper_verification_status' => $status]);
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
