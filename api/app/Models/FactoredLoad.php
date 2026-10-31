<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A load a carrier factors under an NOA. Accepted loads are paid by the shipper into the factor's Stripe account. */
class FactoredLoad extends Model
{
    protected $fillable = [
        'noa_id', 'carrier_org_id', 'factor_org_id', 'load_type', 'load_id', 'load_amount', 'status',
        'requested_by', 'decided_by', 'decided_at', 'decline_reason', 'funded_at', 'funded_by',
        'shipper_acknowledged_at', 'shipper_acknowledged_by',
    ];

    protected function casts(): array
    {
        return [
            'load_amount'             => 'decimal:2',
            'decided_at'              => 'datetime',
            'funded_at'               => 'datetime',
            'shipper_acknowledged_at' => 'datetime',
        ];
    }

    public function noa(): BelongsTo        { return $this->belongsTo(Noa::class); }
    public function carrierOrg(): BelongsTo { return $this->belongsTo(Organization::class, 'carrier_org_id'); }
    public function factorOrg(): BelongsTo  { return $this->belongsTo(Organization::class, 'factor_org_id'); }

    /** The shipment or freight job */
    public function loadRecord(): ?Model
    {
        return $this->load_type === 'freight_job' ? FreightJob::find($this->load_id) : Shipment::find($this->load_id);
    }

    /** The factor is owed this load's payment (accepted or already funded) */
    public function routesToFactor(): bool
    {
        return in_array($this->status, ['accepted', 'funded'], true);
    }
}
