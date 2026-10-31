<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FactoredLoad;
use App\Models\FreightJob;
use App\Models\Noa;
use App\Models\Organization;
use App\Models\OrgMember;
use App\Models\Shipment;
use App\Models\User;
use App\Services\PersonChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * NOAs and factored loads for every account type (docs/noa-factoring.md):
 * - Carrier (owner/staff): files NOAs with a factor, asks for loads to be factored, asks for a release.
 * - Factor (owner/staff): confirms or declines NOAs and loads, marks loads funded, releases NOAs.
 *   Needs a verified owner, and a connected Stripe account to accept loads.
 * - Shipper: sees which of its loads are factored and who to pay; acknowledges the notice.
 * - Admin: reads everything; approves nothing.
 */
class FactoringController extends Controller
{
    private const OPEN_LOAD = ['requested', 'accepted', 'funded'];

    // ── Shared reads ─────────────────────────────────────────────────────────

    // GET /api/v1/factoring/noas
    public function noas(Request $request): JsonResponse
    {
        [$user, $org] = $this->ctx($request);

        $q = Noa::with(['carrierOrg', 'factorOrg'])->withCount(['loads as open_loads' => fn ($l) => $l->whereIn('status', self::OPEN_LOAD)])->latest();
        if (!$user->isPlatformAdmin()) {
            match ($org->type) {
                'carrier' => $q->where('carrier_org_id', $org->id),
                'factor'  => $q->where('factor_org_id', $org->id),
                default   => abort(403),
            };
        }

        return response()->json(['data' => $q->limit(500)->get()->map(fn (Noa $n) => $this->presentNoa($n))]);
    }

    // GET /api/v1/factoring/loads
    public function loads(Request $request): JsonResponse
    {
        [$user, $org] = $this->ctx($request);

        $q = FactoredLoad::with(['carrierOrg', 'factorOrg', 'noa'])->latest();
        if (!$user->isPlatformAdmin()) {
            match ($org->type) {
                'carrier' => $q->where('carrier_org_id', $org->id),
                'factor'  => $q->where('factor_org_id', $org->id),
                'shipper' => $q->whereIn('status', ['accepted', 'funded'])->where(fn ($w) => $this->whereShipperLoads($w, $org)),
                default   => abort(403),
            };
        }

        return response()->json(['data' => $q->limit(500)->get()->map(fn (FactoredLoad $f) => $this->presentLoad($f))]);
    }

    // GET /api/v1/factoring/noas/{noa}/document?release=1
    public function document(Request $request, Noa $noa)
    {
        [$user, $org] = $this->ctx($request);
        abort_unless($user->isPlatformAdmin() || in_array($org?->id, [$noa->carrier_org_id, $noa->factor_org_id], true), 403);

        return PersonChecks::fileResponse($request->boolean('release') ? $noa->release_document_path : $noa->document_path);
    }

    // ── Carrier ──────────────────────────────────────────────────────────────

    // GET /api/v1/factoring/factors?q=   factoring companies on Shipmater
    public function factors(Request $request): JsonResponse
    {
        $this->carrier($request);
        $q = Organization::where('type', 'factor')->where('status', 'active')->orderBy('name');
        if ($term = $request->string('q')->trim()->value()) $q->where('name', 'ilike', "%{$term}%");

        return response()->json(['data' => $q->limit(50)->get()->map(fn (Organization $o) => [
            'id' => $o->id, 'name' => $o->name, 'city' => $o->city, 'state' => $o->state, 'email' => $o->email, 'phone' => $o->phone,
            'verified' => $this->factorVerified($o), 'stripe_connected' => (bool) $o->stripe_connect_id,
        ])]);
    }

