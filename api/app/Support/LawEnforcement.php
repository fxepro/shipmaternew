<?php

namespace App\Support;

use App\Models\FreightJob;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Law enforcement on the admin pages (demo/law-enforcement.html). Officers of an approved agency open the same
 * admin Companies, People, Loads and Live tracking pages as Shipmater staff, read only and narrowed by the
 * agency role matrix (Permissions::CATALOG['agency']). Lists open only from a search, loads and tracking only
 * with a reason and case number, and every search and view is logged in le_access_logs.
 */
class LawEnforcement
{
    /** Tier 2: loads in progress, or delivered within this many hours */
    public const LOAD_WINDOW_HOURS = 72;
    /** Business report price (Billing). Change here. */
    public const REPORT_PRICE_CENTS = 1000;
    /** Shortest search an officer may run on a list page */
    public const MIN_SEARCH = 3;

    public static function isOfficer(?User $u): bool
    {
        return $u !== null && $u->role === 'agency';
    }

    /**
     * Who may open an admin page that officers share. Returns true for Shipmater staff, false for an officer who
     * may (the caller then narrows the data), and refuses everyone else.
     */
    public static function staffOr(Request $request, string $action): bool
    {
        $u = $request->user();
        if ($u->isPlatformAdmin()) return true;
        self::requireOfficer($u, $action);
        return false;
    }

    public static function requireOfficer(User $u, ?string $action = null): void
    {
        abort_unless(self::isOfficer($u), 403);
        $org = $u->currentOrg;
        abort_unless($org && $org->type === 'agency', 403);
        abort_unless($org->verification_status === 'approved', 403, 'Your agency is waiting for Shipmater approval.');
        if ($action) abort_unless($u->canSee($action), 403, "Your role doesn't have access to this.");
    }

    /** Tier 2: the reason and case or stop number an officer gives before a load opens */
    public static function tier2(Request $request): array
    {
        $reason = trim((string) ($request->query('reason') ?? $request->header('X-LE-Reason', '')));
        $case   = trim((string) ($request->query('case_number') ?? $request->header('X-LE-Case', '')));
        abort_if(mb_strlen($reason) < 5 || $case === '', 428, 'Give a reason and a case or stop number to open this load.');
        return [mb_substr($reason, 0, 500), mb_substr($case, 0, 80)];
    }

    /** Whether a load is inside the Tier 2 window: in progress, or delivered in the last 72 hours */
    public static function loadInWindow(FreightJob $job): bool
    {
        if (in_array($job->status, ['in_progress', 'posted'], true) && $job->carrier_id) return true;
        if ($job->status === 'completed') {
            $done = $job->completed_at ?? $job->updated_at;
            return $done && $done->greaterThan(now()->subHours(self::LOAD_WINDOW_HOURS));
        }
        return false;
    }

    /** One row in the access log. Never throws: a failed log write must not hide that the request happened, so it aborts. */
    public static function log(Request $request, string $action, ?string $page = null, array $extra = []): void
    {
        $u = $request->user();
        if (!$u || !self::isOfficer($u)) return;
        DB::table('le_access_logs')->insert([
            'user_id'       => $u->id,
            'org_id'        => $u->current_org_id,
            'action'        => $action,
            'page'          => $page,
            'subject_type'  => $extra['subject_type'] ?? null,
            'subject_id'    => $extra['subject_id'] ?? null,
            'subject_label' => isset($extra['subject_label']) ? mb_substr((string) $extra['subject_label'], 0, 200) : null,
            'query'         => isset($extra['query']) ? mb_substr((string) $extra['query'], 0, 200) : null,
            'reason'        => $extra['reason'] ?? null,
            'case_number'   => $extra['case_number'] ?? null,
            'results'       => $extra['results'] ?? null,
            'ip'            => $request->ip(),
            'user_agent'    => mb_substr((string) $request->userAgent(), 0, 300),
            'created_at'    => now(),
        ]);
    }

    /** Sign-in by an officer */
    public static function logLogin(Request $request, User $u): void
    {
        if (!self::isOfficer($u)) return;
        DB::table('le_access_logs')->insert([
            'user_id' => $u->id, 'org_id' => $u->current_org_id, 'action' => 'login',
            'ip' => $request->ip(), 'user_agent' => mb_substr((string) $request->userAgent(), 0, 300), 'created_at' => now(),
        ]);
    }
}
