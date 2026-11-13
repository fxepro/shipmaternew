<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrgMember extends Model
{
    protected $fillable = [
        'org_id', 'user_id', 'role', 'status', 'joined_at', 'drives',
    ];

    protected function casts(): array
    {
        return ['joined_at' => 'datetime', 'drives' => 'boolean'];
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
