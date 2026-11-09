<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A company checked against an outside source: KYB (Middesk), FMCSA broker authority, SAM.gov */
class OrgCheck extends Model
{
    protected $fillable = [
        'org_id', 'check', 'provider', 'mode', 'external_id', 'status', 'results', 'input_hash', 'error', 'requested_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return ['results' => 'array', 'requested_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function org(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }

    public static function for(Organization $o, string $check): ?self
    {
        return self::where('org_id', $o->id)->where('check', $check)->first();
    }

    /** One result from the check: ['state' => passed|failed|review|pending, 'message' => ?string] */
    public function result(string $key): array
    {
        $r = $this->results[$key] ?? null;
        if ($this->status === 'error') return ['state' => 'review', 'message' => 'The check could not run: ' . ($this->error ?: 'provider error')];
        return $r ?: ['state' => 'pending', 'message' => 'Waiting for the result'];
    }
}
