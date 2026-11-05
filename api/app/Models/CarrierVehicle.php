<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CarrierVehicle extends Model
{
    protected $fillable = [
        'carrier_id',
        'type', 'year', 'make', 'model', 'vin',
        'license_plate', 'license_plate_state',
        'gvwr', 'max_payload',
        'cargo_length', 'cargo_width', 'cargo_height',
        'liftgate', 'climate_controlled', 'enclosed',
        'is_primary', 'registration_expiry',
    ];

    protected function casts(): array
    {
        return [
            'liftgate'             => 'boolean',
            'climate_controlled'   => 'boolean',
            'enclosed'             => 'boolean',
            'is_primary'           => 'boolean',
            'gvwr'                 => 'decimal:2',
            'max_payload'          => 'decimal:2',
            'cargo_length'         => 'decimal:2',
            'cargo_width'          => 'decimal:2',
            'cargo_height'         => 'decimal:2',
            'registration_expiry'  => 'date',
        ];
    }

    public function carrier(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'carrier_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(CarrierDocument::class);
    }
}