    // POST /api/v1/factoring/noas   multipart: factor_org_id, effective_date, document, notes?
    public function fileNoa(Request $request): JsonResponse
    {
        [$user, $org] = $this->carrier($request, true);

        $data = $request->validate([
            'factor_org_id'  => ['required', 'integer', 'exists:organizations,id'],
            'effective_date' => ['required', 'date'],
            'document'       => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
            'notes'          => ['nullable', 'string', 'max:1000'],
        ]);
        abort_unless(Organization::find($data['factor_org_id'])?->type === 'factor', 422, 'Choose a factoring company on Shipmater.');

        // One NOA in force per carrier: a new one waits until the current one is released
        if (Noa::where('carrier_org_id', $org->id)->whereIn('status', ['pending_factor', 'active'])->exists()) {
            return response()->json(['error' => 'You already have an NOA that is active or waiting for the factor. It must be released or declined first.', 'code' => 'noa_exists'], 422);
        }

        $noa = Noa::create([
            'carrier_org_id' => $org->id,
            'factor_org_id'  => $data['factor_org_id'],
            'effective_date' => $data['effective_date'],
            'document_path'  => PersonChecks::storeFile($request->file('document'), $user->id, 'noa'),
            'notes'          => $data['notes'] ?? null,
            'uploaded_by'    => $user->id,
        ]);

        return response()->json(['data' => $this->presentNoa($noa->refresh()->load(['carrierOrg', 'factorOrg']))], 201);
    }

    // POST /api/v1/factoring/noas/{noa}/request-release
    public function requestRelease(Request $request, Noa $noa): JsonResponse
    {
        [, $org] = $this->carrier($request, true);
        abort_unless($noa->carrier_org_id === $org->id && $noa->status === 'active', 422, 'Only an active NOA can be released.');
        $noa->update(['release_requested_at' => now()]);

        return response()->json(['data' => $this->presentNoa($noa->load(['carrierOrg', 'factorOrg']))]);
    }

    // GET /api/v1/factoring/eligible-loads   the carrier's loads that can still be factored
    public function eligibleLoads(Request $request): JsonResponse
    {
        [, $org] = $this->carrier($request);
        $ids   = $this->memberIds($org);
        $taken = FactoredLoad::where('carrier_org_id', $org->id)->whereIn('status', self::OPEN_LOAD)->get(['load_type', 'load_id'])
            ->map(fn ($f) => "{$f->load_type}:{$f->load_id}")->all();

        $shipments = Shipment::whereIn('carrier_id', $ids)->whereNotIn('status', ['cancelled', 'delivered'])
            ->where(fn ($w) => $w->whereNull('payment_status')->orWhereIn('payment_status', ['unpaid', 'authorized']))
            ->latest()->limit(200)->get()->map(fn ($s) => $this->presentRecord('shipment', $s));
        $jobs = FreightJob::whereIn('carrier_id', $ids)->whereNotIn('status', ['cancelled', 'completed', 'draft'])
            ->where(fn ($w) => $w->whereNull('payment_status')->orWhereNotIn('payment_status', ['paid', 'captured']))
            ->latest()->limit(200)->get()->map(fn ($j) => $this->presentRecord('freight_job', $j));

        return response()->json(['data' => $shipments->concat($jobs)->reject(fn ($l) => in_array("{$l['type']}:{$l['id']}", $taken, true))->values()]);
    }

