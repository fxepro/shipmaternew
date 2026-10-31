<?php

namespace App\Services;

use App\Models\Shipment;
use App\Models\User;
use Stripe\StripeClient;

class PaymentService
{
    private StripeClient $stripe;

    /** Platform fee percentage (e.g. 15 = 15%). Configurable via PLATFORM_FEE_PERCENT env. */
    private float $feePercent;

    public function __construct()
    {
        $this->stripe     = new StripeClient(config('services.stripe.secret'));
        $this->feePercent = (float) env('PLATFORM_FEE_PERCENT', 15);
    }

    // ── Customer ──────────────────────────────────────────────────────────────

    /**
     * Get or create a Stripe Customer for a shipper.
     * Persists stripe_customer_id on the User record.
     */
    public function getOrCreateCustomer(User $user): string
    {
        if ($user->stripe_customer_id) {
            return $user->stripe_customer_id;
        }

        $customer = $this->stripe->customers->create([
            'email'    => $user->email,
            'name'     => $user->name,
            'metadata' => ['user_id' => (string) $user->id],
        ]);

        $user->update(['stripe_customer_id' => $customer->id]);

        return $customer->id;
    }

    // ── Payment Intent (freight charge) ──────────────────────────────────────

    /**
     * Create a PaymentIntent in manual-capture mode.
     * Funds are authorized (reserved) but not captured yet.
     * Capture happens at delivery.
     *
     * Stripe mode is determined by the shipper's org (admin-configurable):
     *   'platform' (default) — payment to Shipmater's Stripe. Maximises GMV/ARR.
     *   'connect'  (enterprise) — payment to the org's own Stripe Connect account;
     *              Shipmater collects commission via application_fee_amount.
     */
    public function createFreightIntent(Shipment $shipment, User $shipper): array
    {
        $customerId  = $this->getOrCreateCustomer($shipper);
        $amountCents = (int) round((float) $shipment->agreed_cost * 100);

        // Shipmater's fee, paid by the carrier (docs/fees-and-billing.md). Early payment gets the lower rate.
        $org      = $shipper->currentOrg;
        $feeRate  = \App\Services\Fees::rateFor((bool) ($shipment->early_payment ?? false));
        $feeCents = (int) round($amountCents * $feeRate);

        $baseParams = [
            'amount'               => $amountCents,
            'currency'             => 'usd',
            'customer'             => $customerId,
            'capture_method'       => 'manual',
            'automatic_payment_methods' => [
                'enabled'         => true,
                'allow_redirects' => 'never',
            ],
            'description' => "Freight shipment #{$shipment->id}: {$shipment->item_description}",
            'metadata'    => [
                'type'        => 'freight_payment',
                'shipment_id' => (string) $shipment->id,
                'shipper_id'  => (string) $shipper->id,
                'carrier_id'  => (string) $shipment->carrier_id,
                'fee_cents'   => (string) $feeCents,
                'stripe_mode' => $org?->stripe_mode ?? 'platform',
            ],
        ];

        // ── Connect mode (enterprise, admin-enabled per org) ─────────────────
        // Payment lands in the tenant's Stripe; Shipmater takes application_fee_amount.
        if ($org && $org->usesOwnStripe()) {
            $baseParams['application_fee_amount'] = $feeCents;

            $intent = $this->stripe->paymentIntents->create(
                $baseParams,
                ['stripe_account' => $org->stripe_connect_id]
            );

        // ── Platform mode (default — all revenue through Shipmater's Stripe) ─
        } else {
            $intent = $this->stripe->paymentIntents->create($baseParams);
        }

        $shipment->update([
            'payment_intent_id'  => $intent->id,
            'payment_status'     => 'authorized',
            'platform_fee_cents' => $feeCents,
        ]);

        return [
            'client_secret'     => $intent->client_secret,
            'payment_intent_id' => $intent->id,
            'amount_cents'      => $amountCents,
            'fee_cents'         => $feeCents,
        ];
    }

    // ── Capture + Transfer (on delivery) ─────────────────────────────────────

    /**
     * Capture the held PaymentIntent and transfer the net amount
     * (minus platform fee) to the carrier's Stripe Connect account.
     */
    public function captureAndTransfer(Shipment $shipment): bool
    {
        if (!$shipment->payment_intent_id) return false;
        if ($shipment->payment_status === 'captured') return true; // idempotent

        try {
            // 1. Capture
            $intent = $this->stripe->paymentIntents->capture($shipment->payment_intent_id);

            $amountCents = $intent->amount_received;
            $feeCents    = $shipment->platform_fee_cents ?: (int) round($amountCents * \App\Services\Fees::standardRate());
            $netCents    = $amountCents - $feeCents;

            $shipment->update(['payment_status' => 'captured']);

            // 2. Transfer net to carrier (requires carrier to have a Connect account)
            $carrier        = $shipment->carrier;
            $carrierProfile = $carrier?->carrierProfile;

            if ($netCents > 0 && $carrierProfile?->stripe_account_id) {
                $transfer = $this->stripe->transfers->create([
                    'amount'             => $netCents,
                    'currency'           => 'usd',
                    'destination'        => $carrierProfile->stripe_account_id,
                    'source_transaction' => $intent->latest_charge,
                    'metadata'           => [
                        'shipment_id' => (string) $shipment->id,
                        'carrier_id'  => (string) $carrier->id,
                    ],
                ]);

                $shipment->update([
                    'payment_status' => 'transferred',
                    'transfer_id'    => $transfer->id,
                ]);
            }

            return true;

        } catch (\Exception $e) {
            \Log::error('PaymentService::captureAndTransfer failed', [
                'shipment_id'        => $shipment->id,
                'payment_intent_id'  => $shipment->payment_intent_id,
                'error'              => $e->getMessage(),
            ]);
            return false;
        }
    }

    // ── Refund ────────────────────────────────────────────────────────────────

    public function refund(Shipment $shipment, string $reason = 'requested_by_customer'): bool
    {
        if (!$shipment->payment_intent_id) return false;

        try {
            $this->stripe->refunds->create([
                'payment_intent' => $shipment->payment_intent_id,
                'reason'         => $reason,
            ]);
            $shipment->update(['payment_status' => 'refunded']);
            return true;
        } catch (\Exception $e) {
            \Log::error('PaymentService::refund failed', [
                'shipment_id' => $shipment->id,
                'error'       => $e->getMessage(),
            ]);
            return false;
        }
    }

    // ── Cancel uncaptured intent ──────────────────────────────────────────────

    public function cancelIntent(Shipment $shipment): bool
    {
        if (!$shipment->payment_intent_id) return false;
        if (!in_array($shipment->payment_status, ['authorized', 'unpaid'])) return false;

        try {
            $this->stripe->paymentIntents->cancel($shipment->payment_intent_id);
            $shipment->update(['payment_status' => 'refunded']);
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }
}
