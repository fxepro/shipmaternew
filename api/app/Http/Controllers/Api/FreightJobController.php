<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\FreightJob;
use App\Models\JobStop;
use App\Models\Organization;
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
        // A shipper sees its own loads and those a broker handles for it; a broker sees the loads it posted
        // A platform admin on the admin Operations pages sees every company's loads
        $jobs = ($request->user()->seesAllCompanies() ? FreightJob::query() : FreightJob::shipperSide($request->user()->current_org_id))
            ->with(['contract.carrier:' . Organization::PUBLIC, 'carrier:' . Organization::PUBLIC, 'shipper:' . Organization::PUBLIC, 'broker:' . Organization::PUBLIC, 'stops'])
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
        $user = $request->user();
        $uid  = $user->current_org_id;   // the carrier company

        // An unapproved (or restricted) carrier sees only its own loads, not the load board
        $board = \App\Support\Approval::blocked($user) === null;

        $jobs = FreightJob::with(['contract', 'stops', 'shipper:' . Organization::PUBLIC])
            // Jobs assigned to this carrier  OR  open posted jobs on the market
            ->where(function ($q) use ($uid, $board) {
                $q->where('carrier_id', $uid);
                if ($board) $q->orWhere(function ($inner) {
                    $inner->whereNull('carrier_id')->where('status', 'posted');
                });
            })
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->when($request->type === 'assigned',    fn($q) => $q->where('carrier_id', $uid))
            ->when($request->type === 'open_market', fn($q) => $q->whereNull('carrier_id')->where('status', 'posted'))
            // A driver sees only the loads they are on
            ->when($user->onlyAssignedLoads(), fn($q) => $q->forPerson($user->id))
            ->orderByDesc('created_at')
            ->get();

        // Open loads: does this carrier's fleet, authority and drivers fit?
        $org = Organization::find($uid);
        if ($org && $org->type === 'carrier') {
            $matcher = app(\App\Services\CarrierMatcher::class);
            $ctx = $matcher->context($org);
            foreach ($jobs as $j) {
                if (!$j->carrier_id && $j->status === 'posted') {
                    $r = $matcher->evaluate($j, $ctx);
                    $j->setAttribute('fit', ['fit' => $r['fit'], 'misses' => $r['misses'], 'unknown' => $r['unknown']]);
                }
            }
            if ($request->boolean('fits')) {
                $jobs = $jobs->filter(fn ($j) => $j->carrier_id || ($j->fit['fit'] ?? false))->values();
            }
        }

        return response()->json(['data' => $jobs]);
    }

    // ── Show (shipper) ────────────────────────────────────────────────────────

    public function show(Request $request, FreightJob $job): JsonResponse
    {
        // The shipper whose freight a broker handles may look at the load
        if (!$request->user()->isCustomerOf($job)) $this->authorise($request, $job);
        $job->load([
            'contract.carrier:' . Organization::PUBLIC,
            'stops.pickupItems.deliveryStop',
            'stops.deliveryItems.pickupStop',
            'stops.evidence',
            'shipper:' . Organization::PUBLIC,
            'broker:' . Organization::PUBLIC,
            'carrier:' . Organization::PUBLIC,
            'offers.carrier:' . Organization::PUBLIC,
            'people.user:id,name',
        ]);
        return response()->json(['data' => $job]);
    }

    // ── Show (carrier) ────────────────────────────────────────────────────────
    // A carrier may view:
    //   - any job assigned to them (carrier_id = uid)
    //   - any open-market job that is live (carrier_id IS NULL + status = posted)

    public function carrierShow(Request $request, FreightJob $job): JsonResponse
    {
        $uid = $request->user()->current_org_id;   // the carrier company
        $canView = $request->user()->isCarrierOf($job)
            || (is_null($job->carrier_id) && $job->status === 'posted' && \App\Support\Approval::blocked($request->user()) === null);

        abort_if(!$canView, 403, 'You do not have access to this job.');

        $job->load([
            'contract.carrier:' . Organization::PUBLIC,
            'stops.pickupItems.deliveryStop',
            'stops.deliveryItems.pickupStop',
            'stops.evidence',
            'shipper:' . Organization::PUBLIC,
            'broker:' . Organization::PUBLIC,
            'carrier:' . Organization::PUBLIC,
            'offers' => fn($q) => $q->where('carrier_id', $uid),
            'people.user:id,name',
        ]);
        return response()->json(['data' => $job]);
    }

    // ── Create (draft) ────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'contract_id'                            => 'nullable|exists:contracts,id',
            // Brokers: the shipper customer, on Shipmater (shipper_org_id) or by name
            'shipper_org_id'                         => 'nullable|integer|exists:organizations,id',
            'shipper_name'                           => 'nullable|string|max:200',
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
        ] + self::requirementRules());

        $contract = !empty($data['contract_id']) ? Contract::findOrFail($data['contract_id']) : null;
        if ($contract) {
            abort_unless($request->user()->isShipperOf($contract), 403);
        }

        abort_unless($request->user()->current_org_id, 422, 'Join or create a shipper company first.');

        // Who the load is for: a shipper posts its own; a broker posts for a shipper customer
        $orgId = $request->user()->current_org_id;
        if ($request->user()->currentOrg?->type === 'broker') {
            $customer = !empty($data['shipper_org_id']) ? Organization::where('type', 'shipper')->find($data['shipper_org_id']) : null;
            abort_if(!empty($data['shipper_org_id']) && !$customer, 422, 'That company is not a shipper.');
            abort_if(!$customer && blank($data['shipper_name'] ?? null), 422, 'Name the shipper this load is for.');
            $parties = ['shipper_id' => $customer?->id, 'broker_id' => $orgId, 'shipper_name' => $customer ? null : trim($data['shipper_name'])];
        } else {
            $parties = ['shipper_id' => $orgId, 'broker_id' => null, 'shipper_name' => null];
        }

        // A stop may use your own locations or any public one, never another company's private address
        $locIds = collect($data['stops'])->pluck('location_id')->filter()->unique();
        if ($locIds->isNotEmpty()) {
            $usable = Location::whereIn('id', $locIds)->usableBy($request->user()->current_org_id)->count();
            abort_if($usable !== $locIds->count(), 422, 'One of the stop locations is private to another company.');
        }

        return DB::transaction(function () use ($data, $contract, $request, $parties) {
            $job = FreightJob::create($parties + [
                'contract_id'          => $contract?->id,
                'carrier_id'           => $contract?->carrier_id,
                'title'                => $data['title'] ?? null,
                'reference_number'     => $data['reference_number'] ?? null,
                'special_instructions' => $data['special_instructions'] ?? null,
                'total_weight_lbs'     => $data['total_weight_lbs'] ?? null,
                'optimization_mode'    => $data['optimization_mode'] ?? $contract?->optimization_mode ?? 'shortest_route',
                'status'               => 'draft',
            ] + self::requirementValues($data));
            $job->addPerson($request->user()->current_org_id, $request->user()->id);

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
        abort_unless($request->user()->isShipperOf($job), 403);
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
        abort_unless($request->user()->isShipperOf($job), 403);
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
            // The price the load is posted at on the Marketplace; carriers offer around it
            'posted_rate_cents'                         => 'nullable|integer|min:100|max:100000000',
        ]);

        $job->update(['quote_requirements' => $data['quote_requirements']] + (array_key_exists('posted_rate_cents', $data) ? ['posted_rate_cents' => $data['posted_rate_cents']] : []));

        $job->load([
            'contract',
            'stops.pickupItems.deliveryStop',
            'stops.deliveryItems.pickupStop',
            'stops.evidence',
            'shipper:' . Organization::PUBLIC,
            'carrier:' . Organization::PUBLIC,
            'offers.carrier:' . Organization::PUBLIC,
        ]);

        return response()->json(['data' => $job]);
    }

    // ── Load requirements (equipment, features, specializations, temperature, hazmat) ──

    public static function requirementRules(): array
    {
        return [
            'equipment_types'          => 'sometimes|array',
            'equipment_types.*'        => [\Illuminate\Validation\Rule::in(\App\Models\Capability::keys('equipment'))],
            'required_capabilities'    => 'sometimes|array',
            'required_capabilities.*'  => [\Illuminate\Validation\Rule::in(array_merge(\App\Models\Capability::keys('feature'), \App\Models\Capability::keys('endorsement')))],
            'required_service_types'   => 'sometimes|array',
            'required_service_types.*' => 'string|exists:service_types,key',
            'hazmat'                   => 'sometimes|boolean',
            'temp_min_f'               => 'nullable|integer|min:-40|max:120',
            'temp_max_f'               => 'nullable|integer|min:-40|max:120|gte:temp_min_f',
        ];
    }

    public static function requirementValues(array $data): array
    {
        $out = [];
        foreach (['equipment_types', 'required_capabilities', 'required_service_types'] as $k) {
            if (array_key_exists($k, $data)) $out[$k] = array_values(array_unique($data[$k] ?? []));
        }
        foreach (['hazmat', 'temp_min_f', 'temp_max_f'] as $k) {
            if (array_key_exists($k, $data)) $out[$k] = $data[$k];
        }
        // Hazmat loads need the hazmat specialization
        if (!empty($out['hazmat'])) {
            $out['required_service_types'] = array_values(array_unique(array_merge($out['required_service_types'] ?? [], ['hazmat'])));
        }
        return $out;
    }

    // PATCH /api/v1/shipper/freight-jobs/{job}/requirements
    public function saveRequirements(Request $request, FreightJob $job): JsonResponse
    {
        abort_unless($request->user()->isShipperOf($job), 403);
        abort_unless(in_array($job->status, ['draft', 'posted'], true) && !$job->carrier_id, 422, 'Requirements are fixed once a carrier is booked.');
        $job->update(self::requirementValues($request->validate(self::requirementRules())));
        return response()->json(['data' => $job->only(['id', 'equipment_types', 'required_capabilities', 'required_service_types', 'hazmat', 'temp_min_f', 'temp_max_f'])]);
    }

    // GET /api/v1/shipper/freight-jobs/{job}/matches   ?all=1 also lists carriers that do not fit, with reasons
    public function matches(Request $request, FreightJob $job): JsonResponse
    {
        abort_unless($request->user()->isShipperOf($job), 403);
        return response()->json(['data' => app(\App\Services\CarrierMatcher::class)->forJob($job, $request->boolean('all'))]);
    }

    // ── Save billing ─────────────────────────────────────────────────────────

    public function saveBilling(Request $request, FreightJob $job): JsonResponse
    {
        abort_unless($request->user()->isShipperOf($job), 403);
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
        abort_unless($request->user()->isShipperOf($job), 403);
        abort_if($job->status !== 'draft', 422, 'Job is not in draft status.');
        // A contracted load goes only to an approved carrier
        if ($job->carrier_id && !\App\Support\Approval::companyApproved(Organization::find($job->carrier_id))) {
            return response()->json(['error' => 'The contracted carrier is not approved on Shipmater, so the load can\'t be sent to it yet.', 'code' => 'carrier_not_approved'], 422);
        }

        // The shipper (or the broker for it) declares what is being shipped; the shipper is legally responsible for it
        $data = $request->validate([
            'declaration'           => 'accepted',
            'commodity'             => 'required|string|max:200',
            'total_weight_lbs'      => 'nullable|integer|min:1',
            'sanitary_instructions' => 'nullable|string|max:2000',
        ], [
            'declaration.accepted' => 'Confirm the commodity, weight and hazmat details are accurate.',
            'commodity.required'   => 'Say what is being shipped.',
        ]);
        $weight = $data['total_weight_lbs'] ?? $job->total_weight_lbs ?? ((int) $job->stops()->sum('weight_lbs') ?: null);
        abort_unless($weight, 422, 'Enter the total weight of the load.');

        // Temperature-controlled food: written temperature and sanitation instructions for the carrier (FSMA)
        $tempControlled = $job->temp_min_f !== null || $job->temp_max_f !== null;
        abort_if($tempControlled && blank($data['sanitary_instructions'] ?? $job->sanitary_instructions), 422,
            'Temperature-controlled loads need written temperature and sanitation instructions for the carrier.');

        // Hazmat posted by a shipper: its PHMSA registration, hazmat training and a 24-hour emergency phone,
        // as set in Admin, Compliance (an item switched off there is not asked for)
        $poster = Organization::find($job->posterId());
        if ($job->hazmat && $poster?->type === 'shipper') {
            $items = collect(\App\Support\ComplianceRules::items($poster))->keyBy('key');
            $missing = collect(['hazmat_reg', 'hazmat_training', 'emergency_phone'])
                ->filter(fn ($k) => $items->has($k) && in_array($items[$k]['state'], ['missing', 'expired'], true))
                ->map(fn ($k) => $items[$k]['label'] ?? $k)->values();
            abort_if($missing->isNotEmpty(), 422, 'Hazmat loads need these on your company profile first: ' . $missing->implode(', ') . '.');
        }

        $job->update([
            'status'                => 'posted',
            'posted_at'             => now(),
            'commodity'             => $data['commodity'],
            'total_weight_lbs'      => $weight,
            'sanitary_instructions' => $data['sanitary_instructions'] ?? $job->sanitary_instructions,
            'declared_at'           => now(),
            'declared_by'           => $request->user()->id,
        ]);
        // Contracted jobs already have their carrier: schedule the payment now
        if ($job->carrier_id) {
            app(\App\Services\Payments\LoadPayments::class)->schedule('freight_job', $job);
            app(\App\Services\ContactNotifier::class)->booked($job->fresh('carrier'));
        }

        return response()->json(['data' => $job]);
    }

    // ── Carrier: update stop status ───────────────────────────────────────────

    public function updateStop(Request $request, FreightJob $job, JobStop $stop): JsonResponse
    {
        abort_unless($request->user()->isCarrierOf($job), 403);
        abort_if($stop->freight_job_id !== $job->id, 404);
        $job->addPerson($job->carrier_id, $request->user()->id);

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
        app(\App\Services\ContactNotifier::class)->stopStatus($stop->fresh(['location', 'freightJob.carrier']), $data['status']);

        if ($data['status'] === 'completed') {
            $allDone = $job->stops()->where('status', '!=', 'completed')->doesntExist();
            if ($allDone) {
                $job->update(['status' => 'completed', 'completed_at' => now()]);
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
        $user = $request->user();
        abort_unless($user->seesAllCompanies() || $user->isShipperOf($job) || $user->isCarrierOf($job), 403);
    }
}
