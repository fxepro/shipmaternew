<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceType extends Model
{
    protected $fillable = [
        'parent_id', 'key', 'name', 'description', 'icon', 'category',
        'requires_dot', 'requires_mc', 'requires_cdl', 'requires_hazmat',
        'active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'requires_dot'    => 'boolean',
            'requires_mc'     => 'boolean',
            'requires_cdl'    => 'boolean',
            'requires_hazmat' => 'boolean',
            'active'          => 'boolean',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(ServiceType::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(ServiceType::class, 'parent_id')->orderBy('sort_order');
    }

    public function isCategory(): bool
    {
        return $this->parent_id === null;
    }
}
