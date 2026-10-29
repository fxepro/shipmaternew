<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrierDocument;
use App\Models\CarrierProfile;
use App\Models\CarrierVehicle;
use App\Models\ServiceType;
use App\Models\Shipment;
use App\Models\User;
use App\Services\ServiceTypeRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class CarrierController extends Controller
{
    // ── Profile shape helper (matches ShipperProfileController pattern) ────────

    private function shape(Request $request): array
    {
        $user    = $request->user();
        $profile = $user->carrierProfile;

        // Calculate completion percentage
        $completion = $this->calculateCompletion($profile);

        return [
            'name'                    => $user->name,
            'email'                   => $user->email,
            'carrier_type'            => $profile?->carrier_type ?? 'sole_proprietor',
            'verification_status'     => $profile?->verification_status ?? 'incomplete',
            'onboarding_fee_paid'     => (bool) ($profile?->onboarding_fee_paid ?? false),
            'completion_percentage'   => $completion,

            // Personal
            'date_of_birth'           => $profile?->date_of_birth?->toDateString(),
            'ssn_last_4'              => $profile?->ssn_last_4,
            'photo_url'               => $profile?->photo_url,

            // DOT-Commercial
            'dot_number'              => $profile?->dot_number ?? '',
            'mc_number'               => $profile?->mc_number ?? '',
            'cdl_number'              => $profile?->cdl_number,
            'cdl_issuing_state'       => $profile?->cdl_issuing_state,
            'cdl_expiry_date'         => $profile?->cdl_expiry_date,
            'cdl_class'               => $profile?->cdl_class,
            'usdot_number'            => $profile?->usdot_number,
            'hazmat_endorsement'      => (bool) ($profile?->hazmat_endorsement ?? false),
            'hazmat_expiry_date'      => $profile?->hazmat_expiry_date,
            'tanker_endorsement'      => (bool) ($profile?->tanker_endorsement ?? false),
            'passenger_endorsement'   => (bool) ($profile?->passenger_endorsement ?? false),
            // Personal tab — address
            'street'                  => $profile?->street ?? '',
            'city'                    => $profile?->city ?? '',
            'state'                   => $profile?->state ?? '',
            'zip'                     => $profile?->zip ?? '',

            // Personal tab — government ID
            'id_type'                 => $profile?->id_type ?? 'dl',
            'dl_number'               => $profile?->dl_number ?? '',
            'dl_state'                => $profile?->dl_state ?? '',
            'dl_expiry'               => $profile?->dl_expiry?->toDateString() ?? '',

            'dot_verified'            => (bool) ($profile?->dot_verified ?? false),
            'identity_verified'       => (bool) ($profile?->identity_verified ?? false),
            'identity_verified_at'    => $profile?->identity_verified_at?->toISOString(),

            // Last DOT/FMCSA verification result
            'fmcsa_result'            => $profile?->verifications
                                            ?->firstWhere('check_type', 'fmcsa')
                                            ?->result_data,
            'fmcsa_checked_at'        => $profile?->verifications
                                            ?->firstWhere('check_type', 'fmcsa')
                                            ?->updated_at?->toISOString(),
            'fmcsa_expires_at'        => $profile?->verifications
                                            ?->firstWhere('check_type', 'fmcsa')
                                            ?->expires_at?->toDateString(),

            // Last MC verification result
            'mc_verified'             => (bool) ($profile?->mc_verified ?? false),
            'mc_result'               => $profile?->verifications
                                            ?->firstWhere('check_type', 'mc')
                                            ?->result_data,
            'mc_checked_at'           => $profile?->verifications
                                            ?->firstWhere('check_type', 'mc')
                                            ?->updated_at?->toISOString(),
            'mc_expires_at'           => $profile?->verifications
                                            ?->firstWhere('check_type', 'mc')
                                            ?->expires_at?->toDateString(),
            'company_name'            => $profile?->company_name ?? '',
            'phone'                   => $profile?->phone ?? '',
            'phone_country_code'      => $profile?->phone_country_code ?? 'US',
            'whatsapp'                => $profile?->whatsapp ?? '',
            'whatsapp_country_code'   => $profile?->whatsapp_country_code
                ?? ($profile?->phone_country_code ?? 'US'),

            // Medical
            'medical_examiner_name'   => $profile?->medical_examiner_name,
            'dot_medical_expiry'      => $profile?->dot_medical_expiry,
            'drug_test_date'          => $profile?->drug_test_date,
            'drug_test_result'        => $profile?->drug_test_result,

            // Insurance
            'insurance_verified'      => (bool) ($profile?->insurance_verified ?? false),
            'background_check_status'       => $profile?->background_check_status ?? 'not_started',
            'background_check_invitation_url' => $profile?->verifications
                                                    ?->firstWhere('check_type', 'background')
                                                    ?->result_data['invitation_url'] ?? null,
            'background_check_completed_at' => $profile?->verifications
                                                    ?->firstWhere('check_type', 'background')
                                                    ?->updated_at?->toISOString(),
            'auto_policy_number'      => $profile?->auto_policy_number,
            'auto_insurer_name'       => $profile?->auto_insurer_name,
            'auto_coverage_amount'    => $profile?->auto_coverage_amount,
            'auto_effective_date'     => $profile?->auto_effective_date,
            'auto_expiry_date'        => $profile?->auto_expiry_date,
            'cargo_policy_number'     => $profile?->cargo_policy_number,
            'cargo_insurer_name'      => $profile?->cargo_insurer_name,
            'cargo_coverage_amount'   => $profile?->cargo_coverage_amount,
            'cargo_expiry_date'       => $profile?->cargo_expiry_date,

            // Clearinghouse
            'clearinghouse_query_status' => $profile?->clearinghouse_query_status ?? 'not_run',
            'clearinghouse_queried_at'   => $profile?->clearinghouse_queried_at?->toISOString(),
            'clearinghouse_completed_at' => $profile?->clearinghouse_completed_at?->toISOString(),

            // Stripe
            'stripe_account_id'       => $profile?->stripe_account_id,
            'stripe_account_status'   => $profile?->stripe_account_status ?? 'not_connected',

            // Stats
            'rating'                  => $profile?->rating ? (float) $profile->rating : null,
            'total_ratings'           => $profile?->total_ratings ?? 0,
            'total_deliveries'        => $profile?->total_deliveries ?? 0,
            'org_id'                  => $profile?->org_id,
            'member_since'            => $user->created_at->format('M Y'),

            // Service types
            'service_type_keys'       => $profile?->serviceTypes->pluck('key')->toArray() ?? [],
            'certification_keys'      => $profile?->certifications->pluck('key')->toArray() ?? [],
            'required_fields'         => ServiceTypeRules::requiredFields(
                $profile?->serviceTypes->pluck('key')->toArray() ?? []
            ),
            'relevant_tabs'           => ServiceTypeRules::relevantTabs(
                $profile?->serviceTypes->pluck('key')->toArray() ?? []
            ),
        ];
    }

    private function calculateCompletion($profile): int
    {
        if (!$profile) return 0;

        $fields = [
            'photo_url'           => 10,
            'date_of_birth'       => 10,
            'ssn_last_4'          => 10,
            'cdl_number'          => 15,
            'usdot_number'        => 15,
            'dot_medical_expiry'  => 15,
            'hazmat_endorsement'  => 5,
        ];

        $completed = 0;
        foreach ($fields as $field => $weight) {
            if ($profile->{$field}) $completed += $weight;
        }

        return min($completed, 100);
    }

    // ── GET /api/v1/admin/carriers/pending-review ───────────────────────────
    // Returns carriers awaiting admin review (Checkr returned 'consider')

    public function pendingReview(Request $request): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        // ?status= filters by verification status; defaults to the review queue, 'all' lists every carrier
        $status = $request->input('status', 'pending_review');

        $carriers = User::where('role', 'carrier')
            ->whereHas('carrierProfile', fn ($q) => $status === 'all' ? $q : $q->where('verification_status', $status))
            ->with('carrierProfile.verifications')
            ->latest()
            ->get()
            ->map(function ($u) {
                $profile = $u->carrierProfile;
                $bgCheck  = $profile?->verifications?->firstWhere('check_type', 'background');
                $idCheck  = $profile?->verifications?->firstWhere('check_type', 'identity');
                return [
                    'id'                      => $u->id,
                    'name'                    => $u->name,
                    'email'                   => $u->email,
                    'verification_status'     => $profile?->verification_status,
                    'background_check_status' => $profile?->background_check_status,
                    'background_check_result' => $bgCheck?->result_data,
                    'background_checked_at'   => $bgCheck?->updated_at?->toISOString(),
                    'dot_verified'            => (bool) ($profile?->dot_verified ?? false),
                    'mc_verified'             => (bool) ($profile?->mc_verified  ?? false),
                    'identity_verified'       => (bool) ($profile?->identity_verified ?? false),
                    'identity_verified_at'    => $profile?->identity_verified_at?->toISOString(),
                    'age_verified'            => (bool) ($profile?->age_verified ?? false),
                    'identity_check_status'   => $idCheck?->status,
                    'onboarding_fee_paid'     => (bool) ($profile?->onboarding_fee_paid ?? false),
                    'member_since'            => $u->created_at->format('M Y'),
                    'company_name'            => $profile?->company_name,
                    'dot_number'              => $profile?->dot_number,
                    'mc_number'               => $profile?->mc_number,
                    'carrier_type'            => $profile?->carrier_type,
                    'account_status'          => $u->status ?? 'active',
                    'verification_notes'      => $profile?->verification_notes,
                    'submitted_at'            => $profile?->submitted_for_verification_at,
                    'status_updated_at'       => $profile?->verification_status_updated_at,
                    'created_at'              => $u->created_at?->toISOString(),
                ];
            });

        return response()->json(['data' => $carriers]);
    }

    // ── POST /api/v1/admin/carriers/{id}/approve ─────────────────────────────
    // POST /api/v1/admin/carriers/{id}/reject

    public function reviewCarrier(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->role === 'admin', 403);

        $validated = $request->validate([
            'action' => ['required', 'in:approve,reject'],
            'notes'  => ['nullable', 'string', 'max:500'],
        ]);

        $carrier = User::where('role', 'carrier')->findOrFail($id);
        $profile = $carrier->carrierProfile;

        if (!$profile) {
            return response()->json(['error' => 'Carrier profile not found.'], 404);
        }

        // Identity verification is required before approval
        if ($validated['action'] === 'approve' && !$profile->identity_verified) {
            return response()->json([
                'error' => 'Identity verification must be completed before this carrier can be approved.',
                'code'  => 'identity_not_verified',
            ], 422);
        }

        $status = $validated['action'] === 'approve' ? 'approved' : 'rejected';

        $profile->update([
            'verification_status'            => $status,
            'verification_notes'             => $validated['notes'] ?? null,
            'verification_status_updated_at' => now(),
        ]);

        return response()->json([
            'message' => "Carrier {$status}.",
            'status'  => $status,
        ]);
    }

    // ── GET /api/v1/carrier/profile ──────────────────────────────────────────

    public function kycStatus(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $profile = $request->user()->carrierProfile;
        if (!$profile) {
            return response()->json(['data' => [
                'identity_verified'  => false,
                'age_verified'       => false,
                'identity_check'     => null,
            ]]);
        }

        $identityCheck = $profile->verifications()
            ->where('check_type', 'identity')
            ->latest()
            ->first();

        return response()->json(['data' => [
            'identity_verified'    => (bool) $profile->identity_verified,
            'identity_verified_at' => $profile->identity_verified_at?->toISOString(),
            'age_verified'         => (bool) $profile->age_verified,
            'age_verified_at'      => $profile->age_verified_at?->toISOString(),
            'date_of_birth'        => $profile->date_of_birth?->toDateString(),
            'identity_check'       => $identityCheck ? [
                'status'      => $identityCheck->status,
                'external_id' => $identityCheck->external_id,
                'last_error'  => $identityCheck->result_data['last_error'] ?? null,
                'verified_at' => $identityCheck->result_data['verified_at'] ?? null,
            ] : null,
        ]]);
    }

    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);
        $request->user()->load('carrierProfile.serviceTypes', 'carrierProfile.certifications', 'carrierProfile.verifications');

        return response()->json(['data' => $this->shape($request)]);
    }

    // ── PUT /api/v1/carrier/profile ──────────────────────────────────────────

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isCarrier(), 403);

        $validated = $request->validate([
            'name'                => ['sometimes', 'string', 'max:255'],
            'email'               => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],

            // Personal
            'date_of_birth'       => ['sometimes', 'nullable', 'date'],
            'ssn_last_4'          => ['sometimes', 'nullable', 'string', 'max:4'],
            'photo_url'           => ['sometimes', 'nullable', 'string'],

            // DOT-Commercial
            'cdl_number'            => ['sometimes', 'nullable', 'string', 'max:20'],
            'cdl_issuing_state'     => ['sometimes', 'nullable', 'string', 'max:2'],
            'cdl_expiry_date'       => ['sometimes', 'nullable', 'date'],
            'cdl_class'             => ['sometimes', 'nullable', 'string', 'max:5'],
            'usdot_number'          => ['sometimes', 'nullable', 'string', 'max:20'],
            'mc_number'             => ['sometimes', 'nullable', 'string', 'max:30'],
            'hazmat_endorsement'    => ['sometimes', 'boolean'],
            'hazmat_expiry_date'    => ['sometimes', 'nullable', 'date'],
            'tanker_endorsement'    => ['sometimes', 'boolean'],
            'passenger_endorsement' => ['sometimes', 'boolean'],
            'dot_number'            => ['sometimes', 'nullable', 'string', 'max:20'],
            'company_name'          => ['sometimes', 'nullable', 'string', 'max:200'],
            'phone'                 => ['sometimes', 'nullable', 'string', 'max:40'],
            'phone_country_code'    => ['sometimes', 'nullable', 'string', 'size:2'],
            'whatsapp'              => ['sometimes', 'nullable', 'string', 'max:40'],
            'whatsapp_country_code' => ['sometimes', 'nullable', 'string', 'size:2'],
            'street'                => ['sometimes', 'nullable', 'string', 'max:255'],
            'city'                  => ['sometimes', 'nullable', 'string', 'max:100'],
            'state'                 => ['sometimes', 'nullable', 'string', 'max:2'],
            'zip'                   => ['sometimes', 'nullable', 'string', 'max:10'],
            'id_type'               => ['sometimes', 'nullable', 'string', 'in:dl,passport'],
            'dl_number'             => ['sometimes', 'nullable', 'string', 'max:30'],
            'dl_state'              => ['sometimes', 'nullable', 'string', 'max:2'],
            'dl_expiry'             => ['sometimes', 'nullable', 'date'],

            // Insurance
            'auto_policy_number'   => ['sometimes', 'nullable', 'string'],
            'auto_insurer_name'    => ['sometimes', 'nullable', 'string'],
            'auto_coverage_amount' => ['sometimes', 'nullable', 'numeric'],
            'auto_effective_date'  => ['sometimes', 'nullable', 'date'],
            'auto_expiry_date'     => ['sometimes', 'nullable', 'date'],
            'cargo_policy_number'  => ['sometimes', 'nullable', 'string'],
            'cargo_insurer_name'   => ['sometimes', 'nullable', 'string'],
            'cargo_coverage_amount'=> ['sometimes', 'nullable', 'numeric'],
            'cargo_expiry_date'    => ['sometimes', 'nullable', 'date'],

            // Medical
            'medical_examiner_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'dot_medical_expiry'    => ['sometimes', 'nullable', 'date'],
            'drug_test_date'        => ['sometimes', 'nullable', 'date'],
            'drug_test_result'      => ['sometimes', 'nullable', 'string', 'max:20'],

            // Service types
            'service_type_keys'     => ['sometimes', 'array'],
            'service_type_keys.*'   => ['string'],
        ]);

        // Update users table fields
        $userFields = array_intersect_key($validated, array_flip(['name', 'email']));
        if ($userFields) {
            $user->update($userFields);
        }

        // Handle service types separately (pivot)
        $serviceTypeKeys = $validated['service_type_keys'] ?? null;
        $profileData = array_diff_key($validated, array_flip(['name', 'email', 'service_type_keys']));

        // Sanitize number-only fields — strip prefixes like "MC-", "DOT-", spaces
        foreach (['mc_number', 'dot_number', 'usdot_number'] as $field) {
            if (isset($profileData[$field]) && $profileData[$field] !== null) {
                $profileData[$field] = preg_replace('/\D/', '', $profileData[$field]) ?: null;
            }
        }

        // Auto-compute age verification when DOB is saved
        if (isset($profileData['date_of_birth']) && $profileData['date_of_birth']) {
            $dob = \Carbon\Carbon::parse($profileData['date_of_birth']);
            $isAdult = $dob->age >= 18;
            if (! $isAdult) {
                return response()->json([
                    'message' => 'You must be 18 or older.',
                    'errors'  => ['date_of_birth' => ['You must be 18 or older.']],
                ], 422);
            }
            $profileData['age_verified']    = true;
            $profileData['age_verified_at'] = now();
        }

        // Build E.164 from national phone + country dial code
        if (array_key_exists('phone', $profileData) || array_key_exists('phone_country_code', $profileData)) {
            $existing = $user->carrierProfile;
            $national = $profileData['phone'] ?? $existing?->phone ?? '';
            $cc = strtoupper($profileData['phone_country_code'] ?? $existing?->phone_country_code ?? 'US');
            $profileData['phone_country_code'] = $cc;
            if ($national !== '' && $national !== null) {
                try {
                    $profileData['phone_e164'] = app(\App\Services\SmsOtpService::class)
                        ->normalizeE164((string) $national, $cc);
                } catch (\Throwable) {
                    $profileData['phone_e164'] = null;
                }
            } else {
                $profileData['phone_e164'] = null;
            }
        }

        if (array_key_exists('whatsapp_country_code', $profileData) && $profileData['whatsapp_country_code']) {
            $profileData['whatsapp_country_code'] = strtoupper($profileData['whatsapp_country_code']);
        }

        // Update profile table fields
        $profile = CarrierProfile::updateOrCreate(['user_id' => $user->id], $profileData ?: []);

        // Sync service types if provided
        if ($serviceTypeKeys !== null) {
            $ids = ServiceType::whereIn('key', $serviceTypeKeys)->pluck('id');
            $profile->serviceTypes()->sync($ids);
        }

        $user->load('carrierProfile.serviceTypes');

        return response()->json(['data' => $this->shape($request)]);
    }

    // ── GET /api/v1/carrier/earnings ────────────────────────────────────────

    public function earnings(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $user      = $request->user();
        $shipments = Shipment::where('carrier_id', $user->id)
            ->whereIn('status', ['delivered', 'in_transit', 'assigned'])
            ->get(['id', 'status', 'agreed_cost', 'pickup_city', 'pickup_state',
                   'delivery_city', 'delivery_state', 'distance_miles', 'delivered_at']);

        $delivered     = $shipments->where('status', 'delivered');
        $pendingEscrow = $shipments->whereIn('status', ['in_transit', 'assigned']);
        $totalPaid     = $delivered->sum('agreed_cost');
        $pendingAmount = $pendingEscrow->sum('agreed_cost');

        return response()->json([
            'data' => [
                'total_paid'     => (float) $totalPaid,
                'pending_escrow' => (float) $pendingAmount,
                'shipments'      => $shipments->map(fn ($s) => [
                    'id'             => $s->id,
                    'status'         => $s->status,
                    'amount'         => (float) $s->agreed_cost,
                    'route'          => "{$s->pickup_city}, {$s->pickup_state} → {$s->delivery_city}, {$s->delivery_state}",
                    'distance_miles' => (float) $s->distance_miles,
                    'delivered_at'   => $s->delivered_at?->toISOString(),
                ]),
            ],
        ]);
    }

    // ── POST /api/v1/carrier/payout ─────────────────────────────────────────

    public function requestPayout(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $validated = $request->validate([
            'method' => ['required', 'in:stripe,bank'],
        ]);

        $profile = $request->user()->carrierProfile;

        if (!$profile?->stripe_account_id || $profile->stripe_account_status !== 'verified') {
            return response()->json([
                'error' => 'You must connect and verify your Stripe account before requesting a payout.',
            ], 422);
        }

        // Stripe handles payouts automatically on a rolling basis.
        // For instant payouts, trigger via Stripe API.
        return response()->json([
            'message' => 'Payout request received. Funds will be transferred within 1-2 business days.',
            'method'  => $validated['method'],
        ]);
    }

    // ── GET /api/v1/carrier/documents ───────────────────────────────────────

    public function getDocuments(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $profile = $request->user()->carrierProfile;
        if (!$profile) return response()->json(['data' => []]);

        return response()->json([
            'data' => $profile->documents()
                ->orderBy('type')
                ->get()
                ->map(function ($d) {
                    // Generate a signed URL (1-hour expiry) for private R2 objects.
                    // Fall back to stored URL for legacy local-storage records.
                    $url = $d->url;
                    if ($d->url && !str_starts_with($d->url, 'http')) {
                        try {
                            $url = Storage::disk('r2')->temporaryUrl($d->url, now()->addHour());
                        } catch (\Throwable) {
                            $url = null;
                        }
                    }

                    return [
                        'id'              => $d->id,
                        'type'            => $d->type,
                        'name'            => $d->name,
                        'url'             => $url,
                        'policy_number'   => $d->policy_number,
                        'insurer_name'    => $d->insurer_name,
                        'coverage_amount' => $d->coverage_amount,
                        'effective_date'  => $d->effective_date?->toDateString(),
                        'expiry_date'     => $d->expiry_date?->toDateString(),
                        'verified_at'     => $d->verified_at?->toISOString(),
                    ];
                }),
        ]);
    }

    // ── POST /api/v1/carrier/documents ──────────────────────────────────────

    public function uploadDocument(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $validated = $request->validate([
            'document'        => ['required', 'file', 'max:10240'],
            'type'            => ['required', 'string'],
            'name'            => ['sometimes', 'string'],
            'vehicle_id'      => ['sometimes', 'nullable', 'integer'],
            'policy_number'   => ['sometimes', 'nullable', 'string'],
            'insurer_name'    => ['sometimes', 'nullable', 'string'],
            'coverage_amount' => ['sometimes', 'nullable', 'numeric'],
            'effective_date'  => ['sometimes', 'nullable', 'date'],
            'expiry_date'     => ['sometimes', 'nullable', 'date'],
        ]);

        $profile = $request->user()->carrierProfile()->firstOrCreate(['user_id' => $request->user()->id]);

        $file = $request->file('document');
        $path = $file->storeAs(
            "carrier-docs/{$profile->id}",
            time() . '_' . $file->getClientOriginalName(),
            'r2'
        );

        $doc = CarrierDocument::create([
            'carrier_profile_id' => $profile->id,
            'carrier_vehicle_id' => $validated['vehicle_id'] ?? null,
            'type'               => $validated['type'],
            'name'               => $validated['name'] ?? $file->getClientOriginalName(),
            'url'                => $path, // store R2 path, serve via signed URL
            'mime_type'          => $file->getMimeType(),
            'size'               => $file->getSize(),
            'policy_number'      => $validated['policy_number'] ?? null,
            'insurer_name'       => $validated['insurer_name'] ?? null,
            'coverage_amount'    => $validated['coverage_amount'] ?? null,
            'effective_date'     => $validated['effective_date'] ?? null,
            'expiry_date'        => $validated['expiry_date'] ?? null,
        ]);

        return response()->json(['data' => $doc], 201);
    }

    // ── GET /api/v1/carrier/vehicles ────────────────────────────────────────

    public function getVehicles(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $profile = $request->user()->carrierProfile;
        if (!$profile) return response()->json(['data' => []]);

        return response()->json([
            'data' => $profile->vehicles()
                ->orderByDesc('is_primary')
                ->orderBy('created_at')
                ->get()
                ->map(fn($v) => [
                    'id'                   => $v->id,
                    'type'                 => $v->type,
                    'year'                 => $v->year,
                    'make'                 => $v->make,
                    'model'                => $v->model,
                    'vin'                  => $v->vin,
                    'license_plate'        => $v->license_plate,
                    'license_plate_state'  => $v->license_plate_state,
                    'gvwr'                 => $v->gvwr,
                    'max_payload'          => $v->max_payload,
                    'cargo_length'         => $v->cargo_length,
                    'cargo_width'          => $v->cargo_width,
                    'cargo_height'         => $v->cargo_height,
                    'liftgate'             => $v->liftgate,
                    'climate_controlled'   => $v->climate_controlled,
                    'enclosed'             => $v->enclosed,
                    'is_primary'           => $v->is_primary,
                    'registration_expiry'  => $v->registration_expiry?->toDateString(),
                ]),
        ]);
    }

    // ── POST /api/v1/carrier/vehicles ───────────────────────────────────────

    public function createVehicle(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $validated = $request->validate([
            'type'                 => ['required', 'string'],
            'year'                 => ['required', 'string', 'max:4'],
            'make'                 => ['required', 'string'],
            'model'                => ['required', 'string'],
            'vin'                  => ['sometimes', 'nullable', 'string'],
            'license_plate'        => ['sometimes', 'nullable', 'string'],
            'license_plate_state'  => ['sometimes', 'nullable', 'string', 'max:2'],
            'gvwr'                 => ['sometimes', 'nullable', 'numeric'],
            'max_payload'          => ['sometimes', 'nullable', 'numeric'],
            'cargo_length'         => ['sometimes', 'nullable', 'numeric'],
            'cargo_width'          => ['sometimes', 'nullable', 'numeric'],
            'cargo_height'         => ['sometimes', 'nullable', 'numeric'],
            'liftgate'             => ['sometimes', 'boolean'],
            'climate_controlled'   => ['sometimes', 'boolean'],
            'enclosed'             => ['sometimes', 'boolean'],
            'is_primary'           => ['sometimes', 'boolean'],
            'registration_expiry'  => ['sometimes', 'nullable', 'date'],
        ]);

        $profile = $request->user()->carrierProfile()->firstOrCreate(['user_id' => $request->user()->id]);

        // If setting as primary, demote all others
        if (!empty($validated['is_primary'])) {
            $profile->vehicles()->update(['is_primary' => false]);
        }

        // First vehicle is always primary
        if ($profile->vehicles()->count() === 0) {
            $validated['is_primary'] = true;
        }

        $vehicle = $profile->vehicles()->create($validated);

        return response()->json(['data' => $vehicle], 201);
    }

    // ── PUT /api/v1/carrier/vehicles/{id} ───────────────────────────────────

    public function updateVehicle(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $profile = $request->user()->carrierProfile;
        $vehicle = $profile->vehicles()->findOrFail($id);

        $validated = $request->validate([
            'type'                 => ['sometimes', 'string'],
            'year'                 => ['sometimes', 'string', 'max:4'],
            'make'                 => ['sometimes', 'string'],
            'model'                => ['sometimes', 'string'],
            'vin'                  => ['sometimes', 'nullable', 'string'],
            'license_plate'        => ['sometimes', 'nullable', 'string'],
            'license_plate_state'  => ['sometimes', 'nullable', 'string', 'max:2'],
            'gvwr'                 => ['sometimes', 'nullable', 'numeric'],
            'max_payload'          => ['sometimes', 'nullable', 'numeric'],
            'cargo_length'         => ['sometimes', 'nullable', 'numeric'],
            'cargo_width'          => ['sometimes', 'nullable', 'numeric'],
            'cargo_height'         => ['sometimes', 'nullable', 'numeric'],
            'liftgate'             => ['sometimes', 'boolean'],
            'climate_controlled'   => ['sometimes', 'boolean'],
            'enclosed'             => ['sometimes', 'boolean'],
            'is_primary'           => ['sometimes', 'boolean'],
            'registration_expiry'  => ['sometimes', 'nullable', 'date'],
        ]);

        if (!empty($validated['is_primary'])) {
            $profile->vehicles()->update(['is_primary' => false]);
        }

        $vehicle->update($validated);

        return response()->json(['data' => $vehicle]);
    }

    // ── DELETE /api/v1/carrier/vehicles/{id} ────────────────────────────────

    public function deleteVehicle(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $profile = $request->user()->carrierProfile;
        $vehicle = $profile->vehicles()->findOrFail($id);
        $wasPrimary = $vehicle->is_primary;
        $vehicle->delete();

        // Promote next vehicle to primary if we deleted the primary
        if ($wasPrimary) {
            $profile->vehicles()->oldest()->first()?->update(['is_primary' => true]);
        }

        return response()->json(['message' => 'Vehicle deleted']);
    }

    // ── GET /api/v1/carriers ────────────────────────────────────────────────
    // Supports: ?zip= ?distance_miles= ?verified= ?service_types[]= ?dot= ?sort=

    public function index(Request $request): JsonResponse
    {
        $query = User::where('role', 'carrier')
                     ->with('carrierProfile.serviceTypes', 'currentOrg');

        // Exact DOT lookup (for add-carrier modal)
        if ($dot = $request->query('dot')) {
            $query->whereHas('carrierProfile', fn ($q) =>
                $q->where('dot_number', $dot)->orWhere('usdot_number', $dot)
            );
        }

        // Verified only
        if ($request->query('verified')) {
            $query->whereHas('carrierProfile', fn ($q) =>
                $q->where('verification_status', 'verified')
            );
        }

        // Service types filter
        if ($serviceTypes = $request->query('service_types')) {
            $keys = is_array($serviceTypes) ? $serviceTypes : explode(',', $serviceTypes);
            // Carriers now store service types at org level
            $query->whereHas('currentOrg.serviceTypes', fn ($q) => $q->whereIn('key', $keys));
        }

        // ZIP + distance filter
        // Primary source: carrier_profiles.zip / .state (saved from Personal tab).
        // Fallback: org address (for multi-org carriers that set location at org level).
        if ($zip = $request->query('zip')) {
            $distance = (int) ($request->query('distance_miles', 50));

            if ($distance <= 25) {
                // Tight radius — match first 3 digits of ZIP (same metro)
                $prefix = substr(preg_replace('/\D/', '', $zip), 0, 3);
                $query->where(function ($q) use ($prefix) {
                    $q->whereHas('carrierProfile', fn ($cp) =>
                        $cp->where('zip', 'like', $prefix . '%')
                    )
                    ->orWhereHas('currentOrg', fn ($o) =>
                        $o->where('zip', 'like', $prefix . '%')
                    );
                });
            } else {
                // Broad radius — match by state derived from ZIP prefix
                $state = $this->zipToState($zip);
                if ($state) {
                    $query->where(function ($q) use ($state) {
                        $q->whereHas('carrierProfile', fn ($cp) =>
                            $cp->where('state', $state)
                        )
                        ->orWhereHas('currentOrg', fn ($o) =>
                            $o->where('state', $state)
                        );
                    });
                }
            }
        }

        // Sorting — LEFT JOIN so carriers without a profile still appear
        $sort = $request->query('sort', 'rating');
        $query->leftJoin('carrier_profiles as cp', 'cp.user_id', '=', 'users.id');
        match ($sort) {
            'rating'      => $query->orderByDesc('cp.rating'),
            'deliveries'  => $query->orderByDesc('cp.total_deliveries'),
            'newest'      => $query->orderByDesc('users.created_at'),
            'oldest'      => $query->orderBy('users.created_at'),
            default       => $query->orderByDesc('cp.rating'),
        };

        $carriers = $query->select('users.*')->get();

        return response()->json([
            'data' => $carriers->map(function ($c) {
                $profile = $c->carrierProfile;
                $parts   = explode(' ', $c->name);
                $avatar  = strtoupper(
                    substr($parts[0], 0, 1) . (isset($parts[1]) ? substr($parts[1], 0, 1) : '')
                );

                $org = $c->currentOrg;
                // Service types are org-level for multi-org carriers
                $serviceTypes = $org?->serviceTypes ?? $profile?->serviceTypes;

                return [
                    'id'                   => $c->id,
                    'name'                 => $c->name,
                    'email'                => $c->email,
                    'company_name'         => $profile?->company_name ?? $org?->name ?? '',
                    'dot_number'           => $profile?->dot_number ?? $profile?->usdot_number ?? '',
                    'mc_number'            => $profile?->mc_number ?? '',
                    'phone'                => $profile?->phone ?? $org?->phone ?? '',
                    'verification_status'  => $profile?->verification_status ?? 'incomplete',
                    'dot_verified'         => (bool) ($profile?->dot_verified ?? false),
                    'insurance_verified'   => (bool) ($profile?->insurance_verified ?? false),
                    'rating'               => (float) ($profile?->rating ?? 0),
                    'total_deliveries'     => $profile?->total_deliveries ?? 0,
                    'member_since'         => $c->created_at->format('M Y'),
                    'avatar'               => $avatar,
                    // Location
                    'city'                 => $org?->city ?? '',
                    'state'                => $org?->state ?? '',
                    'zip'                  => $org?->zip ?? '',
                    // Service types (org-level)
                    'service_types'        => $serviceTypes?->map(fn($t) => [
                        'key'  => $t->key,
                        'name' => $t->name,
                        'icon' => $t->icon,
                    ])->toArray() ?? [],
                ];
            }),
        ]);
    }

    // ── ZIP → State (US prefix map for broad geo-filter) ───────────────────────
    // A full ZIP→coordinate lookup (PostGIS / geocoding API) can replace this.

    private function zipToState(string $zip): ?string
    {
        $prefix = (int) substr(preg_replace('/\D/', '', $zip), 0, 3);
        return match(true) {
            $prefix >= 1   && $prefix <= 27  => 'MA',
            $prefix >= 28  && $prefix <= 29  => 'RI',
            $prefix >= 30  && $prefix <= 39  => 'NH',
            $prefix >= 40  && $prefix <= 49  => 'ME',
            $prefix >= 50  && $prefix <= 89  => 'VT',
            $prefix >= 100 && $prefix <= 199 => 'NY',
            $prefix >= 200 && $prefix <= 212 => 'DC',
            $prefix >= 214 && $prefix <= 219 => 'MD',
            $prefix >= 220 && $prefix <= 246 => 'VA',
            $prefix >= 247 && $prefix <= 268 => 'WV',
            $prefix >= 270 && $prefix <= 289 => 'NC',
            $prefix >= 290 && $prefix <= 299 => 'SC',
            $prefix >= 300 && $prefix <= 319 => 'GA',
            $prefix >= 320 && $prefix <= 349 => 'FL',
            $prefix >= 350 && $prefix <= 369 => 'AL',
            $prefix >= 370 && $prefix <= 385 => 'TN',
            $prefix >= 386 && $prefix <= 397 => 'MS',
            $prefix >= 400 && $prefix <= 427 => 'KY',
            $prefix >= 430 && $prefix <= 459 => 'OH',
            $prefix >= 460 && $prefix <= 479 => 'IN',
            $prefix >= 480 && $prefix <= 499 => 'MI',
            $prefix >= 500 && $prefix <= 528 => 'IA',
            $prefix >= 530 && $prefix <= 549 => 'WI',
            $prefix >= 550 && $prefix <= 567 => 'MN',
            $prefix >= 570 && $prefix <= 577 => 'SD',
            $prefix >= 580 && $prefix <= 588 => 'ND',
            $prefix >= 590 && $prefix <= 599 => 'MT',
            $prefix >= 600 && $prefix <= 629 => 'IL',
            $prefix >= 630 && $prefix <= 658 => 'MO',
            $prefix >= 660 && $prefix <= 679 => 'KS',
            $prefix >= 680 && $prefix <= 693 => 'NE',
            $prefix >= 700 && $prefix <= 714 => 'LA',
            $prefix >= 716 && $prefix <= 729 => 'AR',
            $prefix >= 730 && $prefix <= 749 => 'OK',
            $prefix >= 750 && $prefix <= 799 => 'TX',
            $prefix >= 800 && $prefix <= 816 => 'CO',
            $prefix >= 820 && $prefix <= 831 => 'WY',
            $prefix >= 832 && $prefix <= 838 => 'ID',
            $prefix >= 840 && $prefix <= 847 => 'UT',
            $prefix >= 850 && $prefix <= 865 => 'AZ',
            $prefix >= 870 && $prefix <= 884 => 'NM',
            $prefix >= 889 && $prefix <= 898 => 'NV',
            $prefix >= 900 && $prefix <= 961 => 'CA',
            $prefix >= 970 && $prefix <= 979 => 'OR',
            $prefix >= 980 && $prefix <= 994 => 'WA',
            $prefix >= 995 && $prefix <= 999 => 'AK',
            default                          => null,
        };
    }
}
