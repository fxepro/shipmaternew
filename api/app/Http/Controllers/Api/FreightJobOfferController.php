<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FreightJob;
use App\Models\FreightJobOffer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FreightJobOfferController extends Controller
{
    // ── Carrier: submit an offer ──────────────────────────────────────────────
    // POST /api/v1/carrier/freight-jobs/{job}/offers

    public function store(Request $request, FreightJob $job): JsonResponse
    {
        $carrier = $request->user();
        $qr      = $job->quote_requirements ?? [];
        $rateType = $qr['rate_type'] ?? 'flat';

        abort_unless($job->status === 'posted', 422, 'This job is no longer accepting offers.');
        abort_unless(is_null($job->carrier_id), 422, 'This job has already been assigned.');
        abort_if($job->shipper_id === $carrier->id, 422, 'You cannot make an offer on your own job.');

        if ($job->offers()->where('carrier_id', $carrier->id)->whereIn('status', ['pending', 'accepted'])->exists()) {
            abort(422, 'You already have a pending offer on this job.');
        }

        // Build validation rules dynamically from quote_requirements
        $rules = ['note' => ['nullable', 'string', 'max:500']];

        if ($rateType === 'per_mile' || $rateType === 'hourly') {
            $rules['rate_value'] = ['required', 'numeric', 'min:0.01', 'max:99999'];
            $rules['amount']     = ['required', 'numeric', 'min:1', 'max:9999999'];
        } else {
            $rules['amount'] = ['required', 'numeric', 'min:1', 'max:9999999'];
        }

        $rules['fuel_surcharge'] = !empty($qr['require_fuel_surcharge'])
            ? ['required', 'numeric', 'min:0', 'max:99999']
            : ['nullable', 'numeric', 'min:0', 'max:99999'];

        if (!empty($qr['require_detention_rate'])) {
            $rules['detention_rate'] = ['required', 'numeric', 'min:0', 'max:99999'];
            $rules['free_time_hrs']  = ['required', 'integer', 'min:0', 'max:24'];
        } else {
            $rules['detention_rate'] = ['nullable', 'numeric', 'min:0', 'max:99999'];
            $rules['free_time_hrs']  = ['nullable', 'integer', 'min:0', 'max:24'];
        }

        $rules['equipment_type'] = !empty($qr['require_equipment_type'])
            ? ['required', 'string', 'max:50']
            : ['nullable', 'string', 'max:50'];

        $rules['max_weight_lbs'] = !empty($qr['require_max_weight'])
            ? ['required', 'integer', 'min:1', 'max:999999']
            : ['nullable', 'integer', 'min:1', 'max:999999'];

        $rules['payment_terms'] = !empty($qr['require_payment_terms'])
            ? ['required', 'string', 'max:30']
            : ['nullable', 'string', 'max:30'];

        $data = $request->validate($rules);

        $offer = $job->offers()->create([
            'carrier_id'     => $carrier->id,
            'rate_type'      => $rateType,
            'rate_value'     => $data['rate_value'] ?? null,
            'amount'         => $data['amount'],
            'fuel_surcharge' => $data['fuel_surcharge'] ?? null,
            'detention_rate' => $data['detention_rate'] ?? null,
            'free_time_hrs'  => $data['free_time_hrs']  ?? null,
            'equipment_type' => $data['equipment_type'] ?? null,
            'max_weight_lbs' => $data['max_weight_lbs'] ?? null,
            'payment_terms'  => $data['payment_terms']  ?? null,
            'note'           => $data['note']           ?? null,
            'status'         => 'pending',
        ]);

        $offer->load('carrier');

        return response()->json(['data' => $this->shape($offer)], 201);
    }

    // ── Carrier: withdraw their offer ─────────────────────────────────────────
    // DELETE /api/v1/carrier/freight-jobs/{job}/offers/{offer}

    public function withdraw(Request $request, FreightJob $job, FreightJobOffer $offer): JsonResponse
    {
        abort_if($offer->carrier_id !== $request->user()->id, 403);
        abort_if($offer->freight_job_id !== $job->id, 404);
        abort_unless($offer->status === 'pending', 422, 'Only pending offers can be withdrawn.');

        $offer->update(['status' => 'withdrawn']);

        return response()->json(['data' => $this->shape($offer)]);
    }

    // ── Shipper: list offers on a job ─────────────────────────────────────────
    // GET /api/v1/shipper/freight-jobs/{job}/offers

    public function index(Request $request, FreightJob $job): JsonResponse
    {
        abort_if($job->shipper_id !== $request->user()->id, 403);

        $offers = $job->offers()
            ->with('carrier.carrierProfile')
            ->whereIn('status', ['pending', 'accepted', 'rejected'])
            ->get();

        return response()->json(['data' => $offers->map(fn($o) => $this->shape($o))]);
    }

    // ── Shipper: accept an offer ──────────────────────────────────────────────
    // POST /api/v1/shipper/freight-jobs/{job}/offers/{offer}/accept

    public function accept(Request $request, FreightJob $job, FreightJobOffer $offer): JsonResponse
    {
        abort_if($job->shipper_id !== $request->user()->id, 403);
        abort_if($offer->freight_job_id !== $job->id, 404);
        abort_unless($offer->status === 'pending', 422, 'This offer can no longer be accepted.');
        abort_unless(is_null($job->carrier_id), 422, 'Job already has a carrier assigned.');

        // Accept this offer, reject all others
        $offer->update(['status' => 'accepted']);
        $job->offers()
            ->where('id', '!=', $offer->id)
            ->where('status', 'pending')
            ->update(['status' => 'rejected']);

        // Assign the carrier — status stays 'posted' (shown as "Dispatched" on frontend)
        $job->update(['carrier_id' => $offer->carrier_id]);
        app(\App\Services\Payments\LoadPayments::class)->schedule('freight_job', $job);

        $offer->load('carrier.carrierProfile');

        return response()->json(['data' => $this->shape($offer)]);
    }

    // ── Shipper: decline an offer ─────────────────────────────────────────────
    // POST /api/v1/shipper/freight-jobs/{job}/offers/{offer}/decline

    public function decline(Request $request, FreightJob $job, FreightJobOffer $offer): JsonResponse
    {
        abort_if($job->shipper_id !== $request->user()->id, 403);
        abort_if($offer->freight_job_id !== $job->id, 404);
        abort_unless($offer->status === 'pending', 422, 'This offer has already been resolved.');

        $offer->update(['status' => 'rejected']);

        return response()->json(['data' => $this->shape($offer)]);
    }

    // ── Carrier: get their own offer on a job ─────────────────────────────────
    // GET /api/v1/carrier/freight-jobs/{job}/offers/mine

    public function mine(Request $request, FreightJob $job): JsonResponse
    {
        $offer = $job->offers()
            ->where('carrier_id', $request->user()->id)
            ->latest()
            ->first();

        return response()->json(['data' => $offer ? $this->shape($offer) : null]);
    }

    // ── Shipper: list all offers across all their jobs ────────────────────────
    // GET /api/v1/shipper/offers

    public function shipperAllOffers(Request $request): JsonResponse
    {
        $uid = $request->user()->id;

        $offers = FreightJobOffer::with([
            'carrier.carrierProfile',
            'freightJob' => fn($q) => $q->where('shipper_id', $uid)->withCount('stops'),
        ])
            ->whereHas('freightJob', fn($q) => $q->where('shipper_id', $uid))
            ->whereIn('status', ['pending', 'accepted', 'rejected'])
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $offers->map(function (FreightJobOffer $offer) {
                $job = $offer->freightJob;
                return array_merge($this->shape($offer), [
                    'job' => $job ? [
                        'id'                   => $job->id,
                        'title'                => $job->title,
                        'status'               => $job->status,
                        'route_distance_miles' => $job->route_distance_miles,
                        'stops_count'          => $job->stops_count ?? 0,
                        'quote_requirements'   => $job->quote_requirements,
                    ] : null,
                ]);
            }),
        ]);
    }

    // ── Carrier: list all their offers across all jobs ────────────────────────
    // GET /api/v1/carrier/my-offers

    public function carrierMyOffers(Request $request): JsonResponse
    {
        $uid = $request->user()->id;

        $offers = FreightJobOffer::with([
            'carrier',
            'freightJob' => fn($q) => $q->with('shipper')->withCount('stops'),
        ])
            ->where('carrier_id', $uid)
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $offers->map(function (FreightJobOffer $offer) {
                $job = $offer->freightJob;
                return array_merge($this->shape($offer), [
                    'job' => $job ? [
                        'id'                   => $job->id,
                        'title'                => $job->title,
                        'status'               => $job->status,
                        'route_distance_miles' => $job->route_distance_miles,
                        'stops_count'          => $job->stops_count ?? 0,
                        'shipper_name'         => $job->shipper?->name ?? '',
                        'posted_at'            => $job->posted_at?->toISOString(),
                    ] : null,
                ]);
            }),
        ]);
    }

    // ── Shape ─────────────────────────────────────────────────────────────────

    private function shape(FreightJobOffer $offer): array
    {
        $carrier = $offer->carrier;
        $profile = $carrier?->carrierProfile;

        return [
            'id'             => $offer->id,
            'freight_job_id' => $offer->freight_job_id,
            'carrier_id'     => $offer->carrier_id,
            'carrier_name'   => $carrier?->name ?? '',
            'carrier_rating' => (float) ($profile?->rating ?? 5.0),
            'carrier_dot'    => (bool)  ($profile?->dot_verified ?? false),
            'rate_type'      => $offer->rate_type ?? 'flat',
            'rate_value'     => $offer->rate_value !== null ? (float) $offer->rate_value : null,
            'amount'         => (float) $offer->amount,
            'fuel_surcharge' => $offer->fuel_surcharge !== null ? (float) $offer->fuel_surcharge : null,
            'detention_rate' => $offer->detention_rate !== null ? (float) $offer->detention_rate : null,
            'free_time_hrs'  => $offer->free_time_hrs,
            'equipment_type' => $offer->equipment_type,
            'max_weight_lbs' => $offer->max_weight_lbs,
            'payment_terms'  => $offer->payment_terms,
            'note'           => $offer->note,
            'status'         => $offer->status,
            'created_at'     => $offer->created_at?->toISOString(),
        ];
    }
}
