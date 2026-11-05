<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FreightJobOffer extends Model
{
    protected $table = 'freight_job_offers';

    protected $fillable = [
        'freight_job_id',
        'carrier_id',
        'user_id',
        'rate_type',
        'rate_value',
        'amount',
        'fuel_surcharge',
        'detention_rate',
        'free_time_hrs',
        'equipment_type',
        'max_weight_lbs',
        'payment_terms',
        'note',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'amount'         => 'decimal:2',
            'rate_value'     => 'decimal:2',
            'fuel_surcharge' => 'decimal:2',
            'detention_rate' => 'decimal:2',
        ];
    }

    public function freightJob(): BelongsTo
    {
        return $this->belongsTo(FreightJob::class);
    }

    /** The carrier company */
    public function carrier(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'carrier_id');
    }

    /** The person who placed it */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
