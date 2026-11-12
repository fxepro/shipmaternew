<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CarrierVehicle extends Model
{
    /** A new or changed VIN is decoded by NHTSA vPIC after the response (demo/compliance-checks.html) */
    protected static function booted(): void
    {
        static::saved(function (CarrierVehicle $v) {
            if (!$v->wasRecentlyCreated && !$v->wasChanged('vin')) {
                // Details compared with the decoded VIN changed: compare again without calling NHTSA
                if ($v->wasChanged(['year', 'make', 'type', 'vehicle_class', 'gvwr'])) {
                    $v->forceFill(['vin_mismatches' => \App\Services\Checks\RegistryChecks::mismatches($v)])->saveQuietly();
                }
                return;
            }
            $id = $v->id;
            dispatch(function () use ($id) {
                if ($veh = CarrierVehicle::find($id)) \App\Services\Checks\RegistryChecks::vin($veh);
            })->afterResponse();
        });
    }

    protected $fillable = [
        'carrier_id', 'owner_org_id', 'owner_user_id', 'operating_authority_id',
        'unit_number', 'vehicle_class', 'equipment_type', 'temp_min_f', 'temp_max_f', 'trailer_length_ft', 'status',
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
            'vin_decoded'          => 'array',
            'vin_checked_at'       => 'datetime',
            'vin_mismatches'       => 'array',
            'vin_recalls'          => 'array',
            'recalls_checked_at'   => 'datetime',
            'gvwr'                 => 'decimal:2',
            'max_payload'          => 'decimal:2',
            'cargo_length'         => 'decimal:2',
            'cargo_width'          => 'decimal:2',
            'cargo_height'         => 'decimal:2',
            'registration_expiry'  => 'date',
            'trailer_length_ft'    => 'float',
        ];
    }

    /** Feature keys (liftgate, food_grade…) from the capabilities catalog */
    public function capabilityKeys(): array
    {
        return \Illuminate\Support\Facades\DB::table('vehicle_capabilities')->where('vehicle_id', $this->id)->pluck('capability_key')->all();
    }

    public function syncCapabilities(array $keys): void
    {
        $keys = Capability::whereIn('key', $keys)->where('kind', 'feature')->pluck('key')->all();
        $db = \Illuminate\Support\Facades\DB::table('vehicle_capabilities');
        $db->where('vehicle_id', $this->id)->whereNotIn('capability_key', $keys)->delete();
        foreach ($keys as $k) {
            \Illuminate\Support\Facades\DB::table('vehicle_capabilities')->updateOrInsert(['vehicle_id' => $this->id, 'capability_key' => $k], ['updated_at' => now(), 'created_at' => now()]);
        }
        // Keep the old flag in step
        $this->forceFill(['liftgate' => in_array('liftgate', $keys, true)])->saveQuietly();
    }

    /** The company that owns it (may differ from the carrier operating it, e.g. a lease-on) */
    public function ownerOrg(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'owner_org_id');
    }

    public function ownerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function authority(): BelongsTo
    {
        return $this->belongsTo(OperatingAuthority::class, 'operating_authority_id');
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
