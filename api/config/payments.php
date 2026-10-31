<?php

return [
    // stripe: real Stripe calls. fake: no Stripe calls, every hold/charge succeeds (local testing only).
    'driver' => env('PAYMENTS_DRIVER', 'stripe'),

    // Card hold is placed this many hours before the scheduled pickup date (the day before)
    'hold_lead_hours' => (int) env('PAYMENTS_HOLD_LEAD_HOURS', 24),

    // Charge a held card this many hours before Stripe's hold deadline, if it hasn't been delivered yet
    'capture_margin_hours' => (int) env('PAYMENTS_CAPTURE_MARGIN_HOURS', 12),

    // Used when Stripe doesn't report a deadline (Visa off-session holds last 5 days)
    'default_hold_days' => 5,
];
