<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeeCharge;
use App\Models\LedgerEntry;
use App\Models\LoadPayment;
use App\Models\ShipperSubscription;
use App\Services\PersonChecks;
use App\Services\Payments\LoadPayments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin: Shipmater's revenue (Ledger), money owed or stuck (Receivables) and payment routing (docs/fees-and-billing.md). */
class AdminFinanceController extends Controller
{
    // GET /admin/ledger?from=&to=&kind=
    public function ledger(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $from = $request->date('from') ?? now()->startOfYear();
        $to   = $request->date('to') ?? now();
        $q = LedgerEntry::with('org')->whereBetween('occurred_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()]);
        if ($kind = $request->string('kind')->value()) $q->where('kind', $kind);

        $months = (clone $q)->selectRaw("to_char(occurred_at, 'YYYY-MM') as month, kind, sum(amount_cents) as amount, sum(gross_cents) as gross")
            ->groupBy('month', 'kind')->orderBy('month')->get()
            ->groupBy('month')->map(fn ($rows, $month) => [
                'month'   => $month,
                'revenue' => $rows->sum('amount') / 100,
                'volume'  => $rows->sum('gross') / 100,
                'by_kind' => $rows->mapWithKeys(fn ($r) => [$r->kind => $r->amount / 100]),
            ])->values();

        $totals = (clone $q)->selectRaw('kind, sum(amount_cents) as amount, sum(gross_cents) as gross, count(*) as n')->groupBy('kind')->get()
            ->mapWithKeys(fn ($r) => [$r->kind => ['amount' => $r->amount / 100, 'volume' => $r->gross / 100, 'count' => (int) $r->n]]);

        return response()->json(['data' => [
            'from'    => $from->toDateString(),
            'to'      => $to->toDateString(),
            'revenue' => (int) (clone $q)->sum('amount_cents') / 100,
            'volume'  => (int) (clone $q)->sum('gross_cents') / 100,
            'totals'  => $totals,
            'months'  => $months,
            'entries' => $q->latest('occurred_at')->limit(300)->get()->map(fn (LedgerEntry $e) => [
                'id' => $e->id, 'kind' => $e->kind, 'amount' => $e->amount_cents / 100, 'volume' => $e->gross_cents / 100,
                'company' => PersonChecks::companyName($e->org) ?? $e->org?->name, 'description' => $e->description,
                'reference' => $e->reference, 'occurred_at' => $e->occurred_at?->toISOString(),
            ]),
        ]]);
    }

    // GET /admin/receivables
    public function receivables(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $payments = LoadPayment::with(['shipperOrg', 'carrierOrg', 'payeeOrg'])->whereIn('status', ['hold_failed', 'failed'])->latest('updated_at')->limit(300)->get();

        // Loads waiting to be paid where the payee hasn't connected Stripe
        $notConnected = LoadPayment::with(['carrierOrg', 'payeeOrg'])->whereIn('status', ['scheduled', 'hold_failed'])->whereNull('stripe_account')->get()
            ->groupBy('payee_org_id')->map(fn ($rows) => [
                'company' => $rows->first()->payee_type === 'factor' ? $rows->first()->payeeOrg?->name : PersonChecks::companyName($rows->first()->payeeOrg),
                'type'    => $rows->first()->payee_type,
                'loads'   => $rows->count(),
                'amount'  => $rows->sum('amount_cents') / 100,
            ])->values();

        $fees = FeeCharge::with(['carrierOrg', 'factoredLoad.factorOrg'])->where('status', 'failed')->latest('updated_at')->get();
        $subs = ShipperSubscription::with('org')->where('status', 'past_due')->get();

        return response()->json(['data' => [
            'payments' => $payments->map(fn (LoadPayment $p) => [
                'id' => $p->id, 'status' => $p->status, 'load' => ucfirst(str_replace('_', ' ', $p->load_type)) . " #{$p->load_id}",
                'shipper' => PersonChecks::companyName($p->shipperOrg), 'payee' => $p->payee_type === 'factor' ? $p->payeeOrg?->name : PersonChecks::companyName($p->payeeOrg),
                'amount' => $p->amount_cents / 100, 'pickup_date' => $p->pickup_date?->toDateString(), 'reason' => $p->failure_reason,
                'since' => ($p->failed_at ?? $p->updated_at)?->toISOString(),
            ]),
            'not_connected' => $notConnected,
            'fees' => $fees->map(fn (FeeCharge $f) => [
                'id' => $f->id, 'carrier' => PersonChecks::companyName($f->carrierOrg), 'factor' => $f->factoredLoad?->factorOrg?->name,
                'amount' => $f->amount_cents / 100, 'reason' => $f->failure_reason, 'since' => $f->updated_at?->toISOString(),
            ]),
            'subscriptions' => $subs->map(fn (ShipperSubscription $s) => [
                'id' => $s->id, 'company' => PersonChecks::companyName($s->org) ?? $s->org?->name, 'tier' => $s->tier,
                'monthly_price' => (float) $s->monthly_price, 'period_end' => $s->current_period_end?->toISOString(),
            ]),
            'totals' => [
                'payments_cents' => (int) $payments->sum('amount_cents'),
                'fees_cents'     => (int) $fees->sum('amount_cents'),
                'subscriptions'  => $subs->count(),
                'not_connected'  => $notConnected->sum('loads'),
            ],
        ]]);
    }

    // GET /admin/settings/payments
    public function settings(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        return response()->json(['data' => ['flow' => LoadPayments::flow(), 'driver' => config('payments.driver')]]);
    }

    // PUT /admin/settings/payments   { flow: direct|platform }
    public function updateSettings(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $data = $request->validate(['flow' => ['required', 'in:direct,platform']]);
        LoadPayments::setFlow($data['flow'], $request->user()->id);

        return response()->json(['data' => ['flow' => LoadPayments::flow(), 'driver' => config('payments.driver')]]);
    }
}
