<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrierProfile;
use App\Models\Organization;
use App\Models\Shipment;
use App\Models\ShipperProfile;
use App\Models\User;
use App\Services\PersonChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Admin views of carrier and shipper companies (organizations) and their members.
 *
 * Company and person are approved separately, and each needs a clear background check first.
 * Until profiles are split by company (phase 2), company details are read from the owner's profile.
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
            'type'   => ['nullable', 'in:all,carrier,shipper,factor'],
            'status' => ['nullable', 'string'],
            'q'      => ['nullable', 'string', 'max:100'],
        ]);

        $types = ($data['type'] ?? 'all') === 'all' ? ['carrier', 'shipper', 'factor'] : [$data['type']];
        $query = Organization::whereIn('type', $types)
            ->withCount('orgMembers')
            ->with('owner')
            ->latest();

        if (!empty($data['status']) && $data['status'] !== 'all') {
            $query->where('verification_status', $data['status']);
        }
        if (!empty($data['q'])) {
            $query->where('name', 'ilike', "%{$data['q']}%");
        }

        $orgs     = $query->limit(500)->get();
        $profiles = [
            'carrier' => $this->ownerProfiles($orgs->where('type', 'carrier'), 'carrier'),
            'shipper' => $this->ownerProfiles($orgs->where('type', 'shipper'), 'shipper'),
            'factor'  => collect(), // factors keep company details on the org
        ];

        return response()->json([
            'data' => $orgs->map(function (Organization $o) use ($profiles) {
                $p = $profiles[$o->type]->get($o->owner_id);
                return [
                    'id'                      => $o->id,
                    'name'                    => $p?->company_name ?: $o->name,
                    'type'                    => $o->type,
                    'members'                 => $o->org_members_count,
                    'owner'                   => $o->owner?->only(['id', 'name', 'email']),
                    'dot_number'              => $p?->dot_number ?? null,
                    'mc_number'               => $p?->mc_number ?? null,
                    'ein'                     => $p?->ein ?? ($o->type === 'factor' ? $o->tax_id : null),
                    'verification_status'     => $o->verification_status,
                    'background_check_status' => $o->background_check_status,
                    'status'                  => $o->status,
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
        $isFactor  = $org->type === 'factor';

        $profile = match ($org->type) {
            'carrier' => CarrierProfile::where('user_id', $org->owner_id)->first(),
            'shipper' => ShipperProfile::where('user_id', $org->owner_id)->first(),
            default   => null,
        };

        // Loads hold the company directly
        $partyColumn = $isCarrier ? 'carrier_id' : 'shipper_id';
        $shipments   = Shipment::where($partyColumn, $org->id);

        return response()->json([
            'data' => [
                'company' => [
                    'id'         => $org->id,
                    'name'       => $profile?->company_name ?: $org->name,
                    'org_name'   => $org->name,
                    'type'       => $org->type,
                    'status'     => $org->status,
                    'plan'       => $org->plan,
                    'phone'      => $org->phone ?? ($isCarrier ? $profile?->phone : $profile?->business_phone),
                    'email'      => $org->email ?? ($isCarrier ? null : $profile?->business_email),
                    'website'    => $org->website ?? ($isCarrier ? null : $profile?->website),
                    'created_at' => $org->created_at?->toISOString(),
                    'owner'      => $org->owner?->only(['id', 'name', 'email']),
                    'address'    => collect([$org->street, $org->city, $org->state, $org->zip])->filter()->implode(', ') ?: null,
                    'tax_id'     => $isFactor ? $org->tax_id : null,
                    'stripe_mode'     => $org->stripe_mode,
                    'commission_rate' => $org->commission_rate,
                ],
                'company_profile' => $profile ? $this->companyFields($profile, $isCarrier) : null,
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
                'documents' => $isFactor ? [] : ($isCarrier
                    ? DB::table('carrier_documents')->where('org_id', $org->id)->orderByDesc('created_at')
                        ->get(['id', 'type', 'name', 'url', 'expiry_date', 'verified_at', 'created_at'])
                    : ($profile ? DB::table('shipper_documents')->where('shipper_profile_id', $profile->id)->orderByDesc('created_at')
                        ->get(['id', 'type', 'name', 'url', 'verified_at', 'created_at'])
                        ->map(fn ($d) => tap($d, fn ($d) => $d->url = \App\Models\ShipperDocument::fileUrl($d->url))) : [])),
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
                    'active'    => (clone $shipments)->whereIn('status', ['assigned', 'in_transit'])->count(),
                    'delivered' => (clone $shipments)->where('status', 'delivered')->count(),
                    'value'     => (float) (clone $shipments)->where('status', 'delivered')->sum('agreed_cost'),
                    'bids'      => $isCarrier ? DB::table('bids')->where('carrier_id', $org->id)->count() : null,
                ],
                'tabs' => $isFactor ? null : $this->tabs($org, $profile, $isCarrier),
                'recent_shipments' => (clone $shipments)->latest()->limit(10)
                    ->get(['id', 'item_description', 'status', 'pickup_city', 'pickup_state', 'delivery_city', 'delivery_state', 'agreed_cost', 'created_at'])
                    ->map(fn (Shipment $s) => [
                        'id'          => $s->id,
                        'item'        => $s->item_description,
                        'status'      => $s->status,
                        'route'       => "{$s->pickup_city}, {$s->pickup_state} → {$s->delivery_city}, {$s->delivery_state}",
                        'agreed_cost' => $s->agreed_cost ? (float) $s->agreed_cost : null,
                        'created_at'  => $s->created_at?->toISOString(),
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

        // Factors aren't approved by Shipmater (docs/noa-factoring.md)
        if ($org->type === 'factor') {
            return response()->json(['error' => "Factoring companies don't need Shipmater approval.", 'code' => 'not_required'], 422);
        }

        if ($data['action'] === 'approve' && !in_array($org->background_check_status, self::BACKGROUND_PASSED, true)) {
            return response()->json([
                'error' => 'A clear company background check is required before this company can be approved.',
                'code'  => 'background_not_clear',
            ], 422);
        }

        // A carrier's owner must be approved as a person first
        if ($data['action'] === 'approve' && $org->type === 'carrier'
            && User::find($org->owner_id)?->personVerification?->status !== 'approved') {
            return response()->json([
                'error' => 'The owner must be approved as a person (People) before this carrier can be approved.',
                'code'  => 'owner_not_approved',
            ], 422);
        }

        $org->update([
            'verification_status'     => $data['action'] === 'approve' ? 'approved' : 'rejected',
            'verification_notes'      => $data['notes'] ?? null,
            'verification_updated_at' => now(),
            'verification_updated_by' => $request->user()->id,
        ]);

        // Shipper screens still read business verification from the owner's profile (until phase 2)
        if ($org->type === 'shipper' && $profile = ShipperProfile::where('user_id', $org->owner_id)->first()) {
            $approved = $data['action'] === 'approve';
            $profile->update([
                'verification_status' => $approved ? 'verified' : 'incomplete',
                'ein_verified_at'     => $approved ? now() : null,
                'verification_notes'  => $data['notes'] ?? null,
            ]);
        }

        return response()->json(['message' => "Company {$org->verification_status}.", 'status' => $org->verification_status]);
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

        return response()->json(['message' => 'Background check recorded.', 'status' => $org->background_check_status]);
    }

    /** Owner profiles keyed by user id, for the company-level fields they still hold. */
    private function ownerProfiles($orgs, string $type)
    {
        $model = $type === 'carrier' ? CarrierProfile::class : ShipperProfile::class;
        return $model::whereIn('user_id', $orgs->pluck('owner_id')->filter())->get()->keyBy('user_id');
    }

    /** Company-level fields from the owner's profile. Person fields (CDL, DOB, etc.) stay on the person. */
    private function companyFields($p, bool $isCarrier): array
    {
        if ($isCarrier) {
            return [
                'company_name' => $p->company_name, 'carrier_type' => $p->carrier_type,
                'dot_number' => $p->dot_number, 'dot_verified' => (bool) $p->dot_verified,
                'mc_number' => $p->mc_number, 'mc_verified' => (bool) $p->mc_verified,
                'operating_authority_type' => $p->operating_authority_type, 'operating_authority_number' => $p->operating_authority_number,
                'insurance_verified' => (bool) $p->insurance_verified,
                'auto_insurer_name' => $p->auto_insurer_name, 'auto_policy_number' => $p->auto_policy_number,
                'auto_coverage_amount' => $p->auto_coverage_amount, 'auto_expiry_date' => $p->auto_expiry_date,
                'cargo_insurer_name' => $p->cargo_insurer_name, 'cargo_policy_number' => $p->cargo_policy_number,
                'cargo_coverage_amount' => $p->cargo_coverage_amount, 'cargo_expiry_date' => $p->cargo_expiry_date,
                'stripe_account_status' => $p->stripe_account_status,
                'street' => $p->street, 'city' => $p->city, 'state' => $p->state, 'zip' => $p->zip, 'country' => $p->country,
                'rating' => $p->rating, 'total_deliveries' => $p->total_deliveries,
            ];
        }

        return [
            'company_name' => $p->company_name, 'dba' => $p->dba, 'business_type' => $p->business_type,
            'industry' => $p->industry, 'ein' => $p->ein, 'ein_verified_at' => $p->ein_verified_at,
            'state_of_incorporation' => $p->state_of_incorporation, 'year_established' => $p->year_established,
            'employee_count' => $p->employee_count, 'business_phone' => $p->business_phone, 'business_email' => $p->business_email,
            'website' => $p->website, 'biz_street' => $p->biz_street, 'biz_city' => $p->biz_city,
            'biz_state' => $p->biz_state, 'biz_zip' => $p->biz_zip,
            'ops_same_as_biz' => (bool) $p->ops_same_as_biz, 'ops_street' => $p->ops_street, 'ops_city' => $p->ops_city,
            'ops_state' => $p->ops_state, 'ops_zip' => $p->ops_zip,
            'phone' => $p->phone, 'whatsapp' => $p->whatsapp,
            'verification_status' => $p->verification_status, 'verification_submitted_at' => $p->verification_submitted_at,
            'coi_url' => \App\Models\ShipperDocument::fileUrl($p->coi_url), 'coi_expiry' => $p->coi_expiry,
            'hipaa_baa_url' => \App\Models\ShipperDocument::fileUrl($p->hipaa_baa_url), 'hipaa_baa_expiry' => $p->hipaa_baa_expiry,
            'hazmat_reg_url' => \App\Models\ShipperDocument::fileUrl($p->hazmat_reg_url), 'hazmat_reg_expiry' => $p->hazmat_reg_expiry,
            'biz_country' => $p->biz_country, 'ops_country' => $p->ops_country,
            'sam_gov_number' => $p->sam_gov_number,
            'bank_institution_name' => $p->bank_institution_name ?: $p->bank_name, 'bank_last4' => $p->bank_last4,
            'bank_connected_at' => $p->plaid_connected_at,
            'default_pickup_contact_name' => $p->default_pickup_contact_name, 'default_pickup_contact_phone' => $p->default_pickup_contact_phone,
            'internal_ref_format' => $p->internal_ref_format, 'preferred_categories' => $p->preferred_categories ?? [],
            'notif_email' => $this->enabledKeys($p->notif_email), 'notif_sms' => $this->enabledKeys($p->notif_sms),
            'notif_recipients' => collect($p->notif_recipients ?? [])->map(fn ($r) => is_array($r) ? ($r['email'] ?? $r['name'] ?? json_encode($r)) : (string) $r)->values()->all(),
            'rating' => $p->rating, 'total_ratings' => $p->total_ratings,
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
    private function tabs(Organization $org, $profile, bool $isCarrier): array
    {
        $services = $org->serviceTypes()->orderBy('name')->pluck('name');
        if ($isCarrier && $profile) $services = $services->merge($profile->serviceTypes()->pluck('name'))->unique()->sort()->values();

        $names = fn ($ids) => DB::table('organizations')->whereIn('id', $ids)->pluck('name', 'id');

        $contracts = DB::table('contracts')->where($isCarrier ? 'carrier_id' : 'shipper_id', $org->id)->orderByDesc('created_at')->get();
        $otherIds  = $contracts->pluck($isCarrier ? 'shipper_id' : 'carrier_id');
        $preferred = DB::table('preferred_carriers')->where($isCarrier ? 'carrier_id' : 'shipper_id', $org->id)->get();
        $otherIds  = $otherIds->merge($preferred->pluck($isCarrier ? 'shipper_id' : 'carrier_id'));
        $other     = $names($otherIds->unique());

        return [
            'services'       => $services->values(),
            'certifications' => $isCarrier && $profile ? $profile->certifications()->orderBy('name')->pluck('name') : [],
            'vehicles'       => $isCarrier ? DB::table('carrier_vehicles')->where('org_id', $org->id)
                ->get(['id', 'type', 'year', 'make', 'model', 'license_plate', 'license_plate_state', 'max_payload', 'registration_expiry', 'is_primary']) : [],
            'payment' => [
                'stripe_mode'        => $org->stripe_mode,
                'stripe_connected'   => (bool) $org->stripe_connect_id,
                'stripe_customer'    => (bool) $org->stripe_customer_id,
                'payout_status'      => $isCarrier ? $profile?->stripe_account_status : null,
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
                ->get(['id', 'name', 'type', 'city', 'state', 'contact_name', 'is_default', 'usage_count']),
        ];
    }
}
