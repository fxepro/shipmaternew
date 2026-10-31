<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A carrier company's notice of assignment to a factor (docs/noa-factoring.md). */
class Noa extends Model
{
    protected $fillable = [
        'carrier_org_id', 'factor_org_id', 'status', 'effective_date', 'document_path', 'release_document_path', 'notes',
        'uploaded_by', 'decided_by', 'decided_at', 'decline_reason', 'release_requested_at', 'released_by', 'released_at',
    ];

    protected function casts(): array
    {
        return [
            'effective_date'       => 'date',
            'decided_at'           => 'datetime',
            'release_requested_at' => 'datetime',
            'released_at'          => 'datetime',
        ];
    }

    public function carrierOrg(): BelongsTo { return $this->belongsTo(Organization::class, 'carrier_org_id'); }
    public function factorOrg(): BelongsTo  { return $this->belongsTo(Organization::class, 'factor_org_id'); }
    public function loads(): HasMany        { return $this->hasMany(FactoredLoad::class); }

    /** Confirmed by the factor and in effect today */
    public function isInForce(): bool
    {
        return $this->status === 'active' && $this->effective_date->lte(today());
    }
}
