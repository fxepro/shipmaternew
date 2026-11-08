<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A company's operating authority (DOT / MC / broker MC / foreign permit) and the insurance filed on it */
class OperatingAuthority extends Model
{
    public const KINDS = ['carrier', 'broker', 'forwarder'];
    public const STATUSES = ['pending', 'active', 'inactive', 'revoked'];

    protected $fillable = [
        'org_id', 'kind', 'country', 'dot_number', 'mc_number', 'authority_number', 'authority_type', 'status',
        'hazmat_authorized', 'is_primary', 'source', 'verified_at', 'verified_by',
        'auto_insurer_name', 'auto_policy_number', 'auto_coverage_amount', 'auto_expiry_date',
        'cargo_insurer_name', 'cargo_policy_number', 'cargo_coverage_amount', 'cargo_expiry_date',
        'bond_number', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'hazmat_authorized'     => 'boolean',
            'is_primary'            => 'boolean',
            'verified_at'           => 'datetime',
            'auto_expiry_date'      => 'date',
            'cargo_expiry_date'     => 'date',
            'auto_coverage_amount'  => 'float',
            'cargo_coverage_amount' => 'float',
        ];
    }

    public function org(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }

    /** Vehicles running under this authority, including leased-on vehicles owned by someone else */
    public function vehicles(): HasMany
    {
        return $this->hasMany(CarrierVehicle::class, 'operating_authority_id');
    }

    /** Active, and its auto insurance (when on file) is not past expiry */
    public function inGoodStanding(): bool
    {
        if ($this->status !== 'active') return false;
        return !$this->auto_expiry_date || !$this->auto_expiry_date->isPast();
    }

    public function toCard(): array
    {
        return [
            'id' => $this->id, 'kind' => $this->kind, 'country' => $this->country, 'dot_number' => $this->dot_number,
            'mc_number' => $this->mc_number, 'authority_number' => $this->authority_number, 'authority_type' => $this->authority_type,
            'status' => $this->status, 'hazmat_authorized' => $this->hazmat_authorized, 'is_primary' => $this->is_primary,
            'source' => $this->source, 'verified_at' => $this->verified_at?->toISOString(), 'good_standing' => $this->inGoodStanding(),
            'auto_insurer_name' => $this->auto_insurer_name, 'auto_policy_number' => $this->auto_policy_number,
            'auto_coverage_amount' => $this->auto_coverage_amount, 'auto_expiry_date' => $this->auto_expiry_date?->toDateString(),
            'cargo_insurer_name' => $this->cargo_insurer_name, 'cargo_policy_number' => $this->cargo_policy_number,
            'cargo_coverage_amount' => $this->cargo_coverage_amount, 'cargo_expiry_date' => $this->cargo_expiry_date?->toDateString(),
            'bond_number' => $this->bond_number, 'vehicles' => $this->vehicles()->count(),
        ];
    }
}
