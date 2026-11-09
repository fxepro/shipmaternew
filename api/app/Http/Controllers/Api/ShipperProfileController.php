<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\PersonIdentity;
use App\Models\ServiceType;
use App\Models\ShipperDocument;
use App\Models\User;
use App\Services\PersonChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The shipper profile page. Business details, compliance files, shipping defaults and notification
 * settings are the company's (organizations; shipper-only columns start with shipper_). The person's
 * own phone and home address are on their identity record (person_identities, by user_id).
 */
class ShipperProfileController extends Controller
{
    /** Company fields: page field => organizations column */
    private const COMPANY = [
        'dba'                          => 'dba',
        'business_type'                => 'business_type',
        'state_of_incorporation'       => 'state_of_incorporation',
        'year_established'             => 'year_established',
        'employee_count'               => 'employee_count',
        'industry'                     => 'industry',
        'website'                      => 'website',
        'business_phone'               => 'phone',
        'business_email'               => 'email',
        'sam_gov_number'               => 'sam_gov_number',
        // Brokers: the broker MC number, checked with FMCSA
        'broker_mc'                    => 'fmcsa_broker_mc',
        'biz_street'                   => 'street',
        'biz_city'                     => 'city',
        'biz_state'                    => 'state',
        'biz_zip'                      => 'zip',
        'biz_country'                  => 'country',
        'ops_same_as_biz'              => 'ops_same_as_biz',
        'ops_street'                   => 'ops_street',
        'ops_city'                     => 'ops_city',
        'ops_state'                    => 'ops_state',
        'ops_zip'                      => 'ops_zip',
        'ops_country'                  => 'ops_country',
        'default_pickup_contact_name'  => 'shipper_default_pickup_contact_name',
        'default_pickup_contact_phone' => 'shipper_default_pickup_contact_phone',
        'internal_ref_format'          => 'shipper_internal_ref_format',
        'preferred_categories'         => 'shipper_preferred_categories',
        'notif_recipients'             => 'shipper_notif_recipients',
        'coi_expiry'                   => 'shipper_coi_expiry',
        'hipaa_baa_expiry'             => 'shipper_hipaa_baa_expiry',
        'hazmat_reg_expiry'            => 'shipper_hazmat_reg_expiry',
        'notif_email'                  => 'shipper_notif_email',
        'notif_sms'                    => 'shipper_notif_sms',
    ];

    /** The person's own contact details: page field => person_identities column */
    private const IDENTITY = [
        'phone'                 => 'phone',
        'phone_country_code'    => 'phone_country_code',
        'whatsapp'              => 'whatsapp',
        'whatsapp_country_code' => 'whatsapp_country_code',
        'street'                => 'street',
        'city'                  => 'city',
        'state'                 => 'state',
        'zip'                   => 'zip',
    ];

    // ── Default notification preferences ─────────────────────────────────────

    private function defaultNotifEmail(): array
    {
        return [
            'carrier_assigned' => true,
            'pickup_confirmed'  => true,
            'in_transit'        => true,
            'delivered'         => true,
            'disputed'          => true,
            'weekly_summary'    => false,
            'marketing'         => false,
        ];
    }

    private function defaultNotifSms(): array
    {
        return [
            'carrier_assigned' => false,
            'pickup_confirmed'  => true,
            'in_transit'        => false,
            'delivered'         => true,
            'disputed'          => true,
        ];
    }

    private function shipper(User $user): ?Organization
    {
        return PersonChecks::companyOf($user, ['shipper', 'broker']);
    }

