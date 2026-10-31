<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeeCharge;
use App\Models\FreightJob;
use App\Models\LedgerEntry;
use App\Models\LoadPayment;
use App\Models\Organization;
use App\Models\PaymentMethod;
use App\Models\Shipment;
use App\Models\User;
use App\Services\PersonChecks;
use App\Services\Payments\LoadPayments;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Load payments as each company sees them (docs/fees-and-billing.md):
 * shipper = what it pays, carrier = what it earns and the fees it pays, factor = what it receives, admin = everything.
 */
class PaymentsController extends Controller
{
    public function __construct(private LoadPayments $payments) {}

    // GET /payments?status=&q=&from=&to=
    public function index(Request $request): JsonResponse
    {
        [$view, $org] = $this->view($request);
        $q = $this->scoped($view, $org)->with(['shipperOrg', 'carrierOrg', 'payeeOrg', 'paymentMethod'])->latest('id');

        if ($s = $request->string('status')->value()) {
            $q->whereIn('status', match ($s) {
                'attention' => ['hold_failed', 'failed'],
                'upcoming'  => ['scheduled', 'held', 'hold_failed'],
                default     => explode(',', $s),
            });
        }
        if ($from = $request->date('from')) $q->where('created_at', '>=', $from->startOfDay());
        if ($to = $request->date('to')) $q->where('created_at', '<=', $to->endOfDay());

        $rows = $q->limit(500)->get();
        $loads = $this->loadsFor($rows);

        return response()->json(['data' => $rows->map(fn ($p) => $this->present($p, $view, $loads))->values()]);
    }

    // GET /payments/summary
    public function summary(Request $request): JsonResponse
    {
        [$view, $org] = $this->view($request);
        $base = fn () => $this->scoped($view, $org);
        $sum  = fn (Builder $q, string $col = 'amount_cents') => (int) $q->sum($col);

        $data = [
            'view'           => $view,
            'paid_cents'     => $sum($base()->where('status', 'paid')),
            'upcoming_cents' => $sum($base()->whereIn('status', ['scheduled', 'held', 'hold_failed'])),
            'held_cents'     => $sum($base()->where('status', 'held')),
            'processing_cents' => $sum($base()->where('status', 'processing')),
            'attention'      => $base()->whereIn('status', ['hold_failed', 'failed'])->count(),
        ];

        if ($view === 'carrier') {
            $data['net_paid_cents']     = (int) $base()->where('status', 'paid')->where('payee_type', 'carrier')->selectRaw('coalesce(sum(amount_cents - fee_cents),0) as n')->value('n');
            $data['load_fees_cents']    = $sum($base()->where('status', 'paid'), 'fee_cents');
            $data['factored_cents']     = $sum($base()->where('payee_type', 'factor')->whereIn('status', ['paid', 'processing']));
            $data['factored_fees_cents'] = (int) FeeCharge::where('carrier_org_id', $org->id)->where('status', 'paid')->sum('amount_cents');
            $data['fees_owed_cents']    = (int) FeeCharge::where('carrier_org_id', $org->id)->where('status', 'failed')->sum('amount_cents');
        }
        if ($view === 'carrier' || $view === 'factor') {
            $data['stripe_connected'] = (bool) $this->connectedAccount($org);
        }
        if ($view !== 'admin' && $org) {
            $data['has_payment_method'] = PaymentMethod::where('org_id', $org->id)->whereNotNull('stripe_pm_id')->exists();
        }
        if ($view === 'admin') {
            $data['flow'] = LoadPayments::flow();
            $data['revenue_cents'] = (int) LedgerEntry::sum('amount_cents');
            $data['volume_cents']  = (int) LedgerEntry::sum('gross_cents');
        }

        return response()->json(['data' => $data]);
    }

