<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The identity record Shipmater keeps for a person. The ID number is encrypted at rest and
 * only its last 4 digits are ever shown. The full SSN is never stored.
 */
class PersonIdentity extends Model
{
    protected $fillable = [
        'user_id',
        'legal_first_name', 'legal_middle_name', 'legal_last_name', 'suffix', 'date_of_birth',
        'street', 'unit', 'city', 'state', 'zip', 'country', 'phone',
        'id_type', 'id_number', 'id_number_last4', 'id_issuing_state', 'id_issuing_country', 'id_issue_date', 'id_expiry_date',
        'id_front_path', 'id_back_path', 'selfie_path', 'ssn_last4',
        'status', 'verification_method', 'provider_reference', 'failure_reason', 'submitted_at', 'verified_at', 'verified_by',
    ];

    protected $hidden = ['id_number', 'id_front_path', 'id_back_path', 'selfie_path'];

    protected function casts(): array
    {
        return [
            'id_number'      => 'encrypted',
            'date_of_birth'  => 'date',
            'id_issue_date'  => 'date',
            'id_expiry_date' => 'date',
            'submitted_at'   => 'datetime',
            'verified_at'    => 'datetime',
        ];
    }

    /** Keep the last 4 in step with the encrypted number */
    protected static function booted(): void
    {
        static::saving(function (PersonIdentity $identity) {
            if ($identity->isDirty('id_number')) {
                $digits = preg_replace('/\s+/', '', (string) $identity->id_number);
                $identity->id_number_last4 = $digits !== '' ? substr($digits, -4) : null;
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isVerified(): bool
    {
        return $this->status === 'verified';
    }

    public function age(): ?int
    {
        return $this->date_of_birth?->age;
    }
}