    private function shape(User $user): array
    {
        $org = $this->shipper($user);
        $me  = PersonIdentity::where('user_id', $user->id)->first();

        return [
            // The person
            'name'          => $user->name,
            'email'         => $user->email,
            'phone'         => $me?->phone ?? '',
            'phone_country_code' => $me?->phone_country_code ?? 'US',
            'whatsapp'      => $me?->whatsapp ?? '',
            'whatsapp_country_code' => $me?->whatsapp_country_code ?? ($me?->phone_country_code ?? 'US'),
            'member_since'  => $user->created_at->format('M Y'),
            'street'        => $me?->street ?? '',
            'city'          => $me?->city ?? '',
            'state'         => $me?->state ?? '',
            'zip'           => $me?->zip ?? '',
            'country'       => $me?->country === 'US' || !$me?->country ? 'United States' : $me->country,
            'can_edit_company' => $user->canDo('company.profile'),

            // Business identity (the company)
            'company'                => $org?->name ?? '',
            'dba'                    => $org?->dba ?? '',
            'business_type'          => $org?->business_type ?? 'Limited Liability Company (LLC)',
            'ein'                    => $org?->tax_id ?? '',
            'tax_id'                 => $org?->tax_id ?? '',
            'tax_id_type'            => $org?->tax_id_type ?: 'EIN',
            'currency'               => $org?->currency ?: 'USD',
            'state_of_incorporation' => $org?->state_of_incorporation ?? '',
            'year_established'       => $org?->year_established ?? '',
            'employee_count'         => $org?->employee_count ?? '',
            'industry'               => $org?->industry ?? 'Freight & Logistics',
            'website'                => $org?->website ?? '',
            'business_phone'         => $org?->phone ?? '',
            'business_email'         => $org?->email ?? '',
            'sam_gov_number'         => $org?->sam_gov_number ?? '',
            'broker_mc'              => $org?->fmcsa_broker_mc ?? '',

            // Registered address
            'biz_street'    => $org?->street ?? '',
            'biz_city'      => $org?->city ?? '',
            'biz_state'     => $org?->state ?? '',
            'biz_zip'       => $org?->zip ?? '',
            'biz_country'   => $org?->country ?: 'US',

            // Operating address
            'ops_same_as_biz' => (bool) ($org?->ops_same_as_biz ?? true),
            'ops_street'      => $org?->ops_street ?? '',
            'ops_city'        => $org?->ops_city ?? '',
            'ops_state'       => $org?->ops_state ?? '',
            'ops_zip'         => $org?->ops_zip ?? '',
            'ops_country'     => $org?->ops_country ?: 'US',

            // Verification (read-only — set by platform processes, not self-service clicks)
            'verification_status' => $org?->shipper_verification_status ?? 'incomplete',
            'email_verified'      => !is_null($user->email_verified_at),
            'phone_verified'      => !is_null($org?->shipper_phone_verified_at),
            'ein_verified'        => !is_null($org?->shipper_ein_verified_at),

            // Shipping defaults
            'default_pickup_contact_name'  => $org?->shipper_default_pickup_contact_name ?? '',
            'default_pickup_contact_phone' => $org?->shipper_default_pickup_contact_phone ?? '',
            'internal_ref_format'          => $org?->shipper_internal_ref_format ?? '',
            'preferred_categories'         => $org?->shipper_preferred_categories ?? [],
            'notif_recipients'             => $org?->shipper_notif_recipients ?? [],

            // Compliance (the *_url columns hold the stored path; *_file is a link to open it)
            'coi_url'          => $org?->shipper_coi_url ?? '',
            'coi_expiry'       => $org?->shipper_coi_expiry?->toDateString(),
            'hipaa_baa_url'    => $org?->shipper_hipaa_baa_url ?? '',
            'hipaa_baa_expiry' => $org?->shipper_hipaa_baa_expiry?->toDateString(),
            'hazmat_reg_url'   => $org?->shipper_hazmat_reg_url ?? '',
            'hazmat_reg_expiry'=> $org?->shipper_hazmat_reg_expiry?->toDateString(),
            'coi_file'         => ShipperDocument::fileUrl($org?->shipper_coi_url),
            'hipaa_baa_file'   => ShipperDocument::fileUrl($org?->shipper_hipaa_baa_url),
            'hazmat_reg_file'  => ShipperDocument::fileUrl($org?->shipper_hazmat_reg_url),

            // Notifications (the company's)
            'notif_email'      => $org?->shipper_notif_email ?? $this->defaultNotifEmail(),
            'notif_sms'        => $org?->shipper_notif_sms   ?? $this->defaultNotifSms(),

            // Company / service types
            'org_id'           => $org?->id,
            'org_name'         => $org?->name,
            'service_type_keys' => $org?->serviceTypes()->pluck('key')->toArray() ?? [],
        ];
    }

