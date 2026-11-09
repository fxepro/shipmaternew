<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FmcsaService
{
    private string $baseUrl = 'https://mobile.fmcsa.dot.gov/qc/services';

    private function key(): string
    {
        return config('services.fmcsa.key', '');
    }

    // ── DOT number lookup ────────────────────────────────────────────────────
    // GET /carriers/{dotNumber}?webKey={key}

    public function lookupByDot(string $dotNumber): ?array
    {
        $dot = preg_replace('/\D/', '', $dotNumber);
        if (!$dot) return null;

        $response = Http::timeout(12)
            ->accept('application/json')
            ->get("{$this->baseUrl}/carriers/{$dot}", [
                'webKey' => $this->key(),
            ]);

        if ($response->status() === 404) return null;

        if (!$response->successful()) {
            Log::warning('[FMCSA] DOT lookup failed', [
                'dot'    => $dot,
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
            return null;
        }

        $carrier = $response->json('content.carrier');
        if (!$carrier) return null;

        return $this->format($carrier);
    }

    // ── MC / docket number lookup ────────────────────────────────────────────
    // GET /carriers/docket-number/{mcNumber}?webKey={key}
    // Returns an array of carriers — take the first active one.

    public function lookupByMc(string $mcNumber): ?array
    {
        $mc = preg_replace('/\D/', '', $mcNumber);
        if (!$mc) return null;

        $response = Http::timeout(12)
            ->accept('application/json')
            ->get("{$this->baseUrl}/carriers/docket-number/{$mc}", [
                'webKey' => $this->key(),
            ]);

        if ($response->status() === 404) return null;

        if (!$response->successful()) {
            Log::warning('[FMCSA] MC lookup failed', [
                'mc'     => $mc,
                'status' => $response->status(),
            ]);
            return null;
        }

        $content  = $response->json('content');
        Log::info('[FMCSA] MC raw content', ['content' => $content]);

        // MC endpoint returns content.Carrier (array or single object)
        $carriers = $content['Carrier'] ?? $content['carrier'] ?? null;

        // Some responses wrap in array at top level
        if (!$carriers && is_array($content) && isset($content[0])) {
            $carriers = array_map(fn($item) => $item['carrier'] ?? $item, $content);
        }

        if (!$carriers) return null;

        // Normalise: single object vs array
        if (isset($carriers['dotNumber'])) {
            $carriers = [$carriers];
        }

        // Prefer the first one that is allowed to operate, else just take first
        $carrier = collect($carriers)->firstWhere('allowedToOperate', 'Y') ?? $carriers[0];

        Log::info('[FMCSA] MC raw carrier', ['allowedToOperate' => $carrier['allowedToOperate'] ?? 'MISSING', 'operatingStatus' => $carrier['operatingStatus'] ?? 'MISSING']);

        return $this->format($carrier);
    }

    // ── Operating authority ──────────────────────────────────────────────────
    // GET /carriers/{dotNumber}/authority — common, contract and broker authority status (A = active)

    public function authority(string $dotNumber): ?array
    {
        $dot = preg_replace('/\D/', '', $dotNumber);
        if (!$dot) return null;
        $response = Http::timeout(12)->accept('application/json')->get("{$this->baseUrl}/carriers/{$dot}/authority", ['webKey' => $this->key()]);
        if (!$response->successful()) return null;
        $rows = $response->json('content');
        $rows = isset($rows['carrierAuthority']) ? [$rows] : (is_array($rows) ? $rows : []);
        $a = collect($rows)->map(fn ($r) => $r['carrierAuthority'] ?? $r)->first();
        if (!$a) return null;
        return [
            'broker'   => $a['brokerAuthorityStatus'] ?? null,
            'common'   => $a['commonAuthorityStatus'] ?? null,
            'contract' => $a['contractAuthorityStatus'] ?? null,
        ];
    }

    // ── Shared formatter ─────────────────────────────────────────────────────

    private function format(array $c): array
    {
        $allowed = strtoupper($c['allowedToOperate'] ?? 'N') === 'Y';

        return [
            'dot_number'              => (string) ($c['dotNumber'] ?? ''),
            'legal_name'              => $c['legalName'] ?? null,
            'dba_name'                => $c['dbaName'] ?? null,
            'city'                    => $c['phyCity'] ?? null,
            'state'                   => $c['phyState'] ?? null,
            'zip'                     => $c['phyZip'] ?? null,
            'country'                 => $c['phyCountry'] ?? 'US',
            'phone'                   => $c['telephone'] ?? null,
            'allowed_to_operate'      => $allowed,
            'operating_status'        => $c['operatingStatus'] ?? null,
            'safety_rating'           => $c['safetyRating'] ?? 'Not Rated',
            'safety_rating_date'      => $c['safetyRatingDate'] ?? null,
            'bipd_insurance_on_file'  => (int) ($c['bipdInsuranceOnFile'] ?? 0) > 0,
            'bipd_required'           => ($c['bipdInsuranceRequired'] ?? 'N') === 'Y',
            'cargo_insurance_on_file' => (int) ($c['cargoInsuranceOnFile'] ?? 0) > 0,
            'cargo_required'          => ($c['cargoInsuranceRequired'] ?? 'N') === 'Y',
            // Broker financial security (BMC-84 bond / BMC-85 trust)
            'bond_on_file'            => (int) ($c['bondInsuranceOnFile'] ?? 0) > 0,
            'bond_required'           => ($c['bondInsuranceRequired'] ?? 'N') === 'Y',
            'total_drivers'           => (int) ($c['totalDrivers'] ?? 0),
            'total_power_units'       => (int) ($c['totalPowerUnits'] ?? 0),
            'mcs150_date'             => $c['mcs150Date'] ?? null,
            'mcs150_mileage'          => $c['mcs150Mileage'] ?? null,
            'out_of_service_date'     => $c['oosDate'] ?? null,
        ];
    }
}
