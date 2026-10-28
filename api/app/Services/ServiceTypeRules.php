<?php

namespace App\Services;

class ServiceTypeRules
{
    private const RULES = [
        // ── Freight & Logistics ───────────────────────────────────────────
        'general_freight'   => ['required' => ['dot_number', 'mc_number', 'company_name', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => ['cdl_number', 'usdot_number'], 'tabs' => ['dot_commercial', 'insurance']],
        'hotshot'           => ['required' => ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => ['company_name'], 'tabs' => ['dot_commercial', 'insurance']],
        'refrigerated'      => ['required' => ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => ['company_name'], 'tabs' => ['dot_commercial', 'insurance']],
        'flatbed'           => ['required' => ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => ['company_name'], 'tabs' => ['dot_commercial', 'insurance']],
        'dry_van'           => ['required' => ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => ['company_name'], 'tabs' => ['dot_commercial', 'insurance']],
        'hazmat'            => ['required' => ['dot_number', 'mc_number', 'cdl_number', 'hazmat_endorsement', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => ['hazmat_expiry_date', 'dot_medical_expiry'], 'tabs' => ['dot_commercial', 'insurance', 'medical']],

        // ── Auto & Vehicles ───────────────────────────────────────────────
        'auto_transport_open'     => ['required' => ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => ['company_name'], 'tabs' => ['dot_commercial', 'insurance']],
        'auto_transport_enclosed' => ['required' => ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => ['company_name'], 'tabs' => ['dot_commercial', 'insurance']],
        'rv_boat_powersports'     => ['required' => ['dot_number', 'auto_policy_number'], 'recommended' => ['mc_number', 'cargo_policy_number'], 'tabs' => ['dot_commercial', 'insurance']],

        // ── Cold Chain ────────────────────────────────────────────────────
        'cold_chain_food'   => ['required' => ['dot_number', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => [], 'tabs' => ['dot_commercial', 'insurance']],

        // ── Construction & Equipment ──────────────────────────────────────
        'heavy_equipment'       => ['required' => ['dot_number', 'mc_number', 'cdl_number', 'cdl_class', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => ['dot_medical_expiry'], 'tabs' => ['dot_commercial', 'insurance', 'medical']],
        'construction_materials'=> ['required' => ['dot_number', 'auto_policy_number'], 'recommended' => ['mc_number', 'cargo_policy_number'], 'tabs' => ['dot_commercial', 'insurance']],
        'oversized_load'        => ['required' => ['dot_number', 'mc_number', 'cdl_number', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => ['dot_medical_expiry'], 'tabs' => ['dot_commercial', 'insurance', 'medical']],
        'crane_rigging'         => ['required' => ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], 'recommended' => ['cdl_number'], 'tabs' => ['dot_commercial', 'insurance']],

    ];

    public static function requiredFields(array $keys): array
    {
        $fields = [];
        foreach ($keys as $key) $fields = array_merge($fields, self::RULES[$key]['required'] ?? []);
        return array_values(array_unique($fields));
    }

    public static function recommendedFields(array $keys): array
    {
        $fields = [];
        foreach ($keys as $key) $fields = array_merge($fields, self::RULES[$key]['recommended'] ?? []);
        return array_values(array_unique($fields));
    }

    public static function relevantTabs(array $keys): array
    {
        $tabs = ['personal'];
        foreach ($keys as $key) $tabs = array_merge($tabs, self::RULES[$key]['tabs'] ?? []);
        if (count($keys) > 0) { $tabs[] = 'financial'; $tabs[] = 'background'; }
        return array_values(array_unique($tabs));
    }

    public static function requiresDot(array $keys): bool
    {
        foreach ($keys as $key) {
            if (in_array('dot_number', self::RULES[$key]['required'] ?? [])) return true;
        }
        return false;
    }
}
