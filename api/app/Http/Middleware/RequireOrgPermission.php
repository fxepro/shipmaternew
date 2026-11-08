<?php

namespace App\Http\Middleware;

use App\Models\FreightJob;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces the company role matrix (App\Support\Permissions) on a route.
 *
 *   ->middleware('perm:carrier:loads.bid')                       carrier people need full access to loads.bid
 *   ->middleware('perm:carrier:loads.view=view,shipper:loads.view=view')   any access other than none
 *
 * Each rule names a company type, so a route shared by shippers and carriers lists one rule for each.
 * Brokers post and pay for loads like shippers, so a shipper rule also applies to a broker unless the route lists a broker rule.
 * People whose current company is not of a listed type pass through (the controller checks them).
 * When the level is "assigned", a load named in the route must be one the person is on.
 */
class RequireOrgPermission
{
    public function handle(Request $request, Closure $next, string ...$rules): Response
    {
        $user = $request->user();
        $type = $user?->currentOrg?->type;
        if (!$user || !$type) return $next($request);
        // An admin viewing a company may read every page (ViewAsCompany has already refused writes)
        if ($user->viewingAs) return $next($request);

        $hasBrokerRule = collect($rules)->contains(fn ($r) => str_starts_with($r, 'broker:'));
        foreach ($rules as $rule) {
            [$ruleType, $rest] = array_pad(explode(':', $rule, 2), 2, '');
            $applies = $ruleType === $type || ($type === 'broker' && $ruleType === 'shipper' && !$hasBrokerRule);
            if (!$applies) continue;

            [$action, $need] = array_pad(explode('=', $rest, 2), 2, 'full');
            $level = $user->permLevel($action);
            $ok = $need === 'view' ? $level !== 'none' : in_array($level, ['full', 'assigned', 'self'], true);

            if (!$ok) {
                return response()->json([
                    'error'      => $need === 'view'
                        ? "Your role doesn't have access to this."
                        : "Your role can't do this. Ask your company's owner if you need it.",
                    'code'       => 'not_permitted',
                    'permission' => $action,
                ], 403);
            }

            if ($level === 'assigned' && ($load = $this->load($request)) && !$load->people()->where('user_id', $user->id)->exists()) {
                return response()->json(['error' => 'You can only work on loads you are assigned to.', 'code' => 'not_assigned', 'permission' => $action], 403);
            }

            return $next($request);
        }

        return $next($request);
    }

    /** The load this route is about, if any */
    private function load(Request $request): ?FreightJob
    {
        $route = $request->route();
        foreach (['job' => FreightJob::class] as $param => $class) {
            $v = $route?->parameter($param);
            if ($v instanceof $class) return $v;
            if ($v !== null && is_numeric($v)) return $class::find($v);
        }
        // Driver routes use {id}: freight-jobs/{id}/driver
        if (($id = $route?->parameter('id')) !== null) {
            $uri = $route->uri();
            if (str_contains($uri, 'freight-jobs/{id}')) return FreightJob::find($id);
        }
        return null;
    }
}
