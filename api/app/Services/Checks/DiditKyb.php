<?php

namespace App\Services\Checks;

use App\Models\OrgCheck;
use App\Models\Organization;
use App\Models\ShipperDocument;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Didit business verification (docs.didit.me), a backup for Middesk. Uses Didit's standalone APIs so nobody is sent
 * to a Didit page:
 *  - registry: POST /v3/kyb/search/ in the state of the address (then Delaware), then /v3/kyb/select/ for status and officers
 *  - sanctions: POST /v3/aml/ with entity_type company (OFAC, UN, EU and other lists)
 *  - EIN: Didit can't match an EIN with the IRS, so Document AI reads it from the newest W-9 on file and compares it
 *    with the EIN entered. An IRS letter (CP-575 / 147C) is better proof and can take the W-9's place later.
 *  - address: compared with the registered address in the registry (Didit has no address check of its own)
 * Results are put in Middesk's shape (review.tasks, people) so Kyb::apply reads them unchanged.
 * Keys: DIDIT_API_KEY (one key per Didit application: sandbox or live), DIDIT_WEBHOOK_SECRET.
 * Prices (Nov 2026): search $0.50, select $2.00–3.00 by state, AML $0.20, Document AI $0.20. Sandbox is free.
 */
class DiditKyb implements KybProvider
{
    private const BASE = 'https://verification.didit.me';

    public function key(): string { return 'didit'; }
    public function name(): string { return 'Didit'; }

    private function apiKey(): string { return (string) config('services.didit.key'); }

    /** One key per Didit application. A sandbox key is never used for live and a live key never for test. */
    public function configured(string $mode): bool
    {
        $k = $this->apiKey();
        if ($k === '') return false;
        return $mode === 'live' ? !str_starts_with($k, 'sk_test_') : !str_starts_with($k, 'sk_live_');
    }

    private function http(int $timeout = 30): PendingRequest
    {
        return Http::baseUrl(self::BASE)->withHeaders(['x-api-key' => $this->apiKey()])->acceptJson()->timeout($timeout);
    }

    public function create(Organization $o, array $input, string $mode): array
    {
        $vendor = "org-{$o->id}";
        $registry = $this->registry($input, $vendor);
        $aml = $this->aml($input['name'], $vendor);
        $ein = $this->einFromDocument($o, $input, $vendor);
        return $this->business($registry, $aml, $ein, $input);
    }

    /** Pending registry data: read the decision again; the sanctions and EIN results already recorded are kept */
    public function fetch(string $id, string $mode): array
    {
        $check = OrgCheck::where('check', 'kyb')->where('provider', 'didit')->where('external_id', $id)->first();
        $o = $check?->org()->first();
        $input = $o ? Kyb::input($o) : null;
        if (!$check || !$input) return [];
        $d = $this->http()->get("/v3/session/{$id}/decision/")->throw()->json();
        $company = $d['registry_checks'][0]['company'] ?? null;
        $registry = ['id' => $id, 'company' => $company, 'resolved' => ($company['fetch_status'] ?? 'resolved') === 'resolved', 'state' => null];
        $prev = fn ($k) => $check->results[$k] ?? null;
        return $this->business($registry, ['previous' => $prev('sanctions')], ['previous' => $prev('tin')], $input);
    }

    // ── Registry ───────────────────────────────────────────────────────────

    private function registry(array $input, string $vendor): array
    {
        foreach (array_unique([$input['state'], 'DE']) as $state) {
            $found = $this->http()->post('/v3/kyb/search/', ['country_code' => "US-{$state}", 'name' => $input['name'], 'vendor_data' => $vendor])->throw()->json();
            $pick = $this->bestMatch($found['kyb_registry']['companies'] ?? [], $input['name']);
            if (!$pick) continue;
            $sel = $this->http(45)->post('/v3/kyb/select/', ['kyb_response_id' => $pick['kyb_response_id'], 'vendor_data' => $vendor, 'save_api_request' => true])->throw()->json();
            $company = $sel['kyb_registry'] ?? [];
            return ['id' => $sel['request_id'] ?? null, 'company' => $company, 'resolved' => ($company['data_resolved'] ?? true) !== false, 'state' => $state];
        }
        return ['id' => null, 'company' => null, 'resolved' => true, 'state' => $input['state']];
    }

