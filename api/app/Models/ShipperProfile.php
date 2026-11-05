<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShipperProfile extends Model
{
    protected static function booted(): void
    {
        // The legal business name is the company's name
        static::saved(fn (ShipperProfile $profile) => Organization::syncNameFromProfile($profile));
    }

    protected $fillable = [
        'user_id',
        'org_id',
        // Personal
        'phone', 'phone_country_code', 'phone_e164', 'street', 'city', 'state', 'zip', 'country',
        'whatsapp', 'whatsapp_country_code',
        // Business identity
        'company_name', 'dba', 'business_type', 'ein',
        'state_of_incorporation', 'year_established', 'employee_count',
        'industry', 'website', 'business_phone', 'business_email', 'sam_gov_number',
        // Registered address
        'biz_street', 'biz_city', 'biz_state', 'biz_zip', 'biz_country',
        // Operating address
        'ops_same_as_biz', 'ops_street', 'ops_city', 'ops_state', 'ops_zip', 'ops_country',
        // Verification
        'verification_status', 'verification_notes', 'verification_submitted_at',
        'email_verified_at', 'phone_verified_at', 'ein_verified_at',
        // Shipping defaults
        'default_pickup_contact_name', 'default_pickup_contact_phone',
        'internal_ref_format', 'preferred_categories', 'notif_recipients',
        // Compliance
        'coi_url', 'coi_expiry', 'hipaa_baa_url', 'hipaa_baa_expiry',
        'hazmat_reg_url', 'hazmat_reg_expiry',
        // Notifications
        'notif_email', 'notif_sms',
        // Plaid / ACH
        'plaid_access_token', 'plaid_item_id', 'plaid_account_id',
        'bank_last4', 'bank_name', 'bank_institution_name',
        'plaid_connected_at', 'stripe_bank_source_id',
        // Stats
        'rating', 'total_ratings',
    ];

    protected function casts(): array
    {
        return [
            'notif_email'          => 'array',
            'notif_sms'            => 'array',
            'preferred_categories' => 'array',
            'notif_recipients'     => 'array',
            'rating'               => 'decimal:2',
        'ops_same_as_biz'      => 'boolean',
            'coi_expiry'           => 'date',
            'hipaa_baa_expiry'     => 'date',
            'hazmat_reg_expiry'    => 'date',
            'email_verified_at'         => 'datetime',
            'phone_verified_at'         => 'datetime',
            'ein_verified_at'           => 'datetime',
            'verification_submitted_at' => 'datetime',
            'plaid_connected_at'        => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function org(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ShipperDocument::class);
    }
}
