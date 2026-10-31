<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Fees;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Shipmater's fees: public read (pricing page, job wizard) and admin edit (Platform → Fees). */
class FeesController extends Controller
{
    // GET /api/v1/fees   (public)
    public function show(): JsonResponse
    {
        return response()->json(['data' => Fees::all()]);
    }

    // PUT /api/v1/admin/settings/fees
    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $data = $request->validate([
            'standard_rate'            => ['required', 'numeric', 'min:0', 'max:0.5'],
            'early_rate'               => ['required', 'numeric', 'min:0', 'max:0.5', 'lte:standard_rate'],
            'onboarding_fee'           => ['required', 'numeric', 'min:0', 'max:10000'],
            'tiers'                    => ['required', 'array', 'min:1', 'max:10'],
            'tiers.*.key'              => ['required', 'string', 'max:20', 'distinct'],
            'tiers.*.label'            => ['required', 'string', 'max:60'],
            'tiers.*.max_annual_value' => ['nullable', 'numeric', 'min:0'],
            'tiers.*.monthly_price'    => ['required', 'numeric', 'min:0', 'max:100000'],
        ], [
            'early_rate.lte' => 'The early-payment rate must not be higher than the standard rate.',
        ]);

        // Tiers must rise, and only the last may be open-ended
        $tiers = array_values($data['tiers']);
        foreach ($tiers as $i => $t) {
            $last = $i === count($tiers) - 1;
            if ($t['max_annual_value'] === null && !$last) {
                return response()->json(['message' => 'Only the last tier can have no upper limit.'], 422);
            }
            if ($i > 0 && $t['max_annual_value'] !== null && $t['max_annual_value'] <= $tiers[$i - 1]['max_annual_value']) {
                return response()->json(['message' => 'Each tier\'s upper limit must be higher than the one before.'], 422);
            }
        }
        if (end($tiers)['max_annual_value'] !== null) {
            return response()->json(['message' => 'The last tier must have no upper limit.'], 422);
        }

        return response()->json(['data' => Fees::save([...$data, 'tiers' => $tiers], $request->user()->id)]);
    }
}
