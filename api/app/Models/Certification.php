<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Certification extends Model
{
    protected $fillable = [
        'parent_id', 'key', 'name', 'description', 'icon',
        'category', 'active', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Certification::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Certification::class, 'parent_id')->orderBy('sort_order');
    }
}