    // POST /payments/{payment}/retry   (shipper: after a failed hold or charge, with its current default method)
    public function retry(Request $request, LoadPayment $payment): JsonResponse
    {
        $this->shipperOwns($request, $payment);
        abort_unless(in_array($payment->status, ['hold_failed', 'failed', 'scheduled'], true), 422, 'Nothing to retry on this payment.');

        $payment = $payment->status === 'failed' || !$payment->pickup_date || $payment->pickup_date->lte(today())
            ? $this->payments->charge($payment)
            : ($this->payments->holdDue($payment) ? $this->payments->placeHold($payment) : $payment);

        $loads = $this->loadsFor(collect([$payment]));
        return response()->json(['data' => $this->present($payment->fresh(), 'shipper', $loads)]);
    }

    // POST /payments/{payment}/pay-early   (shipper pays now at the early rate)
    public function payEarly(Request $request, LoadPayment $payment): JsonResponse
    {
        $this->shipperOwns($request, $payment);
        $payment = $this->payments->payEarly($payment);

        $loads = $this->loadsFor(collect([$payment]));
        return response()->json(['data' => $this->present($payment->fresh(), 'shipper', $loads)]);
    }

    // GET /payments/fees   (carrier: Shipmater's fee on factored loads)
    public function fees(Request $request): JsonResponse
    {
        [$view, $org] = $this->view($request);
        abort_unless(in_array($view, ['carrier', 'admin'], true), 403);

        $q = FeeCharge::with(['factoredLoad.factorOrg', 'carrierOrg'])->latest('id');
        if ($view === 'carrier') $q->where('carrier_org_id', $org->id);

        return response()->json(['data' => $q->limit(500)->get()->map(fn (FeeCharge $f) => [
            'id'             => $f->id,
            'factored_load_id' => $f->factored_load_id,
            'carrier'        => PersonChecks::companyName($f->carrierOrg),
            'factor'         => $f->factoredLoad?->factorOrg?->name,
            'load'           => $f->factoredLoad ? $this->loadTitle($f->factoredLoad->load_type, $f->factoredLoad->load_id) : null,
            'load_amount'    => $f->load_amount_cents / 100,
            'amount'         => $f->amount_cents / 100,
            'rate'           => (float) $f->fee_rate,
            'status'         => $f->status,
            'failure_reason' => $f->failure_reason,
            'paid_at'        => $f->paid_at?->toISOString(),
            'created_at'     => $f->created_at?->toISOString(),
        ])]);
    }

