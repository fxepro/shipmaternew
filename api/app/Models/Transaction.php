<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    protected $fillable = [
        'shipper_id', 'carrier_id', 'user_id', 'shipment_id', 'payment_method_id',
        'invoice_no', 'description', 'category', 'pickup', 'delivery',
        'amount', 'status', 'due_date', 'notes', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'amount'   => 'float',
            'due_date'  => 'date',
            'paid_at'   => 'datetime',
        ];
    }

    public function shipper(): BelongsTo { return $this->belongsTo(Organization::class, 'shipper_id'); }
    public function carrier(): BelongsTo { return $this->belongsTo(Organization::class, 'carrier_id'); }
    /** The carrier's person who did the work */
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function shipment(): BelongsTo { return $this->belongsTo(Shipment::class); }
    public function paymentMethod(): BelongsTo { return $this->belongsTo(PaymentMethod::class); }
}
