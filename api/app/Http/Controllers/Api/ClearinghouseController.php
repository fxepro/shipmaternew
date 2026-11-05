<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PersonVerification;
use App\Models\User;
use App\Services\PersonChecks;
use App\Models\CarrierVerification;
use App\Services\ClearinghouseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ClearinghouseController extends Controller
{
    public function __construct(private ClearinghouseService $clearinghouse) {}

    // ── POST /api/v1/carrier/clearinghouse ───────────────────────────────────
    // Initiate a pre-employment Clearinghouse query for the authenticated carrier.
    // Driver receives a consent notification at their email — they must approve
    // on clearinghouse.fmcsa.dot.gov before FMCSA returns results.

    public function initiate(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $user = $request->user();
        $pv   = PersonChecks::verification($user);
        $cdl  = PersonChecks::credential($user->id, 'cdl');
        $org  = PersonChecks::companyOf($user, 'carrier');

        // Clearinghouse is a US-only FMCSA program
        if (($org?->carrier_operating_country ?? 'US') !== 'US') {
            return response()->json([
                'status'  => 'not_applicable',
                'message' => 'FMCSA Drug & Alcohol Clearinghouse only applies to US-based carriers.',
            ]);
        }

        // Need CDL number + state to query
        if (!$cdl?->number || !$cdl->issuing_state) {
            return response()->json([
                'error' => 'CDL number and issuing state are required before running a Clearinghouse query. Add them in the Commercial tab.',
            ], 422);
        }

        // Already clear — no need to re-run
        if ($pv->clearinghouse_query_status === 'clear') {
            return response()->json([
                'status'  => 'clear',
                'message' => 'Clearinghouse query already returned clear — no violations found.',
            ]);
        }

        // API not configured yet
        if (!$this->clearinghouse->isConfigured()) {
            return response()->json([
                'error'   => 'Clearinghouse integration is not yet configured. Contact support.',
                'pending' => true,
            ], 503);
        }

        $result = $this->clearinghouse->submitPreEmploymentQuery(
            cdlNumber:   $cdl->number,
            cdlState:    $cdl->issuing_state,
            driverEmail: $user->email,
        );

        if (!$result) {
            return response()->json([
                'error' => 'Failed to submit Clearinghouse query. Please try again or contact support.',
            ], 500);
        }

        // FMCSA returns a query ID — store it on the person
        $queryId = $result['queryId'] ?? $result['id'] ?? null;

        PersonChecks::recordClearinghouse($user, [
            'clearinghouse_query_id'     => $queryId,
            'clearinghouse_query_status' => 'pending_consent',
            'clearinghouse_queried_at'   => now(),
            'clearinghouse_result_data'  => $result,
        ]);

        // Record in carrier_verifications for audit trail
        CarrierVerification::updateOrCreate(
            [
                'user_id'    => $user->id,
                'check_type' => 'clearinghouse',
            ],
            [
                'carrier_id'  => $org?->id,
                'status'      => 'pending',
                'external_id' => $queryId,
                'result_data' => ['query_id' => $queryId, 'submitted_at' => now()->toISOString()],
            ]
        );

        return response()->json([
            'status'  => 'pending_consent',
            'message' => 'Query submitted. Check your email — you will receive a consent request from FMCSA. '
                       . 'Log in at clearinghouse.fmcsa.dot.gov to approve it.',
            'query_id' => $queryId,
        ]);
    }

    // ── GET /api/v1/carrier/clearinghouse/status ─────────────────────────────
    // Poll current status — used as a manual refresh fallback.
    // The webhook is the primary update mechanism.

    public function status(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCarrier(), 403);

        $user = $request->user();
        $pv   = PersonVerification::where('user_id', $user->id)->first();
        if (!$pv) {
            return response()->json(['status' => 'not_run']);
        }

        $dbStatus = $pv->clearinghouse_query_status ?? 'not_run';

        // If we have a query ID and it's still pending, try to poll FMCSA
        if (in_array($dbStatus, ['pending_consent', 'querying']) && $pv->clearinghouse_query_id) {
            $latest = $this->clearinghouse->getQueryStatus($pv->clearinghouse_query_id);

            if ($latest && isset($latest['status'])) {
                $mapped = $this->clearinghouse->mapStatus($latest['status']);

                if ($mapped !== $dbStatus) {
                    $finished = in_array($mapped, ['clear', 'violations_found']);
                    PersonChecks::recordClearinghouse($user, array_filter([
                        'clearinghouse_query_status' => $mapped,
                        'clearinghouse_result_data'  => $latest,
                        'clearinghouse_completed_at' => $finished ? now() : null,
                    ], fn ($v) => $v !== null));
                    $pv->refresh();
                    if ($finished) $this->audit($pv, $mapped, $latest);
                    $dbStatus = $mapped;
                }
            }
        }

        return response()->json([
            'status'       => $dbStatus,
            'query_id'     => $pv->clearinghouse_query_id,
            'queried_at'   => $pv->clearinghouse_queried_at?->toISOString(),
            'completed_at' => $pv->clearinghouse_completed_at?->toISOString(),
            'result_data'  => $pv->clearinghouse_result_data,
        ]);
    }

    // ── POST /clearinghouse/webhook ──────────────────────────────────────────
    // FMCSA fires this when:
    //   - Driver grants or denies consent
    //   - Query result is ready
    //
    // Register this URL in the FMCSA C/TPA portal as your callback endpoint.
    // Full URL: https://yourdomain.com/api/v1/clearinghouse/webhook

    public function webhook(Request $request): JsonResponse
    {
        $payload   = $request->getContent();
        $signature = $request->header('X-Clearinghouse-Signature') ?? '';

        if (!$this->clearinghouse->verifyWebhookSignature($payload, $signature)) {
            Log::warning('Clearinghouse: invalid webhook signature');
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $event   = $request->json()->all();
        $type    = $event['eventType'] ?? $event['type'] ?? '';
        $data    = $event['data'] ?? $event;
        $queryId = $data['queryId'] ?? $data['id'] ?? null;

        Log::info('Clearinghouse webhook received', ['type' => $type, 'query_id' => $queryId]);

        if (!$queryId) {
            return response()->json(['received' => true]);
        }

        $pv   = PersonVerification::where('clearinghouse_query_id', $queryId)->first();
        $user = $pv ? User::find($pv->user_id) : null;

        if (!$user) {
            Log::warning('Clearinghouse: no person found for query', ['query_id' => $queryId]);
            return response()->json(['received' => true]);
        }

        // ── Consent events ───────────────────────────────────────────────────
        $upperType = strtoupper($type);

        if (str_contains($upperType, 'CONSENT_GIVEN') || str_contains($upperType, 'CONSENT_APPROVED')) {
            PersonChecks::recordClearinghouse($user, ['clearinghouse_query_status' => 'querying']);
        }

        if (str_contains($upperType, 'CONSENT_DENIED') || str_contains($upperType, 'CONSENT_REVOKED')) {
            PersonChecks::recordClearinghouse($user, [
                'clearinghouse_query_status' => 'error',
                'clearinghouse_result_data'  => array_merge(
                    $pv->clearinghouse_result_data ?? [],
                    ['consent_denied_at' => now()->toISOString()]
                ),
            ]);
        }

        // ── Query completed ──────────────────────────────────────────────────
        if (str_contains($upperType, 'QUERY_COMPLETED') || str_contains($upperType, 'RESULT_READY')) {
            $fmcsaStatus = $data['status'] ?? $data['result'] ?? '';
            $mapped      = $this->clearinghouse->mapStatus($fmcsaStatus);

            PersonChecks::recordClearinghouse($user, [
                'clearinghouse_query_status' => $mapped,
                'clearinghouse_completed_at' => now(),
                'clearinghouse_result_data'  => $data,
            ]);

            $this->audit($pv->fresh(), $mapped, $data);
        }

        return response()->json(['received' => true]);
    }

    /**
     * Audit record of a finished query. The result itself is the person's clearinghouse credential:
     * PersonChecks::refresh() moves their approval (violations send an approved person back to review).
     */
    private function audit(PersonVerification $pv, string $mappedStatus, array $resultData): void
    {
        CarrierVerification::updateOrCreate(
            ['user_id' => $pv->user_id, 'check_type' => 'clearinghouse'],
            [
                'status'      => $mappedStatus === 'clear' ? 'passed' : 'failed',
                'external_id' => $pv->clearinghouse_query_id,
                'result_data' => $resultData,
                'expires_at'  => now()->addYear(), // annual re-check required
            ]
        );
    }
}
