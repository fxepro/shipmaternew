<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShipperDocument extends Model
{
    protected $fillable = [
        'shipper_profile_id',
        'type', 'name', 'url', 'mime_type', 'size',
        'verified_by', 'verified_at', 'verification_notes',
    ];

    protected function casts(): array
    {
        return [
            'verified_at' => 'datetime',
        ];
    }

    /** A link that opens a stored file: signed for R2 (one hour), public otherwise. */
    public static function fileUrl(?string $path): ?string
    {
        if (!$path) return null;
        if (str_starts_with($path, 'http')) return $path;
        try {
            $r2 = config('filesystems.disks.r2');
            return !empty($r2['key']) && !empty($r2['bucket'])
                ? \Illuminate\Support\Facades\Storage::disk('r2')->temporaryUrl($path, now()->addHour())
                : \Illuminate\Support\Facades\Storage::disk('public')->url($path);
        } catch (\Throwable) {
            return null;
        }
    }

    public function shipperProfile(): BelongsTo
    {
        return $this->belongsTo(ShipperProfile::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
