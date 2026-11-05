<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Services\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ContractController extends Controller
{
    private function shape(Contract $c): array
    {
        $profile = $c->carrier->carrierProfile;
        $parts   = explode(' ', $c->carrier->name);
        $avatar  = strtoupper(substr($parts[0], 0, 1) . (isset($parts[1]) ? substr($parts[1], 0, 1) : ''));

        return [
            'id'              => $c->id,
            'carrier_id'      => $c->carrier_id,
            'carrier'         => $c->carrier->name,
            'carrier_company' => $profile?->company_name ?? '',
            'carrier_avatar'  => $avatar,
            'rate_type'       => $c->rate_type,
            'rate'            => '$' . number_format($c->rate, 2),
            'fuel_surcharge'  => $c->fuel_surcharge ? '$' . number_format($c->fuel_surcharge, 2) : '',
            'detention_rate'  => $c->detention_rate ? '$' . number_format($c->detention_rate, 0) : '',
            'free_time'       => (string) $c->free_time_hrs,
            'equipment_type'  => $c->equipment_type ?? '',
            'max_weight'      => $c->max_weight_lbs ? number_format($c->max_weight_lbs) : '',
            'coverage'        => $c->coverage,
            'payment_terms'   => $c->payment_terms,
            'priority'        => $c->priority,
            'auto_renew'      => $c->auto_renew,
            'valid_from'      => $c->valid_from->format('M j, Y'),
            'valid_to'        => $c->valid_to->format('M j, Y'),
            'status'          => $c->status,
            'notes'           => $c->notes ?? '',
            'shipments_under' => $c->shipments_under,
        ];
    }

    // ── GET /contracts ────────────────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $query = Contract::with('carrier.carrierProfile')
            ->where('shipper_id', $request->user()->current_org_id);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $contracts = $query
            ->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END")
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($c) => $this->shape($c));

        return response()->json(['data' => $contracts]);
    }

    // ── POST /contracts ───────────────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'carrier_id'     => ['required', 'exists:organizations,id'],
            'rate_type'      => ['required', 'in:Per mile,Flat rate,Hourly'],
            'rate'           => ['required', 'numeric', 'min:0'],
            'fuel_surcharge' => ['nullable', 'numeric', 'min:0'],
            'detention_rate' => ['nullable', 'numeric', 'min:0'],
            'free_time_hrs'  => ['nullable', 'integer', 'min:0'],
            'equipment_type' => ['nullable', 'string', 'max:30'],
            'max_weight_lbs' => ['nullable', 'integer', 'min:0'],
            'coverage'       => ['required', 'string', 'max:200'],
            'payment_terms'  => ['required', 'in:Net 15,Net 30,Net 45,Quick Pay'],
            'priority'       => ['required', 'in:First Call,Preferred,Standard'],
            'auto_renew'     => ['boolean'],
            'valid_from'     => ['required', 'date'],
            'valid_to'       => ['required', 'date', 'after:valid_from'],
            'status'         => ['in:active,pending,expired,draft'],
            'notes'          => ['nullable', 'string'],
        ]);

        $contract = Contract::create([
            ...$validated,
            'shipper_id'     => $request->user()->current_org_id,
            'status'         => $validated['status'] ?? 'pending',
            'shipments_under'=> 0,
        ]);

        $contract->load('carrier.carrierProfile');

        return response()->json(['data' => $this->shape($contract)], 201);
    }

    // ── PUT /contracts/{contract} ─────────────────────────────────────────────
    public function update(Request $request, Contract $contract): JsonResponse
    {
        abort_unless($request->user()->isShipperOf($contract), 403);

        $validated = $request->validate([
            'status' => ['sometimes', 'in:active,pending,expired,draft'],
            'notes'  => ['nullable', 'string'],
        ]);

        $contract->update($validated);
        $contract->load('carrier.carrierProfile');

        return response()->json(['data' => $this->shape($contract)]);
    }

    // ── DELETE /contracts/{contract} ──────────────────────────────────────────
    public function destroy(Request $request, Contract $contract): JsonResponse
    {
        abort_unless($request->user()->isShipperOf($contract), 403);
        $contract->delete();
        return response()->json(['message' => 'Contract archived']);
    }

    // ── Documents ─────────────────────────────────────────────────────────────

    /** GET /api/v1/contracts/{contract}/agreement */
    public function agreement(Request $request, Contract $contract): Response
    {
        abort_unless($request->user()->isShipperOf($contract), 403);
        return app(DocumentService::class)->carrierAgreement($contract, (bool) $request->boolean('download'));
    }
}
