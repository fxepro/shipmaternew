<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One background check order with a provider, for one person (App\Services\Background\BackgroundChecks). */
class BackgroundCheck extends Model
{
    public const OPEN     = ['invitation_sent', 'pending'];
    public const FINISHED = ['clear', 'consider', 'suspended'];

    protected $fillable = [
        'user_id', 'org_id', 'provider', 'mode', 'kind', 'package', 'status',
        'candidate_id', 'invitation_id', 'invitation_url', 'report_id',
        'paid_by', 'payer_user_id', 'payer_org_id', 'amount_cents', 'payment_intent_id', 'completed_at',
    ];

    protected function casts(): array
    {
        return ['completed_at' => 'datetime'];
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function payerOrg(): BelongsTo { return $this->belongsTo(Organization::class, 'payer_org_id'); }

    /** basic and full checks give the person the basic level; full and upgrade give the complete level */
    public function coversBasic(): bool { return in_array($this->kind, ['basic', 'full'], true); }
    public function coversComplete(): bool { return in_array($this->kind, ['full', 'upgrade'], true); }
    public function isOpen(): bool { return in_array($this->status, self::OPEN, true); }
}
