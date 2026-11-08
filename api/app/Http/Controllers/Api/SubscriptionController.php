<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use App\Models\ShipperSubscription;
use App\Services\Payments\Gateway;
use App\Services\Payments\LoadPayments;
use App\Services\Fees;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\StripeClient;

/**
 * Shipper subscription (docs/fees-and-billing.md): tiered by the yearly load value the shipper
 * states, billed monthly by Stripe, required to post loads. Re-tiered on actual value after 12 months.
 */
class SubscriptionController extends Controller
{

    private function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    // GET /api/v1/shipper/subscription
    public function show(Request $request): JsonResponse
    {
        $org = $this->shipperOrg($request);

        return response()->json([
            'data'    => $this->present(ShipperSubscription::firstWhere('org_id', $org->id)),
            'tiers'   => Fees::tiers(),
            // Saved cards and bank accounts (Payment tab) the subscription can be charged to
            'methods' => PaymentMethod::where('org_id', $org->id)->whereNotNull('stripe_pm_id')
                ->orderByDesc('is_default')->orderBy('created_at')->get()
                ->map(fn ($m) => ['id' => $m->id, 'type' => $m->type, 'brand' => $m->brand ?: $m->bank_name, 'last4' => $m->last4, 'is_default' => (bool) $m->is_default]),
        ]);
    }

