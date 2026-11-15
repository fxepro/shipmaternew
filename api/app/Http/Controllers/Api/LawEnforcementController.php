<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Support\ComplianceRules;
use App\Services\LeReports;
use App\Support\LawEnforcement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * The officer's own pages (demo/law-enforcement.html): their officer details, records requests (Tier 3),
 * their search history, business reports and billing. Searching companies, people, loads and tracking is on
 * the shared admin pages (App\Support\LawEnforcement).
 */
class LawEnforcementController extends Controller
{
    private const BASIS = ['subpoena', 'court_order', 'warrant', 'emergency'];

    // GET /api/v1/agency/officer
    public function officer(Request $request): JsonResponse
    {
        abort_unless(LawEnforcement::isOfficer($request->user()), 403);
        $row = DB::table('officer_profiles')->where('user_id', $request->user()->id)->first();
        return response()->json(['data' => $row ? collect((array) $row)->except(['id', 'user_id', 'created_at'])->all() : (object) []]);
    }

    // PUT /api/v1/agency/officer
    public function updateOfficer(Request $request): JsonResponse
    {
        abort_unless(LawEnforcement::isOfficer($request->user()), 403);
        $data = $request->validate([
            'badge_number'     => ['nullable', 'string', 'max:40'],
            'title'            => ['nullable', 'string', 'max:80'],
            'unit'             => ['nullable', 'string', 'max:120'],
            'work_phone'       => ['nullable', 'string', 'max:40'],
            'supervisor_name'  => ['nullable', 'string', 'max:120'],
            'supervisor_email' => ['nullable', 'email', 'max:160'],
            'supervisor_phone' => ['nullable', 'string', 'max:40'],
        ]);
        DB::table('officer_profiles')->updateOrInsert(['user_id' => $request->user()->id], $data + ['updated_at' => now(), 'created_at' => now()]);
        return $this->officer($request);
    }

    // GET /api/v1/agency/records
    public function records(Request $request): JsonResponse
    {
        $u = $request->user();
        LawEnforcement::requireOfficer($u, 'le.records');
        $rows = DB::table('le_records_requests as r')->join('users as u', 'u.id', '=', 'r.user_id')
            ->where('r.org_id', $u->current_org_id)
            ->when($u->permLevel('le.history') !== 'full', fn ($q) => $q->where('r.user_id', $u->id))
            ->orderByDesc('r.created_at')->limit(200)
            ->get(['r.id', 'r.case_number', 'r.legal_basis', 'r.subject', 'r.details', 'r.status', 'r.response_notes', 'r.decided_at', 'r.created_at', 'u.name as officer', 'r.document_path']);
        return response()->json(['data' => $rows->map(fn ($r) => collect((array) $r)->except('document_path')->all() + ['has_document' => (bool) $r->document_path])]);
    }

    // POST /api/v1/agency/records   multipart: case_number, legal_basis, subject, details?, document
    public function storeRecord(Request $request): JsonResponse
    {
        $u = $request->user();
        LawEnforcement::requireOfficer($u, 'le.records');
        abort_unless($u->canDo('le.records'), 403, "Your role can't do this.");
        $data = $request->validate([
            'case_number' => ['required', 'string', 'max:80'],
            'legal_basis' => ['required', Rule::in(self::BASIS)],
            'subject'     => ['required', 'string', 'max:300'],
            'details'     => ['nullable', 'string', 'max:5000'],
            // The subpoena, order or warrant; an emergency request explains the danger in Details instead
            'document'    => [Rule::requiredIf(fn () => $request->input('legal_basis') !== 'emergency'), 'nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:20480'],
        ]);
        $path = $request->file('document')?->store("le-records/{$u->current_org_id}", 'local');
        $id = DB::table('le_records_requests')->insertGetId([
            'org_id' => $u->current_org_id, 'user_id' => $u->id, 'case_number' => $data['case_number'], 'legal_basis' => $data['legal_basis'],
            'subject' => $data['subject'], 'details' => $data['details'] ?? null, 'document_path' => $path, 'status' => 'submitted',
            'created_at' => now(), 'updated_at' => now(),
        ]);
        LawEnforcement::log($request, 'request', 'records', ['subject_type' => 'records_request', 'subject_id' => $id, 'subject_label' => $data['subject'], 'case_number' => $data['case_number']]);
        return response()->json(['data' => ['id' => $id]], 201);
    }

