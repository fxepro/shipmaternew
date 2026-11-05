<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Location extends Model
{
    protected $fillable = [
        'org_id', 'type', 'name',
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
            'lat'             => 'float',
            'lng'             => 'float',
            'last_used_at'    => 'datetime',
        ];
    }

    public function org(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }

    public function incrementUsage(): void
    {
        $this->update([
            'usage_count'  => $this->usage_count + 1,
            'last_used_at' => now(),
        ]);
    }
}
