<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\FreightJob;
use App\Models\User;
use App\Services\PersonChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Admin views of carrier and shipper companies (organizations) and their members.
 *
 * Company and person are approved separately, and each needs a clear background check first.
 * Company details are columns on the organization (shipper_ and carrier_ columns for each type).
 */
class AdminCompanyController extends Controller
{
    /** Background results that count as passed */
    public const BACKGROUND_PASSED = ['clear', 'approved', 'passed'];

    // GET /api/v1/admin/companies?type=all|carrier|shipper&status=...&q=...
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $data = $request->validate([
            'type'   => ['nullable', 'in:all,carrier,shipper,factor,receiver,broker'],
            // companies = Shipmater's own customers (Companies page); all = every org (Organizations page)
            'scope'  => ['nullable', 'in:companies,all'],
            'status' => ['nullable', 'string'],
            'q'      => ['nullable', 'string', 'max:100'],
            'limit'  => ['nullable', 'integer', 'min:1', 'max:500'],
        ]);

        // Companies are Shipmater's own customers: shippers, brokers, carriers and factors that signed up.
        // Receivers, and brokers or anything else a customer only listed, are in Organizations (/admin/orgs).
        $all   = ($data['scope'] ?? 'companies') === 'all';
        $own   = ['shipper', 'broker', 'carrier', 'factor'];
        $types = ($data['type'] ?? 'all') === 'all' ? ($all ? Organization::TYPES : $own) : [$data['type']];
        if (!$all && !in_array($types[0], $own, true)) {
            return response()->json(['message' => 'Receivers are in Organizations.'], 422);
        }
        $query = Organization::whereIn('type', $types)
            ->when(!$all, fn ($w) => $w->where('status', '!=', 'listed')->whereNotNull('owner_id'))
            ->withCount(['orgMembers', 'locations', 'contacts'])
            ->with(['owner'])
            ->latest();

        if (!empty($data['status']) && $data['status'] !== 'all') {
            $query->where('verification_status', $data['status']);
        }
        if (!empty($data['q'])) {
            // Name, MC, DOT or EIN
            $q = $data['q'];
            $query->where(fn ($w) => $w->where('name', 'ilike', "%{$q}%")
                ->orWhere('carrier_mc_number', 'ilike', "%{$q}%")
                ->orWhere('carrier_dot_number', 'ilike', "%{$q}%")
                ->orWhere('tax_id', 'ilike', "%{$q}%"));
        }

        $orgs = $query->limit($data['limit'] ?? 500)->get();
        $promos = DB::table('compliance_promotions')->pluck('name', 'id');

