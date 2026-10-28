<?php

namespace Database\Seeders;

use App\Models\ServiceType;
use Illuminate\Database\Seeder;

class ServiceTypeSeeder extends Seeder
{
    public function run(): void
    {
        // Wipe and re-seed cleanly
        \DB::statement('SET CONSTRAINTS ALL DEFERRED');
        ServiceType::query()->delete();

        $categories = [
            [
                'key'      => 'freight_logistics',
                'name'     => 'Freight & Logistics',
                'icon'     => '🚛',
                'category' => 'commercial',
                'sort_order' => 1,
                'children' => [
                    ['key' => 'general_freight',   'name' => 'General Freight (LTL / FTL)',        'requires_dot' => true,  'requires_mc' => true],
                    ['key' => 'hotshot',            'name' => 'Hotshot / Expedited',                'requires_dot' => true,  'requires_mc' => true],
                    ['key' => 'refrigerated',       'name' => 'Refrigerated / Temperature Controlled', 'requires_dot' => true, 'requires_mc' => true],
                    ['key' => 'flatbed',            'name' => 'Flatbed & Step Deck',               'requires_dot' => true,  'requires_mc' => true],
                    ['key' => 'dry_van',            'name' => 'Dry Van',                           'requires_dot' => true,  'requires_mc' => true],
                    ['key' => 'hazmat',             'name' => 'Hazardous Materials (HAZMAT)',       'requires_dot' => true,  'requires_mc' => true, 'requires_cdl' => true, 'requires_hazmat' => true],
                    ['key' => 'cold_chain_food',    'name' => 'Cold Chain / Perishables',          'requires_dot' => true],
                ],
            ],
            [
                'key'      => 'auto_vehicles',
                'name'     => 'Auto & Vehicles',
                'icon'     => '🚗',
                'category' => 'specialized',
                'sort_order' => 2,
                'children' => [
                    ['key' => 'auto_transport_open',     'name' => 'Auto Transport — Open Carrier',   'requires_dot' => true, 'requires_mc' => true],
                    ['key' => 'auto_transport_enclosed', 'name' => 'Auto Transport — Enclosed',       'requires_dot' => true, 'requires_mc' => true],
                    ['key' => 'rv_boat_powersports',     'name' => 'RV, Boat & Powersports',          'requires_dot' => true],
                ],
            ],
            [
                'key'      => 'construction_equipment',
                'name'     => 'Construction & Equipment',
                'icon'     => '🏗️',
                'category' => 'specialized',
                'sort_order' => 3,
                'children' => [
                    ['key' => 'heavy_equipment',  'name' => 'Heavy Equipment Transport', 'requires_dot' => true, 'requires_mc' => true, 'requires_cdl' => true],
                    ['key' => 'construction_materials', 'name' => 'Construction Materials', 'requires_dot' => true],
                    ['key' => 'oversized_load',   'name' => 'Oversized / Wide Load',     'requires_dot' => true, 'requires_mc' => true, 'requires_cdl' => true],
                    ['key' => 'crane_rigging',    'name' => 'Crane & Rigging',           'requires_dot' => true, 'requires_mc' => true],
                ],
            ],
        ];

        foreach ($categories as $i => $cat) {
            $children = $cat['children'];
            unset($cat['children']);

            $parent = ServiceType::create(array_merge([
                'parent_id'       => null,
                'description'     => null,
                'requires_dot'    => false,
                'requires_mc'     => false,
                'requires_cdl'    => false,
                'requires_hazmat' => false,
                'active'          => true,
            ], $cat));

            foreach ($children as $j => $child) {
                ServiceType::create(array_merge([
                    'parent_id'       => $parent->id,
                    'description'     => null,
                    'icon'            => null,
                    'category'        => $cat['category'],
                    'requires_dot'    => false,
                    'requires_mc'     => false,
                    'requires_cdl'    => false,
                    'requires_hazmat' => false,
                    'active'          => true,
                    'sort_order'      => $j + 1,
                ], $child));
            }
        }
    }
}
