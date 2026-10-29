<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A licence, medical card, certification or check result held by one person. */
class PersonCredential extends Model
{
    /** Check results that count as passed */
    public const RESULT_PASSED = ['clear', 'negative', 'passed'];

    protected $fillable = [
        'user_id', 'type', 'name', 'issuer', 'number', 'issuing_state', 'class', 'issued_at', 'expires_at',
        'result', 'document_path', 'source', 'verified_at', 'verified_by', 'notes',
    ];

    protected $hidden = ['document_path'];

    protected function casts(): array
    {
        return [
            'issued_at'   => 'date',
            'expires_at'  => 'date',
            'verified_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->endOfDay()->isPast();
    }

    /** A failed result (e.g. Clearinghouse violations, failed MVR) */
    public function hasFailedResult(): bool
    {
        return $this->result !== null && !in_array($this->result, self::RESULT_PASSED, true) && $this->result !== 'pending';
    }

    /** Verified by an admin (or by the check itself), not expired, and no failed result */
    public function isGood(): bool
    {
        return $this->verified_at !== null && !$this->isExpired() && !$this->hasFailedResult()
            && ($this->result === null || in_array($this->result, self::RESULT_PASSED, true));
    }
}
