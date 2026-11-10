<?php

namespace App\Http\Middleware;

use App\Support\Approval;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * company.approved — the person's company must be approved (App\Support\Approval).
 * company.approved:restricted — a restricted company may also go ahead (finishing loads it already has).
 */
class RequireCompanyApproval
{
    public function handle(Request $request, Closure $next, ?string $allow = null): Response
    {
        if ($why = Approval::blocked($request->user(), $allow === 'restricted')) {
            return response()->json($why, 403);
        }
        return $next($request);
    }
}
