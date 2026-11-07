<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LedgerEntry;
use App\Models\Organization;
use App\Models\ShipperSubscription;
use App\Services\Fees;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin Finance > Subscriptions: every shipper company's subscription, its payments, and the actions
 * Shipmater can take on it (refresh from Stripe, cancel at the end of the month, undo that).
 */
class AdminSubscriptionController extends Controller
{
    // GET /api/v1/admin/subscriptions?status=all|active|pending|past_due|canceled|not_subscribed&tier=&q=
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $data = $request->validate([
            'status' => ['nullable', 'in:all,active,pending,past_due,canceled,cancelling,not_subscribed'],
            'tier'   => ['nullable', 'string', 'max:30'],
            'q'      => ['nullable', 'string', 'max:100'],
        ]);
        $status = $data['status'] ?? 'all';

        // One row per shipper company: its subscription, or none yet
        $orgs = Organization::where('type', 'shipper')->with('owner:id,name,email')
            ->when(!empty($data['q']), fn ($q) => $q->where('name', 'ilike', '%' . $data['q'] . '%'))
            ->orderBy('name')->get();
        $subs = ShipperSubscription::whereIn('org_id', $orgs->pluck('id'))->with('starter:id,name')->get()->keyBy('org_id');
        $paid = LedgerEntry::where('kind', 'subscription')->whereIn('org_id', $orgs->pluck('id'))
            ->selectRaw('org_id, sum(amount_cents) as cents, max(occurred_at) as last_paid')->groupBy('org_id')->get()->keyBy('org_id');

        $rows = $orgs->map(fn ($o) => $this->row($o, $subs->get($o->id), $paid->get($o->id)));

        $summary = [
            'shippers'       => $rows->count(),
            'active'         => $rows->where('status', 'active')->count(),
            'cancelling'     => $rows->where('status', 'active')->where('cancel_at_period_end', true)->count(),
            'pending'        => $rows->where('status', 'pending')->count(),
            'past_due'       => $rows->where('status', 'past_due')->count(),
            'canceled'       => $rows->where('status', 'canceled')->count(),
            'not_subscribed' => $rows->where('subscribed', false)->count(),
            'mrr'            => round($rows->where('status', 'active')->sum('monthly_price'), 2),
            'collected'      => round($rows->sum('paid_total'), 2),
        ];

        $rows = $rows->filter(fn ($r) => match ($status) {
            'all'            => true,
            'not_subscribed' => !$r['subscribed'],
            'cancelling'     => $r['status'] === 'active' && $r['cancel_at_period_end'],
            default          => $r['status'] === $status,
        })->when(!empty($data['tier']), fn ($c) => $c->where('tier', $data['tier']))->values();

        return response()->json(['data' => $rows, 'summary' => $summary, 'tiers' => Fees::tiers()]);
    }

    // GET /api/v1/admin/subscriptions/{org}   (the shipper company's subscription)
    public function show(Request $request, Organization $org): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        abort_unless($org->type === 'shipper', 404);

        $sub = ShipperSubscription::with('starter:id,name')->firstWhere('org_id', $org->id);
        // Bring it up to date from Stripe so the page shows the real state and every payment
        $syncError = null;
        if ($sub) {
            try { SubscriptionController::refreshFromStripe($sub); $sub->refresh(); }
            catch (\Throwable $e) { $syncError = 'Could not reach Stripe to refresh this subscription.'; }
        }

        return response()->json(['data' => $this->detail($org->load('owner:id,name,email'), $sub, $syncError)]);
    }

    // POST /api/v1/admin/subscriptions/{org}/cancel   { at_period_end: true }  — stops at the end of the paid month
    public function cancel(Request $request, Organization $org): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $sub = ShipperSubscription::firstWhere('org_id', $org->id);
        abort_unless($sub?->isActive(), 422, 'This company has no active subscription.');
        SubscriptionController::setCancelAtPeriodEnd($sub, true);
        return response()->json(['data' => $this->detail($org->load('owner:id,name,email'), $sub->fresh())]);
    }

    // POST /api/v1/admin/subscriptions/{org}/resume — undo a cancellation before the month ends
    public function resume(Request $request, Organization $org): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $sub = ShipperSubscription::firstWhere('org_id', $org->id);
        abort_unless($sub?->isActive() && $sub->cancel_at_period_end, 422, 'There is no cancellation to undo.');
        SubscriptionController::setCancelAtPeriodEnd($sub, false);
        return response()->json(['data' => $this->detail($org->load('owner:id,name,email'), $sub->fresh())]);
    }

    private function row(Organization $o, ?ShipperSubscription $s, $paid): array
    {
        $tier   = $s ? Fees::tier($s->tier) : null;
        $status = $s ? $s->displayStatus() : 'not_subscribed';
        return [
            'org_id'               => $o->id,
            'company'              => $o->name,
            'owner'                => $o->owner?->only(['id', 'name', 'email']),
            'subscribed'           => $status !== 'not_subscribed' && $status !== 'not_started',
            'status'               => $status === 'not_started' ? 'not_subscribed' : $status,
            'cancel_at_period_end' => (bool) $s?->cancel_at_period_end,
            'tier'                 => $s?->tier,
            'tier_label'           => $tier['label'] ?? $s?->tier,
            'monthly_price'        => $s ? (float) $s->monthly_price : null,
            'started_at'           => $s?->started_at?->toISOString(),
            'current_period_end'   => $s?->current_period_end?->toISOString(),
            'tier_review_at'       => $s?->tier_review_at?->toISOString(),
            'paid_total'           => $paid ? round($paid->cents / 100, 2) : 0,
            'last_paid_at'         => $paid?->last_paid ? \Carbon\Carbon::parse($paid->last_paid)->toISOString() : null,
        ];
    }

    private function detail(Organization $org, ?ShipperSubscription $s, ?string $syncError = null): array
    {
        $payments = LedgerEntry::where('kind', 'subscription')->where('org_id', $org->id)->orderByDesc('occurred_at')
            ->get(['id', 'amount_cents', 'reference', 'description', 'occurred_at']);
        $row = $this->row($org, $s, (object) ['cents' => $payments->sum('amount_cents'), 'last_paid' => $payments->first()?->occurred_at]);

        return $row + [
            'stated_annual_value' => $s ? (float) $s->stated_annual_value : null,
            'started_by'          => $s?->starter?->name,
            'canceled_at'         => $s?->canceled_at?->toISOString(),
            'stripe_linked'       => (bool) $s?->stripe_subscription_id,
            'sync_error'          => $syncError,
            // What the tier review will look at: load value this company moved since it subscribed
            'moved_since_start'   => $s?->started_at ? round((float) \App\Models\FreightJob::forOrg($org->id)->where('status', '!=', 'draft')
                ->where('created_at', '>=', $s->started_at)->sum('payment_amount_cents') / 100, 2) : null,
            'payments' => $payments->map(fn ($p) => [
                'id' => $p->id, 'amount' => round($p->amount_cents / 100, 2), 'reference' => $p->reference ? substr($p->reference, 0, 6) . '…' . substr($p->reference, -4) : null,
                'description' => $p->description, 'paid_at' => $p->occurred_at?->toISOString(),
            ]),
        ];
    }
}
