<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Organization extends Model
{
    protected $fillable = [
        'name', 'slug', 'type', 'plan', 'status', 'owner_id', 'listed_by_org_id', 'listed_by_user_id', 'claimed_at',
        'phone', 'email', 'website',
        'street', 'city', 'state', 'zip', 'country', 'currency',
        'tax_id', 'tax_id_type',
        'logo_url', 'settings',
        // Stripe billing mode (admin-only toggle)
        'stripe_mode', 'stripe_connect_id', 'commission_rate',
        // Compliance / tenant flags
        'fmcsa_broker_mc', 'is_platform_tenant',
        // Company-level approval (admin)
        'verification_status', 'verification_notes', 'verification_updated_at', 'verification_updated_by',
        'background_check_status', 'background_check_reference', 'background_check_notes', 'background_checked_at',
        // Payout account details sent to Stripe (StripeOnboarding)
        'business_structure', 'legal_name', 'representative_title', 'representative_ownership', 'statement_descriptor',
        'product_description', 'bank_token', 'bank_name', 'bank_last4', 'bank_routing', 'bank_holder_name', 'bank_holder_type',
        'stripe_requirements', 'stripe_submitted_at', 'stripe_connect_status',
        // Business details (every company)
        'dba', 'business_type', 'industry', 'state_of_incorporation', 'year_established', 'employee_count', 'sam_gov_number',
        'phone_country_code', 'phone_e164', 'whatsapp', 'whatsapp_country_code',
        'ops_same_as_biz', 'ops_street', 'ops_city', 'ops_state', 'ops_zip', 'ops_country',
        'rating', 'total_ratings', 'verification_submitted_at',
        // Shippers only (empty for other companies)
        'shipper_verification_status', 'shipper_email_verified_at', 'shipper_phone_verified_at', 'shipper_ein_verified_at',
        'shipper_default_pickup_contact_name', 'shipper_default_pickup_contact_phone', 'shipper_internal_ref_format',
        'shipper_preferred_categories', 'shipper_notif_recipients', 'shipper_notif_email', 'shipper_notif_sms',
        'shipper_coi_url', 'shipper_coi_expiry', 'shipper_hipaa_baa_url', 'shipper_hipaa_baa_expiry',
        'shipper_hazmat_reg_url', 'shipper_hazmat_reg_expiry',
        'shipper_plaid_access_token', 'shipper_plaid_item_id', 'shipper_plaid_account_id', 'shipper_plaid_connected_at',
        'shipper_bank_institution_name', 'shipper_stripe_bank_source_id',
        // Carriers only (empty for other companies)
        'carrier_type', 'carrier_type_selected_at', 'carrier_dot_number', 'carrier_mc_number', 'carrier_dot_verified', 'carrier_mc_verified',
        'carrier_operating_country', 'carrier_operating_authority_number', 'carrier_operating_authority_type', 'carrier_insurance_verified',
        'carrier_auto_policy_number', 'carrier_auto_insurer_name', 'carrier_auto_coverage_amount', 'carrier_auto_effective_date', 'carrier_auto_expiry_date',
        'carrier_cargo_policy_number', 'carrier_cargo_insurer_name', 'carrier_cargo_coverage_amount', 'carrier_cargo_expiry_date',
        'carrier_total_deliveries', 'carrier_onboarding_fee_paid', 'carrier_onboarding_fee_payment_intent_id',
        'carrier_submitted_for_verification_at', 'carrier_last_verification_at', 'carrier_next_reverification_at',
    ];

    /** Columns safe to show another company (eager load as 'shipper:' . Organization::PUBLIC) */
    public const PUBLIC = 'id,name,type,email,phone,city,state,logo_url,rating,total_ratings,carrier_dot_number,carrier_mc_number,carrier_dot_verified,carrier_insurance_verified,carrier_total_deliveries';

    // Single-use Stripe bank token, only ever sent to Stripe; the Plaid token never leaves the server
    protected $hidden = ['bank_token', 'shipper_plaid_access_token'];

    protected function casts(): array
    {
        return [
            'settings'          => 'json',
            'commission_rate'   => 'float',
            'is_platform_tenant'=> 'boolean',
            'verification_updated_at' => 'datetime',
            'claimed_at'              => 'datetime',
            'background_checked_at'   => 'datetime',
            'representative_ownership' => 'float',
            'stripe_requirements'     => 'array',
            'stripe_submitted_at'     => 'datetime',
            'ops_same_as_biz'         => 'boolean',
            'rating'                  => 'decimal:2',
            'total_ratings'           => 'integer',
            'verification_submitted_at' => 'datetime',
            'shipper_email_verified_at' => 'datetime',
            'shipper_phone_verified_at' => 'datetime',
            'shipper_ein_verified_at'   => 'datetime',
            'shipper_preferred_categories' => 'array',
            'shipper_notif_recipients'  => 'array',
            'shipper_notif_email'       => 'array',
            'shipper_notif_sms'         => 'array',
            'shipper_coi_expiry'        => 'date',
            'shipper_hipaa_baa_expiry'  => 'date',
            'shipper_hazmat_reg_expiry' => 'date',
            'shipper_plaid_access_token' => 'encrypted',
            'shipper_plaid_connected_at' => 'datetime',
            'carrier_type_selected_at'  => 'datetime',
            'carrier_dot_verified'      => 'boolean',
            'carrier_mc_verified'       => 'boolean',
            'carrier_insurance_verified' => 'boolean',
            'carrier_auto_coverage_amount'  => 'decimal:2',
            'carrier_auto_effective_date'   => 'date',
            'carrier_auto_expiry_date'      => 'date',
            'carrier_cargo_coverage_amount' => 'decimal:2',
            'carrier_cargo_expiry_date'     => 'date',
            'carrier_total_deliveries'  => 'integer',
            'carrier_onboarding_fee_paid' => 'boolean',
            'carrier_submitted_for_verification_at' => 'datetime',
            'carrier_last_verification_at'   => 'datetime',
            'carrier_next_reverification_at' => 'datetime',
        ];
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'org_members')
                    ->withPivot('role', 'status', 'joined_at')
                    ->withTimestamps();
    }

    /** Representative (factors) and owners with 25%+, sent to Stripe */
    public function people(): HasMany
    {
        return $this->hasMany(BusinessPerson::class);
    }

    public function orgMembers(): HasMany
    {
        return $this->hasMany(OrgMember::class, 'org_id');
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(OrgInvitation::class, 'org_id');
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(CarrierVehicle::class, 'carrier_id');
    }

    public function carrierDocuments(): HasMany
    {
        return $this->hasMany(CarrierDocument::class, 'carrier_id');
    }

    public function carrierVerifications(): HasMany
    {
        return $this->hasMany(CarrierVerification::class, 'carrier_id');
    }

    public function shipperDocuments(): HasMany
    {
        return $this->hasMany(ShipperDocument::class, 'shipper_id');
    }

    public function certifications(): BelongsToMany
    {
        return $this->belongsToMany(Certification::class, 'org_certifications', 'org_id', 'certification_id')
                    ->withTimestamps();
    }

    public function serviceTypes(): BelongsToMany
    {
        return $this->belongsToMany(ServiceType::class, 'org_service_types', 'org_id', 'service_type_id')
                    ->withTimestamps();
    }

    /** Loads where this company is the shipper or the carrier */
    public function shipments()
    {
        return FreightJob::forOrg($this->id);
    }

    public function platformTenant(): HasOne
    {
        return $this->hasOne(PlatformTenant::class, 'org_id');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** The legal business name is the company's name: setting one sets both. */
    public function setLegalName(?string $name): void
    {
        $name = trim((string) $name);
        if ($name === '') return;
        $this->fill(['name' => $name, 'legal_name' => $name]);
    }

    /** Digits only: DOT and MC numbers are stored without "DOT-" or "MC-" prefixes */
    public static function digits(?string $value): ?string
    {
        if ($value === null) return null;
        return preg_replace('/\D/', '', $value) ?: null;
    }

    // ── Directory: locations, contacts, saved partners, listing and claiming ───

    public const TYPES = ['shipper', 'carrier', 'factor', 'receiver', 'broker'];
    /** Types a company can list on someone else's behalf */
    public const LISTABLE = ['receiver', 'broker'];

    public function locations(): HasMany
    {
        return $this->hasMany(Location::class, 'org_id');
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(OrgContact::class, 'org_id');
    }

    /** Organizations this one keeps (a shipper's receivers) */
    public function partnerLinks(): HasMany
    {
        return $this->hasMany(OrgPartner::class, 'org_id');
    }

    public function claims(): HasMany
    {
        return $this->hasMany(OrgClaim::class, 'org_id');
    }

    public function listedBy(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'listed_by_org_id');
    }

    /** Listed by another company and not claimed yet: nobody from it has an account */
    public function isListed(): bool { return $this->status === 'listed' && !$this->owner_id; }

    /**
     * Who may change its details, locations and contacts: its own people once claimed (by role), and while it is
     * only listed, the company that listed it and every company that saved it. Admins always.
     */
    public function editableBy(User $user): bool
    {
        if ($user->isPlatformAdmin()) return true;
        $mine = $user->current_org_id;
        if (!$mine || $user->viewingAs) return false;
        if ((int) $mine === (int) $this->id) return true;
        if (!$this->isListed()) return false;
        return (int) $this->listed_by_org_id === (int) $mine
            || OrgPartner::where('org_id', $mine)->where('partner_org_id', $this->id)->exists();
    }

    /** Who may see its contacts: the same people, plus anyone who saved it */
    public function contactsVisibleTo(User $user): bool
    {
        if ($this->editableBy($user) || $user->isPlatformAdmin()) return true;
        $mine = $user->viewingAs?->id ?? $user->current_org_id;
        return $mine && ((int) $mine === (int) $this->id
            || OrgPartner::where('org_id', $mine)->where('partner_org_id', $this->id)->exists());
    }

    public function isReceiver(): bool       { return $this->type === 'receiver'; }
    public function isCarrier(): bool        { return $this->type === 'carrier'; }
    public function isShipper(): bool        { return $this->type === 'shipper'; }
    public function isActive():  bool        { return $this->status === 'active'; }
    public function isPlatformTenant(): bool { return (bool) $this->is_platform_tenant; }

    /**
     * Effective commission rate for this org.
     * Falls back to the platform-wide default (PLATFORM_FEE_PERCENT env ÷ 100).
     */
    public function commissionRate(): float
    {
        // One rate for everyone, set under Platform → Fees; per-company overrides are retired
        return \App\Services\Fees::standardRate();
    }

    /**
     * Whether payments for this org flow through Shipmater's Stripe (default)
     * or the org's own Stripe Connect account (admin-enabled for enterprise).
     */
    public function usesOwnStripe(): bool
    {
        return $this->stripe_mode === 'connect' && !empty($this->stripe_connect_id);
    }
}