    /** Business verification: complete once the legal name and tax ID are in; verified once Shipmater checks the tax ID */
    public static function businessVerificationStatus(Organization $org, ?User $owner): string
    {
        if (!$org->name || !$org->tax_id) return 'incomplete';
        // Once Shipmater has verified the business, editing other fields must not undo it
        if ($org->shipper_ein_verified_at) return 'verified';
        if (!$owner?->email_verified_at)   return 'incomplete';
        return 'submitted';
    }

    // ── GET /api/v1/shipper/profile ───────────────────────────────────────────

    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()->postsLoads(), 403);

        return response()->json(['data' => $this->shape($request->user())]);
    }

    // ── PUT /api/v1/shipper/profile ───────────────────────────────────────────

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->postsLoads(), 403);

        $validated = $request->validate([
            // The person
            'name'          => ['sometimes', 'string', 'max:255'],
            'email'         => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone'         => ['sometimes', 'nullable', 'string', 'max:40'],
            'phone_country_code' => ['sometimes', 'nullable', 'string', 'size:2'],
            'whatsapp'      => ['sometimes', 'nullable', 'string', 'max:40'],
            'whatsapp_country_code' => ['sometimes', 'nullable', 'string', 'size:2'],
            'street'        => ['sometimes', 'nullable', 'string', 'max:200'],
            'city'          => ['sometimes', 'nullable', 'string', 'max:100'],
            'state'         => ['sometimes', 'nullable', 'string', 'max:50'],
            'zip'           => ['sometimes', 'nullable', 'string', 'max:20'],
            'country'       => ['sometimes', 'nullable', 'string', 'max:100'],

            // Business identity
            'company'                => ['sometimes', 'nullable', 'string', 'max:200'],
            'dba'                    => ['sometimes', 'nullable', 'string', 'max:200'],
            'business_type'          => ['sometimes', 'nullable', 'string', 'max:100'],
            'ein'                    => ['sometimes', 'nullable', 'string', 'max:30'],
            'tax_id'                 => ['sometimes', 'nullable', 'string', 'max:30'],
            'tax_id_type'            => ['sometimes', 'nullable', 'string', 'max:10'],
            'currency'               => ['sometimes', 'nullable', 'string', 'size:3'],
            'state_of_incorporation' => ['sometimes', 'nullable', 'string', 'max:2'],
            'year_established'       => ['sometimes', 'nullable', 'string', 'max:4'],
            'employee_count'         => ['sometimes', 'nullable', 'string', 'max:30'],
            'industry'               => ['sometimes', 'nullable', 'string', 'max:100'],
            'website'                => ['sometimes', 'nullable', 'string', 'max:255'],
            'business_phone'         => ['sometimes', 'nullable', 'string', 'max:40'],
            'business_email'         => ['sometimes', 'nullable', 'email', 'max:255'],
            'sam_gov_number'         => ['sometimes', 'nullable', 'string', 'max:50'],
            'broker_mc'              => ['sometimes', 'nullable', 'string', 'max:20'],

            // Registered address
            'biz_street'    => ['sometimes', 'nullable', 'string', 'max:200'],
            'biz_city'      => ['sometimes', 'nullable', 'string', 'max:100'],
            'biz_state'     => ['sometimes', 'nullable', 'string', 'max:50'],
            'biz_zip'       => ['sometimes', 'nullable', 'string', 'max:20'],
            'biz_country'   => ['sometimes', 'nullable', 'string', 'size:2'],

            // Operating address
            'ops_same_as_biz' => ['sometimes', 'boolean'],
            'ops_street'      => ['sometimes', 'nullable', 'string', 'max:200'],
            'ops_city'        => ['sometimes', 'nullable', 'string', 'max:100'],
            'ops_state'       => ['sometimes', 'nullable', 'string', 'max:50'],
            'ops_zip'         => ['sometimes', 'nullable', 'string', 'max:20'],
            'ops_country'     => ['sometimes', 'nullable', 'string', 'size:2'],

            // Shipping defaults
            'default_pickup_contact_name'  => ['sometimes', 'nullable', 'string', 'max:255'],
            'default_pickup_contact_phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'internal_ref_format'          => ['sometimes', 'nullable', 'string', 'max:100'],
            'preferred_categories'         => ['sometimes', 'array'],
            'notif_recipients'             => ['sometimes', 'array'],

            // Compliance (the files themselves are set by the upload, not by the form)
            'coi_url'          => ['sometimes', 'nullable', 'string'],
            'coi_expiry'       => ['sometimes', 'nullable', 'date'],
            'hipaa_baa_url'    => ['sometimes', 'nullable', 'string'],
            'hipaa_baa_expiry' => ['sometimes', 'nullable', 'date'],
            'hazmat_reg_url'   => ['sometimes', 'nullable', 'string'],
            'hazmat_reg_expiry'=> ['sometimes', 'nullable', 'date'],

            // Notifications
            'notif_email'   => ['sometimes', 'array'],
            'notif_sms'     => ['sometimes', 'array'],

            // Service types (company)
            'service_type_keys'   => ['sometimes', 'array'],
            'service_type_keys.*' => ['string'],
        ]);
        $has = fn (string $k) => array_key_exists($k, $validated);
        $org = $this->shipper($user);

        // ── The company: owner or staff only ──
        $company = [];
        foreach (self::COMPANY as $field => $col) {
            if ($has($field)) $company[$col] = $validated[$field];
        }
        if ($has('company') && trim((string) $validated['company']) !== '') {
            $company['name'] = $company['legal_name'] = trim($validated['company']);
        }
        // The page sends the tax ID as both tax_id and ein
        if ($has('tax_id') || $has('ein')) $company['tax_id'] = $validated['tax_id'] ?? $validated['ein'] ?? null;
        foreach (['tax_id_type', 'currency'] as $k) {
            if ($has($k)) $company[$k] = $validated[$k] === null ? null : strtoupper($validated[$k]);
        }
        foreach (['biz_country' => 'country', 'ops_country' => 'ops_country'] as $field => $col) {
            if (!empty($company[$col])) $company[$col] = strtoupper($company[$col]);
        }

        $changed = $org ? array_filter($company, fn ($v, $col) => json_encode($org->{$col} instanceof \Carbon\Carbon ? $org->{$col}->toDateString() : $org->{$col}) !== json_encode($v), ARRAY_FILTER_USE_BOTH) : $company;
        $serviceChange = $has('service_type_keys');

        // Only the owner or staff change the company; others save just their own details
        if ($org && $user->canDo('company.profile') && ($changed || $serviceChange)) {
            if ($changed) $org->update($changed);
            if ($serviceChange) {
                $org->serviceTypes()->sync(ServiceType::whereIn('key', $validated['service_type_keys'])->pluck('id'));
            }
            $org->refresh();
            $org->update(['shipper_verification_status' => self::businessVerificationStatus($org, User::find($org->owner_id))]);
        }

        // ── The person ──
        $userFields = array_intersect_key($validated, array_flip(['name', 'email']));
        if ($userFields) $user->update($userFields);

        $personal = array_intersect_key($validated, self::IDENTITY);
        if ($personal || $has('country') || $has('name')) {
            $me = PersonChecks::identity($user);
            foreach ($personal as $field => $value) $me->{self::IDENTITY[$field]} = $value;
            if ($has('country')) $me->country = $this->countryCode($validated['country']);
            if ($has('name')) $me->fill(PersonChecks::splitName($validated['name']));
            if ($has('phone') || $has('phone_country_code')) {
                $cc = strtoupper($me->phone_country_code ?: 'US');
                $me->phone_country_code = $cc;
                $me->phone_e164 = null;
                if ($me->phone) {
                    try { $me->phone_e164 = app(\App\Services\SmsOtpService::class)->normalizeE164((string) $me->phone, $cc); } catch (\Throwable) {}
                }
            }
            if ($me->whatsapp_country_code) $me->whatsapp_country_code = strtoupper($me->whatsapp_country_code);
            $me->save();
        }

        return response()->json(['data' => $this->shape($user->fresh())]);
    }

    private function countryCode(?string $country): ?string
    {
        if (!$country) return null;
        $c = strtoupper(trim($country));
        if (strlen($c) === 2) return $c;
        return match ($c) {
            'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA' => 'US',
            'CANADA' => 'CA',
            'MEXICO' => 'MX',
            default  => null,
        };
    }
}
