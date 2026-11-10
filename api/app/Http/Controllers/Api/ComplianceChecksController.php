<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\Checks\Kyb;
use App\Services\Checks\RegistryChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Outside checks for company compliance (demo/compliance-checks.html):
 * business verification settings, the provider's webhook, and running a company's checks again.
 */
class ComplianceChecksController extends Controller
{
    // POST /api/v1/kyb/webhook/{provider}   (public; the signature proves it came from the provider)
    public function webhook(Request $request, string $provider): JsonResponse
    {
        abort_unless(in_array($provider, Kyb::PROVIDERS, true) && $provider !== 'fake', 404);
        $id = Kyb::provider($provider)->parseWebhook($request);
        if ($id === null) return response()->json(['error' => 'Invalid signature'], 401);
        if ($id !== '') Kyb::refresh($provider, $id);
        return response()->json(['received' => true]);
    }

    // POST /api/v1/admin/companies/{org}/checks/run   — run every outside check for the company now
    public function run(Request $request, Organization $org): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        RegistryChecks::forOrg($org, true);
        return response()->json(['data' => \App\Support\ComplianceRules::items($org->fresh())]);
    }

    // ── Admin → Settings → Business verification ───────────────────────────

    // GET /api/v1/admin/settings/kyb
    public function settings(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        return response()->json(['data' => $this->payload()]);
    }

    // PUT /api/v1/admin/settings/kyb   { provider, mode }
    public function updateSettings(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $data = $request->validate([
            'provider' => ['required', 'in:' . implode(',', Kyb::PROVIDERS)],
            'countries'   => ['sometimes', 'array'],
            'countries.*' => ['string', 'size:2'],
        ]);
        $data['countries'] = array_values(array_filter(array_map('strtoupper', $data['countries'] ?? Kyb::settings()['countries']),
            fn ($c) => isset(\App\Support\KybCountries::ALL[$c]) && !in_array($c, \App\Support\KybCountries::BLOCKED, true)));
        if ($data['provider'] === 'fake' && app()->environment('production')) {
            return response()->json(['message' => "The test provider isn't available in production."], 422);
        }
        // Test / Live is the platform switch (App\Support\PlatformMode)
        if (Kyb::mode() === 'live' && !Kyb::provider($data['provider'])->configured('live')) {
            return response()->json(['message' => "Add the provider's live key to the server before switching to live mode."], 422);
        }
        Kyb::save([...Kyb::settings(), ...$data], $request->user()->id);
        return response()->json(['data' => $this->payload()]);
    }

    // POST /api/v1/admin/settings/kyb/test   { provider }
    public function test(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $data = $request->validate(['provider' => ['required', 'in:' . implode(',', Kyb::PROVIDERS)]]);
        try {
            return response()->json(['ok' => true, 'message' => Kyb::provider($data['provider'])->testConnection(Kyb::mode())]);
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()]);
        }
    }

    private function payload(): array
    {
        $base = rtrim(config('app.url'), '/') . '/api/v1/kyb/webhook/';
        $providers = collect(Kyb::PROVIDERS)
            ->reject(fn ($p) => $p === 'fake' && app()->environment('production'))
            ->map(fn ($p) => [
                'key'        => $p,
                'name'       => Kyb::provider($p)->name(),
                'test_ready' => Kyb::provider($p)->configured('test'),
                'live_ready' => Kyb::provider($p)->configured('live'),
                'webhook'    => $p === 'fake' ? null : $base . $p,
            ])->values();
        return [...Kyb::settings(), 'mode' => Kyb::mode(), 'providers' => $providers, 'live_allowed' => Kyb::liveAllowed(),
            'all_countries' => \App\Support\KybCountries::list(), 'didit_ready' => Kyb::provider('didit')->configured(Kyb::mode()),
            'sam_gov_ready' => (string) config('services.sam_gov.key') !== '', 'fmcsa_ready' => (string) config('services.fmcsa.key') !== ''];
    }
}
