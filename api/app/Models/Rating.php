<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Rating extends Model
{
    protected $fillable = [
        'freight_job_id',
        'user_id',
        'rater_id', 'ratee_id',
        'rater_type',
        'overall', 'communication', 'reliability',
        'comment', 'is_public',
    ];

    protected function casts(): array
    {
        return [
            'overall'       => 'integer',
            'communication' => 'integer',
            'reliability'   => 'integer',
            'is_public'     => 'boolean',
        ];
    }

    public function freightJob(): BelongsTo { return $this->belongsTo(FreightJob::class); }
    /** The person who wrote it */
    public function user(): BelongsTo       { return $this->belongsTo(User::class); }
    public function raterOrg(): BelongsTo   { return $this->belongsTo(Organization::class, 'rater_id'); }
    public function rateeOrg(): BelongsTo   { return $this->belongsTo(Organization::class, 'ratee_id'); }

    /** Average of all three sub-scores */
    public function averageScore(): float
    {
        return round(($this->overall + $this->communication + $this->reliability) / 3, 1);
    }
}
