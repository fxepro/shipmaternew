<?php

namespace App\Http\Middleware;

use App\Models\ShipperSubscription;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Shippers need an active subscription to post loads (docs/fees-and-billing.md). */
class RequireShipperSubscription
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user || $user->isPlatformAdmin()) return $next($request);

        $org = $user->currentOrg;
        if ($org?->type === 'shipper' && !ShipperSubscription::where('org_id', $org->id)->first()?->isActive()) {
            return response()->json([
                'error' => 'An active Shipmater subscription is needed to post loads.',
                'code'  => 'subscription_required',
            ], 402);
        }

        return $next($request);
    }
}
