<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShipperSubscription;
use App\Services\Fees;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\StripeClient;

/**
 * Shipper subscription (docs/fees-and-billing.md): tiered by the yearly load value the shipper
 * states, billed monthly by Stripe, required to post loads. Re-tiered on actual value after 12 months.
 */
class SubscriptionController extends Controller
{
    public function __construct(private PaymentService $payments) {}

    private function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    // GET /api/v1/shipper/subscription
    public function show(Request $request): JsonResponse
    {
        $org = $this->shipperOrg($request);

        return response()->json([
            'data'  => $this->present(ShipperSubscription::firstWhere('org_id', $org->id)),
            'tiers' => Fees::tiers(),
        ]);
    }

    // POST /api/v1/shipper/subscription   { stated_annual_value }  → { url } (Stripe Checkout)
    public function subscribe(Request $request): JsonResponse
    {
        $user = $request->user();
        $org  = $this->shipperOrg($request);
        abort_unless($user->isOrgAdmin(), 403, 'Only the owner or staff can manage the subscription.');

        $data = $request->validate(['stated_annual_value' => ['required', 'numeric', 'min:0', 'max:100000000000']]);

        $existing = ShipperSubscription::firstWhere('org_id', $org->id);
        if ($existing?->isActive()) {
            return response()->json(['error' => 'Your subscription is already active.', 'code' => 'already_active'], 422);
        }

        $tier = Fees::tierFor((float) $data['stated_annual_value']);
        abort_if(!$tier, 422, 'No subscription tier is set up. Contact Shipmater.');

        $customerId = $this->payments->getOrCreateCustomer($user);

        $session = $this->stripe()->checkout->sessions->create([
            'mode'        => 'subscription',
            'customer'    => $customerId,
            'line_items'  => [[
                'quantity'   => 1,
                'price_data' => [
                    'currency'     => 'usd',
                    'unit_amount'  => (int) round($tier['monthly_price'] * 100),
                    'recurring'    => ['interval' => 'month'],
                    'product_data' => ['name' => "Shipmater shipper subscription ({$tier['label']} a year)"],
                ],
            ]],
            'success_url' => config('app.frontend_url') . '/shipper/profile?tab=subscription&checkout=success&session_id={CHECKOUT_SESSION_ID}',
            'cancel_url'  => config('app.frontend_url') . '/shipper/profile?tab=subscription&checkout=cancelled',
            'metadata'          => ['platform' => 'shipmater', 'type' => 'shipper_subscription', 'org_id' => (string) $org->id],
            'subscription_data' => ['metadata' => ['platform' => 'shipmater', 'type' => 'shipper_subscription', 'org_id' => (string) $org->id]],
        ]);

        ShipperSubscription::updateOrCreate(['org_id' => $org->id], [
            'tier'                       => $tier['key'],
            'monthly_price'              => $tier['monthly_price'],
            'stated_annual_value'        => $data['stated_annual_value'],
            'status'                     => 'pending',
            'stripe_customer_id'         => $customerId,
            'stripe_checkout_session_id' => $session->id,
            'started_by'                 => $user->id,
        ]);

        return response()->json(['url' => $session->url]);
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
        abort_unless($user->isOrgAdmin(), 403);

        $sub = ShipperSubscription::firstWhere('org_id', $org->id);
        abort_if(!$sub?->stripe_subscription_id, 404, 'No active subscription.');

        $stripeSub = $this->stripe()->subscriptions->update($sub->stripe_subscription_id, ['cancel_at_period_end' => true]);
        self::syncFromStripe($sub, $stripeSub);

        return response()->json(['data' => $this->present($sub->fresh())]);
    }

    /** Copy a Stripe subscription's state onto ours (also used by the webhook). */
    public static function syncFromStripe(ShipperSubscription $sub, $stripeSub): void
    {
        $status = match ($stripeSub->status) {
            'active', 'trialing'                      => $stripeSub->status,
            'past_due', 'unpaid', 'incomplete'        => 'past_due',
            'canceled', 'incomplete_expired'          => 'canceled',
            default                                   => $sub->status,
        };

        // current_period_end moved onto the subscription item in newer Stripe API versions
        $periodEnd = $stripeSub->current_period_end ?? ($stripeSub->items->data[0]->current_period_end ?? null);

        $sub->update([
            'status'                 => $status,
            'stripe_subscription_id' => $stripeSub->id,
            'current_period_end'     => $periodEnd ? \Carbon\Carbon::createFromTimestamp($periodEnd) : $sub->current_period_end,
            'started_at'             => $sub->started_at ?? now(),
            'tier_review_at'         => $sub->tier_review_at ?? now()->addMonths(12),
        ]);
    }

    private function shipperOrg(Request $request)
    {
        $org = $request->user()->currentOrg;
        abort_unless($org && $org->type === 'shipper', 403, 'Subscriptions are for shipper companies.');
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
            'status'              => $s->status,
            'active'              => $s->isActive(),
            'current_period_end'  => $s->current_period_end?->toISOString(),
            'started_at'          => $s->started_at?->toISOString(),
            'tier_review_at'      => $s->tier_review_at?->toISOString(),
        ];
    }
}