        return response()->json([
            'data' => $orgs->map(function (Organization $o) use ($promos) {
                $carrier = $o->type === 'carrier';
                return [
                    'id'                      => $o->id,
                    'name'                    => $o->name,
                    'type'                    => $o->type,
                    'members'                 => $o->org_members_count,
                    'owner'                   => $o->owner?->only(['id', 'name', 'email']),
                    'dot_number'              => $carrier ? $o->carrier_dot_number : null,
                    'mc_number'               => $carrier ? $o->carrier_mc_number : null,
                    'ein'                     => $carrier ? null : $o->tax_id,
                    'verification_status'     => $o->verification_status,
                    'background_check_status' => $o->background_check_status,
                    'status'                  => $o->status,
                    'city'                    => $o->city,
                    'state'                   => $o->state,
                    'locations'               => $o->locations_count,
                    'contacts'                => $o->contacts_count,
                    'third_party'             => $o->status === 'listed' || !$o->owner_id,
                    'joined_promotion'        => $o->joined_promotion_id ? ($promos[$o->joined_promotion_id] ?? null) : null,
                    'created_at'              => $o->created_at?->toISOString(),
                ];
            }),
        ]);
    }

    // GET /api/v1/admin/companies/{org}
    public function show(Request $request, Organization $org): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $org->load(['owner', 'orgMembers.user.personVerification']);
        $isCarrier = $org->type === 'carrier';
        // Receivers and brokers have the same record as a shipper; only their loads are found through their locations
        $isListing = in_array($org->type, ['receiver', 'broker'], true);

        // Loads hold the company directly; a receiver's loads are the ones with a stop at its locations
        $partyColumn = $isCarrier ? 'carrier_id' : 'shipper_id';
        $shipments   = $isListing
            ? FreightJob::whereIn('id', \App\Models\JobStop::whereIn('location_id', $org->locations()->select('id'))->select('freight_job_id'))->where('status', '!=', 'draft')
            : FreightJob::where($partyColumn, $org->id)->where('status', '!=', 'draft');

        return response()->json([
            'data' => [
                'company' => [
                    'id'         => $org->id,
                    'name'       => $org->name,
                    'org_name'   => $org->name,
                    'type'       => $org->type,
                    'status'     => $org->status,
                    'plan'       => $org->plan,
                    'phone'      => $org->phone,
                    'email'      => $org->email,
                    'website'    => $org->website,
                    'created_at' => $org->created_at?->toISOString(),
                    'owner'      => $org->owner?->only(['id', 'name', 'email']),
                    'address'    => collect([$org->street, $org->city, $org->state, $org->zip])->filter()->implode(', ') ?: null,
                    'tax_id'     => $isCarrier ? null : $org->tax_id,
                    'stripe_mode'     => $org->stripe_mode,
                    'commission_rate' => $org->commission_rate,
                    // Joined during an open season (relaxed checks)
                    'joined_promotion' => $org->joined_promotion_id ? DB::table('compliance_promotions')->where('id', $org->joined_promotion_id)->value('name') : null,
                ],
                'company_profile' => $this->companyFields($org, $isCarrier),
                // Locations, contacts, listing and claims (every type)
                'directory' => app(\App\Services\OrgDirectory::class)->detail($org, $request->user()),
                'verification' => [
                    'status'               => $org->verification_status,
                    'notes'                => $org->verification_notes,
                    'updated_at'           => $org->verification_updated_at?->toISOString(),
                    'updated_by'           => $org->verification_updated_by ? DB::table('users')->where('id', $org->verification_updated_by)->value('name') : null,
                    'background_status'    => $org->background_check_status,
                    'background_reference' => $org->background_check_reference,
                    'background_notes'     => $org->background_check_notes,
                    'background_checked_at'=> $org->background_checked_at?->toISOString(),
                ],
                'documents' => ($isCarrier
                    ? DB::table('carrier_documents')->where('carrier_id', $org->id)->orderByDesc('created_at')
                        ->get(['id', 'type', 'name', 'url', 'expiry_date', 'verified_at', 'created_at'])
                    : DB::table('shipper_documents')->where('shipper_id', $org->id)->orderByDesc('created_at')
                        ->get(['id', 'type', 'name', 'url', 'verified_at', 'created_at'])
                        ->map(fn ($d) => tap($d, fn ($d) => $d->url = \App\Models\ShipperDocument::fileUrl($d->url)))),
                'members' => $org->orgMembers->filter(fn ($m) => $m->user)->map(function ($m) use ($org) {
                    $role      = $m->user_id === $org->owner_id ? 'owner' : $m->role;
                    $checklist = PersonChecks::checklist($m->user, ['org' => $org, 'type' => $org->type, 'role' => $role]);
                    return [
                        'user_id'           => $m->user_id,
                        'name'              => $m->user->name,
                        'email'             => $m->user->email,
                        'role'              => $role,
                        'membership'        => $m->status,
                        'joined_at'         => $m->joined_at,
                        'account_status'    => $m->user->status ?? 'active',
                        'approval_required' => $checklist['approval_required'],
                        'person_status'     => $checklist['approval_required'] ? ($m->user->personVerification?->status ?? 'incomplete') : 'not_required',
                        'required_met'      => $checklist['required_met'],
                        'required_total'    => $checklist['required_total'],
                    ];
                })->values(),
                'activity' => [
                    'shipments' => (clone $shipments)->count(),
                    'active'    => (clone $shipments)->whereIn('status', ['posted', 'in_progress'])->whereNotNull('carrier_id')->count(),
                    'delivered' => (clone $shipments)->where('status', 'completed')->count(),
                    'value'     => (float) (clone $shipments)->where('status', 'completed')->sum('payment_amount_cents') / 100,
                    'bids'      => $isCarrier ? DB::table('freight_job_offers')->where('carrier_id', $org->id)->count() : null,
                ],
                'tabs' => $this->tabs($org, $isCarrier),
                // What is checked before approval, and where each item stands
                'checklist' => $this->approvalChecklist($org, $isCarrier),
                // What this type must or may have on file (Compliance tab)
                'compliance' => \App\Support\ComplianceRules::items($org),
                'recent_shipments' => (clone $shipments)->with('stops')->latest()->limit(10)->get()
                    ->map(fn (FreightJob $j) => [
                        'id'          => $j->id,
                        'item'        => $j->title ?: "Load #{$j->id}",
                        'status'      => $j->displayStatus(),
                        'route'       => $j->routeLabel(),
                        'agreed_cost' => $j->amount(),
                        'created_at'  => $j->created_at?->toISOString(),
                    ]),
            ],
        ]);
    }

    // POST /api/v1/admin/companies/{org}/review   { action: approve|reject, notes? }
    public function review(Request $request, Organization $org): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $data = $request->validate([
            'action' => ['required', 'in:approve,reject'],
            'notes'  => ['nullable', 'string', 'max:1000'],
        ]);

        // Every check the policy (Admin Console, Compliance) marks required must have passed
        if ($data['action'] === 'approve') {
            $blocking = $this->blockingChecks($org);
            if ($blocking) {
                $code = count($blocking) === 1 && $blocking[0]['key'] === 'background' ? 'background_not_clear'
                    : (count($blocking) === 1 && $blocking[0]['key'] === 'owner_approved' ? 'owner_not_approved' : 'checks_not_passed');
                return response()->json([
                    'error'    => 'These required checks have not passed yet: ' . implode(', ', array_column($blocking, 'label')) . '.',
                    'code'     => $code,
                    'blocking' => array_column($blocking, 'key'),
                ], 422);
            }
        }

        $this->setDecision($org, $data['action'] === 'approve', $data['notes'] ?? null, $request->user()->id);
        return response()->json(['message' => "Company {$org->verification_status}.", 'status' => $org->verification_status]);
    }

    /** Required checks that have not passed */
    public function blockingChecks(Organization $org): array
    {
        $org->loadMissing(['owner', 'orgMembers.user.personVerification']);
        return array_values(array_filter($this->approvalChecklist($org, $org->type === 'carrier'),
            fn ($r) => $r['required'] && $r['state'] !== 'passed'));
    }

    /**
     * Automatic approval: when the type is set to approve automatically and every required check has passed.
     * Called after anything that can complete a check (compliance file verified, background recorded, ...).
     */
    public static function autoApprove(Organization $org): bool
    {
        if (in_array($org->verification_status, ['approved', 'rejected'], true)) return false;
        if (\App\Services\VerificationPolicy::approvalMode($org->type) !== 'auto' || !$org->owner_id) return false;
        $self = app(self::class);
        if ($self->blockingChecks($org)) return false;
        $self->setDecision($org, true, 'Approved automatically: all required checks passed.', null);
        return true;
    }

    private function setDecision(Organization $org, bool $approved, ?string $notes, ?int $by): void
    {
        $org->update(array_merge([
            'verification_status'     => $approved ? 'approved' : 'rejected',
            'verification_notes'      => $notes,
            'verification_updated_at' => now(),
            'verification_updated_by' => $by,
        ], $org->type === 'shipper' ? [
            // The shipper's business verification shown on their own screens
            'shipper_verification_status' => $approved ? 'verified' : 'incomplete',
            'shipper_ein_verified_at'     => $approved ? now() : null,
        ] : []));
    }

    // POST /api/v1/admin/companies/{org}/background   { result, reference?, notes? }
    // Records the outcome of a company background check run outside the platform.
    public function recordBackground(Request $request, Organization $org): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $data = $request->validate([
            'result'    => ['required', 'in:pending,clear,consider,failed'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes'     => ['nullable', 'string', 'max:1000'],
        ]);

        $org->update([
            'background_check_status'    => $data['result'],
            'background_check_reference' => $data['reference'] ?? null,
            'background_check_notes'     => $data['notes'] ?? null,
            'background_checked_at'      => now(),
        ]);

        self::autoApprove($org->fresh());
        return response()->json(['message' => 'Background check recorded.', 'status' => $org->background_check_status]);
    }

    /**
     * Everything checked before a shipper or carrier is approved, with its state:
     * passed, pending (waiting on someone), missing (not provided), failed or expired.
     * required = blocks approval or working on the platform; the rest is recorded for the review.
     */
    public function approvalChecklist(Organization $o, bool $isCarrier): array
    {
        $rows = [];
        $add = function (string $key, string $group, string $label, bool $required, string $state, ?string $detail = null) use (&$rows) {
            $rows[] = compact('key', 'group', 'label', 'required', 'state', 'detail');
        };
        $date = fn ($d) => $d ? \Illuminate\Support\Carbon::parse($d)->toFormattedDateString() : null;
        $type = $o->type;
        $bg = $o->background_check_status ?? 'not_started';
        $bgState = in_array($bg, self::BACKGROUND_PASSED, true) ? 'passed' : (in_array($bg, ['failed', 'consider'], true) ? 'failed' : ($bg === 'pending' ? 'pending' : 'missing'));
        $owner = $o->owner;

        if ($owner) {
            $add('owner_email', 'Account', 'Owner email verified', true, $owner->email_verified_at ? 'passed' : 'pending',
                $owner->email_verified_at ? $date($owner->email_verified_at) : 'Waiting for the owner to enter the code');
        }

        // Business details everyone but carriers and receivers gives
        if (in_array($type, ['shipper', 'factor', 'broker'], true)) {
            $add('address', 'Business', 'Registered address', true, $o->street && $o->city && $o->state && $o->zip ? 'passed' : 'missing',
                collect([$o->street, $o->city, $o->state, $o->zip])->filter()->implode(', ') ?: null);
        }
        if ($type === 'shipper') {
            $add('phone_verified', 'Business', 'Business phone verified', false, $o->shipper_phone_verified_at ? 'passed' : ($o->phone ? 'pending' : 'missing'),
                $o->shipper_phone_verified_at ? $date($o->shipper_phone_verified_at) : ($o->phone ?: 'No phone'));
            $add('submitted', 'Business', 'Submitted for review', false, $o->verification_submitted_at ? 'passed' : 'pending',
                $o->verification_submitted_at ? $date($o->verification_submitted_at) : 'Not submitted yet');
        }

        // Compliance items for this type (same list as the Compliance tab)
        foreach (\App\Support\ComplianceRules::items($o, false) as $i) {
            $add($i['key'], $i['section'], $i['label'], $i['required'], $i['state'], $i['detail'] ?? $i['value']);
        }

        if (in_array($type, ['carrier', 'shipper'], true)) {
            $docs = $isCarrier ? DB::table('carrier_documents')->where('carrier_id', $o->id) : DB::table('shipper_documents')->where('shipper_id', $o->id);
            $total = (clone $docs)->count(); $verified = (clone $docs)->whereNotNull('verified_at')->count();
            $add('documents', 'Documents', $isCarrier ? 'Documents reviewed' : 'Business documents', false, $total === 0 ? 'missing' : ($verified === $total ? 'passed' : 'pending'), "{$verified} of {$total} verified");
        }

        if ($isCarrier) {
            $ownerStatus = $owner?->personVerification?->status ?? 'incomplete';
            $add('owner_approved', 'People', 'Owner approved (identity and background)', true,
                $ownerStatus === 'approved' ? 'passed' : ($ownerStatus === 'rejected' ? 'failed' : 'pending'), ucfirst(str_replace('_', ' ', $ownerStatus)));
            $drivers = $o->orgMembers->filter(fn ($m) => $m->role === 'driver' && $m->user);
            $okDrivers = $drivers->filter(fn ($m) => $m->user->personVerification?->status === 'approved')->count();
            $add('drivers_approved', 'People', 'Drivers approved', false, $drivers->isEmpty() ? 'missing' : ($okDrivers === $drivers->count() ? 'passed' : 'pending'),
                $drivers->isEmpty() ? 'No drivers yet' : "{$okDrivers} of {$drivers->count()} approved");
            $add('vehicles', 'Fleet', 'Vehicles on file', false, DB::table('carrier_vehicles')->where('carrier_id', $o->id)->exists() ? 'passed' : 'missing');
        }

        // Receivers have no background check
        if ($type !== 'receiver') {
            $add('background', 'Background', 'Company background check', true, $bgState, ucfirst(str_replace('_', ' ', $bg)));
        }

        if ($isCarrier) {
            $payout = $o->stripe_connect_status ?? ($o->stripe_connect_id ? 'reviewing' : 'not_connected');
            $add('payouts', 'Money', 'Payouts set up', true, in_array($payout, ['active', 'verified'], true) ? 'passed' : ($payout === 'not_connected' ? 'missing' : 'pending'), ucfirst(str_replace('_', ' ', $payout)));
        } elseif ($type === 'shipper') {
            $methods = DB::table('payment_methods')->where('org_id', $o->id)->whereNotNull('stripe_pm_id')->count();
            $add('payment_method', 'Money', 'Payment method on file', true, $methods ? 'passed' : 'missing', $methods ? "{$methods} on file" : null);
            $active = DB::table('shipper_subscriptions')->where('org_id', $o->id)->where('status', 'active')->exists();
            $add('subscription', 'Money', 'Subscription active (needed to post loads)', true, $active ? 'passed' : 'missing');
        }
        // Admin policy (Compliance page): off drops the check, optional / deferred stop it blocking
        return array_values(array_filter(array_map(fn ($r) => \App\Services\VerificationPolicy::apply($o, $r), $rows)));
    }

    /** Company fields for the admin page. Person fields (CDL, DOB, etc.) stay on the person. */
    private function companyFields(Organization $o, bool $isCarrier): array
    {
        $day = fn ($d) => $d?->toDateString();

        if ($isCarrier) {
            return [
                'company_name' => $o->name, 'carrier_type' => $o->carrier_type,
                'dot_number' => $o->carrier_dot_number, 'dot_verified' => (bool) $o->carrier_dot_verified,
                'mc_number' => $o->carrier_mc_number, 'mc_verified' => (bool) $o->carrier_mc_verified,
                'operating_authority_type' => $o->carrier_operating_authority_type, 'operating_authority_number' => $o->carrier_operating_authority_number,
                'insurance_verified' => (bool) $o->carrier_insurance_verified,
                'auto_insurer_name' => $o->carrier_auto_insurer_name, 'auto_policy_number' => $o->carrier_auto_policy_number,
                'auto_coverage_amount' => $o->carrier_auto_coverage_amount, 'auto_expiry_date' => $day($o->carrier_auto_expiry_date),
                'cargo_insurer_name' => $o->carrier_cargo_insurer_name, 'cargo_policy_number' => $o->carrier_cargo_policy_number,
                'cargo_coverage_amount' => $o->carrier_cargo_coverage_amount, 'cargo_expiry_date' => $day($o->carrier_cargo_expiry_date),
                'stripe_account_status' => $o->stripe_connect_status ?? ($o->stripe_connect_id ? 'reviewing' : 'not_connected'),
                'street' => $o->street, 'city' => $o->city, 'state' => $o->state, 'zip' => $o->zip, 'country' => $o->country,
                'rating' => $o->rating, 'total_deliveries' => $o->carrier_total_deliveries,
            ];
        }

        $iso = fn ($d) => $d?->toISOString();
        return [
            'company_name' => $o->name, 'dba' => $o->dba, 'business_type' => $o->business_type,
            'industry' => $o->industry, 'ein' => $o->tax_id, 'ein_verified_at' => $iso($o->shipper_ein_verified_at),
            'state_of_incorporation' => $o->state_of_incorporation, 'year_established' => $o->year_established,
            'employee_count' => $o->employee_count, 'business_phone' => $o->phone, 'business_email' => $o->email,
            'website' => $o->website, 'biz_street' => $o->street, 'biz_city' => $o->city,
            'biz_state' => $o->state, 'biz_zip' => $o->zip,
            'ops_same_as_biz' => (bool) $o->ops_same_as_biz, 'ops_street' => $o->ops_street, 'ops_city' => $o->ops_city,
            'ops_state' => $o->ops_state, 'ops_zip' => $o->ops_zip,
            'phone' => $o->phone, 'whatsapp' => $o->whatsapp,
            'verification_status' => $o->shipper_verification_status, 'verification_submitted_at' => $iso($o->verification_submitted_at),
            'coi_url' => \App\Models\ShipperDocument::fileUrl($o->shipper_coi_url), 'coi_expiry' => $day($o->shipper_coi_expiry),
            'hipaa_baa_url' => \App\Models\ShipperDocument::fileUrl($o->shipper_hipaa_baa_url), 'hipaa_baa_expiry' => $day($o->shipper_hipaa_baa_expiry),
            'hazmat_reg_url' => \App\Models\ShipperDocument::fileUrl($o->shipper_hazmat_reg_url), 'hazmat_reg_expiry' => $day($o->shipper_hazmat_reg_expiry),
            'biz_country' => $o->country, 'ops_country' => $o->ops_country,
            'sam_gov_number' => $o->sam_gov_number,
            'bank_institution_name' => $o->shipper_bank_institution_name ?: $o->bank_name, 'bank_last4' => $o->bank_last4,
            'bank_connected_at' => $iso($o->shipper_plaid_connected_at),
            'default_pickup_contact_name' => $o->shipper_default_pickup_contact_name, 'default_pickup_contact_phone' => $o->shipper_default_pickup_contact_phone,
            'internal_ref_format' => $o->shipper_internal_ref_format, 'preferred_categories' => $o->shipper_preferred_categories ?? [],
            'notif_email' => $this->enabledKeys($o->shipper_notif_email), 'notif_sms' => $this->enabledKeys($o->shipper_notif_sms),
            'notif_recipients' => collect($o->shipper_notif_recipients ?? [])->map(fn ($r) => is_array($r) ? ($r['email'] ?? $r['name'] ?? json_encode($r)) : (string) $r)->values()->all(),
            'rating' => $o->rating, 'total_ratings' => $o->total_ratings,
        ];
    }

    /** Notification settings are stored as {key: bool}; show the ones that are on. */
    private function enabledKeys($v): array
    {
        if (!is_array($v)) return [];
        $keys = array_is_list($v) ? $v : array_keys(array_filter($v));
        return array_map(fn ($k) => ucfirst(str_replace('_', ' ', (string) $k)), $keys);
    }

    /**
     * Company-level data for the admin tabs: services, compliance, payment, subscription, team and loads.
     * Only display-safe values: no Plaid, Stripe or bank tokens, only names, last 4 digits and statuses.
     */
    private function tabs(Organization $org, bool $isCarrier): array
    {
        $services = $org->serviceTypes()->orderBy('name')->pluck('name');

        $names = fn ($ids) => DB::table('organizations')->whereIn('id', $ids)->pluck('name', 'id');

        $contracts = DB::table('contracts')->where($isCarrier ? 'carrier_id' : 'shipper_id', $org->id)->orderByDesc('created_at')->get();
        $otherIds  = $contracts->pluck($isCarrier ? 'shipper_id' : 'carrier_id');
        $preferred = DB::table('preferred_carriers')->where($isCarrier ? 'carrier_id' : 'shipper_id', $org->id)->get();
        $otherIds  = $otherIds->merge($preferred->pluck($isCarrier ? 'shipper_id' : 'carrier_id'));
        $other     = $names($otherIds->unique());

        return [
            'services'       => $services->values(),
            'certifications' => $isCarrier ? $org->certifications()->orderBy('name')->pluck('name') : [],
            'vehicles'       => $isCarrier ? DB::table('carrier_vehicles')->where('carrier_id', $org->id)
                ->get(['id', 'type', 'equipment_type', 'unit_number', 'year', 'make', 'model', 'license_plate', 'license_plate_state', 'max_payload', 'temp_min_f', 'temp_max_f', 'registration_expiry', 'is_primary', 'status', 'owner_org_id', 'owner_user_id', 'operating_authority_id'])
                ->map(fn ($v) => (array) $v + ['capabilities' => DB::table('vehicle_capabilities')->where('vehicle_id', $v->id)->pluck('capability_key')]) : [],
            'authorities'    => $org->authorities()->orderBy('kind')->orderByDesc('is_primary')->get()->map->toCard(),
            'categories'     => $org->categories ?? [],
            'service_types'  => $org->serviceTypes()->pluck('key'),
            'payment' => [
                'stripe_mode'        => $org->stripe_mode,
                'stripe_connected'   => (bool) $org->stripe_connect_id,
                'stripe_customer'    => (bool) $org->stripe_customer_id,
                'payout_status'      => $isCarrier ? ($org->stripe_connect_status ?? ($org->stripe_connect_id ? 'reviewing' : 'not_connected')) : null,
                'bank_name'          => $org->bank_name,
                'bank_last4'         => $org->bank_last4,
                'legal_name'         => $org->legal_name,
                'business_structure' => $org->business_structure,
                'commission_rate'    => $org->commission_rate,
            ],
            'payment_methods' => DB::table('payment_methods')->where('org_id', $org->id)->whereNotNull('stripe_pm_id')->orderByDesc('is_default')
                ->get(['id', 'type', 'brand', 'last4', 'exp_month', 'exp_year', 'bank_name', 'is_default', 'created_at'])
                ->map(fn ($m) => [
                    'id' => $m->id, 'type' => $m->type, 'brand' => $m->brand ?: $m->bank_name, 'last4' => $m->last4,
                    'expires' => $m->exp_month ? sprintf('%02d/%s', $m->exp_month, $m->exp_year) : null,
                    'is_default' => (bool) $m->is_default, 'created_at' => $m->created_at,
                ]),
            'subscription' => [
                'plan' => $org->plan,
                'history' => $isCarrier ? [] : DB::table('shipper_subscriptions')->where('org_id', $org->id)->orderByDesc('created_at')
                    ->get(['id', 'tier', 'monthly_price', 'status', 'started_at', 'current_period_end', 'tier_review_at']),
            ],
            'invitations' => DB::table('org_invitations')->where('org_id', $org->id)->whereNull('accepted_at')->orderByDesc('created_at')
                ->get(['id', 'email', 'role', 'expires_at', 'created_at'])
                ->map(fn ($i) => (array) $i + ['state' => now()->greaterThan($i->expires_at) ? 'expired' : 'pending']),
            'contracts' => $contracts->map(fn ($c) => [
                'id' => $c->id, 'title' => $c->title, 'with' => $other[$isCarrier ? $c->shipper_id : $c->carrier_id] ?? null,
                'status' => $c->status, 'rate_type' => $c->rate_type, 'rate' => $c->rate,
                'valid_from' => $c->valid_from, 'valid_to' => $c->valid_to,
            ]),
            'preferred' => $preferred->map(fn ($p) => [
                'id' => $p->id, 'with' => $other[$isCarrier ? $p->shipper_id : $p->carrier_id] ?? null, 'status' => $p->status, 'created_at' => $p->created_at,
            ]),
            'locations' => $isCarrier ? [] : DB::table('locations')->where('org_id', $org->id)->orderBy('name')
                ->get(['id', 'name', 'visibility', 'city', 'state', 'contact_name', 'is_default', 'usage_count']),
        ];
    }
}
