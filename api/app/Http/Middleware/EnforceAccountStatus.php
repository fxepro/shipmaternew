<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Applies the admin-set account status on every authenticated request.
 *   deactivated — token revoked, treated as signed out
 *   paused      — read-only: anything other than GET/HEAD (or logout) is refused
 */
class EnforceAccountStatus
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->status === 'deactivated') {
            $user->currentAccessToken()?->delete();

            return response()->json([
                'message' => 'This account has been deactivated. Contact support.',
                'code'    => 'account_deactivated',
            ], 401);
        }

        if ($user?->status === 'paused'
            && !$request->isMethodSafe()
            && !$request->is('api/v1/auth/logout')) {
            return response()->json([
                'message' => 'This account is paused. You can view your data but cannot make changes. Contact support.',
                'code'    => 'account_paused',
            ], 403);
        }

        return $next($request);
    }
}
