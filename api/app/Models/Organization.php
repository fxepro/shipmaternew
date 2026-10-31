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
        'name', 'slug', 'type', 'plan', 'status', 'owner_id',
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
    ];

    protected function casts(): array
    {
        return [
            'settings'          => 'json',
            'commission_rate'   => 'float',
            'is_platform_tenant'=> 'boolean',
            'verification_updated_at' => 'datetime',
            'background_checked_at'   => 'datetime',
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

    public function orgMembers(): HasMany
    {
        return $this->hasMany(OrgMember::class, 'org_id');
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(OrgInvitation::class, 'org_id');
    }

    public function carrierProfile(): HasOne
    {
        return $this->hasOne(CarrierProfile::class, 'org_id');
    }

    public function shipperProfile(): HasOne
    {
        return $this->hasOne(ShipperProfile::class, 'org_id');
    }

    public function serviceTypes(): BelongsToMany
    {
        return $this->belongsToMany(ServiceType::class, 'org_service_types', 'org_id', 'service_type_id')
                    ->withTimestamps();
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class, 'org_id');
    }

    public function platformTenant(): HasOne
    {
        return $this->hasOne(PlatformTenant::class, 'org_id');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

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
