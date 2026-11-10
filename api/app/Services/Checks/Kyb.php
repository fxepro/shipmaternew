<?php

namespace App\Services\Checks;

use App\Models\OrgCheck;
use App\Models\Organization;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Business verification (KYB) for shippers, brokers and factors: EIN (IRS TIN match), Secretary of State registration,
 * registered address, OFAC sanctions screen and the officers on file. Runs as one request to the provider set in
 * Admin Settings (Middesk, Didit as its backup, or the test provider locally); results arrive by webhook and update the compliance items.
 */
class Kyb
{
    public const TYPES = ['shipper', 'broker', 'factor'];
    public const PROVIDERS = ['middesk', 'didit', 'fake'];

    // ── Settings (Admin Settings, Business verification) ───────────────────

    public static function settings(): array
    {
        $saved = Cache::remember('kyb_settings', 300, fn () => json_decode((string) DB::table('platform_settings')->where('key', 'kyb')->value('value'), true) ?: []);
        return array_replace(['provider' => app()->environment('production') ? 'middesk' : 'fake', 'mode' => 'test', 'countries' => ['US', 'CA', 'MX']], $saved);
    }

    public static function save(array $settings, ?int $userId): array
    {
        DB::table('platform_settings')->updateOrInsert(['key' => 'kyb'], ['value' => json_encode($settings), 'updated_by' => $userId, 'updated_at' => now()]);
        Cache::forget('kyb_settings');
        return self::settings();
    }

    /** Live checks are never run from a developer's computer */
    public static function liveAllowed(): bool
    {
        return \App\Support\PlatformMode::liveAllowed();
    }

    /** The platform-wide Test / Live switch (App\Support\PlatformMode) */
    public static function mode(): string
    {
        return \App\Support\PlatformMode::current();
    }

    public static function provider(?string $key = null): KybProvider
    {
        return match ($key ?? self::settings()['provider']) {
            'middesk' => new MiddeskKyb(),
            'didit'   => new DiditKyb(),
            default   => new FakeKyb(),
        };
    }

    // ── Running a check ────────────────────────────────────────────────────

    /**
     * What is sent: the legal name, tax ID and registered address. Null until all are filled in.
     * US: a 9-digit EIN and the state. Elsewhere: the company registration or tax number; state and postcode are optional.
     */
    public static function input(Organization $o): ?array
    {
        $country = strtoupper($o->country ?: 'US');
        $us = $country === 'US';
        $tin = $us ? preg_replace('/\D/', '', (string) $o->tax_id) : trim((string) $o->tax_id);
        $name = trim((string) ($o->legal_name ?: $o->name));
        if (!in_array($o->type, self::TYPES, true) || !$name || !$o->street || !$o->city) return null;
        if ($us ? (strlen($tin) !== 9 || !$o->state || !$o->zip) : $tin === '') return null;
        return ['name' => $name, 'tin' => $tin, 'street' => $o->street, 'city' => $o->city, 'state' => strtoupper((string) $o->state), 'zip' => (string) $o->zip, 'country' => $country];
    }

    /** Outside the US the check always goes to Didit: Middesk covers US companies only */
    public static function providerFor(Organization $o): KybProvider
    {
        return strtoupper($o->country ?: 'US') === 'US' ? self::provider() : new DiditKyb();
    }

