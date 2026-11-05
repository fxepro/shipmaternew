<?php

namespace App\Services\Payments;

use Stripe\Exception\ApiErrorException;
use Stripe\Exception\CardException;
use Stripe\StripeClient;

class StripeGateway implements Gateway
{
    private StripeClient $stripe;

    public function __construct()
    {
        $this->stripe = new StripeClient(config('services.stripe.secret'));
    }

    public function createCustomer(string $name, ?string $email, array $metadata): string
    {
        return $this->stripe->customers->create(['name' => $name, 'email' => $email, 'metadata' => $metadata])->id;
    }

    public function createSubscription(string $customerId, string $paymentMethodId, int $amountCents, string $name, array $metadata): object
    {
        // One reusable monthly price per amount, found again by its lookup key
        $key   = 'shipmater_subscription_usd_' . $amountCents;
        $price = $this->stripe->prices->all(['lookup_keys' => [$key], 'active' => true, 'limit' => 1])->data[0]
            ?? $this->stripe->prices->create([
                'currency' => 'usd', 'unit_amount' => $amountCents, 'recurring' => ['interval' => 'month'],
                'lookup_key' => $key, 'product_data' => ['name' => $name],
            ]);

        // A card is charged on the spot, so a decline or a bank's extra check fails here and the person can pick
        // another method. A bank debit takes days to clear, so it starts incomplete and Stripe confirms it later.
        $isCard = $this->stripe->paymentMethods->retrieve($paymentMethodId)->type === 'card';

        try {
            return $this->stripe->subscriptions->create([
                'customer'               => $customerId,
                'items'                  => [['price' => $price->id]],
                'default_payment_method' => $paymentMethodId,
                // Charge now; a bank debit that's still processing leaves it incomplete until Stripe confirms it
                'payment_behavior'       => $isCard ? 'error_if_incomplete' : 'allow_incomplete',
                'payment_settings'       => ['payment_method_types' => ['card', 'us_bank_account']],
                'metadata'               => $metadata,
            ]);
        } catch (CardException $e) {
            throw new \RuntimeException(($e->getError()?->message ?: 'Your card was declined.') . ' Choose another card or a bank account.');
        } catch (\Stripe\Exception\InvalidRequestException $e) {
            if (str_contains($e->getMessage(), 'does not belong to') || str_contains($e->getMessage(), 'No such PaymentMethod')) {
                throw new \RuntimeException('This payment method was saved under an old Stripe account. Remove it on the Payment tab and add it again.');
            }
            throw $e;
        }
    }

    public function customerExists(string $customerId): bool
    {
        try {
            return empty($this->stripe->customers->retrieve($customerId)->deleted);
        } catch (\Stripe\Exception\InvalidRequestException $e) {
            // Saved under another Stripe account (e.g. test ids after switching to live keys)
            if ($e->getStripeCode() === 'resource_missing') return false;
            throw $e;
        }
    }

    public function setupIntent(string $customerId): array
    {
        $si = $this->stripe->setupIntents->create([
            'customer'             => $customerId,
            'usage'                => 'off_session',
            'payment_method_types' => ['card', 'us_bank_account'],
        ]);

        return ['client_secret' => $si->client_secret, 'id' => $si->id];
    }

    public function paymentMethodDetails(string $paymentMethodId): array
    {
        $pm = $this->stripe->paymentMethods->retrieve($paymentMethodId);
        if ($pm->type === 'us_bank_account') {
            return ['type' => 'us_bank_account', 'last4' => $pm->us_bank_account->last4, 'bank_name' => $pm->us_bank_account->bank_name,
                    'account_type' => $pm->us_bank_account->account_type, 'customer' => $pm->customer];
        }

        return ['type' => 'card', 'brand' => $pm->card->brand, 'last4' => $pm->card->last4,
                'exp_month' => str_pad((string) $pm->card->exp_month, 2, '0', STR_PAD_LEFT),
                'exp_year' => substr((string) $pm->card->exp_year, -2), 'customer' => $pm->customer];
    }

    public function detachPaymentMethod(string $paymentMethodId): void
    {
        try {
            $this->stripe->paymentMethods->detach($paymentMethodId);
        } catch (ApiErrorException) {
            // Already detached
        }
    }

    public function clonePaymentMethod(string $customerId, string $paymentMethodId, string $account): string
    {
        return $this->stripe->paymentMethods->create(
            ['customer' => $customerId, 'payment_method' => $paymentMethodId],
            ['stripe_account' => $account]
        )->id;
    }

    public function createIntent(array $params, ?string $account = null): array
    {
        try {
            $pi = $this->stripe->paymentIntents->create($params + ['expand' => ['latest_charge']], $account ? ['stripe_account' => $account] : []);
            return $this->result($pi);
        } catch (CardException $e) {
            return ['id' => $e->getError()?->payment_intent?->id, 'status' => 'failed', 'charge_id' => null, 'capture_before' => null,
                    'error' => $e->getError()?->message ?? $e->getMessage()];
        } catch (ApiErrorException $e) {
            return ['id' => null, 'status' => 'failed', 'charge_id' => null, 'capture_before' => null, 'error' => $e->getMessage()];
        }
    }

    public function captureIntent(string $intentId, ?string $account = null): array
    {
        try {
            $pi = $this->stripe->paymentIntents->capture($intentId, ['expand' => ['latest_charge']], $account ? ['stripe_account' => $account] : []);
            return $this->result($pi);
        } catch (ApiErrorException $e) {
            return ['id' => $intentId, 'status' => 'failed', 'charge_id' => null, 'capture_before' => null, 'error' => $e->getMessage()];
        }
    }

    public function cancelIntent(string $intentId, ?string $account = null): void
    {
        try {
            $this->stripe->paymentIntents->cancel($intentId, [], $account ? ['stripe_account' => $account] : []);
        } catch (ApiErrorException) {
            // Already captured, canceled or expired
        }
    }

    private function result($pi): array
    {
        $charge = is_object($pi->latest_charge) ? $pi->latest_charge : null;
        $error  = $pi->last_payment_error?->message;
        if ($pi->status === 'requires_action') $error = 'The bank asked the shipper to authenticate this payment.';

        return [
            'id'             => $pi->id,
            // requires_capture | succeeded | processing | requires_payment_method | requires_action | canceled
            'status'         => $pi->status,
            'charge_id'      => $charge?->id,
            'capture_before' => $charge?->payment_method_details?->card?->capture_before ?? null,
            'error'          => $error,
        ];
    }
}
