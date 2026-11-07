<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A load: what Shipmater calls a shipment or a job. Its places are stops (job_stops), any number of
 * pickups and drop-offs, each pointing to a location. The carrier is chosen up front (contracted,
 * contract_id set) or later from offers (open market).
 */
class FreightJob extends Model
{
    use HasLoadPeople;

    public function loadType(): string { return 'freight_job'; }

    protected $table = 'freight_jobs';

    protected $fillable = [
        'contract_id', 'shipper_id', 'carrier_id',
        'title', 'reference_number', 'tracking_token', 'special_instructions',
        'total_weight_lbs', 'status', 'optimization_mode',
        'route_distance_miles', 'route_duration_minutes',
        'route_optimized_at', 'route_snapshot', 'cost_breakdown',
        'quote_requirements',
        'payment_amount_cents', 'payment_status', 'currency', 'posted_at', 'completed_at',
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
            'completed_at'          => 'datetime',
            'bol_generated_at'      => 'datetime',
            'invoice_date'          => 'date',
            'invoice_due_date'      => 'date',
            'invoice_generated_at'  => 'datetime',
            'route_distance_miles'  => 'float',
        ];
    }

    protected static function booted(): void
    {
        // Every load gets a public tracking code (the /track page)
        static::creating(function (FreightJob $job) {
            if (!$job->tracking_token) {
                do { $t = strtoupper(\Illuminate\Support\Str::random(10)); } while (static::where('tracking_token', $t)->exists());
                $job->tracking_token = $t;
            }
        });
    }

    public function contract(): BelongsTo  { return $this->belongsTo(Contract::class); }
    public function gpsPings(): HasMany    { return $this->hasMany(GpsPing::class)->orderByDesc('pinged_at'); }
    public function latestPing(): HasMany  { return $this->hasMany(GpsPing::class)->orderByDesc('pinged_at')->limit(1); }

    /**
     * The status people see, in the words the pages use:
     * draft, pending (posted, no carrier yet), assigned (carrier chosen), in_transit, delivered, cancelled, disputed.
     */
    public function displayStatus(): string
    {
        return match ($this->status) {
            'posted'      => $this->carrier_id ? 'assigned' : 'pending',
            'in_progress' => 'in_transit',
            'completed'   => 'delivered',
            default       => $this->status,
        };
    }

    /** Filter by the status people see (see displayStatus) */
    public function scopeDisplayStatus($q, string $status)
    {
        return match ($status) {
            'pending'    => $q->where('status', 'posted')->whereNull('carrier_id'),
            'assigned'   => $q->where('status', 'posted')->whereNotNull('carrier_id'),
            'in_transit' => $q->where('status', 'in_progress'),
            'delivered'  => $q->where('status', 'completed'),
            default      => $q->where('status', $status),
        };
    }

    /** Agreed price in dollars */
    public function amount(): ?float
    {
        return $this->payment_amount_cents !== null ? $this->payment_amount_cents / 100 : null;
    }

    /** "Dallas, TX → Austin, TX", first pickup to last drop-off */
    public function routeLabel(): string
    {
        $stops = $this->relationLoaded('stops') ? $this->stops : $this->stops()->get();
        $from = $stops->firstWhere('stop_type', 'pickup');
        $to   = $stops->where('stop_type', 'dropoff')->last();
        $place = fn ($s) => $s ? trim("{$s->city}, {$s->state}", ' ,') : '';
        return trim($place($from) . ' → ' . $place($to), ' →');
    }
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
