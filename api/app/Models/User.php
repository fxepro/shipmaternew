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

    // ── Admin viewing a company (Admin Console, Carrier View and Shipper View) ──

    /** The company a platform admin is reading as, for this request only (App\Http\Middleware\ViewAsCompany) */
    public ?Organization $viewingAs = null;

    /** Read this request as the company: it becomes the current company in memory, with view access to everything */
    public function viewAs(Organization $org): void
    {
        $this->viewingAs = $org;
        $this->current_org_id = $org->id;
        $this->setRelation('currentOrg', $org);
    }

    protected static function booted(): void
    {
        // Never save the company an admin is viewing as their own
        static::saving(function (User $user) {
            if ($user->viewingAs) {
                $user->current_org_id = $user->getOriginal('current_org_id');
            }
        });
    }

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

    // ── Person checks (docs/people-types-and-checks.md) ────────────────────

    public function personVerification(): HasOne
    {
        return $this->hasOne(PersonVerification::class);
    }

    public function personIdentity(): HasOne
    {
        return $this->hasOne(PersonIdentity::class);
    }

    /** Professional profile: CDL, endorsements, experience, open to work */
    public function proProfile(): HasOne
    {
        return $this->hasOne(ProProfile::class);
    }

    public function personCredentials(): HasMany
    {
        return $this->hasMany(PersonCredential::class);
    }

    public function paymentMethods(): HasMany
    {
        return $this->hasMany(PaymentMethod::class);
    }

    /** Loads this person is on (load_people) */
    public function shipments()
    {
        return FreightJob::forPerson($this->id);
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

    public function isBroker(): bool
    {
        return $this->currentOrg?->type === 'broker'
            || $this->role === 'broker';
    }

    /** Shippers and brokers post loads, book carriers and pay them */
    public function postsLoads(): bool
    {
        return $this->isShipper() || $this->isBroker();
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
        if ($this->viewingAs) return 'viewer';
        return OrgMember::where('org_id', $this->current_org_id)
                        ->where('user_id', $this->id)
                        ->value('role');
    }

    // ── Company sides on a row ─────────────────────────────────────────────
    // shipper_id / carrier_id on loads, contracts, bids and so on are companies (organizations.id).

    /**
     * The person's current company is the shipper side on this row: on a load, the company that posted it
     * (the broker when there is one); on contracts, bids and payments, the company that books and pays.
     */
    public function isShipperOf($row): bool
    {
        $id = $row instanceof FreightJob ? $row->posterId() : $row?->shipper_id;
        return $this->current_org_id && (int) $id === (int) $this->current_org_id;
    }

    /** The person's company is the shipper whose freight a broker handles (it may look, not act) */
    public function isCustomerOf($row): bool
    {
        return $this->current_org_id && $row instanceof FreightJob && $row->broker_id
            && (int) $row->shipper_id === (int) $this->current_org_id;
    }

    /** The person's current company is the carrier on this row */
    public function isCarrierOf($row): bool
    {
        return $this->current_org_id && (int) $row?->carrier_id === (int) $this->current_org_id;
    }

    // ── Role permissions (Admin Console, Settings, Roles & Permissions; App\Support\Permissions) ──

    /** This person's level for an action in their current company: full, view, assigned, self or none */
    public function permLevel(string $action): string
    {
        if ($this->viewingAs) return 'view';
        return \App\Support\Permissions::level($this->currentOrg?->type, $this->orgRole(), $action);
    }

    /** May act (full, or on their own assigned loads or record) */
    public function canDo(string $action): bool
    {
        return in_array($this->permLevel($action), ['full', 'assigned', 'self'], true);
    }

    /** May see (anything but none) */
    public function canSee(string $action): bool
    {
        return $this->permLevel($action) !== 'none';
    }

    /** Sees only the loads they are on (drivers, by default) */
    public function onlyAssignedLoads(): bool
    {
        return $this->permLevel('loads.view') === 'assigned';
    }

    public function isOrgOwner(): bool  { return $this->orgRole() === 'owner'; }
    public function isOrgAdmin(): bool  { return in_array($this->orgRole(), ['owner', 'staff']); }
    public function isDriver(): bool    { return $this->orgRole() === 'driver'; }
    public function isDispatcher(): bool { return in_array($this->orgRole(), ['owner', 'staff', 'dispatcher']); }
}
