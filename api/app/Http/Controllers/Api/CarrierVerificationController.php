<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrierVerification;
use App\Services\FmcsaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CarrierVerificationController extends Controller
{
    public function __construct(private FmcsaService $fmcsa) {}

    // ── POST /api/v1/carrier/verify/dot ──────────────────────────────────────
    // Lookup a USDOT number against the live FMCSA SAFER database.
    // Saves dot_verified on the carrier profile if result is positive.

    public function verifyDot(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $profile = $request->user()->carrierProfile;
        if ($profile && ($profile->operating_country ?? 'US') !== 'US') {
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

        $profile = $request->user()->carrierProfile()->firstOrCreate(
            ['user_id' => $request->user()->id]
        );

        // Update profile with verified status and auto-fill legal name if not set
        $profile->update([
            'dot_number'          => preg_replace('/\D/', '', $validated['dot_number']),
            'usdot_number'        => preg_replace('/\D/', '', $validated['dot_number']),
            'dot_verified'        => $result['allowed_to_operate'],
            'company_name'        => $profile->company_name ?: ($result['legal_name'] ?? null),
            'last_verification_at'=> now(),
        ]);

        // Upsert verification record
        CarrierVerification::updateOrCreate(
            [
                'carrier_profile_id' => $profile->id,
                'check_type'         => 'fmcsa',
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

        $validated = $request->validate([
            'mc_number' => ['required', 'string', 'max:30'],
        ]);

        $result = $this->fmcsa->lookupByMc($validated['mc_number']);

        if (!$result) {
            return response()->json([
                'error' => 'MC number not found in the FMCSA database.',
            ], 404);
        }

        $profile = $request->user()->carrierProfile()->firstOrCreate(
            ['user_id' => $request->user()->id]
        );

        $profile->update([
            'mc_number'           => preg_replace('/\D/', '', $validated['mc_number']),
            'mc_verified'         => $result['allowed_to_operate'],
            'last_verification_at'=> now(),
        ]);

        CarrierVerification::updateOrCreate(
            [
                'carrier_profile_id' => $profile->id,
                'check_type'         => 'mc',
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

        $profile = $request->user()->carrierProfile;
        if (!$profile) return response()->json(['data' => []]);

        $verifications = $profile->verifications()
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
}
