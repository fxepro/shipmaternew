<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Payments\StripeOnboarding;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A factor's own Stripe account (Account → Finance). Shippers pay factored loads into it
 * through Shipmater (docs/noa-factoring.md). Kept on organizations.stripe_connect_id.
 * Setup itself lives in PayoutSetupController / StripeOnboarding.
 */
class FactorStripeController extends Controller
{
    // POST /api/v1/factor/stripe/connect   (older clients; same as POST /payouts/submit)
    public function connect(Request $request): JsonResponse
    {
        return app(PayoutSetupController::class)->submit($request);
    }

    // GET /api/v1/factor/stripe/status
    public function status(Request $request): JsonResponse
    {
        $org = $request->user()->currentOrg;
        abort_unless($org?->type === 'factor', 403);

        $s = app(StripeOnboarding::class)->refresh($org);
        return response()->json(['data' => [
            'connected' => $s['connected'], 'ready' => $s['status'] === 'verified', 'status' => $s['status'], 'items' => $s['items'],
        ]]);
    }
}
