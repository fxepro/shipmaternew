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
        $up = function (string $section, string $key, string $label, bool $required, ?string $valueLabel = null, bool $expires = false, bool $valueOnly = false) use ($stored, $file) {
            $row  = $stored->get($key);
            $has  = $row?->file_path || ($valueOnly && filled($row?->value));
            $item = self::item($section, $key, $label, $required,
                $has ? ($row->value ?: ($row->file_name ?: 'On file')) : null,
                $row?->file_path ? (bool) $row->verified_at : null, $row?->expires_at, $file($row?->file_path));
            return array_merge($item, ['upload' => ['value_label' => $valueLabel, 'expires' => $expires, 'value_only' => $valueOnly], 'value_raw' => $row?->value]);
        };

        $items = match ($o->type) {
            'carrier' => [
                self::item('Operating authority', 'dot_number', 'DOT #', true, $o->carrier_dot_number, (bool) $o->carrier_dot_verified),
                self::item('Operating authority', 'mc_number', 'MC #', false, $o->carrier_mc_number, (bool) $o->carrier_mc_verified),
                self::item('Operating authority', 'authority_type', 'Authority type', false, $o->carrier_operating_authority_type ? ucwords(str_replace('_', ' ', $o->carrier_operating_authority_type)) : null),
                self::item('Operating authority', 'authority_number', 'Authority #', false, $o->carrier_operating_authority_number),
                self::item('Auto liability insurance', 'auto_insurance', 'Auto liability policy', true,
                    $o->carrier_auto_insurer_name ? trim("{$o->carrier_auto_insurer_name} · {$o->carrier_auto_policy_number}", ' ·') : null,
                    (bool) $o->carrier_insurance_verified, $o->carrier_auto_expiry_date),
                self::item('Auto liability insurance', 'auto_coverage', 'Coverage', false, self::money($o->carrier_auto_coverage_amount)),
                self::item('Cargo insurance', 'cargo_insurance', 'Cargo policy', false,
                    $o->carrier_cargo_insurer_name ? trim("{$o->carrier_cargo_insurer_name} · {$o->carrier_cargo_policy_number}", ' ·') : null,
                    null, $o->carrier_cargo_expiry_date),
                self::item('Cargo insurance', 'cargo_coverage', 'Coverage', false, self::money($o->carrier_cargo_coverage_amount)),
            ],
            // To post loads: EIN, W-9, an authorized signer (address, payment method and terms are checked elsewhere).
            // Special freight: only when a load needs it; posting such a load asks for what is missing.
            'shipper' => [
                self::item('Business', 'ein', 'EIN', true, $o->tax_id, (bool) $o->shipper_ein_verified_at),
                $up('Business', 'w9', 'W-9', true),
                $up('Business', 'authorized_signer', 'Authorized signer', true, 'Name and title', false, true),
                self::item('Insurance', 'coi', 'Certificate of insurance', false, $o->shipper_coi_url ? 'On file' : null, null, $o->shipper_coi_expiry, $file($o->shipper_coi_url)),
                self::item('Special freight', 'hazmat_reg', 'HazMat registration (PHMSA)', false, $o->shipper_hazmat_reg_url ? 'On file' : null, null, $o->shipper_hazmat_reg_expiry, $file($o->shipper_hazmat_reg_url)),
                $up('Special freight', 'hazmat_training', 'Hazmat training certificate (49 CFR 172.704)', false, null, true),
                $up('Special freight', 'emergency_phone', '24-hour hazmat emergency phone', false, 'Phone number', false, true),
                $up('Special freight', 'ttb_atf_permit', 'TTB or ATF permit (alcohol, tobacco, firearms)', false, 'Permit #', true),
                self::item('Special freight', 'hipaa_baa', 'HIPAA BAA', false, $o->shipper_hipaa_baa_url ? 'On file' : null, null, $o->shipper_hipaa_baa_expiry, $file($o->shipper_hipaa_baa_url)),
                self::item('Government', 'sam_gov', 'SAM.gov #', false, $o->sam_gov_number),
            ],
            'factor' => [
                self::item('Business', 'ein', 'EIN / legal entity', true, $o->tax_id),
                $up('Business', 'w9', 'W-9', true),
                $up('Licensing', 'factoring_license', 'State factoring licence (where required)', false, 'Licence #', true),
                $up('Factoring', 'noa_template', 'NOA template', false),
                self::item('Money', 'bank', 'Bank account verified', true, $o->bank_last4 ? trim(($o->bank_name ?? 'Bank') . ' ···' . $o->bank_last4) : null,
                    $o->bank_last4 ? in_array($o->stripe_connect_status, ['active', 'verified'], true) : null),
            ],
            'broker' => [
                self::item('Authority', 'broker_mc', 'Broker MC authority', true, $o->fmcsa_broker_mc),
                $up('Authority', 'surety_bond', 'BMC-84/85 surety bond ($75,000)', true, 'Bond #'),
                $up('Insurance', 'contingent_cargo', 'Contingent cargo insurance', false, 'Insurer / policy #', true),
                $up('Business', 'w9', 'W-9', true),
            ],
            // Receivers: nothing required; a COI may be kept on file
            'receiver' => [
                $up('Insurance', 'coi', 'Certificate of insurance', false, null, true),
            ],
            default => [],
        };

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
