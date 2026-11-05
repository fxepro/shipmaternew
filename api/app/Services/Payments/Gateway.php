<?php

namespace App\Services\Payments;

/**
 * The payment processor behind LoadPayments. StripeGateway makes real calls; FakeGateway (PAYMENTS_DRIVER=fake)
 * makes none, for local testing. Intent results are arrays: id, status, charge_id, capture_before (unix|null), error.
 */
interface Gateway
{
    public function createCustomer(string $name, ?string $email, array $metadata): string;

    /**
     * Start a monthly subscription charged to a saved payment method, without sending the person to Stripe.
     * Returns the Stripe subscription (or a stand-in with id, status, current_period_end, items).
     * Throws \RuntimeException with a message the person can read when the payment method is refused.
     */
    public function createSubscription(string $customerId, string $paymentMethodId, int $amountCents, string $name, array $metadata): object;

    /** Whether a saved customer id still exists (and isn't deleted) in the Stripe account the current key belongs to */
    public function customerExists(string $customerId): bool;

    /** A SetupIntent the browser confirms with Stripe Elements to save a card or bank account */
    public function setupIntent(string $customerId): array;

    /** type (card|us_bank_account), brand, last4, exp_month, exp_year, bank_name, account_type, customer */
    public function paymentMethodDetails(string $paymentMethodId): array;

    public function detachPaymentMethod(string $paymentMethodId): void;

    /** Copy a platform customer's payment method onto a connected account (needed for direct charges) */
    public function clonePaymentMethod(string $customerId, string $paymentMethodId, string $account): string;

    public function createIntent(array $params, ?string $account = null): array;

    public function captureIntent(string $intentId, ?string $account = null): array;

    public function cancelIntent(string $intentId, ?string $account = null): void;
}
