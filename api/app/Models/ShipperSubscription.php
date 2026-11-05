<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A shipper company's subscription. Required to post loads (docs/fees-and-billing.md). */
class ShipperSubscription extends Model
{
    protected $fillable = [
        'org_id', 'tier', 'monthly_price', 'stated_annual_value', 'status', 'cancel_at_period_end', 'canceled_at',
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
            'cancel_at_period_end'=> 'boolean',
            'canceled_at'         => 'datetime',
        ];
    }

    public function org(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'org_id');
    }

    public function starter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'started_by');
    }

    /** What admin and the shipper see: an attempt that never reached a payment is not a subscription */
    public function displayStatus(): string
    {
        return $this->status === 'pending' && !$this->stripe_subscription_id ? 'not_started' : $this->status;
    }

    /** Lets the company post loads */
    public function isActive(): bool
    {
        return in_array($this->status, ['active', 'trialing'], true);
    }
}
