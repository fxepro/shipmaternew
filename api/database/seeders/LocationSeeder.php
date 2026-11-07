<?php

namespace Database\Seeders;

use App\Models\Location;
use App\Models\User;
use Illuminate\Database\Seeder;

class LocationSeeder extends Seeder
{
    public function run(): void
    {
        $shipper = User::where('email', 'alex@demo.com')->first();
        if (!$shipper) return;

        // Locations belong to the shipper company
        $orgId = $shipper->current_org_id;
        if (!$orgId || Location::where('org_id', $orgId)->exists()) return;

        // ── Pickup / Warehouse addresses ──────────────────────────────────

        $pickups = [
            [
                'name'             => 'Chicago Distribution Center',
                'address'          => '1200 S Canal St',
                'city'             => 'Chicago',
                'state'            => 'IL',
                'zip'              => '60607',
                'lat'              => 41.8631,
                'lng'              => -87.6395,
                'contact_name'     => 'Mike Torres',
                'contact_phone'    => '+1 312 555 0101',
                'operating_hours'  => ['mon'=>'06:00-18:00','tue'=>'06:00-18:00','wed'=>'06:00-18:00','thu'=>'06:00-18:00','fri'=>'06:00-18:00'],
                'notes'            => 'Use Gate B. Call 30 min ahead.',
                'is_default'       => true,
                'usage_count'      => 14,
            ],
            [
                'name'             => 'Chicago Warehouse B',
                'address'          => '456 W Lake St',
                'city'             => 'Chicago',
                'state'            => 'IL',
                'zip'              => '60601',
                'lat'              => 41.8858,
                'lng'              => -87.6429,
                'contact_name'     => 'Sandra Lee',
                'contact_phone'    => '+1 312 555 0102',
                'operating_hours'  => ['mon'=>'07:00-17:00','tue'=>'07:00-17:00','wed'=>'07:00-17:00','thu'=>'07:00-17:00','fri'=>'07:00-15:00'],
                'notes'            => 'Loading dock on south side.',
                'is_default'       => false,
                'usage_count'      => 8,
            ],
            [
                'name'             => 'Aurora Fulfillment Hub',
                'address'          => '800 N Farnsworth Ave',
                'city'             => 'Aurora',
                'state'            => 'IL',
                'zip'              => '60505',
                'lat'              => 41.7606,
                'lng'              => -88.3201,
                'contact_name'     => 'James Park',
                'contact_phone'    => '+1 630 555 0201',
                'operating_hours'  => ['mon'=>'07:00-19:00','tue'=>'07:00-19:00','wed'=>'07:00-19:00','thu'=>'07:00-19:00','fri'=>'07:00-17:00','sat'=>'08:00-14:00'],
                'notes'            => null,
                'is_default'       => false,
                'usage_count'      => 3,
            ],
        ];

        // ── Delivery / Customer addresses ─────────────────────────────────

        $deliveries = [
            [
                'name'             => 'Milwaukee Customer — Main',
                'address'          => '789 N Broadway',
                'city'             => 'Milwaukee',
                'state'            => 'WI',
                'zip'              => '53202',
                'lat'              => 43.0389,
                'lng'              => -87.9065,
                'contact_name'     => 'Rachel Chen',
                'contact_phone'    => '+1 414 555 0301',
                'operating_hours'  => ['mon'=>'09:00-17:00','tue'=>'09:00-17:00','wed'=>'09:00-17:00','thu'=>'09:00-17:00','fri'=>'09:00-15:00'],
                'notes'            => null,
                'is_default'       => false,
                'usage_count'      => 11,
            ],
            [
                'name'             => 'Green Bay Retail Store',
                'address'          => '321 E Walnut St',
                'city'             => 'Green Bay',
                'state'            => 'WI',
                'zip'              => '54301',
                'lat'              => 44.5133,
                'lng'              => -88.0133,
                'contact_name'     => 'Tom Bradley',
                'contact_phone'    => '+1 920 555 0401',
                'operating_hours'  => ['mon'=>'08:00-18:00','tue'=>'08:00-18:00','wed'=>'08:00-18:00','thu'=>'08:00-18:00','fri'=>'08:00-18:00','sat'=>'10:00-16:00'],
                'notes'            => 'Receiving dock around back.',
                'is_default'       => false,
                'usage_count'      => 9,
            ],
            [
                'name'             => 'Madison Distribution',
                'address'          => '555 E Washington Ave',
                'city'             => 'Madison',
                'state'            => 'WI',
                'zip'              => '53703',
                'lat'              => 43.0731,
                'lng'              => -89.3837,
                'contact_name'     => 'Lisa Nguyen',
                'contact_phone'    => '+1 608 555 0501',
                'operating_hours'  => ['mon'=>'07:00-16:00','tue'=>'07:00-16:00','wed'=>'07:00-16:00','thu'=>'07:00-16:00','fri'=>'07:00-15:00'],
                'notes'            => null,
                'is_default'       => false,
                'usage_count'      => 6,
            ],
            [
                'name'             => 'Rockford Supply Co.',
                'address'          => '123 S Main St',
                'city'             => 'Rockford',
                'state'            => 'IL',
                'zip'              => '61101',
                'lat'              => 42.2711,
                'lng'              => -89.0940,
                'contact_name'     => 'Dave Foster',
                'contact_phone'    => '+1 815 555 0601',
                'operating_hours'  => ['mon'=>'08:00-17:00','tue'=>'08:00-17:00','wed'=>'08:00-17:00','thu'=>'08:00-17:00','fri'=>'08:00-16:00'],
                'notes'            => null,
                'is_default'       => false,
                'usage_count'      => 4,
            ],
            [
                'name'             => 'Indianapolis Depot',
                'address'          => '400 S Meridian St',
                'city'             => 'Indianapolis',
                'state'            => 'IN',
                'zip'              => '46225',
                'lat'              => 39.7684,
                'lng'              => -86.1581,
                'contact_name'     => 'Priya Patel',
                'contact_phone'    => '+1 317 555 0701',
                'operating_hours'  => ['mon'=>'07:00-17:00','tue'=>'07:00-17:00','wed'=>'07:00-17:00','thu'=>'07:00-17:00','fri'=>'07:00-16:00'],
                'notes'            => 'Gate access code: 4892',
                'is_default'       => false,
                'usage_count'      => 2,
            ],
        ];

        foreach ($pickups as $data) {
            Location::create(array_merge($data, [
                'org_id'     => $orgId,
                'country'    => 'US',
            ]));
        }

        foreach ($deliveries as $data) {
            Location::create(array_merge($data, [
                'org_id'     => $orgId,
                'country'    => 'US',
                'visibility' => 'private',   // the shipper's own customer addresses
            ]));
        }
    }
}