    /** Send the company to the provider when its details are complete and changed since the last check (or $force). */
    public static function run(Organization $o, bool $force = false): ?OrgCheck
    {
        $input = self::input($o);
        if (!$input) return null;
        $hash = hash('sha256', json_encode($input));
        $check = OrgCheck::firstOrNew(['org_id' => $o->id, 'check' => 'kyb']);
        if (!$force && $check->exists && $check->input_hash === $hash && $check->status !== 'error') return $check;

        $provider = self::providerFor($o);
        $check->fill([
            'provider' => $provider->key(), 'mode' => self::mode(), 'status' => 'pending', 'results' => null, 'error' => null,
            'input_hash' => $hash, 'requested_at' => now(), 'completed_at' => null,
        ]);
        try {
            if (!\App\Support\KybCountries::isEnabled($input['country'])) throw new \RuntimeException("Business verification isn't offered in {$input['country']} yet");
            if (!$provider->configured(self::mode())) throw new \RuntimeException("{$provider->name()} key is not set on the server");
            $business = $provider->create($o, $input, self::mode());
            $check->external_id = $business['id'] ?? null;
            $check->save();
            self::apply($check, $business);
        } catch (\Throwable $e) {
            Log::warning('[KYB] check failed to start', ['org' => $o->id, 'error' => $e->getMessage()]);
            $check->fill(['status' => 'error', 'error' => $e->getMessage()])->save();
        }
        return $check->fresh();
    }

    /** A webhook from the provider: fetch the business again and record its results */
    public static function refresh(string $provider, string $externalId): ?OrgCheck
    {
        $check = OrgCheck::where('check', 'kyb')->where('provider', $provider)->where('external_id', $externalId)->first();
        if (!$check) return null;
        self::apply($check, self::provider($provider)->fetch($externalId, $check->mode));
        return $check->fresh();
    }

    /** Read the provider's review tasks into our five results, then re-run automatic approval */
    public static function apply(OrgCheck $check, array $business): void
    {
        $tasks = collect($business['review']['tasks'] ?? [])->keyBy('key');
        if ($tasks->isEmpty()) {
            $check->update(['status' => 'pending']);
            return;
        }
        $state = function (array $keys) use ($tasks): array {
            foreach ($keys as $k) {
                $t = $tasks->get($k);
                if (!$t) continue;
                $s = match ($t['status'] ?? null) { 'success' => 'passed', 'failure' => 'failed', default => 'review' };
                return ['state' => $s, 'message' => trim(($t['sub_label'] ?? '') . (isset($t['message']) ? ': ' . $t['message'] : ''), ': ') ?: null];
            }
            return ['state' => 'pending', 'message' => 'Not in the result yet'];
        };

        // Officers named in the Secretary of State filings
        $officers = collect($business['people'] ?? $business['officers'] ?? [])->map(fn ($p) => [
            'name'   => $p['name'] ?? trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? '')),
            'titles' => collect($p['titles'] ?? [])->map(fn ($t) => is_array($t) ? ($t['title'] ?? null) : $t)->filter()->values()->all(),
        ])->filter(fn ($p) => $p['name'])->values()->all();

        $check->update([
            'status' => in_array($business['status'] ?? null, ['pending', 'in_audit'], true) ? 'pending' : 'completed',
            'results' => [
                'tin'          => $state(['tin']),
                'registration' => $state(['sos_active', 'sos_inactive', 'sos_not_found', 'sos_match', 'sos_status', 'sos_unknown']),
                'address'      => $state(['address_verification', 'address_deliverability']),
                'sanctions'    => $state(['watchlist']),
                'officers'     => $officers,
                'business_status' => $business['status'] ?? null,
            ],
            'completed_at' => now(),
        ]);

        $org = $check->org()->first();
        if ($check->results['tin']['state'] === 'passed' && $org?->type === 'shipper' && !$org->shipper_ein_verified_at) {
            $org->forceFill(['shipper_ein_verified_at' => now()])->save();
        }
        if ($org) \App\Http\Controllers\Api\AdminCompanyController::autoApprove($org->fresh());
    }

    /** Does the authorized signer match an officer on file? */
    public static function signerMatches(?string $signer, array $officers): bool
    {
        if (!$signer || !$officers) return false;
        $norm = fn ($s) => preg_replace('/[^a-z ]/', '', strtolower($s));
        $name = $norm(preg_split('/[,(\-]/', $signer)[0]);
        foreach ($officers as $o) {
            $parts = array_filter(explode(' ', $norm($o['name'])));
            if ($parts && collect($parts)->every(fn ($p) => str_contains($name, $p))) return true;
        }
        return false;
    }
}
