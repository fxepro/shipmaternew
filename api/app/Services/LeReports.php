<?php

namespace App\Services;

use App\Models\Organization;
use App\Services\Checks\FakeKyb;
use App\Services\Checks\Kyb;
use App\Support\LawEnforcement;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Business reports for officers on companies not on Shipmater (demo/law-enforcement.html, Option 2).
 * Each section fills in as its source answers: FMCSA (seconds), state registration and sanctions through the
 * business verification provider (usually minutes), and the phone and name matched against companies we know.
 * Not charged when the company can't be found.
 */
class LeReports
{
    public const LABELS = [
        'fmcsa'        => 'FMCSA',
        'registration' => 'State registration',
        'watchlists'   => 'Sanctions',
        'shared'       => 'Shared with other companies',
    ];

    /** A company already on Shipmater, so the officer opens it on Companies instead (free) */
    public static function onShipmater(string $type, string $query): ?Organization
    {
        $digits = preg_replace('/\D/', '', $query);
        if ($digits === '' || $type === 'name') return null;
        return Organization::whereIn('type', ['carrier', 'shipper', 'broker', 'factor', 'receiver'])->whereNotNull('owner_id')
            ->where(fn ($w) => match ($type) {
                'usdot' => $w->where('carrier_dot_number', $digits),
                'mc'    => $w->where('carrier_mc_number', $digits)->orWhere('fmcsa_broker_mc', $digits),
                default => $w->whereRaw("regexp_replace(coalesce(tax_id, ''), '\\D', '', 'g') = ?", [$digits]),
            })->first();
    }

    /** Run every source now; the report is ready when none is still pending */
    public static function run(int $id): void
    {
        $r = DB::table('le_reports')->find($id);
        if (!$r) return;
        $sections = json_decode($r->sections ?? '[]', true) ?: [];

        // FMCSA: USDOT or MC only
        $fmcsa = null;
        if (in_array($r->query_type, ['usdot', 'mc'], true)) {
            try {
                $svc = app(FmcsaService::class);
                $fmcsa = $r->query_type === 'usdot' ? $svc->lookupByDot($r->query) : $svc->lookupByMc($r->query);
            } catch (\Throwable $e) {
                Log::warning('[LE report] FMCSA lookup failed', ['report' => $id, 'error' => $e->getMessage()]);
            }
            $sections['fmcsa'] = $fmcsa ? self::section('ready', [
                ['Legal name', $fmcsa['legal_name'] ?? null],
                ['DBA', $fmcsa['dba_name'] ?? null],
                ['USDOT', $fmcsa['dot_number'] ?? null],
                ['Location', collect([$fmcsa['city'] ?? null, $fmcsa['state'] ?? null])->filter()->implode(', ') ?: null],
                ['Allowed to operate', ($fmcsa['allowed_to_operate'] ?? false) ? 'Yes' : 'No', !($fmcsa['allowed_to_operate'] ?? false)],
                ['Operating status', $fmcsa['operating_status'] ?? null],
                ['Liability insurance', ($fmcsa['bipd_insurance_on_file'] ?? false) ? 'On file' : (($fmcsa['bipd_required'] ?? false) ? 'Required, none on file' : 'Not required'), ($fmcsa['bipd_required'] ?? false) && !($fmcsa['bipd_insurance_on_file'] ?? false)],
                ['Out of service', $fmcsa['out_of_service_date'] ?? null, !empty($fmcsa['out_of_service_date'])],
                ['Safety rating', $fmcsa['safety_rating'] ?? null],
                ['Drivers / power units', isset($fmcsa['total_drivers']) ? "{$fmcsa['total_drivers']} / {$fmcsa['total_power_units']}" : null],
                ['Last MCS-150', $fmcsa['mcs150_date'] ?? null],
            ]) : self::section('not_found', [['Result', 'No FMCSA record for this number']]);
        } else {
            $sections['fmcsa'] = self::section('not_applicable', [['Result', 'Search by USDOT or MC to include FMCSA']]);
        }

        $name  = $fmcsa['legal_name'] ?? ($r->query_type === 'name' ? $r->query : null);
        $state = $fmcsa['state'] ?? $r->state;

        // State registration and sanctions: the business verification provider (the test provider outside Live)
        if ($name) {
            try {
                $provider = Kyb::mode() === 'live' ? Kyb::provider() : new FakeKyb();
                $org = (new Organization)->forceFill(['name' => $name, 'type' => 'shipper', 'state' => $state, 'city' => $fmcsa['city'] ?? null]);
                $business = $provider->create($org, [
                    'name' => $name, 'tin' => $r->query_type === 'ein' ? preg_replace('/\D/', '', $r->query) : '',
                    'street' => null, 'city' => $fmcsa['city'] ?? null, 'state' => $state, 'zip' => $fmcsa['zip'] ?? null, 'country' => 'US',
                ], Kyb::mode());
                $tasks = collect($business['review']['tasks'] ?? [])->keyBy('key');
                $task = fn ($k) => $tasks->get($k);
                $sos = $task('sos_active') ?? $task('sos_match') ?? $task('sos_not_found');
                $pending = in_array($business['status'] ?? null, ['pending', 'in_audit'], true) && $tasks->isEmpty();
                $sections['registration'] = $pending ? self::section('pending', []) : self::section($sos ? 'ready' : 'not_found', [
                    ['Entity', $name],
                    ['Status', $sos['sub_label'] ?? 'Not found', ($sos['status'] ?? null) !== 'success'],
                    ['Officers', collect($business['people'] ?? [])->pluck('name')->filter()->implode(', ') ?: null],
                    ['Provider', $provider->name()],
                ]);
                $w = $task('watchlist');
                $sections['watchlists'] = $pending ? self::section('pending', []) : self::section($w ? 'ready' : 'unavailable', [
                    ['Sanctions and watchlists', $w['sub_label'] ?? 'Not checked', $w && ($w['status'] ?? null) !== 'success'],
                ]);
            } catch (\Throwable $e) {
                Log::warning('[LE report] registration check failed', ['report' => $id, 'error' => $e->getMessage()]);
                $sections['registration'] = self::section('unavailable', [['Result', 'The registration check could not be run']]);
                $sections['watchlists'] = self::section('unavailable', [['Result', 'The sanctions check could not be run']]);
            }
        } else {
            $sections['registration'] = self::section('not_found', [['Result', 'No company name to check']]);
            $sections['watchlists'] = self::section('not_found', [['Result', 'No company name to check']]);
        }

        // Shared with companies we know: the same phone, or the same name in another state
        $phone = preg_replace('/\D/', '', (string) ($fmcsa['phone'] ?? ''));
        $phone = strlen($phone) > 10 ? substr($phone, -10) : $phone;
        $byPhone = strlen($phone) === 10 ? Organization::where(fn ($w) => $w->whereRaw("right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 10) = ?", [$phone])
            ->orWhereRaw("right(regexp_replace(coalesce(phone_e164, ''), '\\D', '', 'g'), 10) = ?", [$phone]))->where('type', '!=', 'agency')->pluck('name') : collect();
        $byName = $name ? Organization::where('name', 'ilike', $name)->where('type', '!=', 'agency')->pluck('name') : collect();
        $sections['shared'] = self::section('ready', [
            ['Phone', $phone === '' ? 'No phone on the record' : ($byPhone->isEmpty() ? 'No match' : 'Also used by ' . $byPhone->take(5)->implode(', ')), $byPhone->isNotEmpty()],
            ['Name', $byName->isEmpty() ? 'No match' : 'Same name as ' . $byName->take(5)->implode(', '), $byName->isNotEmpty()],
        ]);

        self::save($id, $sections, $name);
    }

