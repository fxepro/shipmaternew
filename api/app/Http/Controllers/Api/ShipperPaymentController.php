<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bid;
use App\Models\Shipment;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShipperPaymentController extends Controller
{
    public function __construct(private PaymentService $payments) {}

    // ── POST /api/v1/bids/{bid}/payment-intent ────────────────────────────────
    // Step 1: Shipper requests a PaymentIntent before accepting a bid.
    // Returns client_secret for Stripe.js to confirm (authorize) the charge.
    // The bid is NOT accepted yet — acceptance happens after authorization.

    public function createIntent(Request $request, Bid $bid): JsonResponse
    {
        // Replaced by scheduled load payments (App\Services\Payments\LoadPayments): held the day before pickup, charged at delivery
        return response()->json(['error' => 'Payments are now taken automatically: the card on file is held the day before pickup and charged at delivery.', 'code' => 'gone'], 410);
    }

    // ── PUT /api/v1/bids/{bid}/accept ─────────────────────────────────────────
    // Step 2: After Stripe authorizes the card, shipper confirms bid acceptance.
    // Verifies the PaymentIntent is in requires_capture state.

    public function accept(Request $request, Bid $bid): JsonResponse
    {
        $user     = $request->user();
        $shipment = $bid->shipment;

        abort_unless($user->isShipper(), 403);
        abort_unless($shipment->shipper_id === $user->id, 403);
        abort_unless($bid->status === 'pending', 422, 'This bid can no longer be accepted.');

        // A card or bank account must be on file; it is held the day before pickup (docs/fees-and-billing.md)
        $payments = app(\App\Services\Payments\LoadPayments::class);
        $org = \App\Services\Payments\LoadPayments::orgOf($user->id, 'shipper');
        if (!$payments->defaultMethod($org?->id)) {
            return response()->json(['error' => 'Add a card or bank account in Payments before accepting a bid.', 'code' => 'payment_method_required'], 422);
        }

        // Accept the bid and assign the carrier
        $bid->update(['status' => 'accepted']);
        $shipment->bids()->where('id', '!=', $bid->id)->update(['status' => 'rejected']);
        $shipment->update([
            'carrier_id'         => $bid->carrier_id,
            'agreed_cost'        => $bid->amount,
            'status'             => 'assigned',
            'payment_status'     => 'scheduled',
        ]);
        $payments->schedule('shipment', $shipment->fresh());

        return response()->json([
            'message'    => 'Bid accepted. Your card is held the day before pickup and charged at delivery.',
            'shipment_id' => $shipment->id,
        ]);
    }

    // ── POST /api/v1/shipper/pay/{shipment} ───────────────────────────────────
    // For shipments that already have an agreed_cost but no payment yet
    // (e.g. contracted jobs, direct offers). Creates and returns a PaymentIntent.

    public function payShipment(Request $request, Shipment $shipment): JsonResponse
    {
        // Replaced by scheduled load payments (App\Services\Payments\LoadPayments): held the day before pickup, charged at delivery
        return response()->json(['error' => 'Payments are now taken automatically: the card on file is held the day before pickup and charged at delivery.', 'code' => 'gone'], 410);
    }
}
