<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sign-up isn't finished until the email is verified: until then the only calls allowed are
 * reading the signed-in person (/user), resending the email and signing out.
 */
class RequireVerifiedEmail
{
    /** Paths an unverified person may still call */
    private const OPEN = ['api/v1/user', 'api/v1/auth/logout', 'api/v1/auth/email/resend'];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user || $user->hasVerifiedEmail() || $user->isPlatformAdmin() || in_array($request->path(), self::OPEN, true)) {
            return $next($request);
        }

        return response()->json([
            'error' => 'Verify your email address to continue. Check your inbox for the link.',
            'code'  => 'email_not_verified',
        ], 403);
    }
}