    // GET /api/v1/agency/history?scope=mine|agency&page=
    public function history(Request $request): JsonResponse
    {
        $u = $request->user();
        LawEnforcement::requireOfficer($u);
        $level = $u->permLevel('le.history');
        abort_if($level === 'none', 403, "Your role doesn't have access to this.");
        $agency = $level === 'full' && $request->query('scope') === 'agency';
        $rows = DB::table('le_access_logs as l')->join('users as u', 'u.id', '=', 'l.user_id')
            ->where('l.org_id', $u->current_org_id)
            ->when(!$agency, fn ($q) => $q->where('l.user_id', $u->id))
            ->when($request->filled('page_name'), fn ($q) => $q->where('l.page', $request->query('page_name')))
            ->orderByDesc('l.created_at')->limit(500)
            ->get(['l.id', 'l.action', 'l.page', 'l.subject_type', 'l.subject_id', 'l.subject_label', 'l.query', 'l.reason', 'l.case_number', 'l.results', 'l.created_at', 'u.name as officer']);
        return response()->json(['data' => $rows, 'can_see_agency' => $level === 'full']);
    }

    // GET /api/v1/agency/reports
    public function reports(Request $request): JsonResponse
    {
        $u = $request->user();
        LawEnforcement::requireOfficer($u, 'le.reports');
        $rows = DB::table('le_reports')->where('org_id', $u->current_org_id)
            ->when($u->permLevel('le.history') !== 'full', fn ($q) => $q->where('user_id', $u->id))
            ->orderByDesc('created_at')->limit(200)->get();
        return response()->json(['data' => $rows->map(fn ($r) => LeReports::present($r)), 'price' => LawEnforcement::REPORT_PRICE_CENTS / 100]);
    }