    // POST /api/v1/shipper/subscription   { stated_annual_value, payment_method_id? }
    // Charged to a saved card or bank account (the default unless one is chosen), confirmed inside Shipmater.
    public function subscribe(Request $request): JsonResponse
    {
        $user = $request->user();
        $org  = $this->shipperOrg($request);
        abort_unless($user->canDo('company.subscription'), 403, "Your role can't do this. Ask your company's owner if you need it.");

        $data = $request->validate([
            'stated_annual_value' => ['required', 'numeric', 'min:0', 'max:100000000000'],
            'payment_method_id'   => ['sometimes', 'nullable', 'integer'],
        ]);

        $existing = ShipperSubscription::firstWhere('org_id', $org->id);
        if ($existing?->isActive()) {
            return response()->json(['error' => 'Your subscription is already active.', 'code' => 'already_active'], 422);
        }

        $tier = Fees::tierFor((float) $data['stated_annual_value']);
        abort_if(!$tier, 422, 'No subscription tier is set up. Contact Shipmater.');

        $loadPayments = app(LoadPayments::class);
        $method = !empty($data['payment_method_id'])
            ? PaymentMethod::where('org_id', $org->id)->whereNotNull('stripe_pm_id')->find($data['payment_method_id'])
            : $loadPayments->defaultMethod($org->id);
        if (!$method) {
            return response()->json(['error' => 'Add a card or bank account on the Payment tab first.', 'code' => 'no_payment_method'], 422);
        }

        // An earlier attempt still waiting on payment is replaced, so the company is never billed twice
        if ($existing?->stripe_subscription_id && $existing->status === 'pending' && config('payments.driver') !== 'fake') {
            try { $this->stripe()->subscriptions->cancel($existing->stripe_subscription_id); } catch (\Throwable) {}
        }

        $customerId = $loadPayments->customerFor($org);
        try {
            $stripeSub = app(Gateway::class)->createSubscription(
                $customerId, $method->stripe_pm_id, (int) round($tier['monthly_price'] * 100),
                "Shipmater shipper subscription ({$tier['label']} a year)",
                ['platform' => 'shipmater', 'type' => 'shipper_subscription', 'org_id' => (string) $org->id],
            );
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage(), 'code' => 'payment_failed'], 422);
        }

        $sub = ShipperSubscription::updateOrCreate(['org_id' => $org->id], [
            'tier'                       => $tier['key'],
            'monthly_price'              => $tier['monthly_price'],
            'stated_annual_value'        => $data['stated_annual_value'],
            'status'                     => 'pending',
            'stripe_customer_id'         => $customerId,
            'stripe_subscription_id'     => $stripeSub->id,
            'stripe_checkout_session_id' => null,
            'started_by'                 => $user->id,
            // A new subscription after a cancelled one starts its own dates
            'started_at'                 => null,
            'tier_review_at'             => null,
            'canceled_at'                => null,
            'cancel_at_period_end'       => false,
        ]);
        self::syncFromStripe($sub, $stripeSub);
        try { self::refreshFromStripe($sub->fresh()); } catch (\Throwable) {}   // first payment into the ledger; the webhook also does this

        return response()->json(['data' => $this->present($sub->fresh())]);
    }

    // POST /api/v1/shipper/subscription/confirm   { session_id }
    // Called when Stripe Checkout returns, so the subscription is live without waiting for the webhook.
    public function confirm(Request $request): JsonResponse
    {
        $org  = $this->shipperOrg($request);
        $data = $request->validate(['session_id' => ['required', 'string']]);

        $sub = ShipperSubscription::where('org_id', $org->id)->where('stripe_checkout_session_id', $data['session_id'])->first();
        abort_if(!$sub, 404, 'Subscription checkout not found.');

        $session = $this->stripe()->checkout->sessions->retrieve($data['session_id'], ['expand' => ['subscription']]);
        if ($session->status === 'complete' && $session->subscription) {
            self::syncFromStripe($sub, $session->subscription);
        }

        return response()->json(['data' => $this->present($sub->fresh())]);
    }

    // POST /api/v1/shipper/subscription/cancel — stops at the end of the paid month
    public function cancel(Request $request): JsonResponse
    {
        $user = $request->user();
        $org  = $this->shipperOrg($request);
        abort_unless($user->canDo('company.subscription'), 403);

        $sub = ShipperSubscription::firstWhere('org_id', $org->id);
        abort_if(!$sub?->stripe_subscription_id, 404, 'No active subscription.');

        self::setCancelAtPeriodEnd($sub, true);

        return response()->json(['data' => $this->present($sub->fresh())]);
    }

    // POST /api/v1/shipper/subscription/resume — undo a cancellation before the paid month ends
    public function resume(Request $request): JsonResponse
    {
        $user = $request->user();
        $org  = $this->shipperOrg($request);
        abort_unless($user->canDo('company.subscription'), 403);

        $sub = ShipperSubscription::firstWhere('org_id', $org->id);
        abort_unless($sub?->isActive() && $sub->cancel_at_period_end, 422, 'There is no cancellation to undo.');
        self::setCancelAtPeriodEnd($sub, false);

        return response()->json(['data' => $this->present($sub->fresh())]);
    }

    /** Cancel at the end of the paid month, or undo that. Shared by the shipper and admin. */
    public static function setCancelAtPeriodEnd(ShipperSubscription $sub, bool $cancel): void
    {
        if (config('payments.driver') === 'fake' || !$sub->stripe_subscription_id) {
            $sub->update(['cancel_at_period_end' => $cancel]);
            return;
        }
        $stripe = new StripeClient(config('services.stripe.secret'));
        self::syncFromStripe($sub, $stripe->subscriptions->update($sub->stripe_subscription_id, ['cancel_at_period_end' => $cancel]));
    }

    /**
     * Fetch the subscription from Stripe, update ours, and record every paid invoice in the ledger.
     * The webhook does the same; this lets admin refresh it (and works locally, where webhooks can't arrive).
     */
    public static function refreshFromStripe(ShipperSubscription $sub): void
    {
        if (config('payments.driver') === 'fake' || !$sub->stripe_subscription_id) return;
        $stripe = new StripeClient(config('services.stripe.secret'));
        self::syncFromStripe($sub, $stripe->subscriptions->retrieve($sub->stripe_subscription_id));
        foreach ($stripe->invoices->all(['subscription' => $sub->stripe_subscription_id, 'limit' => 100])->data as $invoice) {
            if ($invoice->status !== 'paid' || (int) $invoice->amount_paid <= 0) continue;
            \App\Models\LedgerEntry::record('subscription', (int) $invoice->amount_paid, [
                'org_id' => $sub->org_id, 'source_type' => 'invoice', 'reference' => $invoice->id,
                'description' => 'Shipper subscription',
                'occurred_at' => now()->setTimestamp($invoice->status_transitions->paid_at ?? $invoice->created),
            ]);
        }
    }

    /** Copy a Stripe subscription's state onto ours (also used by the webhook). */
    public static function syncFromStripe(ShipperSubscription $sub, $stripeSub): void
    {
        $status = match ($stripeSub->status) {
            'active', 'trialing'                      => $stripeSub->status,
            'incomplete'                              => 'pending',   // payment processing or needs the bank to confirm
            'past_due', 'unpaid'                      => 'past_due',
            'canceled', 'incomplete_expired'          => 'canceled',
            default                                   => $sub->status,
        };

        // current_period_end moved onto the subscription item in newer Stripe API versions
        $periodEnd = $stripeSub->current_period_end ?? ($stripeSub->items->data[0]->current_period_end ?? null);

        $sub->update([
            'status'                 => $status,
            'cancel_at_period_end'   => (bool) ($stripeSub->cancel_at_period_end ?? false) && $status !== 'canceled',
            'canceled_at'            => $status === 'canceled'
                ? ($sub->canceled_at ?? (isset($stripeSub->canceled_at) && $stripeSub->canceled_at ? \Carbon\Carbon::createFromTimestamp($stripeSub->canceled_at) : now()))
                : null,
            'stripe_subscription_id' => $stripeSub->id,
            'current_period_end'     => $periodEnd ? \Carbon\Carbon::createFromTimestamp($periodEnd) : $sub->current_period_end,
            'started_at'             => $sub->started_at ?? now(),
            'tier_review_at'         => $sub->tier_review_at ?? now()->addMonths(12),
        ]);
    }

    private function shipperOrg(Request $request)
    {
        $org = $request->user()->currentOrg;
        abort_unless($org && in_array($org->type, ['shipper', 'broker'], true), 403, 'Subscriptions are for shipper and broker companies.');
        return $org;
    }

    private function present(?ShipperSubscription $s): ?array
    {
        if (!$s) return null;
        $tier = Fees::tier($s->tier);
        return [
            'tier'                => $s->tier,
            'tier_label'          => $tier['label'] ?? $s->tier,
            'monthly_price'       => (float) $s->monthly_price,
            'stated_annual_value' => (float) $s->stated_annual_value,
            'status'              => $s->displayStatus(),
            'active'              => $s->isActive(),
            'cancel_at_period_end'=> (bool) $s->cancel_at_period_end,
            'current_period_end'  => $s->current_period_end?->toISOString(),
            'started_at'          => $s->started_at?->toISOString(),
            'tier_review_at'      => $s->tier_review_at?->toISOString(),
        ];
    }
}
