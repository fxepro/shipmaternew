<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bid;
use App\Models\ServiceType;
use App\Models\Shipment;
use App\Models\User;
use App\Services\PersonChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobController extends Controller
{
    // GET /api/v1/jobs?type=open|contracted&my_services=1
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isCarrier(), 403);

        $type = $request->input('type', 'open');

        // ── Contracted offers ─────────────��────────────────────────────
        if ($type === 'contracted') {
            $jobs = Shipment::where('job_type', 'contracted')
                ->where('carrier_id', $user->current_org_id)
                ->where('status', 'offered')
                ->with(['shipper', 'contract', 'serviceType'])
                ->latest()
                ->get();

            return response()->json([
                'data' => $jobs->map(fn ($s) => $this->contractedShape($s)),
            ]);
        }

        // ── Open marketplace ──────────────��────────────────────────────
        $query = Shipment::where('job_type', 'open')
            ->whereIn('status', ['pending', 'bidding'])
            ->with(['shipper', 'serviceType'])
            ->withCount('bids');

        // Filter by carrier's service types (opt-in via ?my_services=1)
        if ($request->boolean('my_services')) {
            $org = $user->currentOrg;
            if ($org) {
                $serviceTypeIds = $org->serviceTypes()->pluck('service_types.id');
                if ($serviceTypeIds->isNotEmpty()) {
                    $query->whereIn('service_type_id', $serviceTypeIds);
                }
            }
        }

        $jobs = $query->latest()->paginate(50);

        // Single query: which jobs has this carrier already bid on?
        $biddedIds = Bid::where('carrier_id', $user->current_org_id)
            ->whereIn('shipment_id', $jobs->pluck('id'))
            ->pluck('shipment_id')
            ->flip()
            ->all();

        return response()->json([
            'data' => $jobs->map(function ($s) use ($biddedIds) {
                return [
                    'id'               => $s->id,
                    'item_description' => $s->item_description,
                    'item_category'    => $s->item_category,
                    'service_type'     => $s->serviceType ? [
                        'key'  => $s->serviceType->key,
                        'name' => $s->serviceType->name,
                        'icon' => $s->serviceType->icon,
                    ] : null,
                    'weight_lbs'       => $s->weight_lbs ? (float) $s->weight_lbs : null,
                    'special_notes'    => $s->special_notes,
                    'pickup_city'      => $s->pickup_city,
                    'pickup_state'     => $s->pickup_state,
                    'delivery_city'    => $s->delivery_city,
                    'delivery_state'   => $s->delivery_state,
                    'pickup_date'      => $s->pickup_date?->toDateString(),
                    'delivery_date'    => $s->delivery_date?->toDateString(),
                    'distance_miles'   => $s->distance_miles ? (float) $s->distance_miles : null,
                    'status'           => $s->status,
                    'bids_count'       => $s->bids_count,
                    'already_bid'      => isset($biddedIds[$s->id]),
                    'shipper_name'     => PersonChecks::companyName($s->shipper),
                    'created_at'       => $s->created_at?->toISOString(),
                ];
            }),
        ]);
    }

    private function contractedShape(Shipment $s): array
    {
        return [
            'id'               => $s->id,
            'item_description' => $s->item_description,
            'service_type'     => $s->serviceType ? [
                'key'  => $s->serviceType->key,
                'name' => $s->serviceType->name,
                'icon' => $s->serviceType->icon,
            ] : null,
            'weight_lbs'       => $s->weight_lbs ? (float) $s->weight_lbs : null,
            'pickup_city'      => $s->pickup_city,
            'pickup_state'     => $s->pickup_state,
            'delivery_city'    => $s->delivery_city,
            'delivery_state'   => $s->delivery_state,
            'pickup_date'      => $s->pickup_date?->toDateString(),
            'delivery_date'    => $s->delivery_date?->toDateString(),
            'distance_miles'   => $s->distance_miles ? (float) $s->distance_miles : null,
            'agreed_cost'      => $s->agreed_cost ? (float) $s->agreed_cost : null,
            'contract_rate'    => $s->contract?->rate ? (float) $s->contract->rate : null,
            'contract_rate_type' => $s->contract?->rate_type,
            'shipper_name'     => PersonChecks::companyName($s->shipper),
            'created_at'       => $s->created_at?->toISOString(),
        ];
    }
}
