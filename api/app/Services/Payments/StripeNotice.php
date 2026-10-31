<?php

namespace App\Services\Payments;

use Illuminate\Support\Facades\Log;

/**
 * stripe-php raises a PHP warning for any Stripe-Notice response header (e.g. "We recommend building your
 * integration using Accounts v2" on POST /v1/accounts). Laravel turns warnings into exceptions, which would fail
 * a call Stripe already completed. Run the call through here to log the notice instead.
 */
class StripeNotice
{
    public static function quiet(callable $call): mixed
    {
        set_error_handler(function (int $no, string $message) {
            Log::notice('Stripe notice: ' . $message);
            return true;
        }, E_USER_WARNING);

        try {
            return $call();
        } finally {
            restore_error_handler();
        }
    }
}