    // POST /api/v1/agency/reports   { query_type: usdot|mc|ein|name, query, state?, case_number? }
    public function runReport(Request $request): JsonResponse
    {
        $u = $request->user();
        LawEnforcement::requireOfficer($u, 'le.reports');
        abort_unless($u->canDo('le.reports'), 403, "Your role can't do this.");
        $data = $request->validate([
            'query_type'  => ['required', Rule::in(['usdot', 'mc', 'ein', 'name'])],
            'query'       => ['required', 'string', 'min:3', 'max:200'],
            'state'       => [Rule::requiredIf(fn () => $request->input('query_type') === 'name'), 'nullable', 'string', 'size:2'],
            'case_number' => ['nullable', 'string', 'max:80'],
        ]);
        // On Shipmater already: open it on Companies, free
        if ($org = LeReports::onShipmater($data['query_type'], $data['query'])) {
            return response()->json(['data' => ['on_shipmater' => ['id' => $org->id, 'name' => $org->name]]]);
        }
        $id = DB::table('le_reports')->insertGetId([
            'org_id' => $u->current_org_id, 'user_id' => $u->id, 'query_type' => $data['query_type'], 'query' => trim($data['query']),
            'state' => isset($data['state']) ? strtoupper($data['state']) : null, 'case_number' => $data['case_number'] ?? null,
            'status' => 'running', 'sections' => json_encode([]), 'price_cents' => LawEnforcement::REPORT_PRICE_CENTS,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        LawEnforcement::log($request, 'report', 'reports', ['subject_type' => 'report', 'subject_id' => $id, 'query' => "{$data['query_type']}: {$data['query']}", 'case_number' => $data['case_number'] ?? null]);
        LeReports::run($id);
        return response()->json(['data' => LeReports::present(DB::table('le_reports')->find($id))], 201);
    }

    // GET /api/v1/agency/reports/{id}
    public function report(Request $request, int $id): JsonResponse
    {
        $r = $this->ownReport($request, $id);
        if ($r->status === 'running') {
            LeReports::run($id);
            $r = DB::table('le_reports')->find($id);
        }
        return response()->json(['data' => LeReports::present($r)]);
    }

    // GET /api/v1/agency/reports/{id}/pdf
    public function reportPdf(Request $request, int $id)
    {
        $r = $this->ownReport($request, $id);
        abort_unless($r->status === 'ready', 409, 'The report is not ready yet.');
        $report = LeReports::present($r);
        $agency = $request->user()->currentOrg?->name;
        return \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.le-report', compact('report', 'agency'))
            ->download('shipmater-report-' . $r->id . '.pdf');
    }

    // GET /api/v1/agency/billing
    public function billing(Request $request): JsonResponse
    {
        $u = $request->user();
        LawEnforcement::requireOfficer($u, 'le.billing');
        $rows = DB::table('le_reports')->where('org_id', $u->current_org_id)->where('charge_status', 'invoiced')
            ->orderByDesc('created_at')->get(['id', 'company_name', 'query', 'price_cents', 'created_at', 'user_id']);
        $months = $rows->groupBy(fn ($r) => Carbon::parse($r->created_at)->format('Y-m'))
            ->map(fn ($g, $m) => ['month' => $m, 'label' => Carbon::parse($m . '-01')->format('F Y'), 'reports' => $g->count(), 'total' => $g->sum('price_cents') / 100])
            ->values();
        return response()->json(['data' => [
            'price' => LawEnforcement::REPORT_PRICE_CENTS / 100,
            'this_month' => $months->firstWhere('month', now()->format('Y-m')) ?? ['month' => now()->format('Y-m'), 'label' => now()->format('F Y'), 'reports' => 0, 'total' => 0],
            'months' => $months,
        ]]);
    }

    private function ownReport(Request $request, int $id): object
    {
        $u = $request->user();
        LawEnforcement::requireOfficer($u, 'le.reports');
        $r = DB::table('le_reports')->where('id', $id)->where('org_id', $u->current_org_id)->first();
        abort_unless($r && ($r->user_id === $u->id || $u->permLevel('le.history') === 'full'), 404);
        return $r;
    }

    // ── Shipmater staff: Admin Console, Agency ──────────────────────────────

    /** Officers with their badge details and how much they use Shipmater */
    private function officerRows(?int $orgId = null, ?int $userId = null)
    {
        return DB::table('org_members as m')->join('users as u', 'u.id', '=', 'm.user_id')->join('organizations as o', 'o.id', '=', 'm.org_id')
            ->leftJoin('officer_profiles as p', 'p.user_id', '=', 'u.id')
            ->where('o.type', 'agency')->whereNull('m.left_at')
            ->when($orgId, fn ($q) => $q->where('m.org_id', $orgId))
            ->when($userId, fn ($q) => $q->where('u.id', $userId))
            ->orderBy('u.name')
            ->get(['u.id', 'u.name', 'u.email', 'u.created_at', 'm.role', 'm.status', 'p.badge_number', 'p.title', 'p.unit', 'p.work_phone',
                'p.supervisor_name', 'p.supervisor_email', 'p.supervisor_phone', 'o.id as agency_id', 'o.name as agency', 'o.verification_status as agency_status'])
            ->map(function ($r) {
                $log = DB::table('le_access_logs')->where('user_id', $r->id);
                $identity = DB::table('person_identities')->where('user_id', $r->id)->first(['legal_first_name', 'legal_last_name', 'phone', 'status', 'verified_at']);
                return (array) $r + [
                    'legal_name' => $identity ? trim(($identity->legal_first_name ?? '') . ' ' . ($identity->legal_last_name ?? '')) ?: null : null,
                    'phone' => $identity?->phone,
                    'identity' => $identity?->status,
                    'identity_verified_at' => $identity?->verified_at,
                    'last_login' => (clone $log)->where('action', 'login')->max('created_at'),
                    'searches_30d' => (clone $log)->whereIn('action', ['search', 'view'])->where('created_at', '>=', now()->subDays(30))->count(),
                    'open_requests' => DB::table('le_records_requests')->where('user_id', $r->id)->whereIn('status', ['submitted', 'in_review'])->count(),
                ];
            });
    }

    // GET /api/v1/admin/agencies?agency=   Officers, filtered by agency (agencies are not on Companies)
    public function adminAgencies(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $agencies = Organization::where('type', 'agency')->whereNotNull('owner_id')->orderBy('name')->get(['id', 'name', 'verification_status']);
        return response()->json(['data' => $this->officerRows($request->filled('agency') ? (int) $request->query('agency') : null), 'agencies' => $agencies]);
    }

    // GET /api/v1/admin/agencies/{id}   One officer: who they are, and the agency they work for
    public function adminAgency(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $officer = $this->officerRows(null, $id)->first();
        abort_unless($officer, 404);
        $o = Organization::where('type', 'agency')->findOrFail($officer['agency_id']);
        return response()->json(['data' => [
            'officer' => $officer,
            'agency' => $o->only(['id', 'name', 'agency_kind', 'ori_number', 'jurisdiction', 'phone', 'email', 'website', 'street', 'city', 'state', 'zip', 'country',
                'verification_status', 'verification_notes', 'verification_updated_at', 'created_at']) + ['owner' => $o->owner?->only(['id', 'name', 'email'])],
            'compliance' => ComplianceRules::items($o),
        ]]);
    }

    // GET /api/v1/admin/law-enforcement?action=&agency=&q=
    public function adminLog(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $rows = DB::table('le_access_logs as l')->join('users as u', 'u.id', '=', 'l.user_id')->leftJoin('organizations as o', 'o.id', '=', 'l.org_id')
            ->when($request->filled('action') && $request->query('action') !== 'all', fn ($q) => $q->where('l.action', $request->query('action')))
            ->when($request->filled('agency'), fn ($q) => $q->where('l.org_id', (int) $request->query('agency')))
            ->when($request->filled('officer'), fn ($q) => $q->where('l.user_id', (int) $request->query('officer')))
            ->when($request->filled('q'), fn ($q) => $q->where(fn ($w) => $w->where('u.name', 'ilike', '%' . $request->query('q') . '%')
                ->orWhere('l.case_number', 'ilike', '%' . $request->query('q') . '%')->orWhere('l.subject_label', 'ilike', '%' . $request->query('q') . '%')))
            ->orderByDesc('l.created_at')->limit(500)
            ->get(['l.id', 'l.action', 'l.page', 'l.subject_type', 'l.subject_id', 'l.subject_label', 'l.query', 'l.reason', 'l.case_number', 'l.results', 'l.ip', 'l.created_at',
                'u.id as officer_id', 'u.name as officer', 'o.id as agency_id', 'o.name as agency']);
        $officers = DB::table('users as u')->join('organizations as o', 'o.id', '=', 'u.current_org_id')->where('u.role', 'agency')
            ->get(['u.id', 'u.name', 'o.id as agency_id', 'o.name as agency', 'o.verification_status'])
            ->map(function ($o) {
                $log = DB::table('le_access_logs')->where('user_id', $o->id);
                return (array) $o + [
                    'last_login' => (clone $log)->where('action', 'login')->max('created_at'),
                    'logins_30d' => (clone $log)->where('action', 'login')->where('created_at', '>=', now()->subDays(30))->count(),
                    'searches_30d' => (clone $log)->whereIn('action', ['search', 'view'])->where('created_at', '>=', now()->subDays(30))->count(),
                    'loads_30d' => (clone $log)->where('action', 'view')->whereIn('page', ['loads', 'tracking'])->where('created_at', '>=', now()->subDays(30))->count(),
                ];
            });
        $requests = DB::table('le_records_requests as r')->join('users as u', 'u.id', '=', 'r.user_id')->join('organizations as o', 'o.id', '=', 'r.org_id')
            ->when($request->filled('agency'), fn ($q) => $q->where('r.org_id', (int) $request->query('agency')))
            ->when($request->filled('officer'), fn ($q) => $q->where('r.user_id', (int) $request->query('officer')))
            ->orderByRaw("case when r.status in ('submitted','in_review') then 0 else 1 end")->orderByDesc('r.created_at')->limit(200)
            ->get(['r.id', 'r.case_number', 'r.legal_basis', 'r.subject', 'r.details', 'r.status', 'r.response_notes', 'r.decided_at', 'r.created_at', 'u.name as officer', 'o.name as agency', 'r.document_path'])
            ->map(fn ($r) => collect((array) $r)->except('document_path')->all() + ['has_document' => (bool) $r->document_path]);
        return response()->json(['data' => ['log' => $rows, 'officers' => $officers, 'requests' => $requests]]);
    }

    // PUT /api/v1/admin/law-enforcement/requests/{id}   { status, response_notes? }
    public function decideRequest(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $data = $request->validate([
            'status'         => ['required', Rule::in(['in_review', 'released', 'declined'])],
            'response_notes' => ['nullable', 'string', 'max:5000'],
        ]);
        DB::table('le_records_requests')->where('id', $id)->update($data + [
            'decided_at' => in_array($data['status'], ['released', 'declined'], true) ? now() : null,
            'decided_by' => $request->user()->id, 'updated_at' => now(),
        ]);
        return response()->json(['data' => ['id' => $id]]);
    }

    // GET /api/v1/admin/law-enforcement/requests/{id}/file   and   /agency/records/{id}/file
    public function requestFile(Request $request, int $id)
    {
        $u = $request->user();
        $r = DB::table('le_records_requests')->find($id);
        abort_unless($r && $r->document_path, 404);
        abort_unless($u->isPlatformAdmin() || (LawEnforcement::isOfficer($u) && $r->org_id === $u->current_org_id), 404);
        return Storage::disk('local')->download($r->document_path);
    }
}
