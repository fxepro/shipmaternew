<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A person at a company. Rows are kept when someone leaves (left_at is set), so the history of who worked where,
 * and when, survives. Every normal query sees current members only; history() includes past ones.
 */
class OrgMember extends Model
{
    protected $fillable = [
        'org_id', 'user_id', 'role', 'status', 'joined_at', 'left_at', 'drives',
    ];

    protected function casts(): array
    {
        return ['joined_at' => 'datetime', 'left_at' => 'datetime', 'drives' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::addGlobalScope('current', fn (Builder $q) => $q->whereNull($q->getModel()->getTable() . '.left_at'));
        static::creating(function (OrgMember $m) { $m->joined_at ??= now(); });
    }

    /** Current and past memberships */
    public static function history(): Builder
    {
        return static::withoutGlobalScope('current');
    }

    /** The person left (or was removed): kept as history, no longer a member */
    public function end(): void
    {
        $this->forceFill(['left_at' => now()])->save();
    }

    /** People who drive for the company: the Driver role, and an owner who drives (owner-operator) */
    public function scopeDrivers($q)
    {
        return $q->where(fn ($w) => $w->where('role', 'driver')->orWhere('drives', true));
    }

    public function isDriving(): bool
    {
        return $this->role === 'driver' || (bool) $this->drives;
    }

    public function org(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
