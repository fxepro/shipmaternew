<?php

namespace App\Http\Middleware;

use App\Models\PersonVerification;
use App\Services\PersonChecks;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Carrier operations need an approved carrier company; the owner must also be approved as a person.
 * Other members (staff, dispatchers, drivers) get access once the company is approved —
 * drivers are gated separately when they're assigned a load (docs/people-types-and-checks.md).
 */
class RequireCarrierApproval
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->isCarrier()) {
            $m   = PersonChecks::membership($user);
            $org = $m['org'];

            if ($org && $org->type === 'carrier') {
                if ($org->verification_status !== 'approved') {
                    return $this->deny('Platform access requires an approved carrier company.', $org->verification_status, 'company_not_approved');
                }
                if ($m['role'] === 'owner') {
                    $status = PersonVerification::where('user_id', $user->id)->value('status') ?? 'incomplete';
                    if ($status !== 'approved') {
                        return $this->deny('Platform access requires carrier approval.', $status, 'carrier_not_approved');
                    }
                }
            } else {
                // No carrier company on record (older accounts): fall back to the carrier profile
                $status = $user->carrierProfile?->verification_status ?? 'incomplete';
                if ($status !== 'approved') {
                    return $this->deny('Platform access requires carrier approval.', $status, 'carrier_not_approved');
                }
            }
        }

        return $next($request);
    }

    private function deny(string $error, ?string $status, string $code): Response
    {
        return response()->json(['error' => $error, 'verification_status' => $status, 'code' => $code], 403);
    }
}
