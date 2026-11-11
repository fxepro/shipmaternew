<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One saved version of a company's FMCSA public record (see the fmcsa_records migration) */
class FmcsaRecord extends Model
{
    protected $fillable = ['org_id', 'dot', 'mc', 'data', 'data_hash', 'pulled_at'];

    protected function casts(): array
    {
        return ['data' => 'array', 'pulled_at' => 'datetime'];
    }

    public static function latestFor(int $orgId): ?self
    {
        return self::where('org_id', $orgId)->orderByDesc('id')->first();
    }
}
