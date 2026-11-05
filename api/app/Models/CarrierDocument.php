<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarrierDocument extends Model
{
    protected $fillable = [
        'carrier_id', 'carrier_vehicle_id',
        'type', 'name', 'url', 'mime_type', 'size',
        'policy_number', 'insurer_name', 'coverage_amount',
        'effective_date', 'expiry_date',
        'verified_by', 'verified_at', 'verification_notes',
    ];

    protected function casts(): array
    {
        return [
            'coverage_amount' => 'decimal:2',
            'effective_date'  => 'date',
            'expiry_date'     => 'date',
            'verified_at'     => 'datetime',
        ];
    }

    public function carrier(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'carrier_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(CarrierVehicle::class, 'carrier_vehicle_id');
    }
}
