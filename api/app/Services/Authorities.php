<?php

namespace App\Services;

use App\Models\OperatingAuthority;
use App\Models\Organization;

/**
 * Bridge while profile forms still write authority fields on the company:
 * the company's primary carrier / broker authority follows those columns.
 */
class Authorities
{
    private const CARRIER_FIELDS = [
        'carrier_dot_number', 'carrier_mc_number', 'carrier_operating_country', 'carrier_operating_authority_number',
        'carrier_operating_authority_type', 'carrier_dot_verified', 'carrier_mc_verified',
        'carrier_auto_insurer_name', 'carrier_auto_policy_number', 'carrier_auto_coverage_amount', 'carrier_auto_expiry_date',
        'carrier_cargo_insurer_name', 'carrier_cargo_policy_number', 'carrier_cargo_coverage_amount', 'carrier_cargo_expiry_date',
    ];

    public static function syncFromOrg(Organization $o): void
    {
        if ($o->type === 'carrier' && ($o->wasRecentlyCreated || $o->wasChanged(self::CARRIER_FIELDS))
            && ($o->carrier_dot_number || $o->carrier_mc_number || $o->carrier_operating_authority_number)) {
            $a = $o->authorities()->where('kind', 'carrier')->where('is_primary', true)->first()
                ?? new OperatingAuthority(['org_id' => $o->id, 'kind' => 'carrier', 'is_primary' => true, 'status' => 'pending', 'source' => 'self']);
            $a->fill([
                'country' => $o->carrier_operating_country ?: 'US', 'dot_number' => $o->carrier_dot_number, 'mc_number' => $o->carrier_mc_number,
                'authority_number' => $o->carrier_operating_authority_number, 'authority_type' => $o->carrier_operating_authority_type,
                'auto_insurer_name' => $o->carrier_auto_insurer_name, 'auto_policy_number' => $o->carrier_auto_policy_number,
                'auto_coverage_amount' => $o->carrier_auto_coverage_amount, 'auto_expiry_date' => $o->carrier_auto_expiry_date,
                'cargo_insurer_name' => $o->carrier_cargo_insurer_name, 'cargo_policy_number' => $o->carrier_cargo_policy_number,
                'cargo_coverage_amount' => $o->carrier_cargo_coverage_amount, 'cargo_expiry_date' => $o->carrier_cargo_expiry_date,
            ]);
            // FMCSA lookup passed: active. Never demote one an admin set by hand.
            if (($o->carrier_dot_verified || $o->carrier_mc_verified) && $a->status === 'pending') {
                $a->status = 'active';
                $a->source = 'fmcsa';
                $a->verified_at ??= now();
            }
            $a->save();
        }

        if ($o->fmcsa_broker_mc && ($o->wasRecentlyCreated || $o->wasChanged('fmcsa_broker_mc'))) {
            $o->authorities()->updateOrCreate(['kind' => 'broker', 'is_primary' => true], ['mc_number' => $o->fmcsa_broker_mc]);
        }
    }
}
