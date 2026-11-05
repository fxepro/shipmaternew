<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bid;
use App\Models\Shipment;
use App\Models\User;
use App\Services\PersonChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BidController extends Controller
{
    // GET /api/v1/shipments/{shipment}/bids  — shipper views bids on their job
    public function index(Request $request, Shipment $shipment): JsonResponse
    {
        $user = $request->user();
        if (!$user->isPlatformAdmin() && !$user->isShipperOf($shipment)) {
            abort(403);
        }

        $bids = $shipment->bids()->with('carrier.carrierProfile')->latest()->get();

        return response()->json(['data' => $bids->map(fn ($b) => $this->shape($b))]);
    }

    // POST /api/v1/shipments/{shipment}/bids  — carrier places bid
    public function store(Request $request, Shipment $shipment): JsonResponse
    {
        $user = $request->user();

        abort_unless($user->isCarrier() && $user->current_org_id, 403, 'Only carriers can place bids.');
        abort_unless(in_array($shipment->status, ['pending', 'bidding']), 422, 'This job is no longer accepting bids.');
        abort_if($shipment->job_type === 'contracted', 422, 'Contracted jobs do not accept open bids.');

        if ($shipment->bids()->where('carrier_id', $user->current_org_id)->exists()) {
            abort(422, 'Your company has already placed a bid on this job.');
        }

        $validated = $request->validate([
            'amount'                  => ['required', 'numeric', 'min:1'],
            'estimated_pickup_date'   => ['required', 'date'],
            'estimated_delivery_date' => ['required', 'date', 'after_or_equal:estimated_pickup_date'],
            'note'                    => ['nullable', 'string', 'max:500'],
        ]);

        $bid = $shipment->bids()->create(array_merge($validated, ['carrier_id' => $user->current_org_id, 'user_id' => $user->id]));

        if ($shipment->status === 'pending') {
            $shipment->update(['status' => 'bidding']);
        }

        $bid->load('carrier.carrierProfile');

        return response()->json(['data' => $this->shape($bid)], 201);
    }

    // PUT /api/v1/bids/{bid}/accept  — shipper accepts a bid
    public function accept(Request $request, Bid $bid): JsonResponse
    {
        $user    = $request->user();
        $shipment = $bid->shipment;

        abort_unless($user->isShipperOf($shipment), 403);
        abort_unless($bid->status === 'pending', 422, 'This bid can no longer be accepted.');

        $bid->update(['status' => 'accepted']);
        $shipment->bids()->where('id', '!=', $bid->id)->update(['status' => 'rejected']);
        $shipment->update([
            'carrier_id'  => $bid->carrier_id,
            'agreed_cost' => $bid->amount,
            'status'      => 'assigned',
        ]);
        $shipment->addPerson($user->current_org_id, $user->id);
        $shipment->addPerson($bid->carrier_id, $bid->user_id);

        $bid->load('carrier.carrierProfile');

        return response()->json(['data' => $this->shape($bid)]);
    }

    // PUT /api/v1/bids/{bid}/withdraw  — carrier withdraws their own bid
    public function withdraw(Request $request, Bid $bid): JsonResponse
    {
        $user = $request->user();

        abort_unless($user->isCarrierOf($bid), 403);
        abort_unless($bid->status === 'pending', 422, 'Only pending bids can be withdrawn.');

        $bid->update(['status' => 'withdrawn']);

        return response()->json(['data' => $this->shape($bid)]);
    }

    // GET /api/v1/carrier/offers  — carrier views all their placed bids
    public function carrierOffers(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isCarrier(), 403);

        $bids = Bid::where('carrier_id', $user->current_org_id)
            ->with(['shipment.shipper'])
            ->latest()
            ->paginate(50);

        return response()->json([
            'data' => $bids->map(function ($bid) {
                $s = $bid->shipment;
                return [
                    'id'                      => $bid->id,
                    'shipment_id'             => $bid->shipment_id,
                    'amount'                  => (float) $bid->amount,
                    'estimated_pickup_date'   => $bid->estimated_pickup_date?->toDateString(),
                    'estimated_delivery_date' => $bid->estimated_delivery_date?->toDateString(),
                    'note'                    => $bid->note,
                    'status'                  => $bid->status,
                    'item_description'        => $s?->item_description,
                    'route'                   => $s ? "{$s->pickup_city}, {$s->pickup_state} → {$s->delivery_city}, {$s->delivery_state}" : '',
                    'shipment_status'         => $s?->status,
                    'shipper_name'            => PersonChecks::companyName($s?->shipper),
                    'created_at'              => $bid->created_at?->toISOString(),
                ];
            }),
        ]);
    }

    private function shape(Bid $bid): array
    {
        $carrier = $bid->carrier;
        $profile = $carrier?->carrierProfile;

        return [
            'id'                      => $bid->id,
            'shipment_id'             => $bid->shipment_id,
            'carrier_id'              => $bid->carrier_id,
            'user_id'                 => $bid->user_id,
            'carrier_name'            => PersonChecks::companyName($carrier) ?? '',
            'carrier_rating'          => (float) ($profile?->rating ?? 5.0),
            'carrier_dot_verified'    => (bool) ($profile?->dot_verified ?? false),
            'amount'                  => (float) $bid->amount,
            'estimated_pickup_date'   => $bid->estimated_pickup_date?->toDateString(),
            'estimated_delivery_date' => $bid->estimated_delivery_date?->toDateString(),
            'note'                    => $bid->note,
            'status'                  => $bid->status,
            'created_at'              => $bid->created_at?->toISOString(),
        ];
    }
}