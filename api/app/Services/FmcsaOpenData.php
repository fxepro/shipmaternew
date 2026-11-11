<?php

namespace App\Services;

use App\Models\FmcsaRecord;
use App\Models\OrgCheck;
use App\Models\Organization;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * FMCSA's free public data on data.transportation.gov (no key), for what QCMobile does not give:
 * insurance on file, the BOC-3 process agent, authority history, revocations and SMS safety measures.
 *
 * FMCSA runs two registration systems at once, and both publish daily:
 *  - the old Licensing & Insurance (L&I) system: full history, DOT padded to 8 digits, dates MM/DD/YYYY,
 *    coverage in thousands of dollars
 *  - the new Motus system: the latest changes, DOT unpadded, dates YYYYMMDD, coverage in dollars
 * Both are read and merged. SMS measures come from the monthly "SMS AB PassProperty" file
 * (all active interstate carriers); percentiles for property carriers are not public.
 */
class FmcsaOpenData
{
    private const BASE = 'https://data.transportation.gov/resource/';

    private const SETS = [
        'insurance'       => 'qh9u-swkp', // ActPendInsur - All With History (L&I)
        'insurance_motus' => 'x96h-evps', // Motus Insur
        'boc3'            => '2emp-mxtb', // BOC3 - All With History (L&I)
        'boc3_motus'      => 'mhr5-hjyc', // Motus BOC3
        'authority'       => '9mw4-x3tu', // AuthHist - All With History (L&I)
        'authority_motus' => 'dm5j-zc6c', // Motus AuthHist
        'revocation'      => 'sa6p-acbp', // Revocation - All With History (L&I)
        'revocation_motus'=> 'e67p-xyd5', // Motus RevokeSuspend
        'sms'             => '4y6x-dmck', // SMS AB PassProperty (monthly)
    ];

    private const FORMS = [
        '91' => 'Auto liability (BMC-91)', '91X' => 'Auto liability (BMC-91X)', '34' => 'Cargo (BMC-34)', '82' => 'Surety bond (BMC-82)',
        '83' => 'Cargo (BMC-83)', '84' => 'Broker bond (BMC-84)', '85' => 'Broker trust (BMC-85)',
    ];

    /** Everything public FMCSA holds on one company, cached for a day. Null when there is no DOT or MC number. */
    public function record(?string $dot, ?string $mc = null, bool $fresh = false): ?array
    {
        $dot = ltrim(preg_replace('/\D/', '', (string) $dot), '0');
        $mc  = ltrim(preg_replace('/\D/', '', (string) $mc), '0');
        if ($dot === '' && $mc === '') return null;
        $key = "fmcsa-open:{$dot}:{$mc}";
        if ($fresh) Cache::forget($key);
        return Cache::remember($key, now()->addDay(), fn () => $this->build($dot, $mc));
    }

    /**
     * A company's record as saved in fmcsa_records, pulled from FMCSA when there is none, when it is
     * older than a day, when the DOT or MC changed, or when $fresh. A new row is saved only when the
     * record changed; otherwise the latest row's pulled_at moves. If FMCSA can't be reached the last
     * saved record is returned.
     *
     * @return array{data: ?array, dot: ?string, mc: ?string, pulled_at: ?string, history: int}
     */
    public function forOrg(Organization $o, bool $fresh = false): array
    {
        [$dot, $mc] = $o->type === 'carrier'
            ? [$o->carrier_dot_number, $o->carrier_mc_number]
            : [OrgCheck::for($o, 'fmcsa_broker')?->external_id, $o->fmcsa_broker_mc];
        $d = ltrim(preg_replace('/\D/', '', (string) $dot), '0');
        $m = ltrim(preg_replace('/\D/', '', (string) $mc), '0');
        $out = fn (?FmcsaRecord $r) => [
            'data' => $r?->data, 'dot' => $dot, 'mc' => $mc, 'pulled_at' => $r?->pulled_at?->toISOString(),
            'history' => $r ? FmcsaRecord::where('org_id', $o->id)->count() : 0,
        ];
        if ($d === '' && $m === '') return $out(null);

        $last = FmcsaRecord::latestFor($o->id);
        $stale = !$last || $fresh || $last->dot !== $d || $last->mc !== $m || $last->pulled_at->lt(now()->subDay());
        if (!$stale) return $out($last);

        $data = $this->build($d, $m);
        if ($data === null) return $out($last);
        Cache::put("fmcsa-open:{$d}:{$m}", $data, now()->addDay());

        $hash = hash('sha256', json_encode(array_diff_key($data, ['checked_at' => 1])));
        if ($last && $last->data_hash === $hash && $last->dot === $d && $last->mc === $m) {
            $last->update(['pulled_at' => now(), 'data' => $data]);
            return $out($last);
        }
        return $out(FmcsaRecord::create(['org_id' => $o->id, 'dot' => $d, 'mc' => $m, 'data' => $data, 'data_hash' => $hash, 'pulled_at' => now()]));
    }