    /** The candidate whose name matches best, ignoring case, punctuation and the company-type ending */
    private function bestMatch(array $companies, string $name): ?array
    {
        $norm = fn ($s) => trim(preg_replace('/\b(inc|incorporated|llc|l l c|corp|corporation|co|company|ltd|limited|lp|llp|pllc|pc)\b/', '', preg_replace('/[^a-z0-9 ]/', ' ', strtolower((string) $s))));
        $want = preg_replace('/\s+/', ' ', $norm($name));
        foreach ($companies as $c) if (preg_replace('/\s+/', ' ', $norm($c['name'] ?? '')) === $want) return $c;
        return null;
    }

    // ── Sanctions ──────────────────────────────────────────────────────────

    private function aml(string $name, string $vendor): array
    {
        try {
            return $this->http()->post('/v3/aml/', ['full_name' => $name, 'entity_type' => 'company', 'vendor_data' => $vendor, 'save_api_request' => true])->throw()->json('aml') ?? [];
        } catch (\Throwable $e) {
            Log::warning('[Didit] AML screen failed', ['vendor' => $vendor, 'error' => $e->getMessage()]);
            return ['error' => $e->getMessage()];
        }
    }

    // ── EIN, read from the W-9 ─────────────────────────────────────────────

    private function einFromDocument(Organization $o, array $input, string $vendor): array
    {
        $doc = ShipperDocument::where('shipper_id', $o->id)->where('type', 'w9')->latest()->first();
        if (!$doc) return ['missing' => true];
        try {
            $disk = !empty(config('filesystems.disks.r2.key')) && !empty(config('filesystems.disks.r2.bucket')) ? 'r2' : 'public';
            $file = Storage::disk($disk)->get($doc->url);
            if ($file === null) return ['missing' => true];
            $fields = [
                ['key' => 'ein', 'name' => 'EIN', 'instruction' => 'Employer identification number (9 digits, written NN-NNNNNNN)', 'type' => 'text', 'required' => true],
                ['key' => 'legal_name', 'name' => 'Legal name', 'instruction' => 'Name as shown on the income tax return (line 1)', 'type' => 'text', 'required' => false],
            ];
            $r = $this->http(60)->attach('document', $file, basename($doc->url))
                ->post('/v3/document-ai/', ['fields' => json_encode($fields), 'expected_company_name' => $input['name'], 'vendor_data' => $vendor, 'save_api_request' => 'true'])
                ->throw()->json('document_ai') ?? [];
            return ['ein' => preg_replace('/\D/', '', (string) ($r['extracted_data']['ein'] ?? '')), 'name_score' => $r['name_match_score'] ?? null];
        } catch (\Throwable $e) {
            Log::warning('[Didit] Document AI failed', ['vendor' => $vendor, 'error' => $e->getMessage()]);
            return ['error' => $e->getMessage()];
        }
    }

    // ── Into Middesk's shape ───────────────────────────────────────────────

