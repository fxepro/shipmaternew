<?php

namespace App\Support;

/**
 * What a company is in the directory. A company can be several (a 3PL that brokers and runs warehouses).
 * organizations.type is separate: the role it plays on Shipmater, which drives its pages and permissions.
 */
class OrgCategories
{
    public const ALL = [
        'trucking_company'    => ['Trucking company', 'Carriers and fleets'],
        'owner_operator'      => ['Owner-operator', 'Carriers and fleets'],
        'private_fleet'       => ['Private fleet', 'Carriers and fleets'],
        'freight_broker'      => ['Freight broker', 'Intermediaries'],
        '3pl'                 => ['3PL', 'Intermediaries'],
        'freight_forwarder'   => ['Freight forwarder', 'Intermediaries'],
        'dispatch_service'    => ['Dispatch service', 'Intermediaries'],
        'intermodal_provider' => ['Intermodal provider', 'Intermediaries'],
        'shipper'             => ['Shipper', 'Customers'],
        'receiver'            => ['Receiver', 'Customers'],
        'warehouse'           => ['Warehouse / distribution center', 'Facilities'],
        'cross_dock'          => ['Cross-dock / transload', 'Facilities'],
        'terminal'            => ['Port, rail yard or terminal', 'Facilities'],
        'equipment_provider'  => ['Truck, trailer or container provider', 'Services'],
        'maintenance'         => ['Maintenance and repair', 'Services'],
        'financial'           => ['Factoring, lending and financing', 'Services'],
        'insurance'           => ['Insurance', 'Services'],
        'compliance'          => ['DOT, CDL and safety compliance', 'Services'],
        'training'            => ['CDL school / training', 'Services'],
        'technology'          => ['TMS, ELD, GPS and fleet software', 'Services'],
    ];

    public static function keys(): array
    {
        return array_keys(self::ALL);
    }

    public static function catalog(): array
    {
        return collect(self::ALL)->map(fn ($v, $k) => ['key' => $k, 'name' => $v[0], 'group' => $v[1]])->values()->all();
    }
}