    /** The record pulled from FMCSA now; null when no data set could be reached */
    private function build(string $dot, string $mc): ?array
    {
        if (!$this->fetchAll($dot, $mc)) return null;
        return [
            'insurance'   => $this->insurance($dot, $mc),
            'boc3'        => $this->boc3($dot, $mc),
            'authority'   => $this->authority($dot, $mc),
            'revocations' => $this->revocations($dot, $mc),
            'safety'      => $dot !== '' ? $this->safety($dot) : null,
            'checked_at'  => now()->toISOString(),
        ];
    }

    /** Rows per data set, fetched together */
    private array $rows = [];

    /** All nine data sets at once (one at a time is too slow, and blocks a single-threaded server). False when none answered. */
    private function fetchAll(string $dot, string $mc): bool
    {
        $ok = 0;
        $where = [];
        foreach (array_keys(self::SETS) as $set) {
            $where[$set] = $set === 'sms' ? ($dot !== '' ? "dot_number='{$dot}'" : null) : $this->where($dot, $mc, str_ends_with($set, '_motus'));
        }
        $where = array_filter($where);
        $responses = Http::pool(fn ($pool) => array_map(
            fn ($set) => $pool->as($set)->timeout(20)->acceptJson()->get(self::BASE . self::SETS[$set] . '.json', ['$where' => $where[$set], '$limit' => 100]),
            array_keys($where),
        ));
        $this->rows = [];
        foreach ($where as $set => $_) {
            $r = $responses[$set] ?? null;
            if ($r instanceof \Illuminate\Http\Client\Response && $r->successful()) { $this->rows[$set] = $r->json() ?: []; $ok++; continue; }
            Log::warning('[FMCSA open data] query failed', ['set' => $set, 'status' => $r instanceof \Illuminate\Http\Client\Response ? $r->status() : (is_object($r) ? get_class($r) : null)]);
            $this->rows[$set] = [];
        }
        return $ok > 0;
    }

    // ── Insurance and bonds on file ─────────────────────────────────────────

    private function insurance(string $dot, string $mc): array
    {
        $rows = [];
        foreach ($this->get('insurance_motus') as $r) {
            $rows[$r['policy_no'] ?? uniqid()] = [
                'form' => $this->form($r['ins_form_code'] ?? ''), 'insurer' => $r['insurance_company_name'] ?? null, 'policy' => $r['policy_no'] ?? null,
                'coverage' => isset($r['max_cov_amount']) ? (int) round((float) $r['max_cov_amount']) : null,
                'effective' => $this->date($r['effective_date'] ?? null), 'cancels' => null, 'filed' => $this->date($r['trans_date'] ?? null),
            ];
        }
        foreach ($this->get('insurance') as $r) {
            $policy = $r['policy_no'] ?? uniqid();
            if (isset($rows[$policy])) { $rows[$policy]['cancels'] ??= $this->date($r['cancl_effective_date'] ?? null); continue; }
            $rows[$policy] = [
                'form' => $this->form($r['ins_form_code'] ?? ''), 'insurer' => $r['name_company'] ?? null, 'policy' => $r['policy_no'] ?? null,
                // L&I lists coverage in thousands of dollars
                'coverage' => isset($r['max_cov_amount']) ? (int) round((float) $r['max_cov_amount'] * 1000) : null,
                'effective' => $this->date($r['effective_date'] ?? null), 'cancels' => $this->date($r['cancl_effective_date'] ?? null),
                'filed' => $this->date($r['trans_date'] ?? null),
            ];
        }
        // L&I puts the effective date in the cancel column when no cancellation is pending
        foreach ($rows as &$r) if ($r['cancels'] && $r['cancels'] === $r['effective']) $r['cancels'] = null;
        return array_values($rows);
    }

    // ── BOC-3 process agent ─────────────────────────────────────────────────

    private function boc3(string $dot, string $mc): ?array
    {
        $r = $this->get('boc3_motus')[0] ?? $this->get('boc3')[0] ?? null;
        if (!$r) return null;
        return [
            'agent' => $r['co_name'] ?? null, 'attention' => $r['attn_to_or_title'] ?? null,
            'address' => trim(implode(', ', array_filter([$r['street_po'] ?? null, preg_replace('/\s+/', ' ', $r['city'] ?? ''), trim(($r['state_code'] ?? '') . ' ' . ($r['zip_code'] ?? ''))]))),
        ];
    }

    // ── Authority: current status (Motus) and history (L&I) ─────────────────

