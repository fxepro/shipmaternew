<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One job in a person's work history. "Verified" when the job is at a Shipmater company the person is or was a member of. */
class ProExperience extends Model
{
    public const TYPES = [
        'company_driver' => 'Company driver', 'owner_operator' => 'Owner-operator', 'lease_operator' => 'Lease operator',
        'contract' => 'Contract', 'office' => 'Office / staff', 'training' => 'Training',
    ];

    protected $fillable = ['user_id', 'title', 'company_name', 'org_id', 'employment_type', 'location', 'start_date', 'end_date', 'description', 'equipment'];

    protected function casts(): array
    {
        return ['start_date' => 'date', 'end_date' => 'date', 'equipment' => 'array'];
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function org(): BelongsTo { return $this->belongsTo(Organization::class, 'org_id'); }

    /** Verified: the job is at a Shipmater company and the person is a member of it */
    public function isVerified(): bool
    {
        return $this->org_id !== null
            && \Illuminate\Support\Facades\DB::table('org_members')->where('org_id', $this->org_id)->where('user_id', $this->user_id)->exists();
    }

    public function toCard(): array
    {
        return [
            'id' => $this->id, 'title' => $this->title, 'company_name' => $this->company_name, 'org_id' => $this->org_id,
            'employment_type' => $this->employment_type, 'employment_type_label' => self::TYPES[$this->employment_type] ?? null,
            'location' => $this->location, 'start_date' => $this->start_date?->format('Y-m'), 'end_date' => $this->end_date?->format('Y-m'),
            'current' => $this->end_date === null, 'description' => $this->description, 'equipment' => $this->equipment ?? [],
            'verified' => $this->isVerified(),
        ];
    }
}
