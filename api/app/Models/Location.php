<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A site that belongs to an organization of any type. It has no pickup or delivery type: any location can
 * ship and receive, and a stop on a load points at it. Public locations can be found and used by everyone;
 * private ones only by their own company.
 */
class Location extends Model
{
    protected $fillable = [
        'org_id', 'created_by_org_id', 'name', 'visibility',
        'dock_doors', 'appointment_required', 'site_instructions',
        'contact_name', 'contact_phone', 'contact_email',
        'address', 'city', 'state', 'zip', 'country',
        'lat', 'lng', 'operating_hours', 'notes',
        'is_default', 'usage_count', 'last_used_at',
    ];

    protected function casts(): array
    {
        return [
            'operating_hours' => 'array',
            'is_default'      => 'boolean',
            'appointment_required' => 'boolean',
            'lat'             => 'float',
            'lng'             => 'float',
            'last_used_at'    => 'datetime',
        ];
    }

    public function org(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(OrgContact::class);
    }

    /** Locations a company may put on a load: its own, and every public one */
    public function scopeUsableBy($q, ?int $orgId)
    {
        return $q->where(fn ($w) => $w->where('visibility', 'public')->orWhere('org_id', $orgId));
    }

    public function incrementUsage(): void
    {
        $this->update([
            'usage_count'  => $this->usage_count + 1,
            'last_used_at' => now(),
        ]);
    }
}