    // POST /payments/fees/{fee}/retry   (carrier, after adding a card)
    public function retryFee(Request $request, FeeCharge $fee): JsonResponse
    {
        [$view, $org] = $this->view($request);
        abort_unless($view === 'carrier' && $fee->carrier_org_id === $org->id, 403);
        abort_unless($request->user()->isOrgAdmin(), 403, 'Only the owner or staff can pay fees.');
        abort_unless($fee->status === 'failed', 422, 'This fee is not due.');

        $fee = $this->payments->collectFee($fee);
        return response()->json(['data' => ['id' => $fee->id, 'status' => $fee->status, 'failure_reason' => $fee->failure_reason]]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** @return array{0: string, 1: ?Organization} */
    private function view(Request $request): array
    {
        $user = $request->user();
        if ($user->role === 'admin') return ['admin', null];

        $org = $user->currentOrg;
        abort_unless($org && in_array($org->type, ['shipper', 'carrier', 'factor'], true), 403);
        return [$org->type, $org];
    }

    private function scoped(string $view, ?Organization $org): Builder
    {
        return match ($view) {
            'shipper' => LoadPayment::where('shipper_org_id', $org->id),
            'carrier' => LoadPayment::where('carrier_org_id', $org->id),
            'factor'  => LoadPayment::where('payee_org_id', $org->id)->where('payee_type', 'factor'),
            default   => LoadPayment::query(),
        };
    }

    private function shipperOwns(Request $request, LoadPayment $p): void
    {
        [$view, $org] = $this->view($request);
        abort_unless($view === 'shipper' && $p->shipper_org_id === $org->id, 403);
        abort_unless($request->user()->isOrgAdmin(), 403, 'Only the owner or staff can manage payments.');
    }

    private function connectedAccount(?Organization $org): ?string
    {
        if (!$org) return null;
        if ($org->stripe_connect_id) return $org->stripe_connect_id;
        if ($org->type !== 'carrier') return null;
        $profile = User::find($org->owner_id)?->carrierProfile;
        return $profile?->stripe_account_id ?: null;
    }

    /** Preload the shipments and freight jobs behind a page of payments */
    private function loadsFor($rows): array
    {
        return [
            'shipment'    => Shipment::whereIn('id', $rows->where('load_type', 'shipment')->pluck('load_id'))->get()->keyBy('id'),
            'freight_job' => FreightJob::whereIn('id', $rows->where('load_type', 'freight_job')->pluck('load_id'))->get()->keyBy('id'),
        ];
    }

    private function loadTitle(string $type, int $id): array
    {
        $r = $type === 'freight_job' ? FreightJob::find($id) : Shipment::find($id);
        return $this->describe($type, $id, $r);
    }

    private function describe(string $type, int $id, $r): array
    {
        if (!$r) return ['type' => $type, 'id' => $id, 'title' => 'Load removed', 'route' => null, 'status' => null];
        return [
            'type'   => $type,
            'id'     => $id,
            'title'  => $type === 'freight_job' ? ($r->title ?: "Job #{$id}") : ($r->item_description ?: "Shipment #{$id}"),
            'route'  => $type === 'shipment' ? trim("{$r->pickup_city}, {$r->pickup_state} → {$r->delivery_city}, {$r->delivery_state}", ' ,→') : ($r->reference_number ?: null),
            'status' => $r->status,
        ];
    }

    private function present(LoadPayment $p, string $view, array $loads): array
    {
        $record = $loads[$p->load_type][$p->load_id] ?? null;
        $load   = $this->describe($p->load_type, $p->load_id, $record);
        $load['href'] = match ($view) {
            'shipper' => $p->load_type === 'freight_job' ? "/shipper/jobs/{$p->load_id}" : "/shipper/shipments/{$p->load_id}",
            'carrier' => $p->load_type === 'freight_job' ? "/carrier/my-jobs/{$p->load_id}" : null,
            default   => null,
        };

        return [
            'id'             => $p->id,
            'load'           => $load,
            'shipper'        => PersonChecks::companyName($p->shipperOrg),
            'carrier'        => PersonChecks::companyName($p->carrierOrg),
            'payee'          => ['type' => $p->payee_type, 'name' => $p->payee_type === 'factor' ? $p->payeeOrg?->name : PersonChecks::companyName($p->payeeOrg)],
            'amount'         => $p->amount_cents / 100,
            'fee'            => $p->fee_cents / 100,
            'fee_rate'       => (float) $p->fee_rate,
            'net'            => $p->netCents() / 100,
            'early'          => (bool) $p->early,
            'flow'           => $p->flow,
            'method'         => $p->method,
            // Card details only for the shipper who owns them (and admin); carriers and factors see the type
            'method_label'   => !in_array($view, ['shipper', 'admin'], true) ? ($p->method ? ($p->method === 'card' ? 'Card' : 'Bank account') : null) : ($p->paymentMethod ? ($p->paymentMethod->type === 'card' ? ucfirst((string) $p->paymentMethod->brand) : ($p->paymentMethod->bank_name ?: 'Bank')) . ' •••• ' . $p->paymentMethod->last4 : null),
            'pickup_date'    => $p->pickup_date?->toDateString(),
            'status'         => $p->status,
            'held_at'        => $p->held_at?->toISOString(),
            'capture_before' => $p->capture_before?->toISOString(),
            'paid_at'        => $p->paid_at?->toISOString(),
            'failure_reason' => $p->failure_reason,
            'refunded'       => $p->refunded_cents / 100,
            'created_at'     => $p->created_at?->toISOString(),
        ];
    }
}
