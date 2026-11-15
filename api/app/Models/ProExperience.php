<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One job in a person's work history. "Verified" when the job is at a Shipmater company and the person's membership
 * there (joined_at to left_at) overlaps the job's dates; the verified dates are the membership's, not what was typed.
 */
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

    /** The membership at this job's company that overlaps the job's dates, current or past */
    public function membership(): ?OrgMember
    {
        if ($this->org_id === null) return null;
        $start = $this->start_date?->copy()->startOfMonth();
        $end   = $this->end_date?->copy()->endOfMonth();
        return OrgMember::history()->where('org_id', $this->org_id)->where('user_id', $this->user_id)
            ->when($end, fn ($q) => $q->where('joined_at', '<=', $end))
            ->when($start, fn ($q) => $q->where(fn ($w) => $w->whereNull('left_at')->orWhere('left_at', '>=', $start)))
            ->orderByDesc('joined_at')->first();
    }

    public function isVerified(): bool
    {
        return $this->membership() !== null;
    }

    public function toCard(): array
    {
        $m = $this->membership();
        return [
            'verified_from' => $m?->joined_at?->format('Y-m'), 'verified_to' => $m?->left_at?->format('Y-m'),
            'id' => $this->id, 'title' => $this->title, 'company_name' => $this->company_name, 'org_id' => $this->org_id,
            'employment_type' => $this->employment_type, 'employment_type_label' => self::TYPES[$this->employment_type] ?? null,
            'location' => $this->location, 'start_date' => $this->start_date?->format('Y-m'), 'end_date' => $this->end_date?->format('Y-m'),
            'current' => $this->end_date === null, 'description' => $this->description, 'equipment' => $this->equipment ?? [],
            'verified' => $m !== null,
        ];
    }
}
