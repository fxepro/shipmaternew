<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\PersonIdentity;
use App\Models\PreferredCarrier;
use App\Models\Shipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PreferredCarrierController extends Controller
{
    // ── GET /preferred-carriers ───────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $shipperId = $request->user()->current_org_id;   // the shipper company

        $rows = PreferredCarrier::with(['carrier'])
            ->where('shipper_id', $shipperId)
            ->orderBy('status')
            ->orderBy('created_at')
            ->get()
            ->map(function ($pc) use ($shipperId) {
                $carrier = $pc->carrier;

                $parts  = explode(' ', $carrier->name);
                $avatar = strtoupper(substr($parts[0], 0, 1) . (isset($parts[1]) ? substr($parts[1], 0, 1) : ''));

                $together = Shipment::where('shipper_id', $shipperId)
                    ->where('carrier_id', $carrier->id)
                    ->whereIn('status', ['assigned', 'in_transit', 'delivered'])
                    ->count();

                $joined = $carrier->created_at
                    ? $carrier->created_at->format('M Y')
                    : $pc->created_at->format('M Y');

                return [
                    'id'                => $pc->id,
                    'carrier_id'        => $carrier->id,
                    'name'              => $carrier->name,
                    'company'           => $carrier->name,
                    'dot'               => $carrier->carrier_dot_number ?? '',
                    'mc'                => $carrier->carrier_mc_number ?? '',
                    'email'             => $carrier->email,
                    'phone'             => $carrier->phone ?: (PersonIdentity::where('user_id', $carrier->owner_id)->value('phone') ?? ''),
                    'location'          => implode(', ', array_filter([$carrier->city, $carrier->state])),
                    'rating'            => (float) ($carrier->rating ?? 0),
                    'reviews'           => $carrier->carrier_total_deliveries ?? 0,
                    'completed_together'=> $together,
                    'status'            => $pc->status,
                    'avatar'            => $avatar,
                    'joined_date'       => $joined,
                    'insurance_verified'=> (bool) $carrier->carrier_insurance_verified,
                ];
            });

        return response()->json(['data' => $rows]);
    }

    // ── POST /preferred-carriers ──────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'dot_number' => ['required', 'string', 'max:20'],
        ]);

        // Preferred carriers are company to company
        $carrier   = Organization::where('type', 'carrier')
            ->where('carrier_dot_number', Organization::digits($request->dot_number))->first();
        $shipperId = $request->user()->current_org_id;
        if (!$carrier || !$shipperId) {
            return response()->json(['message' => 'No carrier found with that DOT number.'], 404);
        }

        if (PreferredCarrier::where('shipper_id', $shipperId)->where('carrier_id', $carrier->id)->exists()) {
            return response()->json(['message' => 'This carrier is already in your network.'], 422);
        }

        $pc = PreferredCarrier::create([
            'shipper_id' => $shipperId,
            'carrier_id' => $carrier->id,
            'status'     => 'pending',
        ]);

        $pc->load('carrier');

        return response()->json(['data' => $pc], 201);
    }

    // ── DELETE /preferred-carriers/{preferredCarrier} ─────────────────────────
    public function destroy(Request $request, PreferredCarrier $preferredCarrier): JsonResponse
    {
        abort_unless($request->user()->isShipperOf($preferredCarrier), 403);
        $preferredCarrier->delete();
        return response()->json(['message' => 'Carrier removed from network']);
    }
}
