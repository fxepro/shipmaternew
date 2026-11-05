<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FreightJob extends Model
{
    use HasLoadPeople;

    public function loadType(): string { return 'freight_job'; }

    protected $table = 'freight_jobs';

    protected $fillable = [
        'contract_id', 'shipper_id', 'carrier_id',
        'title', 'reference_number', 'special_instructions',
        'total_weight_lbs', 'status', 'optimization_mode',
        'route_distance_miles', 'route_duration_minutes',
        'route_optimized_at', 'route_snapshot', 'cost_breakdown',
        'quote_requirements',
        'payment_amount_cents', 'payment_status', 'currency', 'posted_at',
        'bol_pdf_key', 'bol_pdf_url', 'bol_generated_at',
        'invoice_number', 'invoice_date', 'invoice_due_date',
        'invoice_pdf_key', 'invoice_pdf_url', 'invoice_generated_at',
    ];

    protected function casts(): array
    {
        return [
            'route_snapshot'        => 'array',
            'cost_breakdown'        => 'array',
            'quote_requirements'    => 'array',
            'route_optimized_at'    => 'datetime',
            'posted_at'             => 'datetime',
            'bol_generated_at'      => 'datetime',
            'invoice_date'          => 'date',
            'invoice_due_date'      => 'date',
            'invoice_generated_at'  => 'datetime',
            'route_distance_miles'  => 'float',
        ];
    }

    public function contract(): BelongsTo  { return $this->belongsTo(Contract::class); }
    public function stops(): HasMany       { return $this->hasMany(JobStop::class)->orderBy('optimized_sequence')->orderBy('sequence'); }
    public function evidence(): HasMany    { return $this->hasMany(JobEvidence::class); }
    public function offers(): HasMany      { return $this->hasMany(FreightJobOffer::class)->latest(); }
    public function ratings(): HasMany     { return $this->hasMany(Rating::class); }

    public function pickupStops(): HasMany
    {
        return $this->hasMany(JobStop::class)->where('stop_type', 'pickup')->orderBy('optimized_sequence')->orderBy('sequence');
    }

    public function deliveryStops(): HasMany
    {
        return $this->hasMany(JobStop::class)->where('stop_type', 'dropoff')->orderBy('optimized_sequence')->orderBy('sequence');
    }
}
