<?php

namespace App\Support;

use App\Models\Organization;
use Illuminate\Support\Carbon;

/**
 * What each type of company must (or may) have on file to be compliant.
 * One list per type: the admin Compliance tab and the Overview verification table both read it,
 * so a company only ever shows the items that apply to it.
 *
 * Item: section, key, label, required, value, verified (bool|null = no verification step),
 *       expires (Y-m-d|null), file (url|null), state (passed|pending|missing|expired), detail.
 * "upload" = the company (or an admin) adds it as a file in org_compliance_items; Shipmater verifies it.
 */
class ComplianceRules
{
    /** $policy = false: every item with its default required flag (the admin policy grid uses this) */
    public static function items(Organization $o, bool $policy = true): array
    {
        $file   = fn ($path) => $path ? \App\Models\ShipperDocument::fileUrl($path) : null;
        $stored = \App\Models\OrgComplianceItem::where('org_id', $o->id)->get()->keyBy('key');
        // An item kept as a file in org_compliance_items
        // $legacy: [file path, expiry] from the older profile columns, used until a file is uploaded here
        $up = function (string $section, string $key, string $label, bool $required, ?string $valueLabel = null, bool $expires = false, bool $valueOnly = false, ?array $legacy = null) use ($stored, $file) {
            $row  = $stored->get($key);
            $has  = $row?->file_path || ($valueOnly && filled($row?->value));
            $item = !$has && !empty($legacy[0])
                ? self::item($section, $key, $label, $required, 'On file', null, $legacy[1] ?? null, $file($legacy[0]))
                : self::item($section, $key, $label, $required,
                    $has ? ($row->value ?: ($row->file_name ?: 'On file')) : null,
                    $row?->file_path ? (bool) $row->verified_at : null, $row?->expires_at, $file($row?->file_path));
            return array_merge($item, ['upload' => ['value_label' => $valueLabel, 'expires' => $expires, 'value_only' => $valueOnly], 'value_raw' => $row?->value]);
        };

        // Results from outside checks (demo/compliance-checks.html)
        $checks = $o->exists ? \App\Models\OrgCheck::where('org_id', $o->id)->get()->keyBy('check') : collect();
        $kyb = $checks->get('kyb');
        // An item whose state comes from an outside check: passed, failed, review (needs a person) or pending
        $ext = function (string $section, string $key, string $label, bool $required, $value, ?array $result, ?string $waiting = null) {
            $item = self::item($section, $key, $label, $required, $value);
            if ($value === null || $value === '') return $item;
            $r = $result ?? ['state' => 'pending', 'message' => $waiting];
            $item['state'] = match ($r['state']) { 'passed' => 'passed', 'failed' => 'failed', default => 'pending' };
            $item['verified'] = $r['state'] === 'passed';
            $item['detail'] = $r['state'] === 'review' ? 'Needs review: ' . ($r['message'] ?? 'see the provider result') : ($r['message'] ?? null);
            return $item;
        };
        // The four business verification (KYB) items for shippers, brokers and factors
        $kybWaiting = \App\Services\Checks\Kyb::input($o) ? 'Waiting for the business verification result' : 'Runs once the legal name, tax ID and address are filled in';
        // Outside the US: the company's registration or tax number, its national register, and no W-9
        $us = strtoupper($o->country ?: 'US') === 'US';
        $kybItems = fn () => [
            $ext('Business', 'ein', $us ? 'EIN' : 'Registration or tax number', true, $o->tax_id, $kyb?->result('tin'), $kybWaiting),
            $ext('Business', 'kyb_registration', $us ? 'Business registration (Secretary of State)' : 'Business registration (company register)', true,
                ($o->legal_name ?: $o->name) ?: null, $kyb?->result('registration'), $kybWaiting),
            $ext('Business', 'address', 'Registered address', true,
                collect([$o->street, $o->city, $o->state, $o->zip])->filter()->count() === 4 ? collect([$o->street, $o->city, $o->state, $o->zip])->implode(', ') : null,
                $kyb?->result('address'), $kybWaiting),
            $ext('Business', 'kyb_sanctions', 'Sanctions screen (OFAC)', true, $kyb ? 'Screened' : (\App\Services\Checks\Kyb::input($o) ? 'Waiting' : null),
                $kyb?->result('sanctions'), $kybWaiting),
        ];
        // Authorized signer: matched to the officers in the Secretary of State filing
        $signer = function () use ($up, $stored, $kyb) {
            $item = $up('Business', 'authorized_signer', 'Authorized signer', true, 'Name and title', false, true);
            $name = $stored->get('authorized_signer')?->value;
            if (!$name) return $item;
            $officers = $kyb?->results['officers'] ?? [];
            if (!$kyb || $kyb->status !== 'completed') return array_merge($item, ['state' => 'pending', 'verified' => false, 'detail' => 'Waiting for the officers on file']);
            $ok = \App\Services\Checks\Kyb::signerMatches($name, $officers);
            return array_merge($item, ['state' => $ok ? 'passed' : 'pending', 'verified' => $ok,
                'detail' => $ok ? 'Matches an officer on file' : 'Needs review: not among the officers on file' . ($officers ? ' (' . collect($officers)->pluck('name')->implode(', ') . ')' : '')]);
        };

        $items = match ($o->type) {
            'carrier' => (function () use ($o) {
                // Auto liability: the FMCSA insurance filing (BIPD on file) for carriers that must file one;
                // otherwise the certificate, reviewed by Shipmater
                $fm = $o->exists ? \App\Models\CarrierVerification::where('carrier_id', $o->id)->where('check_type', 'fmcsa')->value('result_data') : null;
                $fm = is_string($fm) ? json_decode($fm, true) : $fm;
                $policy = $o->carrier_auto_insurer_name ? trim("{$o->carrier_auto_insurer_name} · {$o->carrier_auto_policy_number}" . ($o->carrier_auto_coverage_amount ? ' · ' . self::money($o->carrier_auto_coverage_amount) : ''), ' ·') : null;
                $auto = self::item('Insurance', 'auto_insurance', 'Auto liability insurance', true, $policy, (bool) $o->carrier_insurance_verified, $o->carrier_auto_expiry_date);
                if (!empty($fm['bipd_required'])) {
                    $onFile = !empty($fm['bipd_insurance_on_file']);
                    $auto = array_merge($auto, ['value' => $policy ?? 'FMCSA filing', 'state' => $onFile ? 'passed' : 'failed', 'verified' => $onFile,
                        'detail' => $onFile ? 'Insurance filing on file at FMCSA' : 'No insurance filing on file at FMCSA']);
                }
                $cargo = $o->carrier_cargo_insurer_name ? trim("{$o->carrier_cargo_insurer_name} · {$o->carrier_cargo_policy_number}" . ($o->carrier_cargo_coverage_amount ? ' · ' . self::money($o->carrier_cargo_coverage_amount) : ''), ' ·') : null;
                return [
                    self::item('Operating authority', 'dot_number', 'USDOT number', true, $o->carrier_dot_number, (bool) $o->carrier_dot_verified),
                    self::item('Operating authority', 'mc_number', 'Operating authority (MC)', false, $o->carrier_mc_number, (bool) $o->carrier_mc_verified),
                    $auto,
                    self::item('Insurance', 'cargo_insurance', 'Cargo insurance', false, $cargo, null, $o->carrier_cargo_expiry_date),
                ];
            })(),
            // To post loads: the business checks, W-9 and an authorized signer. Special freight: only when a load needs it.
            'shipper' => [
                ...$kybItems(),
                $up('Business', 'w9', 'W-9', $us),
                $signer(),
                $up('Insurance', 'coi', 'Certificate of insurance', false, null, true, false, [$o->shipper_coi_url, $o->shipper_coi_expiry]),
                $up('Special freight', 'hazmat_reg', 'HazMat registration (PHMSA)', false, 'Registration #', true, false, [$o->shipper_hazmat_reg_url, $o->shipper_hazmat_reg_expiry]),
                $up('Special freight', 'hazmat_training', 'Hazmat training certificate (49 CFR 172.704)', false, null, true),
                $up('Special freight', 'emergency_phone', '24-hour hazmat emergency phone', false, 'Phone number', false, true),
                $up('Special freight', 'ttb_atf_permit', 'TTB or ATF permit (alcohol, tobacco, firearms)', false, 'Permit #', true),
                $up('Special freight', 'hipaa_baa', 'HIPAA BAA', false, null, true, false, [$o->shipper_hipaa_baa_url, $o->shipper_hipaa_baa_expiry]),
                $ext('Government', 'sam_gov', 'SAM.gov registration (UEI)', false, $o->sam_gov_number, $checks->get('sam_gov')?->result('registration'), 'Waiting for SAM.gov'),
            ],
            'factor' => [
                ...$kybItems(),
                $up('Business', 'w9', 'W-9', $us),
                $up('Licensing', 'factoring_license', 'State lending or factoring licence (where required)', false, 'Licence #', true),
                $up('Factoring', 'noa_template', 'NOA template', false),
                self::item('Money', 'bank', 'Bank account', true, $o->bank_last4 ? trim(($o->bank_name ?? 'Bank') . ' ···' . $o->bank_last4) : null,
                    $o->bank_last4 ? in_array($o->stripe_connect_status, ['active', 'verified'], true) : null),
            ],
            'broker' => (function () use ($o, $kybItems, $up, $ext, $checks, $us) {
                $fm = $checks->get('fmcsa_broker');
                // The bond passes from FMCSA's record; a file is only needed when FMCSA doesn't show one
                $bond = $up('Authority', 'surety_bond', 'Surety bond or trust (BMC-84/85, $75,000)', true, 'Bond #');
                $bondResult = $fm?->result('bond');
                if ($o->fmcsa_broker_mc && $bondResult) {
                    $bond = array_merge($bond, [
                        'value' => $bond['value'] ?? ($bondResult['state'] === 'passed' ? 'On file at FMCSA' : null),
                        'state' => match ($bondResult['state']) { 'passed' => 'passed', 'failed' => $bond['state'] === 'missing' ? 'failed' : $bond['state'], default => 'pending' },
                        'verified' => $bondResult['state'] === 'passed' ?: $bond['verified'],
                        'detail' => $bondResult['message'] ?? $bond['detail'],
                    ]);
                }
                return [
                    ...$kybItems(),
                    $ext('Authority', 'broker_mc', 'Broker authority (MC)', true, $o->fmcsa_broker_mc, $fm?->result('authority'), 'Waiting for FMCSA'),
                    $bond,
                    $up('Business', 'w9', 'W-9', $us),
                    $up('Insurance', 'contingent_cargo', 'Contingent cargo insurance', false, 'Insurer / policy #', true),
                ];
            })(),
            // Receivers: nothing required; a COI may be kept on file
            'receiver' => [
                $up('Insurance', 'coi', 'Certificate of insurance', false, null, true),
            ],
            default => [],
        };

        // What each item is checked against, and whether automatically or by review
        $items = array_map(fn ($i) => array_merge($i, \App\Support\ComplianceSources::for($i['key'])), $items);

        // Admin policy: off removes the item, deferred / optional stop it blocking
        return $policy
            ? array_values(array_filter(array_map(fn ($i) => \App\Services\VerificationPolicy::apply($o, $i), $items)))
            : $items;
    }

    private static function item(string $section, string $key, string $label, bool $required, $value,
                                 ?bool $verified = null, $expires = null, ?string $file = null): array
    {
        $has     = $value !== null && $value !== '';
        $expiry  = $expires ? Carbon::parse($expires) : null;
        $expired = $expiry?->isPast() ?? false;

        $state = !$has ? 'missing' : ($expired ? 'expired' : ($verified === false ? 'pending' : 'passed'));
        $detail = !$has ? null
            : ($expiry ? ($expired ? 'Expired ' : 'Expires ') . $expiry->toFormattedDateString()
            : ($verified === false ? 'Not verified yet' : null));

        return [
            'section'   => $section,
            'key'       => $key,
            'label'     => $label,
            'required'  => $required,
            'value'     => $has ? (string) $value : null,
            'verified'  => $verified,
            'expires'   => $expiry?->toDateString(),
            'file'      => $file,
            'state'     => $state,
            'detail'    => $detail,
            'upload'    => null,
        ];
    }

    private static function money($v): ?string
    {
        return $v !== null && $v !== '' ? '$' . number_format((float) $v) : null;
    }
}
