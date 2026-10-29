<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ShipmentResource;
use App\Models\FreightJob;
use App\Models\Organization;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    private function requireAdmin(Request $request): ?JsonResponse
    {
        if ($request->user()?->role !== 'admin') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        return null;
    }

    // GET /api/v1/admin/metrics
    public function metrics(Request $request): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $total    = Shipment::count();
        $carriers = $this->countUsersOfType('carrier');
        $shippers = $this->countUsersOfType('shipper');
        $revenue  = Shipment::whereNotNull('platform_fee_cents')
            ->sum('platform_fee_cents') / 100;

        return response()->json([
            'data' => [
                'total'          => $total,
                'total_carriers' => $carriers,
                'total_shippers' => $shippers,
                'revenue'        => number_format((float) $revenue, 2, '.', ''),
            ],
        ]);
    }

    /** Users whose legacy role or current org type matches (same rule as User::isCarrier/isShipper). */
    private function countUsersOfType(string $type): int
    {
        return User::where(fn ($q) => $q
            ->where('role', $type)
            ->orWhereHas('currentOrg', fn ($o) => $o->where('type', $type))
        )->count();
    }

    // GET /api/v1/admin/shipments
    public function shipments(Request $request): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $query = Shipment::with(['shipper', 'carrier', 'latestPing'])
            ->latest();

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('q')) {
            $q = $request->input('q');
            $query->where('item_description', 'ilike', "%{$q}%");
        }

        $limit     = (int) $request->input('limit', 50);
        $shipments = $query->limit($limit)->get();

        return response()->json([
            'data' => ShipmentResource::collection($shipments),
        ]);
    }

    // GET /api/v1/admin/users
    public function users(Request $request): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $query = User::with('currentOrg')->latest();

        if ($request->filled('q')) {
            $q = $request->input('q');
            $query->where(function ($sub) use ($q) {
                $sub->where('name', 'ilike', "%{$q}%")
                    ->orWhere('email', 'ilike', "%{$q}%");
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->input('role'));
        }

        $users = $query->limit(200)->get()->map(fn (User $u) => [
            'id'         => $u->id,
            'name'       => $u->name,
            'email'      => $u->email,
            'role'       => $u->role,
            'avatar_url' => $u->avatar_url,
            'created_at' => $u->created_at?->toISOString(),
            'org'        => $u->currentOrg ? [
                'id'   => $u->currentOrg->id,
                'name' => $u->currentOrg->name,
                'type' => $u->currentOrg->type,
            ] : null,
        ]);

        return response()->json(['data' => $users]);
    }

    // GET /api/v1/admin/financials
    public function financials(Request $request): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $from    = $request->input('from') ? \Carbon\Carbon::parse($request->input('from'))->startOfDay() : now()->subDays(29)->startOfDay();
        $to      = $request->input('to')   ? \Carbon\Carbon::parse($request->input('to'))->endOfDay()     : now()->endOfDay();
        $status  = $request->input('status', 'all');   // all | completed | pending | unpaid
        $orgId   = $request->input('org_id');

        $query = FreightJob::with(['shipper', 'carrier'])
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('created_at');

        if ($status !== 'all') {
            $query->where('payment_status', $status);
        }
        if ($orgId) {
            $query->where('org_id', $orgId);
        }

        $jobs = $query->limit(500)->get();

        // Aggregate totals
        $totalRevenue   = $jobs->sum(fn ($j) => ($j->cost_breakdown['shipper_total']   ?? 0));
        $platformFees   = $jobs->sum(fn ($j) => ($j->cost_breakdown['platform_fee']    ?? 0));
        $carrierPayouts = $jobs->sum(fn ($j) => ($j->cost_breakdown['carrier_payout']  ?? 0));
        $pending        = $jobs->where('payment_status', 'pending')->sum(fn ($j) => ($j->cost_breakdown['shipper_total'] ?? 0));

        $rows = $jobs->map(fn (FreightJob $j) => [
            'id'               => $j->id,
            'title'            => $j->title,
            'reference'        => $j->reference_number,
            'invoice_number'   => $j->invoice_number,
            'status'           => $j->status,
            'payment_status'   => $j->payment_status,
            'shipper'          => $j->shipper?->name,
            'carrier'          => $j->carrier?->name,
            'shipper_total'    => $j->cost_breakdown['shipper_total']  ?? null,
            'platform_fee'     => $j->cost_breakdown['platform_fee']   ?? null,
            'carrier_payout'   => $j->cost_breakdown['carrier_payout'] ?? null,
            'invoice_date'     => $j->invoice_date?->toDateString(),
            'invoice_due_date' => $j->invoice_due_date?->toDateString(),
            'created_at'       => $j->created_at?->toISOString(),
        ]);

        return response()->json([
            'data' => [
                'summary' => [
                    'total_revenue'   => round($totalRevenue,   2),
                    'platform_fees'   => round($platformFees,   2),
                    'carrier_payouts' => round($carrierPayouts, 2),
                    'pending'         => round($pending,        2),
                    'job_count'       => $jobs->count(),
                ],
                'rows' => $rows,
            ],
        ]);
    }

    // GET /api/v1/admin/financials/export — streams a CSV download
    public function financialsExport(Request $request): Response
    {
        if ($request->user()?->role !== 'admin') {
            abort(403);
        }

        $from   = $request->input('from') ? \Carbon\Carbon::parse($request->input('from'))->startOfDay() : now()->subDays(29)->startOfDay();
        $to     = $request->input('to')   ? \Carbon\Carbon::parse($request->input('to'))->endOfDay()     : now()->endOfDay();
        $status = $request->input('status', 'all');

        $query = FreightJob::with(['shipper', 'carrier'])
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('created_at');

        if ($status !== 'all') {
            $query->where('payment_status', $status);
        }

        $jobs = $query->limit(5000)->get();

        $csv = implode(',', ['Job ID','Title','Reference','Invoice #','Status','Payment Status','Shipper','Carrier','Shipper Total','Platform Fee','Carrier Payout','Invoice Date','Invoice Due','Created At']) . "\n";

        foreach ($jobs as $j) {
            $cbd = $j->cost_breakdown ?? [];
            $csv .= implode(',', [
                $j->id,
                '"' . str_replace('"', '""', $j->title ?? '') . '"',
                $j->reference_number ?? '',
                $j->invoice_number   ?? '',
                $j->status           ?? '',
                $j->payment_status   ?? '',
                '"' . str_replace('"', '""', $j->shipper?->name ?? '') . '"',
                '"' . str_replace('"', '""', $j->carrier?->name ?? '') . '"',
                $cbd['shipper_total']  ?? '',
                $cbd['platform_fee']   ?? '',
                $cbd['carrier_payout'] ?? '',
                $j->invoice_date?->toDateString() ?? '',
                $j->invoice_due_date?->toDateString() ?? '',
                $j->created_at?->toDateString() ?? '',
            ]) . "\n";
        }

        $filename = 'shipmater-financials-' . now()->format('Y-m-d') . '.csv';

        return response($csv, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    // GET /api/v1/admin/disputes
    public function disputes(Request $request): JsonResponse
    {
        if ($err = $this->requireAdmin($request)) return $err;

        $shipments = Shipment::with(['shipper', 'carrier'])
            ->where('status', 'disputed')
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (Shipment $s) => [
                'id'          => $s->id,
                'shipment_id' => $s->id,
                'item_name'   => $s->item_description,
                'reason'      => 'Disputed by ' . ($s->shipper?->name ?? 'shipper'),
                'status'      => 'open',
                'created_at'  => $s->updated_at?->toISOString(),
                'shipper'     => $s->shipper?->name,
                'carrier'     => $s->carrier?->name,
                'value'       => $s->agreed_cost,
            ]);

        return response()->json(['data' => $shipments]);
    }
}
