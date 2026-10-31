<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One amount Shipmater earned (or refunded), with the load volume it came from. */
class LedgerEntry extends Model
{
    protected $fillable = ['kind', 'amount_cents', 'gross_cents', 'org_id', 'source_type', 'source_id', 'reference', 'description', 'occurred_at'];

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }

    public function org(): BelongsTo { return $this->belongsTo(Organization::class, 'org_id'); }

    /** Record once: the same kind + source + reference is never written twice */
    public static function record(string $kind, int $amountCents, array $attrs = []): self
    {
        return self::firstOrCreate(
            ['kind' => $kind, 'source_type' => $attrs['source_type'] ?? null, 'source_id' => $attrs['source_id'] ?? null, 'reference' => $attrs['reference'] ?? null],
            ['amount_cents' => $amountCents, 'gross_cents' => $attrs['gross_cents'] ?? 0, 'org_id' => $attrs['org_id'] ?? null,
             'description' => $attrs['description'] ?? null, 'occurred_at' => $attrs['occurred_at'] ?? now()]
        );
    }
}
