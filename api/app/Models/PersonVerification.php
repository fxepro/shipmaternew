<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Approval status and background check for one person at a carrier or shipper company. */
class PersonVerification extends Model
{
    /** Background results that count as passed (same as companies) */
    public const BACKGROUND_PASSED = ['clear', 'approved', 'passed'];

    protected $fillable = [
        'user_id', 'status', 'notes', 'reviewed_at', 'reviewed_by',
        'background_check_status', 'background_check_reference', 'background_check_notes', 'background_checked_at',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at'           => 'datetime',
            'background_checked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function backgroundPassed(): bool
    {
        return in_array($this->background_check_status, self::BACKGROUND_PASSED, true);
    }
}
