<?php

namespace App\Models;

use App\Notifications\VerifyEmailNotification;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable;

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmailNotification);
    }

    protected $fillable = [
        'name', 'email', 'password', 'role', 'avatar_url', 'current_org_id', 'stripe_customer_id',
        'status', 'status_reason', 'status_changed_at', 'status_changed_by',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'status_changed_at' => 'datetime',
        ];
    }

    // ── Org relationships ──────────────────────────────────────────────────

    public function currentOrg(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'current_org_id');
    }

    public function organizations(): BelongsToMany
    {
        return $this->belongsToMany(Organization::class, 'org_members')
                    ->withPivot('role', 'status', 'joined_at')
                    ->withTimestamps();
    }

    public function ownedOrganizations(): HasMany
    {
        return $this->hasMany(Organization::class, 'owner_id');
    }

    // ── Profile relationships ──────────────────────────────────────────────

    public function carrierProfile(): HasOne
    {
        return $this->hasOne(CarrierProfile::class);
    }

    public function shipperProfile(): HasOne
    {
        return $this->hasOne(ShipperProfile::class);
    }

    // ── Person checks (docs/people-types-and-checks.md) ────────────────────

    public function personVerification(): HasOne
    {
        return $this->hasOne(PersonVerification::class);
    }

    public function personIdentity(): HasOne
    {
        return $this->hasOne(PersonIdentity::class);
    }

    public function personCredentials(): HasMany
    {
        return $this->hasMany(PersonCredential::class);
    }

    public function dispatchedShipments(): HasMany
    {
        return $this->hasMany(Shipment::class, 'shipper_id');
    }

    public function assignedShipments(): HasMany
    {
        return $this->hasMany(Shipment::class, 'carrier_id');
    }

    public function inboundShipments(): HasMany
    {
        return $this->hasMany(Shipment::class, 'receiver_id');
    }

    public function paymentMethods(): HasMany
    {
        return $this->hasMany(PaymentMethod::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'shipper_id');
    }

    public function preferredCarriers(): HasMany
    {
        return $this->hasMany(PreferredCarrier::class, 'shipper_id');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'shipper_id');
    }

    // ── Role helpers ───────────────────────────────────────────────────────
    // Checks org type first (multi-org), falls back to legacy role column.

    public function isCarrier(): bool
    {
        return $this->currentOrg?->type === 'carrier'
            || $this->role === 'carrier';
    }

    public function isShipper(): bool
    {
        return $this->currentOrg?->type === 'shipper'
            || $this->role === 'shipper';
    }

    public function isFactor(): bool
    {
        return $this->currentOrg?->type === 'factor'
            || $this->role === 'factor';
    }

    public function isReceiver(): bool      { return $this->role === 'receiver'; }
    public function isPlatformAdmin(): bool { return $this->role === 'admin'; }

    /** Org role for the current org */
    public function orgRole(): ?string
    {
        return OrgMember::where('org_id', $this->current_org_id)
                        ->where('user_id', $this->id)
                        ->value('role');
    }

    public function isOrgOwner(): bool  { return $this->orgRole() === 'owner'; }
    public function isOrgAdmin(): bool  { return in_array($this->orgRole(), ['owner', 'staff']); }
    public function isDriver(): bool    { return $this->orgRole() === 'driver'; }
    public function isDispatcher(): bool { return in_array($this->orgRole(), ['owner', 'staff', 'dispatcher']); }
}