    private function business(array $registry, array $aml, array $ein, array $input): array
    {
        $task = fn ($key, $status, $sub) => ['key' => $key, 'status' => $status, 'sub_label' => $sub];
        $back = fn (?array $r) => match ($r['state'] ?? null) { 'passed' => 'success', 'failed' => 'failure', default => 'review' };
        $c = $registry['company'];

        // EIN
        if (isset($ein['previous'])) $tin = $task('tin', $back($ein['previous']), $ein['previous']['message'] ?? null);
        elseif (!empty($ein['missing'])) $tin = $task('tin', 'review', 'Upload a W-9 so the EIN can be read from it');
        elseif (!empty($ein['error']) || ($ein['ein'] ?? '') === '') $tin = $task('tin', 'review', 'The EIN could not be read from the W-9');
        else $tin = $ein['ein'] === $input['tin'] ? $task('tin', 'success', 'Matches the W-9') : $task('tin', 'failure', 'Differs from the W-9');

        // Registration
        $where = $registry['state'] ? " in {$registry['state']}" : '';
        if (!$c) $sos = $task('sos_not_found', 'failure', "Not found in the state registry{$where}");
        else {
            $st = strtolower((string) ($c['registry_status'] ?? ''));
            $sos = $task('sos_active', $st === 'active' ? 'success' : ($st === '' ? 'review' : 'failure'), ucfirst($st ?: 'status not given') . $where);
        }

        // Address: the registry's addresses against the one entered
        if (!$c) $addr = $task('address_verification', 'review', 'No registry record to compare with');
        else {
            $text = strtolower(json_encode([$c['registered_address'] ?? null, $c['addresses'] ?? []]));
            $ok = str_contains($text, strtolower($input['zip'])) || str_contains($text, strtolower($input['city']));
            $addr = $task('address_verification', $ok ? 'success' : 'review', $ok ? 'Matches the registry' : 'Differs from the registered address');
        }

        // Sanctions
        if (isset($aml['previous'])) $watch = $task('watchlist', $back($aml['previous']), $aml['previous']['message'] ?? null);
        elseif (!empty($aml['error'])) $watch = $task('watchlist', 'review', 'Screening did not run');
        else {
            $hits = (int) ($aml['total_hits'] ?? 0);
            $watch = match ($aml['status'] ?? null) {
                'Approved' => $task('watchlist', 'success', $hits ? "{$hits} possible matches cleared" : 'No hits'),
                'Declined' => $task('watchlist', 'failure', "{$hits} sanctions or watchlist matches"),
                default    => $task('watchlist', 'review', "{$hits} possible matches to review"),
            };
        }

        $people = collect($c['officers'] ?? [])->filter(fn ($p) => ($p['is_active'] ?? true) !== false)
            ->map(fn ($p) => ['name' => $p['name'] ?? null, 'titles' => array_values(array_filter([$p['designation'] ?? $p['role'] ?? null]))])
            ->filter(fn ($p) => $p['name'])->values()->all();

        return [
            'id'     => $registry['id'] ?? null,
            'status' => $registry['resolved'] ? 'completed' : 'pending',
            'review' => ['tasks' => [$tin, $sos, $addr, $watch]],
            'people' => $people,
        ];
    }

    // ── Webhooks and connection test ───────────────────────────────────────

    /** Signed with HMAC-SHA256 of the raw body in X-Signature, plus X-Timestamp within 5 minutes */
    public function parseWebhook(Request $request): ?string
    {
        $secret = (string) config('services.didit.webhook_secret');
        $sig = (string) $request->header('X-Signature');
        $ts = (int) $request->header('X-Timestamp');
        if ($secret === '' || abs(time() - $ts) > 300 || !hash_equals(hash_hmac('sha256', $request->getContent(), $secret), $sig)) return null;
        $event = json_decode($request->getContent(), true) ?: [];
        if (($event['session_kind'] ?? null) !== 'business') return '';
        return (string) ($event['session_id'] ?? '');
    }

    /** A sandbox search is free and returns one made-up company; a live key is only checked for being accepted */
    public function testConnection(string $mode): string
    {
        if (!$this->configured($mode)) throw new \RuntimeException("The Didit {$mode} key is not set on the server.");
        if ($mode === 'live') return 'A Didit live key is set. It is not called from here because every search is charged.';
        $this->http()->post('/v3/kyb/search/', ['country_code' => 'US-DE', 'name' => 'Connection test'])->throw();
        return 'Connected to Didit (sandbox).';
    }
}
