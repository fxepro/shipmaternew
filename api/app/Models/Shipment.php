<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use App\Models\ServiceType;

class Shipment extends Model
{
    use HasLoadPeople;

    public function loadType(): string { return 'shipment'; }

    protected $fillable = [
        'shipper_id', 'carrier_id', 'receiver_id',
        'service_type_id', 'required_cert_keys',
        'status', 'job_type', 'contract_id',
        'item_description', 'item_category', 'weight_lbs',
        'handling_requirements', 'special_notes',
        'pickup_address', 'pickup_city', 'pickup_state',
        'pickup_lat', 'pickup_lng',
        'pickup_contact_name', 'pickup_contact_phone',
        'pickup_date', 'pickup_time_window',
        'delivery_address', 'delivery_city', 'delivery_state',
        'delivery_lat', 'delivery_lng',
        'delivery_contact_name', 'delivery_contact_phone',
        'delivery_date', 'delivery_time_window',
        'distance_miles', 'estimated_duration_mins',
        'agreed_cost', 'tracking_token',
        'delivered_at', 'delivery_photo_url', 'route_polyline',
        'payment_intent_id', 'payment_status', 'platform_fee_cents', 'transfer_id',
    ];

    protected function casts(): array
    {
        return [
            'handling_requirements' => 'array',
            'required_cert_keys'    => 'array',
            'pickup_date'           => 'date',
            'delivery_date'         => 'date',
            'delivered_at'          => 'datetime',
            'route_polyline'         => 'array',
            'pickup_lat'            => 'decimal:8',
            'pickup_lng'            => 'decimal:8',
            'delivery_lat'          => 'decimal:8',
            'delivery_lng'          => 'decimal:8',
            'weight_lbs'            => 'decimal:2',
            'distance_miles'        => 'decimal:2',
            'agreed_cost'           => 'decimal:2',
            'platform_fee_cents'    => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Shipment $shipment) {
            if (empty($shipment->tracking_token)) {
                $shipment->tracking_token = Str::upper(Str::random(8));
            }
        });
    }

    // ── Relationships ──────────────────────────────────────────────────

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }

    public function bids(): HasMany
    {
        return $this->hasMany(Bid::class);
    }

    public function gpsPings(): HasMany
    {
        return $this->hasMany(GpsPing::class)->orderBy('pinged_at');
    }

    public function latestPing(): HasMany
    {
        return $this->hasMany(GpsPing::class)->latest('pinged_at')->limit(1);
    }

    public function serviceType(): BelongsTo
    {
        return $this->belongsTo(ServiceType::class);
    }
}