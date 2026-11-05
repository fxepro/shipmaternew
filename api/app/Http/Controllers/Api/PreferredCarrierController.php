<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrierProfile;
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

        $rows = PreferredCarrier::with(['carrier.carrierProfile'])
            ->where('shipper_id', $shipperId)
            ->orderBy('status')
            ->orderBy('created_at')
            ->get()
            ->map(function ($pc) use ($shipperId) {
                $carrier = $pc->carrier;
                $profile = $carrier->carrierProfile;

                $parts  = explode(' ', $carrier->name);
                $avatar = strtoupper(substr($parts[0], 0, 1) . (isset($parts[1]) ? substr($parts[1], 0, 1) : ''));

                $together = Shipment::where('shipper_id', $shipperId)
                    ->where('carrier_id', $carrier->id)
                    ->whereIn('status', ['assigned', 'in_transit', 'delivered'])
                    ->count();

                $joined = $profile?->created_at
                    ? $profile->created_at->format('M Y')
                    : $pc->created_at->format('M Y');

                return [
                    'id'                => $pc->id,
                    'carrier_id'        => $carrier->id,
                    'name'              => $carrier->name,
                    'company'           => $profile?->company_name ?? '',
                    'dot'               => $profile?->dot_number ?? '',
                    'mc'                => $profile?->mc_number ?? '',
                    'email'             => $carrier->email,
                    'phone'             => $profile?->phone ?? '',
                    'location'          => '',
                    'rating'            => (float) ($profile?->rating ?? 0),
                    'reviews'           => $profile?->total_deliveries ?? 0,
                    'completed_together'=> $together,
                    'status'            => $pc->status,
                    'avatar'            => $avatar,
                    'joined_date'       => $joined,
                    'insurance_verified'=> (bool) ($profile?->insurance_verified ?? false),
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

        $profile = CarrierProfile::where('dot_number', $request->dot_number)
            ->with('org')
            ->first();

        if (! $profile) {
            return response()->json(['message' => 'No carrier found with that DOT number.'], 404);
        }

        // Preferred carriers are company to company
        $carrier   = $profile->org;
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

        $pc->load('carrier.carrierProfile');

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