    // POST /api/v1/factoring/loads   { load_type, load_id }
    public function factorLoad(Request $request): JsonResponse
    {
        [$user, $org] = $this->carrier($request, true);
        $data = $request->validate([
            'load_type' => ['required', 'in:shipment,freight_job'],
            'load_id'   => ['required', 'integer'],
        ]);

        if (\App\Services\Payments\LoadPayments::carrierOwesFees($org->id)) {
            return response()->json(['error' => 'You have an unpaid Shipmater fee on a funded load. Pay it in Earnings before factoring more loads.', 'code' => 'fee_unpaid'], 422);
        }

        $noa = Noa::where('carrier_org_id', $org->id)->where('status', 'active')->latest()->first();
        if (!$noa?->isInForce()) {
            return response()->json(['error' => 'You need an NOA confirmed by your factor, in effect today, before factoring a load.', 'code' => 'no_active_noa'], 422);
        }

        $record = $data['load_type'] === 'freight_job' ? FreightJob::find($data['load_id']) : Shipment::find($data['load_id']);
        abort_unless($record && in_array($record->carrier_id, $this->memberIds($org), true), 404, 'Load not found.');
        abort_if(in_array($record->payment_status, ['captured', 'transferred', 'paid', 'processing'], true), 422, 'This load has already been paid.');
        abort_if(FactoredLoad::where('load_type', $data['load_type'])->where('load_id', $record->id)->whereIn('status', self::OPEN_LOAD)->exists(), 422, 'This load is already factored.');

        $fl = FactoredLoad::create([
            'noa_id'         => $noa->id,
            'carrier_org_id' => $org->id,
            'factor_org_id'  => $noa->factor_org_id,
            'load_type'      => $data['load_type'],
            'load_id'        => $record->id,
            'load_amount'    => $this->amount($data['load_type'], $record),
            'requested_by'   => $user->id,
        ]);

        return response()->json(['data' => $this->presentLoad($fl->refresh()->load(['carrierOrg', 'factorOrg', 'noa']))], 201);
    }

    // DELETE /api/v1/factoring/loads/{load}   withdraw a request the factor hasn't answered
    public function withdrawLoad(Request $request, FactoredLoad $load): JsonResponse
    {
        [, $org] = $this->carrier($request, true);
        abort_unless($load->carrier_org_id === $org->id && $load->status === 'requested', 422, 'Only an unanswered request can be withdrawn.');
        $load->delete();

        return response()->json(['message' => 'Request withdrawn.']);
    }

    // ── Factor ───────────────────────────────────────────────────────────────

    // POST /api/v1/factoring/noas/{noa}/decide   { action: confirm|decline, reason? }
    public function decideNoa(Request $request, Noa $noa): JsonResponse
    {
        [$user, $org] = $this->factor($request);
        abort_unless($noa->factor_org_id === $org->id && $noa->status === 'pending_factor', 422, 'This NOA is not waiting for you.');
        $data = $request->validate(['action' => ['required', 'in:confirm,decline'], 'reason' => ['nullable', 'string', 'max:500']]);

        $noa->update([
            'status'         => $data['action'] === 'confirm' ? 'active' : 'declined',
            'decided_by'     => $user->id,
            'decided_at'     => now(),
            'decline_reason' => $data['action'] === 'decline' ? ($data['reason'] ?? null) : null,
        ]);

        return response()->json(['data' => $this->presentNoa($noa->load(['carrierOrg', 'factorOrg']))]);
    }

