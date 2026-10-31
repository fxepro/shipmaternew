<?php

namespace App\Services\Payments;

use Illuminate\Support\Str;

/**
 * Local testing only (PAYMENTS_DRIVER=fake): no Stripe calls. Every hold and charge succeeds, except payment
 * methods ending 0002, which decline like Stripe's test card 4000 0000 0000 0002.
 * Fake payment method ids look like pm_fake_card_4242 or pm_fake_bank_6789.
 */
class FakeGateway implements Gateway
{
    public function createCustomer(string $name, ?string $email, array $metadata): string
    {
        return 'cus_fake_' . Str::random(10);
    }

    public function setupIntent(string $customerId): array
    {
        return ['client_secret' => null, 'id' => 'seti_fake_' . Str::random(10)];
    }

    public function paymentMethodDetails(string $paymentMethodId): array
    {
        $parts = explode('_', $paymentMethodId);
        $last4 = $parts[3] ?? '4242';

        return ($parts[2] ?? '') === 'bank'
            ? ['type' => 'us_bank_account', 'last4' => $last4, 'bank_name' => 'Test Bank', 'account_type' => 'checking', 'customer' => null]
            : ['type' => 'card', 'brand' => 'visa', 'last4' => $last4, 'exp_month' => '12', 'exp_year' => substr((string) (now()->year + 3), -2), 'customer' => null];
    }

    public function detachPaymentMethod(string $paymentMethodId): void {}

    public function clonePaymentMethod(string $customerId, string $paymentMethodId, string $account): string
    {
        return $paymentMethodId;
    }

    public function createIntent(array $params, ?string $account = null): array
    {
        $id = 'pi_fake_' . Str::random(14);
        if (str_ends_with((string) ($params['payment_method'] ?? ''), '_0002')) {
            return ['id' => $id, 'status' => 'failed', 'charge_id' => null, 'capture_before' => null, 'error' => 'Your card was declined. (test)'];
        }
        $manual = ($params['capture_method'] ?? 'automatic') === 'manual';
        $bank   = str_contains((string) ($params['payment_method'] ?? ''), '_bank_');

        return [
            'id'             => $id,
            'status'         => $manual ? 'requires_capture' : ($bank ? 'processing' : 'succeeded'),
            'charge_id'      => 'ch_fake_' . Str::random(14),
            'capture_before' => $manual ? now()->addDays(config('payments.default_hold_days'))->timestamp : null,
            'error'          => null,
        ];
    }

    public function captureIntent(string $intentId, ?string $account = null): array
    {
        return ['id' => $intentId, 'status' => 'succeeded', 'charge_id' => 'ch_fake_' . Str::random(14), 'capture_before' => null, 'error' => null];
    }

    public function cancelIntent(string $intentId, ?string $account = null): void {}
}
