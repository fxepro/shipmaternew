<?php

namespace App\Services\Background;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Checkr (api.checkr.com; the test key works against api.checkr-staging.com).
 * The person enters their SSN on Checkr's hosted invitation form; Shipmater never sees it.
 * Invitations are billed to Shipmater's Checkr account and last 7 days.
 */
class CheckrProvider implements Provider
{
    public function name(): string { return 'checkr'; }

    public function configured(string $mode): bool
    {
        return (bool) config("services.checkr.{$mode}_key");
    }

    private function http(string $mode)
    {
        if (!$this->configured($mode)) {
            throw new \RuntimeException('Background checks aren\'t set up yet. Contact Shipmater support.');
        }
        return Http::timeout(15)
            ->baseUrl(rtrim((string) config("services.checkr.{$mode}_url"), '/'))
            ->withBasicAuth(config("services.checkr.{$mode}_key"), '')
            ->accept('application/json');
    }

    public function createCandidate(array $person, string $mode): string
    {
        $response = $this->http($mode)->post('/candidates', [
            'first_name' => $person['first_name'],
            'last_name'  => $person['last_name'],
            'email'      => $person['email'],
            'dob'        => $person['dob'],
        ]);
        if (!$response->successful()) {
            Log::error('[Background:checkr] Create candidate failed', ['status' => $response->status(), 'body' => $response->body()]);
            throw new \RuntimeException('Could not start the background check. Try again in a few minutes.');
        }
        return (string) $response->json('id');
    }

    public function invite(string $candidateId, string $package, ?string $state, string $mode): array
    {
        $response = $this->http($mode)->post('/invitations', [
            'candidate_id'   => $candidateId,
            'package'        => $package,
            'work_locations' => [array_filter(['country' => 'US', 'state' => $state ? strtoupper($state) : null])],
        ]);
        if (!$response->successful()) {
            Log::error('[Background:checkr] Create invitation failed', ['status' => $response->status(), 'candidate_id' => $candidateId, 'body' => $response->body()]);
            throw new \RuntimeException('Could not start the background check. Try again in a few minutes.');
        }
        return ['id' => (string) $response->json('id'), 'url' => (string) $response->json('invitation_url')];
    }

    public function parseWebhook(Request $request): ?array
    {
        // Signed with HMAC-SHA256 of the raw body using the account's API key: try the test key, then the live one
        $payload   = $request->getContent();
        $signature = (string) $request->header('X-Checkr-Signature', '');
        $mode = null;
        foreach (['test', 'live'] as $m) {
            $key = config("services.checkr.{$m}_key");
            if ($key && $signature !== '' && hash_equals(hash_hmac('sha256', $payload, $key), $signature)) {
                $mode = $m;
                break;
            }
        }
        if (!$mode) return null;

        $event = $request->json()->all();
        $obj   = $event['data']['object'] ?? [];
        $type  = $event['type'] ?? '';

        // Results are only clear or consider. A consider result is never a rejection by itself: the FCRA requires
        // pre-adverse and post-adverse action notices first (run from Checkr's dashboard).
        $kind = match ($type) {
            'invitation.completed'       => 'invitation_completed',
            'invitation.expired'         => 'invitation_expired',
            'report.created'             => 'report_created',
            'report.completed'           => 'report_completed',
            'report.post_adverse_action' => 'adverse_action',
            default                      => null,
        };
        if (!$kind) return [];

        $isInvitation = str_starts_with($type, 'invitation.');
        return [
            'mode'          => $mode,
            'event'         => $kind,
            'candidate_id'  => $obj['candidate_id'] ?? null,
            'invitation_id' => $isInvitation ? ($obj['id'] ?? null) : null,
            'report_id'     => $isInvitation ? ($obj['report_id'] ?? null) : ($obj['id'] ?? null),
            'result'        => $kind === 'report_completed' ? (($obj['result'] ?? null) === 'clear' ? 'clear' : 'consider') : null,
        ];
    }

    public function testConnection(string $mode): string
    {
        $response = $this->http($mode)->get('/packages');
        if (!$response->successful()) {
            throw new \RuntimeException("Checkr refused the {$mode} key (HTTP {$response->status()}).");
        }
        $slugs = collect($response->json('data', []))->pluck('slug')->filter()->implode(', ');
        return 'Connected. Packages on this account: ' . ($slugs ?: 'none');
    }
}
