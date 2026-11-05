<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrierVerification;
use App\Models\Organization;
use App\Services\FmcsaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CarrierVerificationController extends Controller
{
    public function __construct(private FmcsaService $fmcsa) {}

    // ── POST /api/v1/carrier/verify/dot ──────────────────────────────────────
    // Lookup a USDOT number against the live FMCSA SAFER database.
    // Saves the result on the carrier company.

    public function verifyDot(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $org = $this->carrier($request);
        if (($org->carrier_operating_country ?? 'US') !== 'US') {
            return response()->json([
                'status'  => 'not_applicable',
                'message' => 'FMCSA DOT verification only applies to US-based carriers. For other countries, submit your operating authority documents for manual review.',
            ]);
        }

        $validated = $request->validate([
            'dot_number' => ['required', 'string', 'max:20'],
        ]);

        $result = $this->fmcsa->lookupByDot($validated['dot_number']);

        if (!$result) {
            return response()->json([
                'error' => 'DOT number not found in the FMCSA SAFER database. Double-check the number and try again.',
            ], 404);
        }

        // The company's DOT number and whether it is authorized; the legal name is filled in if missing
        $org->update([
            'carrier_dot_number'           => Organization::digits($validated['dot_number']),
            'carrier_dot_verified'         => $result['allowed_to_operate'],
            'carrier_last_verification_at' => now(),
        ]);
        if (!$org->legal_name && !empty($result['legal_name'])) $org->update(['legal_name' => $result['legal_name']]);

        // Upsert verification record
        CarrierVerification::updateOrCreate(
            [
                'carrier_id' => $org->id,
                'check_type' => 'fmcsa',
            ],
            [
                'status'      => $result['allowed_to_operate'] ? 'passed' : 'failed',
                'external_id' => $result['dot_number'],
                'result_data' => $result,
                'expires_at'  => now()->addDays(90),
            ]
        );

        return response()->json([
            'data'     => $result,
            'verified' => $result['allowed_to_operate'],
            'message'  => $result['allowed_to_operate']
                ? 'DOT verified — carrier is authorized to operate.'
                : 'DOT number found but this carrier is NOT currently authorized to operate.',
        ]);
    }

    // ── POST /api/v1/carrier/verify/mc ───────────────────────────────────────
    // Lookup an MC (motor carrier docket) number. Does not set dot_verified
    // but returns the FMCSA record for the carrier to review.

    public function verifyMc(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);
        $org = $this->carrier($request);

        $validated = $request->validate([
            'mc_number' => ['required', 'string', 'max:30'],
        ]);

        $result = $this->fmcsa->lookupByMc($validated['mc_number']);

        if (!$result) {
            return response()->json([
                'error' => 'MC number not found in the FMCSA database.',
            ], 404);
        }

        $org->update([
            'carrier_mc_number'            => Organization::digits($validated['mc_number']),
            'carrier_mc_verified'          => $result['allowed_to_operate'],
            'carrier_last_verification_at' => now(),
        ]);

        CarrierVerification::updateOrCreate(
            [
                'carrier_id' => $org->id,
                'check_type' => 'mc',
            ],
            [
                'status'      => $result['allowed_to_operate'] ? 'passed' : 'failed',
                'external_id' => preg_replace('/\D/', '', $validated['mc_number']),
                'result_data' => $result,
                'expires_at'  => now()->addDays(90),
            ]
        );

        return response()->json([
            'data'     => $result,
            'verified' => $result['allowed_to_operate'],
            'message'  => $result['allowed_to_operate']
                ? 'MC number verified — carrier has active operating authority.'
                : 'MC number found but operating authority is NOT active.',
        ]);
    }

    // ── GET /api/v1/carrier/verifications ────────────────────────────────────
    // Returns all verification records for the authenticated carrier.

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        // The company's checks (FMCSA, MC) and the person's own (identity, background)
        $user = $request->user();
        $org  = \App\Services\PersonChecks::companyOf($user, 'carrier');

        $verifications = CarrierVerification::where(fn ($q) => $q->where('user_id', $user->id)
                ->when($org, fn ($w) => $w->orWhere(fn ($c) => $c->where('carrier_id', $org->id)->whereIn('check_type', ['fmcsa', 'mc']))))
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn($v) => [
                'check_type'  => $v->check_type,
                'status'      => $v->status,
                'external_id' => $v->external_id,
                'expires_at'  => $v->expires_at?->toDateString(),
                'updated_at'  => $v->updated_at->toISOString(),
            ]);

        return response()->json(['data' => $verifications]);
    }

    /** The carrier company; checks change company details, so only the owner or staff run them */
    private function carrier(Request $request): Organization
    {
        $org = \App\Services\PersonChecks::companyOf($request->user(), 'carrier');
        abort_unless($org, 422, 'You are not part of a carrier company.');
        abort_unless($request->user()->canDo('company.profile'), 403, "Your role can't do this. Ask your company's owner if you need it.");
        return $org;
    }
}