    private static function section(string $status, array $rows): array
    {
        return ['status' => $status, 'at' => now()->toISOString(),
            'rows' => array_values(array_map(fn ($row) => ['label' => $row[0], 'value' => $row[1], 'flag' => (bool) ($row[2] ?? false)],
                array_filter($rows, fn ($row) => $row[1] !== null && $row[1] !== '')))];
    }

    private static function save(int $id, array $sections, ?string $name): void
    {
        $pending = collect($sections)->contains(fn ($s) => $s['status'] === 'pending');
        $found = collect(['fmcsa', 'registration'])->contains(fn ($k) => ($sections[$k]['status'] ?? null) === 'ready');
        $status = $pending ? 'running' : ($found ? 'ready' : 'not_found');
        DB::table('le_reports')->where('id', $id)->update([
            'sections' => json_encode($sections), 'company_name' => $name, 'status' => $status,
            'price_cents' => $status === 'not_found' ? 0 : LawEnforcement::REPORT_PRICE_CENTS,
            // Ready reports go on the agency's monthly statement (Billing); not found is never charged
            'charge_status' => $status === 'ready' ? 'invoiced' : ($status === 'not_found' ? 'not_charged' : 'pending'),
            'completed_at' => $pending ? null : now(), 'updated_at' => now(),
        ]);
    }

    /** The report for the page and the PDF */
    public static function present(object $r): array
    {
        $sections = json_decode($r->sections ?? '[]', true) ?: [];
        return [
            'id' => $r->id, 'query_type' => $r->query_type, 'query' => $r->query, 'state' => $r->state, 'case_number' => $r->case_number,
            'company_name' => $r->company_name, 'status' => $r->status, 'price' => $r->price_cents / 100, 'charge_status' => $r->charge_status,
            'sections' => collect(self::LABELS)->map(fn ($label, $key) => ($sections[$key] ?? ['status' => 'pending', 'rows' => [], 'at' => null]) + ['key' => $key, 'label' => $label])->values(),
            'run_by' => DB::table('users')->where('id', $r->user_id)->value('name'),
            'created_at' => $r->created_at, 'completed_at' => $r->completed_at,
        ];
    }
}