    // POST /api/v1/factoring/noas/{noa}/release   multipart: document? (release letter)
    public function release(Request $request, Noa $noa): JsonResponse
    {
        [$user, $org] = $this->factor($request);
        abort_unless($noa->factor_org_id === $org->id && $noa->status === 'active', 422, 'Only an active NOA can be released.');
        $request->validate(['document' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240']]);

        // Loads already accepted or funded stay with the factor; unanswered requests lapse
        FactoredLoad::where('noa_id', $noa->id)->where('status', 'requested')->update(['status' => 'declined', 'decline_reason' => 'NOA released', 'decided_at' => now()]);

        $noa->update([
            'status'                => 'released',
            'released_by'           => $user->id,
            'released_at'           => now(),
            'release_document_path' => $request->hasFile('document') ? PersonChecks::storeFile($request->file('document'), $user->id, 'noa_release') : $noa->release_document_path,
        ]);

        return response()->json(['data' => $this->presentNoa($noa->load(['carrierOrg', 'factorOrg']))]);
    }

    // POST /api/v1/factoring/loads/{load}/decide   { action: accept|decline|funded, reason? }
    public function decideLoad(Request $request, FactoredLoad $load): JsonResponse
    {
        [$user, $org] = $this->factor($request);
        abort_unless($load->factor_org_id === $org->id, 403);
        $data = $request->validate(['action' => ['required', 'in:accept,decline,funded'], 'reason' => ['nullable', 'string', 'max:500']]);

        if ($data['action'] === 'funded') {
            abort_unless($load->status === 'accepted', 422, 'Only an accepted load can be marked funded.');
            $load->update(['status' => 'funded', 'funded_at' => now(), 'funded_by' => $user->id]);
            // Shipmater's fee is charged to the carrier now (docs/fees-and-billing.md)
            app(\App\Services\Payments\LoadPayments::class)->chargeFactoredFee($load);
        } else {
            abort_unless($load->status === 'requested', 422, 'This load is not waiting for you.');
            if ($data['action'] === 'accept' && !$org->stripe_connect_id) {
                return response()->json(['error' => 'Connect your Stripe account (Profile → Finance) before accepting loads, so shippers can pay you.', 'code' => 'stripe_not_connected'], 422);
            }
            $load->update([
                'status'         => $data['action'] === 'accept' ? 'accepted' : 'declined',
                'decided_by'     => $user->id,
                'decided_at'     => now(),
                'decline_reason' => $data['action'] === 'decline' ? ($data['reason'] ?? null) : null,
            ]);
            // Accepted: the shipper's payment now goes to the factor
            if ($data['action'] === 'accept') app(\App\Services\Payments\LoadPayments::class)->repoint($load->load_type, $load->load_id);
        }

        return response()->json(['data' => $this->presentLoad($load->load(['carrierOrg', 'factorOrg', 'noa']))]);
    }

    // ── Shipper ──────────────────────────────────────────────────────────────

    // POST /api/v1/factoring/loads/{load}/acknowledge
    public function acknowledge(Request $request, FactoredLoad $load): JsonResponse
    {
        [$user, $org] = $this->ctx($request);
        abort_unless($org?->type === 'shipper' && $load->routesToFactor(), 403);
        abort_unless(in_array($load->loadRecord()?->shipper_id, $this->memberIds($org), true), 403);

        if (!$load->shipper_acknowledged_at) {
            $load->update(['shipper_acknowledged_at' => now(), 'shipper_acknowledged_by' => $user->id]);
        }

        return response()->json(['data' => $this->presentLoad($load->load(['carrierOrg', 'factorOrg', 'noa']))]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function ctx(Request $request): array
    {
        $user = $request->user();
        return [$user, $user->currentOrg];
    }

    private function carrier(Request $request, bool $manage = false): array
    {
        [$user, $org] = $this->ctx($request);
        abort_unless($org?->type === 'carrier', 403, 'Factoring is managed by the carrier company.');
        if ($manage) abort_unless($user->isOrgAdmin(), 403, 'Only the owner or staff can manage factoring.');
        return [$user, $org];
    }

    /** Factors act only with a verified owner (docs/noa-factoring.md) */
    private function factor(Request $request): array
    {
        [$user, $org] = $this->ctx($request);
        abort_unless($org?->type === 'factor', 403);
        abort_unless($user->isOrgAdmin(), 403, 'Only the owner or staff can confirm NOAs and loads.');
        if (!$this->factorVerified($org)) {
            abort(response()->json(['error' => 'Your company owner must verify their identity (Verification) before you can confirm NOAs or loads.', 'code' => 'owner_not_verified'], 422));
        }
        return [$user, $org];
    }

    private function factorVerified(Organization $org): bool
    {
        $owner = User::find($org->owner_id);
        return $owner ? PersonChecks::isCleared($owner) : false;
    }

    private function memberIds(Organization $org): array
    {
        return OrgMember::where('org_id', $org->id)->pluck('user_id')->push($org->owner_id)->unique()->values()->all();
    }

    private function whereShipperLoads($w, Organization $org): void
    {
        $ids = $this->memberIds($org);
        $w->where(fn ($s) => $s->where('load_type', 'shipment')->whereIn('load_id', Shipment::whereIn('shipper_id', $ids)->select('id')))
          ->orWhere(fn ($s) => $s->where('load_type', 'freight_job')->whereIn('load_id', FreightJob::whereIn('shipper_id', $ids)->select('id')));
    }

    private function amount(string $type, $record): ?float
    {
        return $type === 'freight_job'
            ? ($record->payment_amount_cents ? $record->payment_amount_cents / 100 : null)
            : ($record->agreed_cost !== null ? (float) $record->agreed_cost : null);
    }

    private function presentRecord(string $type, $r): array
    {
        $shipperOrg = Organization::whereIn('id', OrgMember::where('user_id', $r->shipper_id)->pluck('org_id'))->where('type', 'shipper')->first();
        return [
            'type'           => $type,
            'id'             => $r->id,
            'title'          => $type === 'freight_job' ? ($r->title ?: "Job #{$r->id}") : ($r->item_description ?: "Shipment #{$r->id}"),
            'route'          => $type === 'shipment' ? trim("{$r->pickup_city}, {$r->pickup_state} → {$r->delivery_city}, {$r->delivery_state}", ' ,→') : ($r->reference_number ?: null),
            'amount'         => $this->amount($type, $r),
            'status'         => $r->status,
            'payment_status' => $r->payment_status,
            'shipper'        => $shipperOrg ? PersonChecks::companyName($shipperOrg) : null,
            'href_carrier'   => $type === 'freight_job' ? "/carrier/my-jobs/{$r->id}" : null,
        ];
    }

    private function presentNoa(Noa $n): array
    {
        return [
            'id'                   => $n->id,
            'status'               => $n->status,
            'in_force'             => $n->isInForce(),
            'effective_date'       => $n->effective_date?->toDateString(),
            'carrier'              => ['id' => $n->carrier_org_id, 'name' => PersonChecks::companyName($n->carrierOrg)],
            'factor'               => ['id' => $n->factor_org_id, 'name' => $n->factorOrg?->name, 'email' => $n->factorOrg?->email, 'phone' => $n->factorOrg?->phone],
            'notes'                => $n->notes,
            'has_release_document' => (bool) $n->release_document_path,
            'decided_at'           => $n->decided_at?->toISOString(),
            'decline_reason'       => $n->decline_reason,
            'release_requested_at' => $n->release_requested_at?->toISOString(),
            'released_at'          => $n->released_at?->toISOString(),
            'open_loads'           => $n->open_loads ?? null,
            'created_at'           => $n->created_at?->toISOString(),
        ];
    }

    private function presentLoad(FactoredLoad $f): array
    {
        $record = $f->loadRecord();
        return [
            'id'                      => $f->id,
            'status'                  => $f->status,
            'noa_id'                  => $f->noa_id,
            'carrier'                 => ['id' => $f->carrier_org_id, 'name' => PersonChecks::companyName($f->carrierOrg)],
            'factor'                  => ['id' => $f->factor_org_id, 'name' => $f->factorOrg?->name, 'stripe_connected' => (bool) $f->factorOrg?->stripe_connect_id],
            'load'                    => $record ? $this->presentRecord($f->load_type, $record) : ['type' => $f->load_type, 'id' => $f->load_id, 'title' => 'Load removed'],
            'amount'                  => $f->load_amount !== null ? (float) $f->load_amount : null,
            'decided_at'              => $f->decided_at?->toISOString(),
            'decline_reason'          => $f->decline_reason,
            'funded_at'               => $f->funded_at?->toISOString(),
            'shipper_acknowledged_at' => $f->shipper_acknowledged_at?->toISOString(),
            'created_at'              => $f->created_at?->toISOString(),
        ];
    }
}
