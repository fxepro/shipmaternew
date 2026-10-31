<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Payments\StripeNotice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\StripeClient;

/**
 * A factor's own Stripe account (Account → Finance). Shippers pay factored loads into it
 * through Shipmater (docs/noa-factoring.md). Kept on organizations.stripe_connect_id.
 */
class FactorStripeController extends Controller
{
    private function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    // POST /api/v1/factor/stripe/connect → { url } (Stripe onboarding)
    public function connect(Request $request): JsonResponse
    {
        $user = $request->user();
        $org  = $user->currentOrg;
        abort_unless($org?->type === 'factor', 403);
        abort_unless($user->isOrgAdmin(), 403, 'Only the owner or staff can connect Stripe.');

        if (!$org->stripe_connect_id) {
            $account = StripeNotice::quiet(fn () => $this->stripe()->accounts->create([
                'type'          => 'express',
                'country'       => 'US',
                'email'         => $org->email ?: $user->email,
                'business_type' => 'company',
                'company'       => array_filter(['name' => $org->name, 'tax_id' => $org->tax_id ? preg_replace('/\D/', '', $org->tax_id) : null]),
                'capabilities'  => ['card_payments' => ['requested' => true], 'transfers' => ['requested' => true]],
                'metadata'      => ['platform' => 'shipmater', 'type' => 'factor', 'org_id' => (string) $org->id],
            ]));
            $org->update(['stripe_connect_id' => $account->id]);
        }

        $base = config('app.frontend_url') . '/factor/profile?tab=finance';
        $link = $this->stripe()->accountLinks->create([
            'account'     => $org->stripe_connect_id,
            'refresh_url' => $base . '&stripe=refresh',
            'return_url'  => $base . '&stripe=return',
            'type'        => 'account_onboarding',
        ]);

        return response()->json(['url' => $link->url]);
    }

    // GET /api/v1/factor/stripe/status
    public function status(Request $request): JsonResponse
    {
        $org = $request->user()->currentOrg;
        abort_unless($org?->type === 'factor', 403);

        if (!$org->stripe_connect_id) {
            return response()->json(['data' => ['connected' => false, 'ready' => false]]);
        }

        try {
            $a = $this->stripe()->accounts->retrieve($org->stripe_connect_id);
        } catch (\Throwable $e) {
            return response()->json(['data' => ['connected' => true, 'ready' => false, 'error' => 'Could not reach Stripe. Try again shortly.']]);
        }

        return response()->json(['data' => [
            'connected'         => true,
            'ready'             => (bool) ($a->details_submitted && $a->payouts_enabled),
            'details_submitted' => (bool) $a->details_submitted,
            'payouts_enabled'   => (bool) $a->payouts_enabled,
            'requirements_due'  => count($a->requirements?->currently_due ?? []),
        ]]);
    }
}
