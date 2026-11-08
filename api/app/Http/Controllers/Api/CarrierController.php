<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrierDocument;
use App\Models\CarrierVerification;
use App\Models\Certification;
use App\Models\Organization;
use App\Models\PersonIdentity;
use App\Models\PersonVerification;
use App\Models\ServiceType;
use App\Models\FreightJob;
use App\Models\User;
use App\Services\PersonChecks;
use App\Services\ServiceTypeRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * The carrier profile page. The company's details (DOT, MC, insurance, payout account) are kept on the
 * carrier company (organizations, carrier_ columns); the person's own details (identity, licences,
 * medical card, checks) in the person tables by user_id. The page sees one set of fields.
 */
class CarrierController extends Controller
{
    /** Fields kept on the carrier company: page field => organizations column */
    private const COMPANY = [
        'auto_policy_number'    => 'carrier_auto_policy_number',
        'auto_insurer_name'     => 'carrier_auto_insurer_name',
        'auto_coverage_amount'  => 'carrier_auto_coverage_amount',
        'auto_effective_date'   => 'carrier_auto_effective_date',
        'auto_expiry_date'      => 'carrier_auto_expiry_date',
        'cargo_policy_number'   => 'carrier_cargo_policy_number',
        'cargo_insurer_name'    => 'carrier_cargo_insurer_name',
        'cargo_coverage_amount' => 'carrier_cargo_coverage_amount',
        'cargo_expiry_date'     => 'carrier_cargo_expiry_date',
    ];

    /** Fields kept on the person's identity record: page field => person_identities column */
    private const IDENTITY = [
        'date_of_birth'         => 'date_of_birth',
        'photo_url'             => 'photo_url',
        'phone'                 => 'phone',
        'phone_country_code'    => 'phone_country_code',
        'whatsapp'              => 'whatsapp',
        'whatsapp_country_code' => 'whatsapp_country_code',
        'street'                => 'street',
        'city'                  => 'city',
        'state'                 => 'state',
        'zip'                   => 'zip',
        'dl_state'              => 'id_issuing_state',
        'dl_expiry'             => 'id_expiry_date',
    ];

    private function carrier(User $user): ?Organization
    {
        return PersonChecks::companyOf($user, 'carrier');
    }

    private static function day($date): ?string
    {
        return $date ? \Carbon\Carbon::parse($date)->toDateString() : null;
    }

    // ── Profile shape ─────────────────────────────────────────────────────────

