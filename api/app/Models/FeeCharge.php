<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Shipmater's fee on a factored load, charged to the carrier when the factor marks the load funded. */
class FeeCharge extends Model
{
    protected $fillable = [
        'factored_load_id', 'carrier_org_id', 'load_amount_cents', 'amount_cents', 'fee_rate', 'status',
        'payment_method_id', 'payment_intent_id', 'failure_reason', 'attempts', 'paid_at',
    ];

    protected function casts(): array
    {
        return ['fee_rate' => 'decimal:4', 'paid_at' => 'datetime'];
    }

    public function factoredLoad(): BelongsTo { return $this->belongsTo(FactoredLoad::class); }
    public function carrierOrg(): BelongsTo   { return $this->belongsTo(Organization::class, 'carrier_org_id'); }
}
