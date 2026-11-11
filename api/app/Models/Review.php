<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Feedback one company gives another it worked with, on a load or on factoring (see the reviews migration) */
class Review extends Model
{
    protected $fillable = [
        'freight_job_id', 'noa_id', 'reviewer_org_id', 'reviewer_user_id', 'reviewer_role', 'reviewee_org_id', 'reviewee_role',
        'overall', 'communication', 'reliability', 'comment', 'is_public', 'hidden_at', 'hidden_by', 'hidden_reason',
    ];

    protected function casts(): array
    {
        return [
            'overall' => 'integer', 'communication' => 'integer', 'reliability' => 'integer',
            'is_public' => 'boolean', 'hidden_at' => 'datetime',
        ];
    }

    /** What "reliability" means for the company being reviewed */
    public const RELIABILITY = [
        'carrier' => 'On time', 'shipper' => 'Ease at the dock', 'broker' => 'Pays on time',
        'receiver' => 'Ease at the dock', 'factor' => 'Pays on time',
    ];

    public function freightJob(): BelongsTo  { return $this->belongsTo(FreightJob::class); }
    public function noa(): BelongsTo         { return $this->belongsTo(Noa::class); }
    public function reviewerOrg(): BelongsTo { return $this->belongsTo(Organization::class, 'reviewer_org_id'); }
    public function reviewer(): BelongsTo    { return $this->belongsTo(User::class, 'reviewer_user_id'); }
    public function revieweeOrg(): BelongsTo { return $this->belongsTo(Organization::class, 'reviewee_org_id'); }
    public function hiddenBy(): BelongsTo    { return $this->belongsTo(User::class, 'hidden_by'); }

    public function scopeShown(Builder $q): Builder
    {
        return $q->whereNull('hidden_at');
    }

    public function averageScore(): float
    {
        return round(($this->overall + $this->communication + $this->reliability) / 3, 1);
    }

    /** Keep a company's average and count in step (hidden reviews don't count) */
    public static function recalculate(int $orgId): void
    {
        $agg = self::where('reviewee_org_id', $orgId)->shown()
            ->selectRaw('ROUND(AVG((overall + communication + reliability) / 3.0), 2) as avg_rating, COUNT(*) as total')->first();
        Organization::whereKey($orgId)->update(['rating' => $agg?->total ? $agg->avg_rating : null, 'total_ratings' => (int) ($agg?->total ?? 0)]);
    }

    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'freight_job_id' => $this->freight_job_id, 'job_title' => $this->freightJob?->title,
            'noa_id' => $this->noa_id,
            'reviewer_org_id' => $this->reviewer_org_id, 'reviewer_org' => $this->reviewerOrg?->name,
            'reviewer_user_id' => $this->reviewer_user_id, 'reviewer' => $this->reviewer?->name, 'reviewer_role' => $this->reviewer_role,
            'reviewee_org_id' => $this->reviewee_org_id, 'reviewee_org' => $this->revieweeOrg?->name, 'reviewee_role' => $this->reviewee_role,
            'overall' => $this->overall, 'communication' => $this->communication, 'reliability' => $this->reliability,
            'reliability_label' => self::RELIABILITY[$this->reviewee_role] ?? 'Reliability',
            'average' => $this->averageScore(), 'comment' => $this->comment, 'is_public' => $this->is_public,
            'hidden_at' => $this->hidden_at?->toISOString(), 'hidden_by' => $this->hiddenBy?->name, 'hidden_reason' => $this->hidden_reason,
            'created_at' => $this->created_at?->toISOString(),
            // Older screens read these names
            'rater_id' => $this->reviewer_user_id, 'rater_type' => $this->reviewer_role, 'rater_org' => $this->reviewerOrg?->name,
        ];
    }
}
