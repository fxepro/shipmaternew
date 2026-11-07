<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ShipmentResource;
use App\Models\FreightJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Public tracking by a load's tracking code (/track/{token}), no sign-in */
class TrackController extends Controller
{
    // GET /api/v1/track/{token}
    public function show(string $token): JsonResponse
    {
        $job = FreightJob::where('tracking_token', strtoupper($token))
            ->where('status', '!=', 'draft')
            ->with(['stops', 'carrier', 'shipper', 'latestPing'])
            ->firstOrFail();

        return response()->json(['data' => new ShipmentResource($job)]);
    }

    // POST /api/v1/track/{token} — the receiver confirms delivery: the remaining drop-offs are completed
    public function confirm(Request $request, string $token): JsonResponse
    {
        $job = FreightJob::where('tracking_token', strtoupper($token))
            ->whereIn('status', ['posted', 'in_progress'])
            ->whereNotNull('carrier_id')
            ->firstOrFail();

        $remaining = $job->stops()->where('status', '!=', 'completed')->get();
        $job->stops()->where('status', '!=', 'completed')->update(['status' => 'completed', 'completed_at' => now()]);
        $job->update(['status' => 'completed', 'completed_at' => now()]);
        foreach ($remaining as $stop) {
            app(\App\Services\ContactNotifier::class)->stopStatus($stop->fresh(['location', 'freightJob.carrier']), 'completed');
        }

        // Delivered: charge the shipper's hold (or charge now if there is none)
        $payments = app(\App\Services\Payments\LoadPayments::class);
        $payment  = \App\Models\LoadPayment::where('load_type', 'freight_job')->where('load_id', $job->id)->first()
            ?? $payments->schedule('freight_job', $job);
        if ($payment) $payments->charge($payment);

        return response()->json([
            'data'    => new ShipmentResource($job->fresh(['stops', 'carrier', 'shipper'])),
            'message' => 'Delivery confirmed.',
        ]);
    }
}