    private function authority(string $dot, string $mc): array
    {
        $current = [];
        foreach ($this->get('authority_motus') as $r) {
            $type = $r['op_auth_type'] ?? 'Authority';
            $date = $this->date($r['status_change_date'] ?? null);
            if (isset($current[$type]) && $current[$type]['date'] >= $date) continue;
            $current[$type] = ['type' => $type, 'status' => $r['op_auth_status'] ?? null, 'reason' => $r['reason'] ?? null, 'date' => $date];
        }
        $history = array_map(fn ($r) => [
            'type' => ucwords(strtolower($r['mod_col_1'] ?? 'Authority')), 'granted' => $this->date($r['orig_served_date'] ?? null),
            'action' => isset($r['disp_action_desc']) ? ucfirst(strtolower($r['disp_action_desc'])) : null, 'action_date' => $this->date($r['disp_served_date'] ?? $r['disp_decided_date'] ?? null),
        ], $this->get('authority'));
        usort($history, fn ($a, $b) => strcmp((string) $b['granted'], (string) $a['granted']));
        return ['current' => array_values($current), 'history' => $history];
    }

    private function revocations(string $dot, string $mc): array
    {
        $rows = array_merge(
            array_map(fn ($r) => ['type' => $r['op_auth_type'] ?? null, 'action' => $r['order1_type_desc'] ?? null,
                'served' => $this->date($r['order1_serve_date'] ?? null), 'effective' => $this->date($r['order1_effective_date'] ?? null)], $this->get('revocation_motus')),
            array_map(fn ($r) => ['type' => isset($r['type_license']) ? ucfirst(strtolower($r['type_license'])) : null, 'action' => isset($r['order2_type_desc']) ? ucfirst(strtolower($r['order2_type_desc'])) : null,
                'served' => $this->date($r['order1_serve_date'] ?? null), 'effective' => $this->date($r['order2_effective_date'] ?? null)], $this->get('revocation')),
        );
        usort($rows, fn ($a, $b) => strcmp((string) ($b['effective'] ?? $b['served']), (string) ($a['effective'] ?? $a['served'])));
        return $rows;
    }

    // ── SMS safety measures (monthly) ───────────────────────────────────────

    private function safety(string $dot): ?array
    {
        $r = $this->rows['sms'][0] ?? null;
        if (!$r) return null;
        $n = fn ($k) => (int) ($r[$k] ?? 0);
        $rate = fn ($oos, $total) => $n($total) > 0 ? round($n($oos) / $n($total) * 100, 1) : null;
        $basic = fn ($label, $p) => ['label' => $label, 'measure' => isset($r["{$p}_measure"]) ? (float) $r["{$p}_measure"] : null,
            'alert' => ($r["{$p}_ac"] ?? 'N') === 'Y', 'inspections_with_violations' => $n("{$p}_insp_w_viol")];
        return [
            'inspections' => $n('insp_total'),
            'driver_inspections' => $n('driver_insp_total'), 'driver_oos_rate' => $rate('driver_oos_insp_total', 'driver_insp_total'),
            'vehicle_inspections' => $n('vehicle_insp_total'), 'vehicle_oos_rate' => $rate('vehicle_oos_insp_total', 'vehicle_insp_total'),
            'basics' => [
                $basic('Unsafe driving', 'unsafe_driv'), $basic('Hours of service', 'hos_driv'), $basic('Driver fitness', 'driv_fit'),
                $basic('Drugs and alcohol', 'contr_subst'), $basic('Vehicle maintenance', 'veh_maint'),
            ],
        ];
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** Match on DOT or MC. The L&I sets pad DOT to 8 digits; Motus does not, and writes MC both ways. */
    private function where(string $dot, string $mc, bool $motus): string
    {
        $or = [];
        if ($dot !== '') $or[] = $motus ? "usdot_number='{$dot}'" : "dot_number='" . str_pad($dot, 8, '0', STR_PAD_LEFT) . "'";
        if ($mc !== '') $or[] = $motus ? "docket_number in('MC{$mc}','MC-{$mc}')" : "docket_number='MC{$mc}'";
        return implode(' OR ', $or);
    }

    /** The rows fetched for a data set */
    private function get(string $set): array
    {
        return $this->rows[$set] ?? [];
    }

    private function form(string $code): string
    {
        $c = strtoupper(preg_replace('/^BMC-?/i', '', trim($code)));
        return self::FORMS[$c] ?? ($code !== '' ? $code : 'Filing');
    }

    /** MM/DD/YYYY or YYYYMMDD to YYYY-MM-DD */
    private function date(?string $d): ?string
    {
        $d = trim((string) $d);
        if (preg_match('#^(\d{2})/(\d{2})/(\d{4})$#', $d, $m)) return "{$m[3]}-{$m[1]}-{$m[2]}";
        if (preg_match('#^(\d{4})(\d{2})(\d{2})$#', $d, $m)) return "{$m[1]}-{$m[2]}-{$m[3]}";
        return $d !== '' ? substr($d, 0, 10) : null;
    }
}
