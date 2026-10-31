<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** The shipper's payment for one load (docs/fees-and-billing.md). See App\Services\Payments\LoadPayments. */
class LoadPayment extends Model
{
    protected $fillable = [
        'load_type', 'load_id', 'shipper_org_id', 'carrier_org_id', 'payee_org_id', 'payee_type', 'factored_load_id',
        'amount_cents', 'fee_cents', 'fee_rate', 'early', 'flow', 'method', 'pickup_date', 'status', 'payment_method_id',
        'stripe_account', 'payment_intent_id', 'charge_id', 'held_at', 'capture_before', 'paid_at', 'failure_reason',
        'failed_at', 'attempts', 'refunded_cents',
    ];

    protected function casts(): array
    {
        return [
            'early'          => 'boolean',
            'fee_rate'       => 'decimal:4',
            'pickup_date'    => 'date',
            'held_at'        => 'datetime',
            'capture_before' => 'datetime',
            'paid_at'        => 'datetime',
            'failed_at'      => 'datetime',
        ];
    }

    public function shipperOrg(): BelongsTo    { return $this->belongsTo(Organization::class, 'shipper_org_id'); }
    public function carrierOrg(): BelongsTo    { return $this->belongsTo(Organization::class, 'carrier_org_id'); }
    public function payeeOrg(): BelongsTo      { return $this->belongsTo(Organization::class, 'payee_org_id'); }
    public function paymentMethod(): BelongsTo { return $this->belongsTo(PaymentMethod::class); }
    public function factoredLoad(): BelongsTo  { return $this->belongsTo(FactoredLoad::class); }

    public function loadRecord(): ?Model
    {
        return $this->load_type === 'freight_job' ? FreightJob::find($this->load_id) : Shipment::find($this->load_id);
    }

    /** The carrier or factor receives this (amount less Shipmater's fee) */
    public function netCents(): int
    {
        return (int) $this->amount_cents - (int) $this->fee_cents;
    }
}
