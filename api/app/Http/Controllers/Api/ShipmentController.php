<?php

namespace App\Http\Controllers\Api;

use App\Events\ShipmentPingReceived;
use App\Http\Controllers\Controller;
use App\Http\Resources\ShipmentResource;
use App\Models\FreightJob;
use App\Models\GpsPing;
use App\Models\LoadPerson;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Shipments are freight jobs (one load table, stops for every pickup and drop-off).
 * This controller serves the summary lists and panels (My Shipments, dashboards, receiver pages)
 * and the carrier's GPS pings. Creating, offers and stops are in FreightJobController and FreightJobOfferController.
 */
class ShipmentController extends Controller
{
    private const WITH = ['stops', 'shipper', 'broker', 'carrier', 'people.user', 'latestPing'];

    // GET /api/v1/shipments   ?status=pending|assigned|in_transit|delivered|cancelled|disputed  ?include_drafts=1
    public function index(Request $request): AnonymousResourceCollection
    {
        /** @var User $user */
        $user  = $request->user();
        $query = $this->visibleTo($user);

        if ($request->filled('status')) {
            $query->displayStatus($request->input('status'));
        } elseif (!$request->boolean('include_drafts')) {
            $query->where('status', '!=', 'draft');
        }

        return ShipmentResource::collection($query->with(self::WITH)->latest()->paginate(50));
    }

    // GET /api/v1/shipments/{job}
    public function show(Request $request, FreightJob $job): JsonResponse
    {
        abort_unless($this->visibleTo($request->user())->whereKey($job->id)->exists(), 403);
        return response()->json(['data' => new ShipmentResource($job->load(self::WITH))]);
    }

    // POST /api/v1/jobs/{job}/ping — the carrier's GPS position while the load moves
    public function ping(Request $request, FreightJob $job): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isPlatformAdmin() || $user->isCarrierOf($job), 403, 'Only the assigned carrier can send GPS pings.');

        $data = $request->validate([
            'lat'   => ['required', 'numeric'],
            'lng'   => ['required', 'numeric'],
            'speed' => ['nullable', 'numeric'],
            'eta'   => ['nullable', 'string'],
        ]);

        $ping = GpsPing::create($data + ['freight_job_id' => $job->id, 'pinged_at' => now()]);
        $ping->setRelation('freightJob', $job);

        // The first ping starts the trip
        if ($job->status === 'posted' && $job->carrier_id) {
            $job->update(['status' => 'in_progress']);
        }

        // Live map update. The ping is already saved, so a realtime server that is down must not fail it
        try {
            broadcast(new ShipmentPingReceived($ping));
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json(['data' => $ping]);
    }

    /** Loads this person may see: their company's (shipper or carrier), a driver's own, or ones they are on (receivers) */
    private function visibleTo(User $user)
    {
        if ($user->isPlatformAdmin()) return FreightJob::query();

        // A receiver company sees loads with a stop at one of its locations, and loads it was added to
        if ($user->isReceiver() || $user->currentOrg?->type === 'receiver') {
            $org = $user->current_org_id;
            return FreightJob::where(fn ($q) => $q
                ->whereIn('id', \App\Models\JobStop::whereIn('location_id', \App\Models\Location::where('org_id', $org ?? 0)->select('id'))->select('freight_job_id'))
                ->orWhereIn('id', LoadPerson::where('load_type', 'freight_job')
                    ->where(fn ($p) => $p->where('user_id', $user->id)->when($org, fn ($x) => $x->orWhere('org_id', $org)))
                    ->select('load_id')))
                ->where('status', '!=', 'draft');
        }

        if ($user->isCarrier()) {
            $q = FreightJob::where('carrier_id', $user->current_org_id);
            return $user->onlyAssignedLoads() ? $q->forPerson($user->id) : $q;
        }

        // Shippers also see loads a broker handles for them; brokers see the loads they posted
        return FreightJob::shipperSide($user->current_org_id);
    }
}
