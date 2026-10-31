<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A shipper company's subscription. Required to post loads (docs/fees-and-billing.md). */
class ShipperSubscription extends Model
{
    protected $fillable = [
        'org_id', 'tier', 'monthly_price', 'stated_annual_value', 'status',
        'stripe_customer_id', 'stripe_subscription_id', 'stripe_checkout_session_id',
        'current_period_end', 'started_at', 'tier_review_at', 'started_by',
    ];

    protected function casts(): array
    {
        return [
            'monthly_price'       => 'decimal:2',
            'stated_annual_value' => 'decimal:2',
            'current_period_end'  => 'datetime',
            'started_at'          => 'datetime',
            'tier_review_at'      => 'datetime',
        ];
    }

    public function org(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }

    /** Lets the company post loads */
    public function isActive(): bool
    {
        return in_array($this->status, ['active', 'trialing'], true);
    }
}
