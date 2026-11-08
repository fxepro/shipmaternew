<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A person's professional profile: it goes with them from company to company */
class ProProfile extends Model
{
    public const ROLES = [
        'company_driver' => 'Company CDL driver', 'owner_operator' => 'Owner-operator', 'lease_operator' => 'Lease operator',
        'team_driver' => 'Team driver', 'heavy_haul_driver' => 'Heavy-haul driver', 'tanker_driver' => 'Tanker driver',
        'hazmat_driver' => 'HAZMAT driver', 'yard_jockey' => 'Yard jockey / hostler', 'dispatcher' => 'Dispatcher',
        'fleet_manager' => 'Fleet manager', 'safety_manager' => 'Safety / compliance manager', 'load_planner' => 'Load planner',
        'driver_recruiter' => 'Driver recruiter', 'driver_trainer' => 'Driver trainer', 'logistics_professional' => 'Logistics professional',
    ];
    public const HAUL_TYPES = ['local' => 'Local', 'regional' => 'Regional', 'otr' => 'Over the road', 'dedicated' => 'Dedicated route'];

    protected $fillable = [
        'user_id', 'headline', 'roles', 'cdl_class', 'cdl_state', 'endorsements', 'years_experience', 'equipment_experience',
        'haul_types', 'team_ok', 'home_city', 'home_state', 'home_country', 'preferred_regions', 'open_to_work',
        'available_from', 'bio', 'visibility',
    ];

    protected function casts(): array
    {
        return [
            'roles' => 'array', 'endorsements' => 'array', 'equipment_experience' => 'array', 'haul_types' => 'array',
            'preferred_regions' => 'array', 'team_ok' => 'boolean', 'open_to_work' => 'boolean', 'available_from' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function toCard(): array
    {
        return [
            'headline' => $this->headline, 'roles' => $this->roles ?? [],
            // CDL class and state come from the person's CDL (Driving credentials)
            'cdl_class' => ($cdl = \App\Services\PersonChecks::credential((int) $this->user_id, 'cdl'))?->class, 'cdl_state' => $cdl?->issuing_state,
            // From the person's CDL credentials (Driving credentials), not edited here
            'endorsements' => \App\Support\Endorsements::forUser((int) $this->user_id), 'years_experience' => $this->years_experience,
            'equipment_experience' => $this->equipment_experience ?? [], 'haul_types' => $this->haul_types ?? [], 'team_ok' => (bool) $this->team_ok,
            'home_city' => $this->home_city, 'home_state' => $this->home_state, 'home_country' => $this->home_country ?? 'US',
            'preferred_regions' => $this->preferred_regions ?? [], 'open_to_work' => (bool) $this->open_to_work,
            'available_from' => $this->available_from?->toDateString(), 'bio' => $this->bio, 'visibility' => $this->visibility ?? 'private',
        ];
    }
}
