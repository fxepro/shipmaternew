<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contract extends Model
{
    protected $fillable = [
        'shipper_id', 'carrier_id',
        'rate_type', 'rate', 'fuel_surcharge', 'detention_rate', 'free_time_hrs',
        'equipment_type', 'max_weight_lbs', 'coverage',
        'payment_terms', 'priority', 'auto_renew',
        'valid_from', 'valid_to', 'status', 'notes', 'shipments_under',
        'signed_at', 'carrier_response_at', 'carrier_declined_reason',
    ];

    protected function casts(): array
    {
        return [
            'rate'                 => 'float',
            'fuel_surcharge'       => 'float',
            'detention_rate'       => 'float',
            'auto_renew'           => 'boolean',
            'valid_from'           => 'date',
            'valid_to'             => 'date',
            'signed_at'            => 'datetime',
            'carrier_response_at'  => 'datetime',
        ];
    }

    public function shipper(): BelongsTo { return $this->belongsTo(Organization::class, 'shipper_id'); }
    public function carrier(): BelongsTo { return $this->belongsTo(Organization::class, 'carrier_id'); }
    public function freightJobs(): HasMany { return $this->hasMany(FreightJob::class); }
}
