<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FreightJob;
use App\Services\PersonChecks;
use App\Services\Rates\RateEstimator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Rate check: market rate guidance for shippers and brokers (App\Services\Rates\RateEstimator) */
class RateCheckController extends Controller
{
    // POST /api/v1/rates/check   { origin_city, origin_state, destination_city, destination_state, equipment, pickup_date?, hazmat?, temp_controlled?, extra_stops? }
    public function check(Request $request, RateEstimator $rates): JsonResponse
    {
        $d = $request->validate([
            'origin_city'       => 'required|string|max:100', 'origin_state'      => 'required|string|size:2',
            'destination_city'  => 'required|string|max:100', 'destination_state' => 'required|string|size:2',
            'equipment'         => 'required|string|max:40|exists:capabilities,key',
            'pickup_date'       => 'nullable|date',
            'hazmat'            => 'boolean', 'temp_controlled' => 'boolean',
            'extra_stops'       => 'nullable|integer|min:0|max:20',
        ]);
        $origin = ['city' => $d['origin_city'], 'state' => strtoupper($d['origin_state'])];
        $dest = ['city' => $d['destination_city'], 'state' => strtoupper($d['destination_state'])];

        $result = $rates->estimate([
            'origin' => $origin, 'destination' => $dest, 'equipment' => $d['equipment'],
            'hazmat' => $d['hazmat'] ?? false, 'temp_controlled' => $d['temp_controlled'] ?? false, 'extra_stops' => $d['extra_stops'] ?? 0,
        ]);

        if ($result['ok']) {
            DB::table('rate_checks')->insert([
                'org_id' => PersonChecks::companyOf($request->user(), ['shipper', 'broker'])?->id, 'user_id' => $request->user()->id,
                'origin' => "{$origin['city']}, {$origin['state']}", 'destination' => "{$dest['city']}, {$dest['state']}",
                'equipment' => $d['equipment'], 'pickup_date' => $d['pickup_date'] ?? null,
                'hazmat' => $d['hazmat'] ?? false, 'temp_controlled' => $d['temp_controlled'] ?? false, 'extra_stops' => $d['extra_stops'] ?? 0,
                'miles' => $result['miles'], 'result' => json_encode($result), 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        return response()->json(['data' => $result]);
    }

    // GET /api/v1/rates/checks   the company's recent rate checks
    public function history(Request $request): JsonResponse
    {
        $org = PersonChecks::companyOf($request->user(), ['shipper', 'broker']);
        $rows = DB::table('rate_checks')->where($org ? 'org_id' : 'user_id', $org?->id ?? $request->user()->id)
            ->orderByDesc('created_at')->limit(25)->get()
            ->map(fn ($r) => [
                'id' => $r->id, 'origin' => $r->origin, 'destination' => $r->destination, 'equipment' => $r->equipment,
                'hazmat' => (bool) $r->hazmat, 'temp_controlled' => (bool) $r->temp_controlled, 'miles' => (float) $r->miles,
                'total' => json_decode($r->result, true)['total'] ?? null, 'created_at' => $r->created_at,
            ]);
        return response()->json(['data' => $rows]);
    }

    // GET /api/v1/shipper/freight-jobs/{job}/market-rate   the estimate for a load; kept on the load while it is a draft
    public function forJob(Request $request, FreightJob $job, RateEstimator $rates): JsonResponse
    {
        abort_unless($request->user()->isShipperOf($job), 403);
        $result = $rates->forJob($job);
        if ($result['ok'] && $job->status === 'draft') $job->update(['market_rate' => $result]);
        return response()->json(['data' => $result]);
    }

    // GET /api/v1/admin/settings/rates
    public function settings(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        return response()->json(['data' => RateEstimator::settings(), 'equipment' => DB::table('capabilities')->where('kind', 'equipment')->where('active', true)->orderBy('sort_order')->get(['key', 'name'])]);
    }

    // PUT /api/v1/admin/settings/rates
    public function updateSettings(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $d = $request->validate([
            'per_mile'        => 'array', 'per_mile.*' => 'nullable|numeric|min:0|max:50',
            'min_charge'      => 'nullable|numeric|min:0', 'spread_pct' => 'nullable|numeric|min:0|max:50',
            'hazmat_pct'      => 'nullable|numeric|min:0|max:100', 'temp_pct' => 'nullable|numeric|min:0|max:100',
            'extra_stop'      => 'nullable|numeric|min:0', 'fuel_base_price' => 'nullable|numeric|min:0|max:20', 'fuel_mpg' => 'nullable|numeric|min:1|max:20',
        ]);
        $d['per_mile'] = array_filter($d['per_mile'] ?? [], fn ($v) => $v !== null && $v !== '');
        return response()->json(['data' => RateEstimator::save(array_replace(RateEstimator::settings(), $d, ['per_mile' => $d['per_mile']]), $request->user()->id)]);
    }
}
