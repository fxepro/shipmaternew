<?php

namespace App\Services\Background;

use Illuminate\Http\Request;

/**
 * Foley (foley.io). Foley documents its screening API only to account holders, so the order and webhook calls
 * are not written yet: every call says so instead of guessing endpoints. Keys and URLs are already in
 * config/services.php ('foley'); fill in createCandidate, invite and parseWebhook from Foley's documents.
 */
class FoleyProvider implements Provider
{
    // Carriers and drivers see this, so it names no provider
    private const NOT_CONNECTED = 'Background checks are paused while Shipmater sets up its screening company. Try again later or contact support.';

    public function name(): string { return 'foley'; }

    public function configured(string $mode): bool
    {
        return (bool) config("services.foley.{$mode}_key") && (bool) config('services.foley.account_id');
    }

    public function createCandidate(array $person, string $mode): string
    {
        throw new \RuntimeException(self::NOT_CONNECTED);
    }

    public function invite(string $candidateId, string $package, ?string $state, string $mode): array
    {
        throw new \RuntimeException(self::NOT_CONNECTED);
    }

    public function parseWebhook(Request $request): ?array
    {
        return null;
    }

    public function reportPdf(string $reportId, string $mode): ?string
    {
        return null;
    }

    public function testConnection(string $mode): string
    {
        throw new \RuntimeException('Not connected yet: Shipmater needs Foley\'s API documents and sandbox keys.');
    }
}