    private function shape(User $user): array
    {
        $org      = $this->carrier($user);
        $identity = PersonIdentity::where('user_id', $user->id)->first();
        $pv       = PersonVerification::where('user_id', $user->id)->first();
        $cred     = fn (string $type) => PersonChecks::credential($user->id, $type);
        $cdl = $cred('cdl'); $hazmat = $cred('hazmat_endorsement'); $medical = $cred('dot_medical'); $drug = $cred('drug_test');

        $companyCheck = fn (string $type) => $org
            ? CarrierVerification::where('carrier_id', $org->id)->where('check_type', $type)->latest()->first() : null;
        $fmcsa = $companyCheck('fmcsa');
        $mc    = $companyCheck('mc');
        $background = CarrierVerification::where('user_id', $user->id)->where('check_type', 'background')->latest()->first();

        $serviceKeys = $org?->serviceTypes()->pluck('key')->toArray() ?? [];
        $passport    = $identity?->id_type === 'passport';
        $idIsCdl     = (bool) $identity?->id_is_cdl;

        return [
            'name'                    => $user->name,
            'email'                   => $user->email,
            'carrier_type'            => $org?->carrier_type ?? 'sole_proprietor',
            'verification_status'     => $pv?->status ?? 'incomplete',
            'onboarding_fee_paid'     => (bool) $org?->carrier_onboarding_fee_paid,
            'completion_percentage'   => $this->completion($org, $identity, $cdl, $medical, $hazmat),

            // Personal
            'date_of_birth'           => $identity?->date_of_birth?->toDateString(),
            // Never sent back to the browser; stored encrypted
            'ssn_last_4'              => $identity?->ssn_last4 ? '••••' : null,
            'has_ssn_last_4'          => (bool) $identity?->ssn_last4,
            'photo_url'               => $identity?->photo_url,

            // Company (DOT / MC)
            'dot_number'              => $org?->carrier_dot_number ?? '',
            'usdot_number'            => $org?->carrier_dot_number,
            'mc_number'               => $org?->carrier_mc_number ?? '',

            // Licences and endorsements (the person's credentials)
            'cdl_number'              => $cdl?->number,
            'cdl_issuing_state'       => $cdl?->issuing_state,
            'cdl_expiry_date'         => $cdl?->expires_at?->toDateString(),
            'cdl_class'               => $cdl?->class,
            'hazmat_endorsement'      => (bool) $hazmat,
            'hazmat_expiry_date'      => $hazmat?->expires_at?->toDateString(),
            'tanker_endorsement'      => (bool) $cred('tanker_endorsement'),
            'passenger_endorsement'   => (bool) $cred('passenger_endorsement'),
            'doubles_triples_endorsement' => (bool) $cred('doubles_triples_endorsement'),
            'school_bus_endorsement'  => (bool) $cred('school_bus_endorsement'),
            'medical_card_on_file'    => (bool) $medical,

            // Home address and government ID
            'street'                  => $identity?->street ?? '',
            'city'                    => $identity?->city ?? '',
            'state'                   => $identity?->state ?? '',
            'zip'                     => $identity?->zip ?? '',
            'id_type'                 => $passport ? 'passport' : ($idIsCdl ? 'cdl' : 'dl'),
            'id_is_cdl'               => $idIsCdl,
            'identity_status'         => $identity?->status ?? 'not_started',
            'dl_number'               => $passport ? '' : ($identity?->id_number ?? ''),
            'dl_state'                => $identity?->id_issuing_state ?? '',
            'dl_country'              => $identity?->id_issuing_country,
            'dl_expiry'               => $identity?->id_expiry_date?->toDateString() ?? '',

            'dot_verified'            => (bool) $org?->carrier_dot_verified,
            'identity_verified'       => $identity?->status === 'verified',
            'identity_verified_at'    => $identity?->status === 'verified' ? $identity->verified_at?->toISOString() : null,

            // Last DOT/FMCSA and MC checks (company)
            'fmcsa_result'            => $fmcsa?->result_data,
            'fmcsa_checked_at'        => $fmcsa?->updated_at?->toISOString(),
            'fmcsa_expires_at'        => $fmcsa?->expires_at?->toDateString(),
            'mc_verified'             => (bool) $org?->carrier_mc_verified,
            'mc_result'               => $mc?->result_data,
            'mc_checked_at'           => $mc?->updated_at?->toISOString(),
            'mc_expires_at'           => $mc?->expires_at?->toDateString(),

            'company_name'            => $org?->name ?? '',
            'phone'                   => $identity?->phone ?? '',
            'phone_country_code'      => $identity?->phone_country_code ?? 'US',
            'whatsapp'                => $identity?->whatsapp ?? '',
            'whatsapp_country_code'   => $identity?->whatsapp_country_code ?? ($identity?->phone_country_code ?? 'US'),

            // Medical (the person's credentials)
            'medical_examiner_name'   => $medical?->issuer,
            'dot_medical_expiry'      => $medical?->expires_at?->toDateString(),
            'drug_test_date'          => $drug?->issued_at?->toDateString(),
            'drug_test_result'        => $drug?->result,

            // Insurance (company)
            'insurance_verified'      => (bool) $org?->carrier_insurance_verified,
            'background_check_status'       => PersonChecks::backgroundForProfile($pv?->background_check_status),
            'background_check_invitation_url' => $background?->result_data['invitation_url'] ?? null,
            'background_check_completed_at' => $background?->updated_at?->toISOString(),
            'auto_policy_number'      => $org?->carrier_auto_policy_number,
            'auto_insurer_name'       => $org?->carrier_auto_insurer_name,
            'auto_coverage_amount'    => $org?->carrier_auto_coverage_amount,
            'auto_effective_date'     => $org?->carrier_auto_effective_date?->toDateString(),
            'auto_expiry_date'        => $org?->carrier_auto_expiry_date?->toDateString(),
            'cargo_policy_number'     => $org?->carrier_cargo_policy_number,
            'cargo_insurer_name'      => $org?->carrier_cargo_insurer_name,
            'cargo_coverage_amount'   => $org?->carrier_cargo_coverage_amount,
            'cargo_expiry_date'       => $org?->carrier_cargo_expiry_date?->toDateString(),

            // Clearinghouse (the person)
            'clearinghouse_query_status' => $pv?->clearinghouse_query_status ?? 'not_run',
            'clearinghouse_queried_at'   => $pv?->clearinghouse_queried_at?->toISOString(),
            'clearinghouse_completed_at' => $pv?->clearinghouse_completed_at?->toISOString(),

            // Payout account (company)
            'stripe_account_id'       => $org?->stripe_connect_id,
            'stripe_account_status'   => $org?->stripe_connect_id ? ($org->stripe_connect_status ?? 'reviewing') : 'not_connected',

            // Stats (company)
            'rating'                  => $org?->rating ? (float) $org->rating : null,
            'total_ratings'           => $org?->total_ratings ?? 0,
            'total_deliveries'        => $org?->carrier_total_deliveries ?? 0,
            'org_id'                  => $org?->id,
            'can_edit_company'        => $user->canDo('company.profile'),
            'member_since'            => $user->created_at->format('M Y'),

            // Services and certifications (company)
            'service_type_keys'       => $serviceKeys,
            'categories'              => $org?->categories ?? [],
            'certification_keys'      => $org?->certifications()->pluck('key')->toArray() ?? [],
            'required_fields'         => ServiceTypeRules::requiredFields($serviceKeys),
            'relevant_tabs'           => ServiceTypeRules::relevantTabs($serviceKeys),
        ];
    }

