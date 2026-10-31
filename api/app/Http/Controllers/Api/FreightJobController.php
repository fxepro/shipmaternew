<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\FreightJob;
use App\Models\JobStop;
use App\Models\JobStopItem;
use App\Models\Location;
use App\Services\DocumentService;
use App\Services\RouteOptimizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class FreightJobController extends Controller
{
    public function __construct(private RouteOptimizationService $optimizer) {}

    // ── Shipper: list jobs ────────────────────────────────────────────────────

    public function shipperIndex(Request $request): JsonResponse
    {
        $jobs = FreightJob::where('shipper_id', $request->user()->id)
            ->with(['contract.carrier.carrierProfile', 'carrier.carrierProfile', 'stops'])
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->when($request->filled('contract_id'), fn($q) => $q->where('contract_id', $request->contract_id))
            ->when($request->type === 'contracted', fn($q) => $q->whereNotNull('contract_id'))
            ->when($request->type === 'open',       fn($q) => $q->whereNull('contract_id'))
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $jobs]);
    }

    // ── Carrier: list jobs ────────────────────────────────────────────────────

    public function carrierIndex(Request $request): JsonResponse
    {
        $uid = $request->user()->id;

        $jobs = FreightJob::with(['contract', 'stops', 'shipper'])
            // Jobs assigned to this carrier  OR  open posted jobs on the market
            ->where(function ($q) use ($uid) {
                $q->where('carrier_id', $uid)
                  ->orWhere(function ($inner) {
                      $inner->whereNull('carrier_id')->where('status', 'posted');
                  });
            })
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->when($request->type === 'assigned',    fn($q) => $q->where('carrier_id', $uid))
            ->when($request->type === 'open_market', fn($q) => $q->whereNull('carrier_id')->where('status', 'posted'))
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $jobs]);
    }

    // ── Show (shipper) ────────────────────────────────────────────────────────

    public function show(Request $request, FreightJob $job): JsonResponse
    {
        $this->authorise($request, $job);
        $job->load([
            'contract.carrier.carrierProfile',
            'stops.pickupItems.deliveryStop',
            'stops.deliveryItems.pickupStop',
            'stops.evidence',
            'shipper',
            'carrier.carrierProfile',
            'offers.carrier',
        ]);
        return response()->json(['data' => $job]);
    }

    // ── Show (carrier) ────────────────────────────────────────────────────────
    // A carrier may view:
    //   - any job assigned to them (carrier_id = uid)
    //   - any open-market job that is live (carrier_id IS NULL + status = posted)

    public function carrierShow(Request $request, FreightJob $job): JsonResponse
    {
        $uid = $request->user()->id;
        $canView = $job->carrier_id === $uid
            || (is_null($job->carrier_id) && $job->status === 'posted');

        abort_if(!$canView, 403, 'You do not have access to this job.');

        $job->load([
            'contract.carrier.carrierProfile',
            'stops.pickupItems.deliveryStop',
            'stops.deliveryItems.pickupStop',
            'stops.evidence',
            'shipper',
            'carrier.carrierProfile',
            'offers' => fn($q) => $q->where('carrier_id', $uid),
        ]);
        return response()->json(['data' => $job]);
    }

    // ── Create (draft) ────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'contract_id'                            => 'nullable|exists:contracts,id',
            'title'                                  => 'nullable|string|max:200',
            'reference_number'                       => 'nullable|string|max:100',
            'special_instructions'                   => 'nullable|string',
            'total_weight_lbs'                       => 'nullable|integer',
            'optimization_mode'                      => 'nullable|in:cluster_pickups,shortest_route',
            'stops'                                  => 'required|array|min:1',
            'stops.*.stop_type'                      => 'required|in:pickup,dropoff',
            'stops.*.sequence'                       => 'required|integer|min:1',
            'stops.*.location_id'                    => 'nullable|exists:locations,id',
            'stops.*.name'                           => 'nullable|string|max:200',
            'stops.*.contact_name'                   => 'nullable|string|max:100',
            'stops.*.contact_phone'                  => 'nullable|string|max:20',
            'stops.*.address'                        => 'required|string',
            'stops.*.city'                           => 'required|string',
            'stops.*.state'                          => 'required|string|max:10',
            'stops.*.zip'                            => 'required|string|max:20',
            'stops.*.lat'                            => 'nullable|numeric',
            'stops.*.lng'                            => 'nullable|numeric',
            'stops.*.scheduled_date'                 => 'nullable|date',
            'stops.*.window_start'                   => 'nullable|date_format:H:i',
            'stops.*.window_end'                     => 'nullable|date_format:H:i',
            'stops.*.weight_lbs'                     => 'nullable|integer',
            'stops.*.special_instructions'           => 'nullable|string',
            'stops.*.items'                          => 'nullable|array',
            'stops.*.items.*.delivery_stop_sequence' => 'required_with:stops.*.items|integer',
            'stops.*.items.*.description'            => 'required_with:stops.*.items|string',
            'stops.*.items.*.quantity'               => 'nullable|integer|min:1',
            'stops.*.items.*.unit'                   => 'nullable|in:pallet,box,piece,bag,drum,crate,other',
            'stops.*.items.*.weight_lbs'             => 'nullable|integer',
            'stops.*.items.*.sku'                    => 'nullable|string|max:100',
        ]);

        $contract = $data['contract_id'] ? Contract::findOrFail($data['contract_id']) : null;
        if ($contract) {
            abort_if($contract->shipper_id !== $request->user()->id, 403);
        }

        return DB::transaction(function () use ($data, $contract, $request) {
            $job = FreightJob::create([
                'contract_id'          => $contract?->id,
                'shipper_id'           => $request->user()->id,
                'carrier_id'           => $contract?->carrier_id,
                'org_id'               => $request->user()->org_id ?? null,
                'title'                => $data['title'] ?? null,
                'reference_number'     => $data['reference_number'] ?? null,
                'special_instructions' => $data['special_instructions'] ?? null,
                'total_weight_lbs'     => $data['total_weight_lbs'] ?? null,
                'optimization_mode'    => $data['optimization_mode'] ?? $contract?->optimization_mode ?? 'shortest_route',
                'status'               => 'draft',
            ]);

            // Create stops keyed by sequence for item linking
            $stopsBySequence = [];
            foreach ($data['stops'] as $stopData) {
                $stop = JobStop::create([
                    'freight_job_id'       => $job->id,
                    'location_id'          => $stopData['location_id'] ?? null,
                    'name'                 => $stopData['name'] ?? null,
                    'stop_type'            => $stopData['stop_type'],
                    'sequence'             => $stopData['sequence'],
                    'contact_name'         => $stopData['contact_name'] ?? null,
                    'contact_phone'        => $stopData['contact_phone'] ?? null,
                    'address'              => $stopData['address'],
                    'city'                 => $stopData['city'],
                    'state'                => $stopData['state'],
                    'zip'                  => $stopData['zip'],
                    'lat'                  => $stopData['lat'] ?? null,
                    'lng'                  => $stopData['lng'] ?? null,
                    'scheduled_date'       => $stopData['scheduled_date'] ?? null,
                    'window_start'         => $stopData['window_start'] ?? null,
                    'window_end'           => $stopData['window_end'] ?? null,
                    'weight_lbs'           => $stopData['weight_lbs'] ?? null,
                    'special_instructions' => $stopData['special_instructions'] ?? null,
                ]);
                $stopsBySequence[$stopData['sequence']] = $stop;

                if (!empty($stopData['location_id'])) {
                    Location::where('id', $stopData['location_id'])->increment('usage_count');
                }
            }

            // Create manifest items on pickup stops
            foreach ($data['stops'] as $stopData) {
                if ($stopData['stop_type'] !== 'pickup' || empty($stopData['items'])) continue;
                $pickupStop = $stopsBySequence[$stopData['sequence']];

                foreach ($stopData['items'] as $item) {
                    $deliveryStop = $stopsBySequence[$item['delivery_stop_sequence']] ?? null;
                    if (!$deliveryStop) continue;

                    JobStopItem::create([
                        'pickup_stop_id'   => $pickupStop->id,
                        'delivery_stop_id' => $deliveryStop->id,
                        'description'      => $item['description'],
                        'quantity'         => $item['quantity'] ?? 1,
                        'unit'             => $item['unit'] ?? 'pallet',
                        'weight_lbs'       => $item['weight_lbs'] ?? null,
                        'sku'              => $item['sku'] ?? null,
                    ]);
                }
            }

            $job->load('stops.pickupItems.deliveryStop');
            return response()->json(['data' => $job], 201);
        });
    }

    // ── Optimise route ────────────────────────────────────────────────────────

    public function optimise(Request $request, FreightJob $job): JsonResponse
    {
        abort_if($job->shipper_id !== $request->user()->id, 403);
        abort_if($job->status !== 'draft', 422, 'Can only optimise draft jobs.');

        $stops = $job->stops()->with('deliveryItems')->get();

        $input = $stops->map(function (JobStop $stop) {
            return [
                'id'               => $stop->id,
                'lat'              => (float) $stop->lat,
                'lng'              => (float) $stop->lng,
                'type'             => $stop->stop_type,
                'required_pickups' => $stop->requiredPickupIds(),
            ];
        })->filter(fn($s) => $s['lat'] && $s['lng'])->values()->toArray();

        $result = $this->optimizer->optimize($input, $job->optimization_mode);

        foreach ($result['sequence'] as $position => $stopId) {
            JobStop::where('id', $stopId)->update(['optimized_sequence' => $position + 1]);
        }

        $job->update([
            'route_distance_miles'   => $result['distance_miles'],
            'route_duration_minutes' => $result['duration_minutes'],
            'route_optimized_at'     => now(),
            'route_snapshot'         => $result,
        ]);

        $job->load('stops.pickupItems.deliveryStop');
        return response()->json(['data' => $job]);
    }

    // ── Save offer terms (open jobs only) ────────────────────────────────────
    // PATCH /api/v1/shipper/freight-jobs/{job}/terms

    public function saveTerms(Request $request, FreightJob $job): JsonResponse
    {
        abort_if($job->shipper_id !== $request->user()->id, 403);
        abort_if($job->status !== 'draft', 422, 'Can only update terms on draft jobs.');
        abort_unless(is_null($job->contract_id), 422, 'Only open jobs use offer terms.');

        $data = $request->validate([
            'quote_requirements'                        => 'required|array',
            'quote_requirements.preset'                 => 'nullable|string|max:30',
            'quote_requirements.rate_type'              => 'required|in:flat,per_mile,hourly',
            'quote_requirements.require_fuel_surcharge' => 'boolean',
            'quote_requirements.require_detention_rate' => 'boolean',
            'quote_requirements.free_time_hrs'          => 'integer|min:0|max:24',
            'quote_requirements.require_equipment_type' => 'boolean',
            'quote_requirements.equipment_type_hint'    => 'nullable|string|max:50',
            'quote_requirements.require_max_weight'     => 'boolean',
            'quote_requirements.require_payment_terms'  => 'boolean',
            'quote_requirements.payment_terms_hint'     => 'nullable|string|max:20',
        ]);

        $job->update(['quote_requirements' => $data['quote_requirements']]);

        $job->load([
            'contract',
            'stops.pickupItems.deliveryStop',
            'stops.deliveryItems.pickupStop',
            'stops.evidence',
            'shipper',
            'carrier',
            'offers.carrier',
        ]);

        return response()->json(['data' => $job]);
    }

    // ── Save billing ─────────────────────────────────────────────────────────

    public function saveBilling(Request $request, FreightJob $job): JsonResponse
    {
        abort_if($job->shipper_id !== $request->user()->id, 403);
        abort_if($job->status !== 'draft', 422, 'Can only update billing on draft jobs.');

        $data = $request->validate([
            'payment_amount_cents' => 'required|integer|min:0',
            'cost_breakdown'       => 'required|array',
        ]);

        $job->update([
            'payment_amount_cents' => $data['payment_amount_cents'],
            'cost_breakdown'       => $data['cost_breakdown'],
        ]);

        $job->load('stops.pickupItems.deliveryStop');
        return response()->json(['data' => $job]);
    }

    // ── Post (send to carrier) ────────────────────────────────────────────────

    public function post(Request $request, FreightJob $job): JsonResponse
    {
        abort_if($job->shipper_id !== $request->user()->id, 403);
        abort_if($job->status !== 'draft', 422, 'Job is not in draft status.');

        $job->update([
            'status'    => 'posted',
            'posted_at' => now(),
        ]);
        // Contracted jobs already have their carrier: schedule the payment now
        if ($job->carrier_id) app(\App\Services\Payments\LoadPayments::class)->schedule('freight_job', $job);

        return response()->json(['data' => $job]);
    }

    // ── Carrier: update stop status ───────────────────────────────────────────

    public function updateStop(Request $request, FreightJob $job, JobStop $stop): JsonResponse
    {
        abort_if($job->carrier_id !== $request->user()->id, 403);
        abort_if($stop->freight_job_id !== $job->id, 404);

        $data = $request->validate([
            'status'        => 'required|in:en_route,arrived,completed',
            'carrier_notes' => 'nullable|string',
        ]);

        $timestamps = [
            'en_route'  => 'en_route_at',
            'arrived'   => 'arrived_at',
            'completed' => 'completed_at',
        ];

        $stop->update([
            'status'                      => $data['status'],
            $timestamps[$data['status']]  => now(),
            'carrier_notes'               => $data['carrier_notes'] ?? $stop->carrier_notes,
        ]);

        if ($data['status'] === 'completed') {
            $allDone = $job->stops()->where('status', '!=', 'completed')->doesntExist();
            if ($allDone) {
                $job->update(['status' => 'completed']);
                // Delivered: charge the shipper's hold (or charge now if there is none)
                $payments = app(\App\Services\Payments\LoadPayments::class);
                $payment  = \App\Models\LoadPayment::where('load_type', 'freight_job')->where('load_id', $job->id)->first()
                    ?? $payments->schedule('freight_job', $job);
                if ($payment) $payments->charge($payment);
            } elseif ($job->status === 'posted') {
                $job->update(['status' => 'in_progress']);
            }
        }

        return response()->json(['data' => $stop]);
    }

    // ── Documents ─────────────────────────────────────────────────────────────

    /** GET /api/v1/jobs/{job}/rate-confirmation */
    public function rateConfirmation(Request $request, FreightJob $job): Response
    {
        $this->authorise($request, $job);
        return app(DocumentService::class)->rateConfirmation($job, (bool) $request->boolean('download'));
    }

    public function bol(Request $request, FreightJob $job): Response
    {
        $this->authorise($request, $job);
        return app(DocumentService::class)->bol($job, (bool) $request->boolean('download'));
    }

    public function invoice(Request $request, FreightJob $job): Response
    {
        $this->authorise($request, $job);
        return app(DocumentService::class)->invoice($job, (bool) $request->boolean('download'));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function authorise(Request $request, FreightJob $job): void
    {
        $uid = $request->user()->id;
        abort_if($job->shipper_id !== $uid && $job->carrier_id !== $uid, 403);
    }
}
