<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CarrierProfile extends Model
{
    protected $fillable = [
        'user_id',
        'org_id',
        'carrier_type',
        'carrier_type_selected_at',

        // Personal
        'date_of_birth',
        'ssn_last_4',
        'photo_url',

        // DOT-Commercial
        'cdl_number',
        'cdl_issuing_state',
        'cdl_expiry_date',
        'cdl_class',
        'usdot_number',
        'mc_number',
        'hazmat_endorsement',
        'hazmat_expiry_date',
        'tanker_endorsement',
        'passenger_endorsement',
        'company_name',
        'phone',
        'phone_country_code',
        'phone_e164',
        'whatsapp',
        'whatsapp_country_code',
        'street',
        'city',
        'state',
        'zip',
        'country',
        'operating_country',
        'id_type',
        'dl_number',
        'dl_state',
        'dl_country',
        'dl_expiry',
        // Non-US identity
        'national_id_type',
        'national_id_number',
        // Non-US operating authority
        'operating_authority_number',
        'operating_authority_type',
        'dot_number',
        'dot_verified',
        'mc_verified',
        'insurance_verified',
        'auto_policy_number', 'auto_insurer_name', 'auto_coverage_amount',
        'auto_effective_date', 'auto_expiry_date',
        'cargo_policy_number', 'cargo_insurer_name', 'cargo_coverage_amount',
        'cargo_expiry_date',

        // Medical
        'medical_examiner_name',
        'dot_medical_expiry',
        'drug_test_date',
        'drug_test_result',

        // Verification
        'verification_status',
        'verification_status_updated_at',
        'verification_notes',
        'background_check_status',
        'identity_verified',
        'identity_verified_at',
        'age_verified',
        'age_verified_at',
        'checkr_candidate_id',
        'checkr_report_id',

        // Stripe
        'stripe_account_id',
        'stripe_account_status',
        'stripe_verification_data',
        'onboarding_fee_paid',
        'onboarding_fee_payment_intent_id',

        // FMCSA Drug & Alcohol Clearinghouse
        'clearinghouse_query_id',
        'clearinghouse_query_status',
        'clearinghouse_queried_at',
        'clearinghouse_completed_at',
        'clearinghouse_result_data',

        // Dates
        'submitted_for_verification_at',
        'last_verification_at',
        'next_reverification_at',

        // Stats
        'rating',
        'total_deliveries',
        'total_ratings',
    ];

    protected function casts(): array
    {
        return [
            'onboarding_fee_paid'       => 'boolean',
            'dot_verified'              => 'boolean',
            'mc_verified'               => 'boolean',
            'identity_verified'         => 'boolean',
            'identity_verified_at'      => 'datetime',
            'age_verified'              => 'boolean',
            'age_verified_at'           => 'datetime',
            'insurance_verified'        => 'boolean',
            'auto_coverage_amount'      => 'decimal:2',
            'auto_effective_date'       => 'date',
            'auto_expiry_date'          => 'date',
            'cargo_coverage_amount'     => 'decimal:2',
            'cargo_expiry_date'         => 'date',
            'hazmat_endorsement'        => 'boolean',
            'tanker_endorsement'        => 'boolean',
            'passenger_endorsement'     => 'boolean',
            'rating'                    => 'decimal:2',
            'date_of_birth'             => 'date',
            'dl_expiry'                 => 'date',
            'cdl_expiry_date'           => 'date',
            'hazmat_expiry_date'        => 'date',
            'dot_medical_expiry'        => 'date',
            'drug_test_date'            => 'date',
            'stripe_verification_data'    => 'json',
            'clearinghouse_queried_at'    => 'datetime',
            'clearinghouse_completed_at'  => 'datetime',
            'clearinghouse_result_data'   => 'json',
        ];
    }

    /** Mirror profile-held checks into the person's records (person_verifications, identities, credentials) */
    protected static function booted(): void
    {
        static::saved(fn (CarrierProfile $profile) => \App\Services\PersonChecks::syncFromCarrierProfile($profile));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function org(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }

    public function vehicles(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(CarrierVehicle::class);
    }

    public function documents(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(CarrierDocument::class);
    }

    public function verifications(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(CarrierVerification::class);
    }

    public function serviceTypes(): BelongsToMany
    {
        return $this->belongsToMany(ServiceType::class, 'carrier_profile_service_types')
                    ->withTimestamps();
    }

    public function certifications(): BelongsToMany
    {
        return $this->belongsToMany(Certification::class, 'carrier_profile_certifications')
                    ->withTimestamps();
    }
}