    private function completion(?Organization $org, ?PersonIdentity $identity, $cdl, $medical, $hazmat): int
    {
        $items = [
            [(bool) $identity?->photo_url,        10],
            [(bool) $identity?->date_of_birth,    10],
            [(bool) $identity?->ssn_last4,        10],
            [(bool) $cdl?->number,                15],
            [(bool) $org?->carrier_dot_number,    15],
            [(bool) $medical?->expires_at,        15],
            [(bool) $hazmat,                       5],
        ];
        return min(array_sum(array_map(fn ($i) => $i[0] ? $i[1] : 0, $items)), 100);
    }

    // ── GET /api/v1/carrier/kyc-status ──────────────────────────────────────

    public function kycStatus(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isCarrier(), 403);

        $identity = PersonIdentity::where('user_id', $user->id)->first();
        $check = CarrierVerification::where('user_id', $user->id)->where('check_type', 'identity')->latest()->first();
        $verified = $identity?->status === 'verified';
        $adult = $identity?->date_of_birth && $identity->age() >= 18;

        return response()->json(['data' => [
            'identity_verified'    => $verified,
            'identity_verified_at' => $verified ? $identity->verified_at?->toISOString() : null,
            'age_verified'         => (bool) $adult,
            'age_verified_at'      => $adult ? $identity->updated_at?->toISOString() : null,
            'date_of_birth'        => $identity?->date_of_birth?->toDateString(),
            'identity_check'       => $check ? [
                'status'      => $check->status,
                'external_id' => $check->external_id,
                'last_error'  => $check->result_data['last_error'] ?? null,
                'verified_at' => $check->result_data['verified_at'] ?? null,
            ] : null,
        ]]);
    }

    // ── GET /api/v1/carrier/profile ──────────────────────────────────────────

    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        return response()->json(['data' => $this->shape($request->user())]);
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
            'ssn_last_4'          => ['sometimes', 'nullable', 'digits:4'],
            'photo_url'           => ['sometimes', 'nullable', 'string', 'max:255'],

            // Licences
            'cdl_number'            => ['sometimes', 'nullable', 'string', 'max:20'],
            'cdl_issuing_state'     => ['sometimes', 'nullable', 'string', 'max:2'],
            'cdl_expiry_date'       => ['sometimes', 'nullable', 'date'],
            'cdl_class'             => ['sometimes', 'nullable', 'string', 'max:5'],
            'hazmat_endorsement'    => ['sometimes', 'boolean'],
            'hazmat_expiry_date'    => ['sometimes', 'nullable', 'date'],
            'tanker_endorsement'    => ['sometimes', 'boolean'],
            'passenger_endorsement' => ['sometimes', 'boolean'],
            'doubles_triples_endorsement' => ['sometimes', 'boolean'],
            'school_bus_endorsement' => ['sometimes', 'boolean'],

            // Company
            'usdot_number'          => ['sometimes', 'nullable', 'string', 'max:20'],
            'dot_number'            => ['sometimes', 'nullable', 'string', 'max:20'],
            'mc_number'             => ['sometimes', 'nullable', 'string', 'max:30'],
            'company_name'          => ['sometimes', 'nullable', 'string', 'max:200'],

            // Contact and home address
            'phone'                 => ['sometimes', 'nullable', 'string', 'max:40'],
            'phone_country_code'    => ['sometimes', 'nullable', 'string', 'size:2'],
            'whatsapp'              => ['sometimes', 'nullable', 'string', 'max:40'],
            'whatsapp_country_code' => ['sometimes', 'nullable', 'string', 'size:2'],
            'street'                => ['sometimes', 'nullable', 'string', 'max:255'],
            'city'                  => ['sometimes', 'nullable', 'string', 'max:100'],
            'state'                 => ['sometimes', 'nullable', 'string', 'max:2'],
            'zip'                   => ['sometimes', 'nullable', 'string', 'max:10'],
            'id_type'               => ['sometimes', 'nullable', 'string', 'in:dl,passport,cdl'],
            'dl_number'             => ['sometimes', 'nullable', 'string', 'max:30'],
            'dl_state'              => ['sometimes', 'nullable', 'string', 'max:2'],
            'dl_expiry'             => ['sometimes', 'nullable', 'date'],

            // Insurance (company)
            'auto_policy_number'   => ['sometimes', 'nullable', 'string', 'max:255'],
            'auto_insurer_name'    => ['sometimes', 'nullable', 'string', 'max:255'],
            'auto_coverage_amount' => ['sometimes', 'nullable', 'numeric'],
            'auto_effective_date'  => ['sometimes', 'nullable', 'date'],
            'auto_expiry_date'     => ['sometimes', 'nullable', 'date'],
            'cargo_policy_number'  => ['sometimes', 'nullable', 'string', 'max:255'],
            'cargo_insurer_name'   => ['sometimes', 'nullable', 'string', 'max:255'],
            'cargo_coverage_amount'=> ['sometimes', 'nullable', 'numeric'],
            'cargo_expiry_date'    => ['sometimes', 'nullable', 'date'],

            // Medical
            'medical_examiner_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'dot_medical_expiry'    => ['sometimes', 'nullable', 'date'],
            'drug_test_date'        => ['sometimes', 'nullable', 'date'],
            'drug_test_result'      => ['sometimes', 'nullable', 'string', 'max:20'],

            // Services (company)
            'service_type_keys'     => ['sometimes', 'array'],
            'service_type_keys.*'   => ['string'],
        ]);
        $has = fn (string $k) => array_key_exists($k, $validated);

        if (!empty($validated['date_of_birth']) && \Carbon\Carbon::parse($validated['date_of_birth'])->age < 18) {
            return response()->json([
                'message' => 'You must be 18 or older.',
                'errors'  => ['date_of_birth' => ['You must be 18 or older.']],
            ], 422);
        }

        $org = $this->carrier($user);

        // ── The company: owner or staff only ──
        $company = [];
        foreach (self::COMPANY as $field => $col) {
            if ($has($field)) $company[$col] = $validated[$field];
        }
        if ($has('usdot_number') || $has('dot_number')) {
            $company['carrier_dot_number'] = Organization::digits($validated['usdot_number'] ?? $validated['dot_number'] ?? null);
        }
        if ($has('mc_number')) $company['carrier_mc_number'] = Organization::digits($validated['mc_number']);
        if ($has('company_name') && trim((string) $validated['company_name']) !== '') {
            $company['name'] = $company['legal_name'] = trim($validated['company_name']);
        }
        $changed = $org ? array_filter($company, fn ($v, $col) => (string) $org->{$col} !== (string) $v, ARRAY_FILTER_USE_BOTH) : $company;
        $serviceChange = $has('service_type_keys');

        // Only the owner or staff change the company; drivers and dispatchers save just their own details
        if ($org && $user->canDo('company.profile') && ($changed || $serviceChange)) {
            if ($changed) $org->update($changed);
            if ($serviceChange) {
                $org->serviceTypes()->sync(ServiceType::whereIn('key', $validated['service_type_keys'])->pluck('id'));
            }
        }

        DB::transaction(function () use ($user, $validated, $has) {
            // ── The person's login ──
            $userFields = array_intersect_key($validated, array_flip(['name', 'email']));
            if ($userFields) $user->update($userFields);

            // ── The person's identity record ──
            $identity = PersonChecks::identity($user);
            foreach (self::IDENTITY as $field => $col) {
                if ($has($field)) $identity->{$col} = $validated[$field];
            }
            if ($has('name')) $identity->fill(PersonChecks::splitName($validated['name']));
            if (!empty($validated['ssn_last_4'])) $identity->ssn_last4 = $validated['ssn_last_4'];
            if ($has('id_type')) {
                $identity->id_type = $validated['id_type'] === 'passport' ? 'passport' : 'driver_license';
                // A CDL is a driver licence: the ID is the CDL, entered once under Driving credentials
                $identity->id_is_cdl = $validated['id_type'] === 'cdl';
            }
            if ($has('dl_number')) {
                $identity->id_number = $validated['dl_number'] ?: null;
                if ($validated['dl_number'] && !$identity->id_type) $identity->id_type = 'driver_license';
            }
            if ($has('phone') || $has('phone_country_code')) {
                $cc = strtoupper($identity->phone_country_code ?: 'US');
                $identity->phone_country_code = $cc;
                $identity->phone_e164 = null;
                if ($identity->phone) {
                    try {
                        $identity->phone_e164 = app(\App\Services\SmsOtpService::class)->normalizeE164((string) $identity->phone, $cc);
                    } catch (\Throwable) {}
                }
            }
            if ($identity->whatsapp_country_code) $identity->whatsapp_country_code = strtoupper($identity->whatsapp_country_code);
            $identity->save();

            // ── The person's licences, endorsements and medical card ──
            $cred = function (string $type, array $map, callable $present) use ($user, $validated) {
                $given = array_intersect_key($validated, $map);
                if (!$given) return;
                $current = PersonChecks::credential($user->id, $type);
                $fields = [];
                foreach ($map as $field => $col) {
                    if ($col === null) continue;
                    $fields[$col] = array_key_exists($field, $validated) ? $validated[$field] : $current?->{$col};
                }
                PersonChecks::setCredential($user->id, $type, $present($validated, $current), $fields);
            };
            $cred('cdl', ['cdl_number' => 'number', 'cdl_issuing_state' => 'issuing_state', 'cdl_class' => 'class', 'cdl_expiry_date' => 'expires_at'],
                fn ($v, $c) => (bool) (array_key_exists('cdl_number', $v) ? $v['cdl_number'] : $c?->number));
            $cred('hazmat_endorsement', ['hazmat_endorsement' => null, 'hazmat_expiry_date' => 'expires_at'],
                fn ($v, $c) => array_key_exists('hazmat_endorsement', $v) ? (bool) $v['hazmat_endorsement'] : (bool) $c);
            $cred('tanker_endorsement', ['tanker_endorsement' => null], fn ($v) => (bool) $v['tanker_endorsement']);
            $cred('passenger_endorsement', ['passenger_endorsement' => null], fn ($v) => (bool) $v['passenger_endorsement']);
            $cred('doubles_triples_endorsement', ['doubles_triples_endorsement' => null], fn ($v) => (bool) $v['doubles_triples_endorsement']);
            $cred('school_bus_endorsement', ['school_bus_endorsement' => null], fn ($v) => (bool) $v['school_bus_endorsement']);
            $cred('dot_medical', ['medical_examiner_name' => 'issuer', 'dot_medical_expiry' => 'expires_at'],
                fn ($v, $c) => (bool) (($v['dot_medical_expiry'] ?? $c?->expires_at) || ($v['medical_examiner_name'] ?? $c?->issuer)));
            $cred('drug_test', ['drug_test_date' => 'issued_at', 'drug_test_result' => 'result'],
                fn ($v, $c) => (bool) (array_key_exists('drug_test_date', $v) ? $v['drug_test_date'] : $c?->issued_at));
        });

        // ID is the CDL: copy its number, state and expiry onto the government ID
        $identity = PersonIdentity::where('user_id', $user->id)->first();
        if ($identity?->id_is_cdl && ($cdl = PersonChecks::credential($user->id, 'cdl'))) {
            $identity->forceFill([
                'id_type' => 'driver_license', 'id_number' => $cdl->number,
                'id_issuing_state' => $cdl->issuing_state, 'id_expiry_date' => $cdl->expires_at,
            ])->save();
        }

        PersonChecks::refresh($user->fresh());

        return response()->json(['data' => $this->shape($user->fresh())]);
    }

    // ── GET /api/v1/carrier/earnings ────────────────────────────────────────

    public function earnings(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $user      = $request->user();
        $shipments = FreightJob::where('carrier_id', $user->current_org_id)
            ->whereIn('status', ['posted', 'in_progress', 'completed'])
            ->with('stops')->latest()->get();

        $delivered     = $shipments->where('status', 'completed');
        $pendingEscrow = $shipments->whereIn('status', ['posted', 'in_progress']);
        $totalPaid     = $delivered->sum(fn ($j) => $j->amount() ?? 0);
        $pendingAmount = $pendingEscrow->sum(fn ($j) => $j->amount() ?? 0);

        return response()->json([
            'data' => [
                'total_paid'     => (float) $totalPaid,
                'pending_escrow' => (float) $pendingAmount,
                'shipments'      => $shipments->map(fn ($s) => [
                    'id'             => $s->id,
                    'status'         => $s->displayStatus(),
                    'amount'         => (float) ($s->amount() ?? 0),
                    'route'          => $s->routeLabel(),
                    'distance_miles' => (float) $s->route_distance_miles,
                    'delivered_at'   => $s->completed_at?->toISOString(),
                ])->values(),
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

        $org = $this->carrier($request->user());

        if (!$org?->stripe_connect_id || $org->stripe_connect_status !== 'verified') {
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

        $org = $this->carrier($request->user());
        if (!$org) return response()->json(['data' => []]);

        return response()->json([
            'data' => $org->carrierDocuments()
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

        $org = $this->carrier($request->user());
        abort_unless($org, 422, 'You are not part of a carrier company.');
        if (!empty($validated['vehicle_id'])) {
            abort_unless($org->vehicles()->whereKey($validated['vehicle_id'])->exists(), 422, 'That vehicle is not on your company.');
        }

        $file = $request->file('document');
        $path = $file->storeAs(
            "carrier-docs/org-{$org->id}",
            time() . '_' . $file->getClientOriginalName(),
            'r2'
        );

        $doc = CarrierDocument::create([
            'carrier_id'         => $org->id,
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

        $org = $this->carrier($request->user());
        if (!$org) return response()->json(['data' => []]);

        return response()->json([
            'data' => $org->vehicles()
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
                    'unit_number'          => $v->unit_number,
                    'vehicle_class'        => $v->vehicle_class,
                    'equipment_type'       => $v->equipment_type,
                    'temp_min_f'           => $v->temp_min_f,
                    'temp_max_f'           => $v->temp_max_f,
                    'trailer_length_ft'    => $v->trailer_length_ft,
                    'status'               => $v->status,
                    'capabilities'         => $v->capabilityKeys(),
                    'owner_org_id'         => $v->owner_org_id,
                    'owner_user_id'        => $v->owner_user_id,
                    'owner_name'           => $v->owner_user_id ? $v->ownerUser?->name : $v->ownerOrg?->name,
                    'operating_authority_id' => $v->operating_authority_id,
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
        ] + self::vehicleExtraRules());

        $org = $this->carrier($request->user());
        abort_unless($org, 422, 'You are not part of a carrier company.');

        // If setting as primary, demote all others
        if (!empty($validated['is_primary'])) {
            $org->vehicles()->update(['is_primary' => false]);
        }

        // First vehicle is always primary
        if ($org->vehicles()->count() === 0) {
            $validated['is_primary'] = true;
        }

        $caps = $validated['capabilities'] ?? null;
        unset($validated['capabilities']);
        $validated = $this->vehicleOwnership($org, $validated, true);
        $vehicle = $org->vehicles()->create($validated);
        $vehicle->syncCapabilities($caps ?? (!empty($validated['liftgate']) ? ['liftgate'] : []));

        return response()->json(['data' => $vehicle], 201);
    }

    // ── PUT /api/v1/carrier/vehicles/{id} ───────────────────────────────────

    public function updateVehicle(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $org = $this->carrier($request->user());
        abort_unless($org, 404);
        $vehicle = $org->vehicles()->findOrFail($id);

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
        ] + self::vehicleExtraRules());

        if (!empty($validated['is_primary'])) {
            $org->vehicles()->update(['is_primary' => false]);
        }

        $caps = $validated['capabilities'] ?? null;
        unset($validated['capabilities']);
        $validated = $this->vehicleOwnership($org, $validated, false);
        $vehicle->update($validated);
        if ($caps !== null) $vehicle->syncCapabilities($caps);
        elseif (array_key_exists('liftgate', $validated)) {
            $keys = array_values(array_diff($vehicle->capabilityKeys(), ['liftgate']));
            if ($validated['liftgate']) $keys[] = 'liftgate';
            $vehicle->syncCapabilities($keys);
        }

        return response()->json(['data' => $vehicle]);
    }

    /** Fields beyond the original form: equipment, features, temperature, owner vs operator */
    private static function vehicleExtraRules(): array
    {
        return [
            'unit_number'            => ['sometimes', 'nullable', 'string', 'max:40'],
            'vehicle_class'          => ['sometimes', 'nullable', 'in:tractor,trailer,straight_truck,van,pickup'],
            'equipment_type'         => ['sometimes', 'nullable', \Illuminate\Validation\Rule::in(\App\Models\Capability::keys('equipment'))],
            'temp_min_f'             => ['sometimes', 'nullable', 'integer', 'min:-40', 'max:120'],
            'temp_max_f'             => ['sometimes', 'nullable', 'integer', 'min:-40', 'max:120'],
            'trailer_length_ft'      => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:80'],
            'status'                 => ['sometimes', 'in:active,out_of_service,sold'],
            'capabilities'           => ['sometimes', 'array'],
            'capabilities.*'         => [\Illuminate\Validation\Rule::in(\App\Models\Capability::keys('feature'))],
            'owner'                  => ['sometimes', 'in:company,driver,other_company'],
            'owner_user_id'          => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'owner_org_id'           => ['sometimes', 'nullable', 'integer', 'exists:organizations,id'],
            'operating_authority_id' => ['sometimes', 'nullable', 'integer', 'exists:operating_authorities,id'],
        ];
    }

    /**
     * Who owns the vehicle vs who operates it. The carrier always operates it (under one of its authorities);
     * the owner is the company, one of its people (an owner-operator leased on), or another company.
     */
    private function vehicleOwnership(Organization $org, array $v, bool $creating): array
    {
        $owner = $v['owner'] ?? null;
        unset($v['owner']);
        if ($owner === 'company' || ($creating && !$owner && empty($v['owner_user_id']) && empty($v['owner_org_id']))) {
            $v['owner_org_id'] = $org->id;
            $v['owner_user_id'] = null;
        } elseif ($owner === 'driver' || (!$owner && !empty($v['owner_user_id']))) {
            abort_unless(!empty($v['owner_user_id']) && \Illuminate\Support\Facades\DB::table('org_members')->where('org_id', $org->id)->where('user_id', $v['owner_user_id'])->exists(),
                422, 'The owner must be a person in your company.');
            $v['owner_org_id'] = null;
        } elseif ($owner === 'other_company' || (!$owner && !empty($v['owner_org_id']))) {
            abort_unless(!empty($v['owner_org_id']), 422, 'Choose the company that owns it.');
            $v['owner_user_id'] = null;
        }
        if (array_key_exists('operating_authority_id', $v) && $v['operating_authority_id']) {
            abort_unless($org->authorities()->where('id', $v['operating_authority_id'])->where('kind', 'carrier')->exists(), 422, 'That authority is not yours.');
        } elseif ($creating) {
            $v['operating_authority_id'] = $org->primaryAuthority('carrier')?->id;
        }
        if (isset($v['temp_min_f'], $v['temp_max_f']) && $v['temp_min_f'] > $v['temp_max_f']) {
            abort(422, 'The lowest temperature must be below the highest.');
        }
        return $v;
    }

    // ── DELETE /api/v1/carrier/vehicles/{id} ────────────────────────────────

    public function deleteVehicle(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $org = $this->carrier($request->user());
        abort_unless($org, 404);
        $vehicle = $org->vehicles()->findOrFail($id);
        $wasPrimary = $vehicle->is_primary;
        $vehicle->delete();

        // Promote next vehicle to primary if we deleted the primary
        if ($wasPrimary) {
            $org->vehicles()->oldest()->first()?->update(['is_primary' => true]);
        }

        return response()->json(['message' => 'Vehicle deleted']);
    }

    // ── GET /api/v1/carriers ────────────────────────────────────────────────
    // One row per carrier company. Supports: ?zip= ?distance_miles= ?verified= ?service_types[]= ?dot= ?sort=

    public function index(Request $request): JsonResponse
    {
        $query = Organization::where('type', 'carrier')->with('serviceTypes', 'owner');

        // Exact DOT lookup (for add-carrier modal)
        if ($dot = $request->query('dot')) {
            $query->where('carrier_dot_number', Organization::digits($dot));
        }

        // Approved companies only
        if ($request->query('verified')) {
            $query->where('verification_status', 'approved');
        }

        if ($serviceTypes = $request->query('service_types')) {
            $keys = is_array($serviceTypes) ? $serviceTypes : explode(',', $serviceTypes);
            $query->whereHas('serviceTypes', fn ($q) => $q->whereIn('key', $keys));
        }

        // ZIP + distance: the company's address, or its owner's home address for owner-operators
        if ($zip = $request->query('zip')) {
            $distance = (int) ($request->query('distance_miles', 50));
            $ownerHome = fn (string $col, string $op, string $value) => fn ($q) => $q->whereExists(fn ($e) => $e
                ->from('person_identities')->whereColumn('person_identities.user_id', 'organizations.owner_id')->where($col, $op, $value));

            if ($distance <= 25) {
                // Tight radius — match first 3 digits of ZIP (same metro)
                $prefix = substr(preg_replace('/\D/', '', $zip), 0, 3);
                $query->where(fn ($q) => $q->where('zip', 'like', $prefix . '%')->orWhere($ownerHome('person_identities.zip', 'like', $prefix . '%')));
            } elseif ($state = $this->zipToState($zip)) {
                // Broad radius — match by state derived from ZIP prefix
                $query->where(fn ($q) => $q->where('state', $state)->orWhere($ownerHome('person_identities.state', '=', $state)));
            }
        }

        match ($request->query('sort', 'rating')) {
            'deliveries' => $query->orderByDesc('carrier_total_deliveries'),
            'newest'     => $query->orderByDesc('created_at'),
            'oldest'     => $query->orderBy('created_at'),
            default      => $query->orderByRaw('rating DESC NULLS LAST'),
        };

        $carriers = $query->get();
        $homes = PersonIdentity::whereIn('user_id', $carriers->pluck('owner_id')->filter())->get()->keyBy('user_id');

        return response()->json([
            'data' => $carriers->map(function (Organization $org) use ($homes) {
                $owner = $org->owner;
                $home  = $homes->get($org->owner_id);
                $parts = explode(' ', (string) ($owner?->name ?? $org->name));
                $avatar = strtoupper(substr($parts[0], 0, 1) . (isset($parts[1]) ? substr($parts[1], 0, 1) : ''));

                return [
                    'id'                   => $owner?->id,       // the owner (who the shipper deals with)
                    'org_id'               => $org->id,          // the carrier company
                    'name'                 => $owner?->name ?? $org->name,
                    'email'                => $org->email ?: $owner?->email,
                    'company_name'         => $org->name,
                    'dot_number'           => $org->carrier_dot_number ?? '',
                    'mc_number'            => $org->carrier_mc_number ?? '',
                    'phone'                => $org->phone ?: ($home?->phone ?? ''),
                    'verification_status'  => $org->verification_status ?? 'incomplete',
                    'dot_verified'         => (bool) $org->carrier_dot_verified,
                    'insurance_verified'   => (bool) $org->carrier_insurance_verified,
                    'rating'               => (float) ($org->rating ?? 0),
                    'total_deliveries'     => $org->carrier_total_deliveries ?? 0,
                    'member_since'         => $org->created_at->format('M Y'),
                    'avatar'               => $avatar,
                    'city'                 => $org->city ?: ($home?->city ?? ''),
                    'state'                => $org->state ?: ($home?->state ?? ''),
                    'zip'                  => $org->zip ?: ($home?->zip ?? ''),
                    'service_types'        => $org->serviceTypes->map(fn ($t) => [
                        'key'  => $t->key,
                        'name' => $t->name,
                        'icon' => $t->icon,
                    ])->values()->toArray(),
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
