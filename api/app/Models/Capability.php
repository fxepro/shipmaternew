<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Catalog entry: equipment type, vehicle feature or driver endorsement */
class Capability extends Model
{
    protected $fillable = ['key', 'name', 'kind', 'service_type_key', 'description', 'sort_order', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public static function keys(string $kind): array
    {
        return static::where('kind', $kind)->where('active', true)->pluck('key')->all();
    }
}
