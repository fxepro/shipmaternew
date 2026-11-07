<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A position reported by the carrier while a load is moving */
class GpsPing extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'freight_job_id',
        'lat',
        'lng',
        'speed',
        'eta',
        'pinged_at',
    ];

    protected function casts(): array
    {
        return [
            'lat'       => 'decimal:8',
            'lng'       => 'decimal:8',
            'speed'     => 'decimal:2',
            'pinged_at' => 'datetime',
        ];
    }

    public function freightJob(): BelongsTo
    {
        return $this->belongsTo(FreightJob::class);
    }
}
