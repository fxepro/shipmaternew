<?php

namespace App\Services\Checks;

use App\Models\Organization;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Middesk business verification (docs.middesk.com).
 * Sandbox https://api-sandbox.middesk.com/v1 with mk_test keys, production https://api.middesk.com/v1 with mk_live keys.
 * Webhooks: business.created / business.updated, signed with HMAC-SHA256 of the raw body in X-Middesk-Signature-256.
 * Keys: MIDDESK_TEST_KEY, MIDDESK_LIVE_KEY, MIDDESK_WEBHOOK_SECRET on the server.
 */
class MiddeskKyb implements KybProvider
{
    public function key(): string { return 'middesk'; }
    public function name(): string { return 'Middesk'; }

    private function apiKey(string $mode): string
    {
        return (string) config($mode === 'live' ? 'services.middesk.live_key' : 'services.middesk.test_key');
    }

    public function configured(string $mode): bool
    {
        $k = $this->apiKey($mode);
        return $k !== '' && str_starts_with($k, $mode === 'live' ? 'mk_live' : 'mk_test');
    }

    private function http(string $mode): PendingRequest
    {
        $base = $mode === 'live' ? 'https://api.middesk.com/v1' : 'https://api-sandbox.middesk.com/v1';
        return Http::baseUrl($base)->withToken($this->apiKey($mode))->acceptJson()->timeout(20);
    }

    public function create(Organization $o, array $input, string $mode): array
    {
        return $this->http($mode)->post('/businesses', [
            'name'        => $input['name'],
            'tin'         => ['tin' => $input['tin']],
            'addresses'   => [[
                'address_line1' => $input['street'], 'city' => $input['city'], 'state' => $input['state'], 'postal_code' => $input['zip'],
            ]],
            'external_id' => "org-{$o->id}",
        ])->throw()->json();
    }

    public function fetch(string $id, string $mode): array
    {
        return $this->http($mode)->get("/businesses/{$id}")->throw()->json();
    }

    public function parseWebhook(Request $request): ?string
    {
        $secret = (string) config('services.middesk.webhook_secret');
        $sig = (string) $request->header('X-Middesk-Signature-256');
        if ($secret === '' || !hash_equals(hash_hmac('sha256', $request->getContent(), $secret), $sig)) return null;
        $event = json_decode($request->getContent(), true) ?: [];
        if (!in_array($event['type'] ?? '', ['business.created', 'business.updated'], true)) return '';
        return (string) ($event['data']['object']['id'] ?? '');
    }

    public function testConnection(string $mode): string
    {
        if (!$this->configured($mode)) throw new \RuntimeException("The Middesk {$mode} key is not set on the server.");
        $this->http($mode)->get('/businesses', ['per_page' => 1])->throw();
        return "Connected to Middesk ({$mode}).";
    }
}
