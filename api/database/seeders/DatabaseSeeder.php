<?php

namespace Database\Seeders;

use App\Models\CarrierProfile;
use App\Models\Contract;
use App\Models\ShipperProfile;
use App\Models\GpsPing;
use App\Models\PaymentMethod;
use App\Models\PreferredCarrier;
use App\Models\Shipment;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Demo users ────────────────────────────────────────────────────

        // Plain 'password' — User model casts password as 'hashed' (do not Hash::make here).
        $shipper = User::updateOrCreate(
            ['email' => 'alex@demo.com'],
            ['name' => 'Alex Morgan', 'password' => 'password', 'role' => 'shipper']
        );

        $carrier1 = User::updateOrCreate(
            ['email' => 'jordan@demo.com'],
            ['name' => 'Jordan Reyes', 'password' => 'password', 'role' => 'carrier']
        );

        $carrier2 = User::updateOrCreate(
            ['email' => 'casey@demo.com'],
            ['name' => 'Casey Rivera', 'password' => 'password', 'role' => 'carrier']
        );

        $carrier3 = User::updateOrCreate(
            ['email' => 'marcus@demo.com'],
            ['name' => 'Marcus Webb', 'password' => 'password', 'role' => 'carrier']
        );

        $receiver = User::updateOrCreate(
            ['email' => 'sam@demo.com'],
            ['name' => 'Sam Chen', 'password' => 'password', 'role' => 'receiver']
        );

        User::updateOrCreate(
            ['email' => 'admin@demo.com'],
            ['name' => 'Admin User', 'password' => 'password', 'role' => 'admin']
        );

        // Factoring company: a company of its own, no Shipmater approval (docs/noa-factoring.md)
        $factor = User::updateOrCreate(
            ['email' => 'dana@demo.com'],
            ['name' => 'Dana Brooks', 'password' => 'password', 'role' => 'factor']
        );
        $factorOrg = \App\Models\Organization::firstOrCreate(
            ['owner_id' => $factor->id, 'type' => 'factor'],
            [
                'name' => 'Summit Freight Capital LLC', 'slug' => 'summit-freight-capital', 'status' => 'active',
                'verification_status' => 'not_required',
                'phone' => '+1 (555) 010-7788', 'email' => 'noa@summitfreightcapital.test',
                'street' => '400 Commerce St', 'city' => 'Dallas', 'state' => 'TX', 'zip' => '75202', 'country' => 'US',
                'tax_id' => '84-1234567',
            ]
        );
        \App\Models\OrgMember::firstOrCreate(
            ['org_id' => $factorOrg->id, 'user_id' => $factor->id],
            ['role' => 'owner', 'status' => 'active', 'joined_at' => now()]
        );
        $factor->update(['current_org_id' => $factorOrg->id]);

        // ── Carrier profiles ──────────────────────────────────────────────

        CarrierProfile::firstOrCreate(
            ['user_id' => $carrier1->id],
            [
                'company_name'            => 'Reyes Transport LLC',
                'phone'                   => '+1 (555) 010-2030',
                'dot_number'              => '3842910',
                'dot_verified'            => true,
                'mc_number'               => 'MC-291847',
                'insurance_verified'      => true,
                'background_check_status' => 'approved',
                'rating'                  => 4.90,
                'total_deliveries'        => 284,
            ]
        );

        CarrierProfile::firstOrCreate(
            ['user_id' => $carrier2->id],
            [
                'company_name'            => 'CRR Freight Inc',
                'phone'                   => '+1 (555) 874-3310',
                'dot_number'              => '4821055',
                'dot_verified'            => true,
                'mc_number'               => 'MC-482100',
                'insurance_verified'      => true,
                'background_check_status' => 'approved',
                'rating'                  => 4.70,
                'total_deliveries'        => 156,
            ]
        );

        CarrierProfile::firstOrCreate(
            ['user_id' => $carrier3->id],
            [
                'company_name'            => 'Webb Transport Co.',
                'phone'                   => '+1 (214) 555-0777',
                'dot_number'              => '2910483',
                'dot_verified'            => false,
                'mc_number'               => 'MC-511092',
                'insurance_verified'      => false,
                'background_check_status' => 'pending',
                'rating'                  => 4.50,
                'total_deliveries'        => 44,
            ]
        );

        // ── Shipper profile for Alex Morgan ──────────────────────────────────

        ShipperProfile::updateOrCreate(
            ['user_id' => $shipper->id],
            [
                'phone'         => '+1 (555) 248-3910',
                'street'        => '3600 Brighton Blvd',
                'city'          => 'Denver',
                'state'         => 'CO',
                'zip'           => '80216',
                'country'       => 'United States',
                'company_name'  => 'Morgan Freight Co.',
                'business_type' => 'Limited Liability Company (LLC)',
                'ein'           => '82-4910372',
                'industry'      => 'Manufacturing',
                'website'       => 'https://morganfreight.com',
                'biz_street'    => '3600 Brighton Blvd',
                'biz_city'      => 'Denver',
                'biz_state'     => 'CO',
                'biz_zip'       => '80216',
                'verification_status' => 'incomplete',
                'email_verified_at'   => null,
                'phone_verified_at'   => null,
                'ein_verified_at'     => null,
                'notif_email'   => [
                    'carrier_assigned' => true,
                    'pickup_confirmed'  => true,
                    'in_transit'        => true,
                    'delivered'         => true,
                    'disputed'          => true,
                    'weekly_summary'    => false,
                    'marketing'         => false,
                ],
                'notif_sms' => [
                    'carrier_assigned' => false,
                    'pickup_confirmed'  => true,
                    'in_transit'        => false,
                    'delivered'         => true,
                    'disputed'          => true,
                ],
            ]
        );

        // ── Helper ────────────────────────────────────────────────────────
        // Adds a single GPS ping to a shipment if it has none yet

        $ping = function (Shipment $s, float $lat, float $lng, float $speed, string $eta) {
            if (GpsPing::where('shipment_id', $s->id)->doesntExist()) {
                GpsPing::create([
                    'shipment_id' => $s->id,
                    'lat'         => $lat,
                    'lng'         => $lng,
                    'speed'       => $speed,
                    'eta'         => $eta,
                    'pinged_at'   => now()->subMinutes(rand(1, 4)),
                ]);
            }
        };

        // ══════════════════════════════════════════════════════════════════
        // DEMO0001 — Long-haul: Denver → Dallas  (existing, in_transit)
        // ══════════════════════════════════════════════════════════════════

        $s1 = Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0001'],
            [
                'shipper_id'              => $shipper->id,
                'carrier_id'              => $carrier1->id,
                'receiver_id'             => $receiver->id,
                'status'                  => 'in_transit',
                'item_description'        => 'Pallet of surgical instruments',
                'item_category'           => 'Medical / Healthcare',
                'weight_lbs'              => 340.00,
                'handling_requirements'   => ['Fragile', 'Temperature Controlled'],
                'special_notes'           => 'Handle with care — medical equipment',
                'pickup_address'          => '1700 Lincoln St, Denver, CO 80203',
                'pickup_city'             => 'Denver',
                'pickup_state'            => 'CO',
                'pickup_lat'              => 39.73915,
                'pickup_lng'              => -104.98470,
                'pickup_date'             => '2026-06-10',
                'pickup_time_window'      => '8am – 11am',
                'delivery_address'        => '2100 Ross Ave, Dallas, TX 75201',
                'delivery_city'           => 'Dallas',
                'delivery_state'          => 'TX',
                'delivery_lat'            => 32.78306,
                'delivery_lng'            => -96.80667,
                'delivery_date'           => '2026-06-11',
                'delivery_time_window'    => '1pm – 5pm',
                'distance_miles'          => 795.60,
                'estimated_duration_mins' => 864,
                'agreed_cost'             => 1250.00,
            ]
        );
        // Near Amarillo, TX — truck is ~3/4 of the way
        $ping($s1, 35.2220, -101.8313, 68.0, '2:30 PM');

        // ══════════════════════════════════════════════════════════════════
        // DEMO0002 — Long-haul: Denver → Los Angeles  (in_transit)
        // ══════════════════════════════════════════════════════════════════

        $s2 = Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0002'],
            [
                'shipper_id'              => $shipper->id,
                'carrier_id'              => $carrier2->id,
                'receiver_id'             => $receiver->id,
                'status'                  => 'in_transit',
                'item_description'        => 'Auto parts — engine blocks',
                'item_category'           => 'Automotive',
                'weight_lbs'              => 1840.00,
                'handling_requirements'   => ['Heavy Load', 'Strapped'],
                'special_notes'           => 'Two engine blocks on skids',
                'pickup_address'          => '3600 Brighton Blvd, Denver, CO 80216',
                'pickup_city'             => 'Denver',
                'pickup_state'            => 'CO',
                'pickup_lat'              => 39.76800,
                'pickup_lng'              => -104.97200,
                'pickup_date'             => '2026-06-10',
                'pickup_time_window'      => '6am – 9am',
                'delivery_address'        => '1600 S Alameda St, Los Angeles, CA 90021',
                'delivery_city'           => 'Los Angeles',
                'delivery_state'          => 'CA',
                'delivery_lat'            => 34.03500,
                'delivery_lng'            => -118.24000,
                'delivery_date'           => '2026-06-11',
                'delivery_time_window'    => '10am – 2pm',
                'distance_miles'          => 1021.40,
                'estimated_duration_mins' => 1080,
                'agreed_cost'             => 1875.00,
            ]
        );
        // Near Grand Junction, CO — crossing into Utah
        $ping($s2, 39.0639, -108.5506, 72.0, '6:45 PM');

        // ══════════════════════════════════════════════════════════════════
        // DEMO0003 — Long-haul: Chicago → Houston  (in_transit)
        // ══════════════════════════════════════════════════════════════════

        $s3 = Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0003'],
            [
                'shipper_id'              => $shipper->id,
                'carrier_id'              => $carrier1->id,
                'receiver_id'             => $receiver->id,
                'status'                  => 'in_transit',
                'item_description'        => 'Restaurant kitchen equipment',
                'item_category'           => 'Commercial Kitchen',
                'weight_lbs'              => 2200.00,
                'handling_requirements'   => ['Keep Upright', 'No Stack'],
                'pickup_address'          => '1800 W 35th St, Chicago, IL 60609',
                'pickup_city'             => 'Chicago',
                'pickup_state'            => 'IL',
                'pickup_lat'              => 41.83200,
                'pickup_lng'              => -87.67400,
                'pickup_date'             => '2026-06-09',
                'pickup_time_window'      => 'All day',
                'delivery_address'        => '4200 Westheimer Rd, Houston, TX 77027',
                'delivery_city'           => 'Houston',
                'delivery_state'          => 'TX',
                'delivery_lat'            => 29.73900,
                'delivery_lng'            => -95.46200,
                'delivery_date'           => '2026-06-11',
                'delivery_time_window'    => 'Morning (8am – 12pm)',
                'distance_miles'          => 1086.20,
                'estimated_duration_mins' => 1140,
                'agreed_cost'             => 2100.00,
            ]
        );
        // Near Springfield, MO — roughly halfway
        $ping($s3, 37.2089, -93.2923, 65.0, 'Tomorrow 9:00 AM');

        // ══════════════════════════════════════════════════════════════════
        // DEMO0004 — Local Dallas: Deep Ellum → Medical District  (in_transit)
        // ══════════════════════════════════════════════════════════════════

        $s4 = Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0004'],
            [
                'shipper_id'              => $shipper->id,
                'carrier_id'              => $carrier2->id,
                'status'                  => 'in_transit',
                'item_description'        => 'Lab specimen cooler — urgent',
                'item_category'           => 'Medical / Healthcare',
                'weight_lbs'              => 48.00,
                'handling_requirements'   => ['Fragile', 'Temperature Controlled', 'Priority'],
                'special_notes'           => 'Time-sensitive biological samples. Must arrive within 2 hours.',
                'pickup_address'          => '2548 Elm St, Dallas, TX 75226',
                'pickup_city'             => 'Dallas',
                'pickup_state'            => 'TX',
                'pickup_lat'              => 32.78420,
                'pickup_lng'              => -96.78800,
                'pickup_date'             => '2026-06-11',
                'pickup_time_window'      => 'Immediate',
                'delivery_address'        => '5323 Harry Hines Blvd, Dallas, TX 75235',
                'delivery_city'           => 'Dallas',
                'delivery_state'          => 'TX',
                'delivery_lat'            => 32.81260,
                'delivery_lng'            => -96.84350,
                'delivery_date'           => '2026-06-11',
                'delivery_time_window'    => 'ASAP',
                'distance_miles'          => 5.20,
                'estimated_duration_mins' => 18,
                'agreed_cost'             => 95.00,
            ]
        );
        // Midway through Dallas — near Uptown
        $ping($s4, 32.79800, -96.81200, 27.0, '14 min');

        // ══════════════════════════════════════════════════════════════════
        // DEMO0005 — Local NYC: Penn Station → JFK Airport  (in_transit)
        // ══════════════════════════════════════════════════════════════════

        $s5 = Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0005'],
            [
                'shipper_id'              => $shipper->id,
                'carrier_id'              => $carrier1->id,
                'status'                  => 'in_transit',
                'item_description'        => 'Film production equipment',
                'item_category'           => 'Entertainment / AV',
                'weight_lbs'              => 620.00,
                'handling_requirements'   => ['Fragile', 'Delicate Electronics'],
                'pickup_address'          => '355 W 34th St, New York, NY 10001',
                'pickup_city'             => 'New York',
                'pickup_state'            => 'NY',
                'pickup_lat'              => 40.75070,
                'pickup_lng'              => -73.99350,
                'pickup_date'             => '2026-06-11',
                'pickup_time_window'      => '6am – 8am',
                'delivery_address'        => 'JFK Airport, Terminal 4, Jamaica, NY 11430',
                'delivery_city'           => 'New York',
                'delivery_state'          => 'NY',
                'delivery_lat'            => 40.64130,
                'delivery_lng'            => -73.77810,
                'delivery_date'           => '2026-06-11',
                'delivery_time_window'    => 'Before 10am',
                'distance_miles'          => 19.70,
                'estimated_duration_mins' => 55,
                'agreed_cost'             => 280.00,
            ]
        );
        // Jamaica, Queens — almost at JFK
        $ping($s5, 40.70110, -73.81800, 34.0, '22 min');

        // ══════════════════════════════════════════════════════════════════
        // DEMO0006 — Local Dallas zigzag: Warehouse loop  (in_transit)
        //   Multiple stops through industrial Dallas — good route-planner fuel
        // ══════════════════════════════════════════════════════════════════

        $s6 = Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0006'],
            [
                'shipper_id'              => $shipper->id,
                'carrier_id'              => $carrier2->id,
                'status'                  => 'in_transit',
                'item_description'        => 'HVAC units — multi-site install',
                'item_category'           => 'Construction / HVAC',
                'weight_lbs'              => 3100.00,
                'handling_requirements'   => ['Heavy Load', 'Crane Required at Delivery'],
                'special_notes'           => 'First drop: West Commerce St. Second drop: Stemmons Fwy site.',
                'pickup_address'          => '101 Singleton Blvd, Dallas, TX 75212',
                'pickup_city'             => 'Dallas',
                'pickup_state'            => 'TX',
                'pickup_lat'              => 32.77760,
                'pickup_lng'              => -96.87580,
                'pickup_date'             => '2026-06-11',
                'pickup_time_window'      => '7am – 9am',
                'delivery_address'        => '2626 Stemmons Fwy, Dallas, TX 75207',
                'delivery_city'           => 'Dallas',
                'delivery_state'          => 'TX',
                'delivery_lat'            => 32.80120,
                'delivery_lng'            => -96.86400,
                'delivery_date'           => '2026-06-11',
                'delivery_time_window'    => 'Before noon',
                'distance_miles'          => 3.80,
                'estimated_duration_mins' => 22,
                'agreed_cost'             => 210.00,
            ]
        );
        // Mid-route on Commerce St
        $ping($s6, 32.78990, -96.87000, 18.0, '8 min');

        // ══════════════════════════════════════════════════════════════════
        // DEMO0007 — Local LA zigzag: Studio City → Santa Monica  (assigned)
        // ══════════════════════════════════════════════════════════════════

        Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0007'],
            [
                'shipper_id'         => $shipper->id,
                'carrier_id'         => $carrier1->id,
                'status'             => 'assigned',
                'item_description'   => 'Film set props — breakables',
                'item_category'      => 'Entertainment / Props',
                'weight_lbs'         => 190.00,
                'handling_requirements' => ['Fragile', 'No Stack'],
                'pickup_address'     => '11040 Ventura Blvd, Studio City, CA 91604',
                'pickup_city'        => 'Studio City',
                'pickup_state'       => 'CA',
                'pickup_lat'         => 34.13920,
                'pickup_lng'         => -118.39750,
                'pickup_date'        => '2026-06-12',
                'pickup_time_window' => '8am – 10am',
                'delivery_address'   => '1333 Ocean Ave, Santa Monica, CA 90401',
                'delivery_city'      => 'Santa Monica',
                'delivery_state'     => 'CA',
                'delivery_lat'       => 34.01950,
                'delivery_lng'       => -118.49120,
                'delivery_date'      => '2026-06-12',
                'delivery_time_window' => 'Before 1pm',
                'distance_miles'     => 20.30,
                'estimated_duration_mins' => 48,
                'agreed_cost'        => 175.00,
            ]
        );

        // ══════════════════════════════════════════════════════════════════
        // DEMO0008 — Mid-haul: Seattle → Portland  (assigned)
        // ══════════════════════════════════════════════════════════════════

        Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0008'],
            [
                'shipper_id'         => $shipper->id,
                'carrier_id'         => $carrier2->id,
                'status'             => 'assigned',
                'item_description'   => 'Furniture — home relocation',
                'item_category'      => 'Household Goods',
                'weight_lbs'         => 4200.00,
                'handling_requirements' => ['Wrap Items', 'No Tipping'],
                'pickup_address'     => '1800 Airport Way S, Seattle, WA 98134',
                'pickup_city'        => 'Seattle',
                'pickup_state'       => 'WA',
                'pickup_lat'         => 47.57600,
                'pickup_lng'         => -122.32800,
                'pickup_date'        => '2026-06-13',
                'pickup_time_window' => '9am – 12pm',
                'delivery_address'   => '200 SW Market St, Portland, OR 97201',
                'delivery_city'      => 'Portland',
                'delivery_state'     => 'OR',
                'delivery_lat'       => 45.52100,
                'delivery_lng'       => -122.67900,
                'delivery_date'      => '2026-06-13',
                'delivery_time_window' => '2pm – 6pm',
                'distance_miles'     => 174.80,
                'estimated_duration_mins' => 210,
                'agreed_cost'        => 640.00,
            ]
        );

        // ══════════════════════════════════════════════════════════════════
        // DEMO0009 — Long-haul: Miami → Atlanta  (pending, no carrier yet)
        // ══════════════════════════════════════════════════════════════════

        Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0009'],
            [
                'shipper_id'         => $shipper->id,
                'status'             => 'pending',
                'item_description'   => 'Pharmaceutical cold-chain shipment',
                'item_category'      => 'Medical / Pharmaceutical',
                'weight_lbs'         => 780.00,
                'handling_requirements' => ['Refrigerated', 'Temperature Controlled', 'Time-Sensitive'],
                'special_notes'      => 'Must maintain 2–8°C at all times. Carrier must have reefer unit.',
                'pickup_address'     => '1901 NW 7th Ave, Miami, FL 33136',
                'pickup_city'        => 'Miami',
                'pickup_state'       => 'FL',
                'pickup_lat'         => 25.79100,
                'pickup_lng'         => -80.20200,
                'pickup_date'        => '2026-06-14',
                'pickup_time_window' => '7am – 9am',
                'delivery_address'   => '1600 Clifton Rd NE, Atlanta, GA 30329',
                'delivery_city'      => 'Atlanta',
                'delivery_state'     => 'GA',
                'delivery_lat'       => 33.79700,
                'delivery_lng'       => -84.32600,
                'delivery_date'      => '2026-06-14',
                'delivery_time_window' => '4pm – 7pm',
                'distance_miles'     => 661.30,
                'estimated_duration_mins' => 720,
                'agreed_cost'        => 1400.00,
            ]
        );

        // ══════════════════════════════════════════════════════════════════
        // DEMO0010 — Local Houston zigzag: IAH Airport → Texas Medical Center
        //   (pending — carrier shopping)
        // ══════════════════════════════════════════════════════════════════

        Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0010'],
            [
                'shipper_id'         => $shipper->id,
                'status'             => 'pending',
                'item_description'   => 'MRI machine components',
                'item_category'      => 'Medical Equipment',
                'weight_lbs'         => 5600.00,
                'handling_requirements' => ['Oversize Load', 'Fragile', 'Crane Required'],
                'special_notes'      => 'Oversized load — permit required. Magnetic shielding in crates.',
                'pickup_address'     => '2800 N Terminal Rd, Houston, TX 77032',
                'pickup_city'        => 'Houston',
                'pickup_state'       => 'TX',
                'pickup_lat'         => 29.99020,
                'pickup_lng'         => -95.33680,
                'pickup_date'        => '2026-06-15',
                'pickup_time_window' => '5am – 7am (off-peak)',
                'delivery_address'   => '6431 Fannin St, Houston, TX 77030',
                'delivery_city'      => 'Houston',
                'delivery_state'     => 'TX',
                'delivery_lat'       => 29.70980,
                'delivery_lng'       => -95.39830,
                'delivery_date'      => '2026-06-15',
                'delivery_time_window' => '8am – 10am',
                'distance_miles'     => 23.60,
                'estimated_duration_mins' => 55,
                'agreed_cost'        => 950.00,
            ]
        );

        // ══════════════════════════════════════════════════════════════════
        // DEMO0011 — Long-haul: Boston → New York  (delivered ✓)
        // ══════════════════════════════════════════════════════════════════

        Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0011'],
            [
                'shipper_id'         => $shipper->id,
                'carrier_id'         => $carrier1->id,
                'receiver_id'        => $receiver->id,
                'status'             => 'delivered',
                'item_description'   => 'Art gallery installation',
                'item_category'      => 'Fine Art',
                'weight_lbs'         => 510.00,
                'handling_requirements' => ['White Glove', 'Climate Controlled', 'Fragile'],
                'special_notes'      => 'Museum-quality crating required.',
                'pickup_address'     => '465 Huntington Ave, Boston, MA 02115',
                'pickup_city'        => 'Boston',
                'pickup_state'       => 'MA',
                'pickup_lat'         => 42.33900,
                'pickup_lng'         => -71.09400,
                'pickup_date'        => '2026-06-08',
                'pickup_time_window' => '10am – 12pm',
                'delivery_address'   => '1000 5th Ave, New York, NY 10028',
                'delivery_city'      => 'New York',
                'delivery_state'     => 'NY',
                'delivery_lat'       => 40.77970,
                'delivery_lng'       => -73.96330,
                'delivery_date'      => '2026-06-09',
                'delivery_time_window' => '9am – 11am',
                'distance_miles'     => 215.40,
                'estimated_duration_mins' => 255,
                'agreed_cost'        => 890.00,
                'delivered_at'       => '2026-06-09 10:22:00',
            ]
        );

        // ══════════════════════════════════════════════════════════════════
        // DEMO0012 — Local Chicago zigzag: O'Hare → Navy Pier  (assigned)
        //   Cuts through the city — ideal route-planner test
        // ══════════════════════════════════════════════════════════════════

        Shipment::firstOrCreate(
            ['tracking_token' => 'DEMO0012'],
            [
                'shipper_id'         => $shipper->id,
                'carrier_id'         => $carrier2->id,
                'status'             => 'assigned',
                'item_description'   => 'Trade show booth materials',
                'item_category'      => 'Events / Exhibitions',
                'weight_lbs'         => 920.00,
                'handling_requirements' => ['No Stack', 'Upright Only'],
                'pickup_address'     => "10000 W O'Hare Ave, Chicago, IL 60666",
                'pickup_city'        => 'Chicago',
                'pickup_state'       => 'IL',
                'pickup_lat'         => 41.97400,
                'pickup_lng'         => -87.90700,
                'pickup_date'        => '2026-06-12',
                'pickup_time_window' => '5am – 7am',
                'delivery_address'   => '600 E Grand Ave, Chicago, IL 60611',
                'delivery_city'      => 'Chicago',
                'delivery_state'     => 'IL',
                'delivery_lat'       => 41.89180,
                'delivery_lng'       => -87.60820,
                'delivery_date'      => '2026-06-12',
                'delivery_time_window' => '10am – noon',
                'distance_miles'     => 18.40,
                'estimated_duration_mins' => 52,
                'agreed_cost'        => 340.00,
            ]
        );

        // ══════════════════════════════════════════════════════════════════
        // Report
        // ══════════════════════════════════════════════════════════════════

        // ── Transactions ──────────────────────────────────────────────────────
        $pm = PaymentMethod::where('user_id', $shipper->id)->orderBy('id')->get();
        $visa = $pm->firstWhere('last4', '4242');
        $mc   = $pm->firstWhere('last4', '5100');
        $ach  = $pm->firstWhere('last4', '4821');

        if (! Transaction::where('shipper_id', $shipper->id)->exists()) {
            $txns = [
                ['INV-2026-0042', $carrier1->id, $visa?->id,  'Industrial HVAC Units',          'Industrial Equipment', 'Denver, CO',         'Salt Lake City, UT', 1224.75, 'paid',       '2026-05-28', '2026-06-07', null,                                                         '2026-05-28 10:00:00'],
                ['INV-2026-0041', $carrier2->id, $mc?->id,    'Retail Fixtures Pallet',          'Retail Goods',         'Portland, OR',       'Seattle, WA',        950.00,  'paid',       '2026-05-22', '2026-06-01', null,                                                         '2026-05-22 09:00:00'],
                ['INV-2026-0043', $carrier2->id, $ach?->id,   'Medical Supplies — Cold Chain',   'Medical / Pharma',     'San Francisco, CA',  'Los Angeles, CA',    1875.00, 'pending',    '2026-06-01', '2026-06-11', 'Cold chain required. Payment due upon delivery confirmation.', null],
                ['INV-2026-0040', $carrier3->id, $visa?->id,  'Steel Coil Load',                 'Raw Materials',        'Dallas, TX',         'Houston, TX',        2340.00, 'paid',       '2026-05-15', '2026-05-25', null,                                                         '2026-05-15 08:00:00'],
                ['INV-2026-0044', $carrier1->id, $visa?->id,  'Electronics Batch — Fragile',     'Electronics',          'Denver, CO',         'Albuquerque, NM',    788.50,  'processing', '2026-06-01', '2026-06-15', 'Payment processing via bank transfer.',                       null],
                ['INV-2026-0038', $carrier3->id, $mc?->id,    'Automotive Parts Crate',          'Automotive',           'Oklahoma City, OK',  'Dallas, TX',         615.00,  'failed',     '2026-05-10', '2026-05-20', 'Card declined. Please update payment method and retry.',      null],
                ['INV-2026-0035', $carrier2->id, $visa?->id,  'Furniture Shipment',              'Furniture',            'Portland, OR',       'Eugene, OR',         540.00,  'refunded',   '2026-04-28', '2026-05-08', 'Shipment cancelled by carrier. Full refund issued.',          null],
                ['INV-2026-0045', $carrier1->id, $ach?->id,   'Hazmat — Class 3 Liquids',        'Hazmat',               'Denver, CO',         'Phoenix, AZ',        3120.00, 'pending',    '2026-06-01', '2026-06-20', 'Net-30 terms per contract INV-2026-0001.',                    null],
            ];

            foreach ($txns as [$inv, $cid, $pmid, $desc, $cat, $pickup, $delivery, $amount, $status, $date, $due, $notes, $paidAt]) {
                Transaction::create([
                    'shipper_id'        => $shipper->id,
                    'carrier_id'        => $cid,
                    'payment_method_id' => $pmid,
                    'invoice_no'        => $inv,
                    'description'       => $desc,
                    'category'          => $cat,
                    'pickup'            => $pickup,
                    'delivery'          => $delivery,
                    'amount'            => $amount,
                    'status'            => $status,
                    'due_date'          => $due,
                    'notes'             => $notes,
                    'paid_at'           => $paidAt,
                    'created_at'        => $date,
                    'updated_at'        => $date,
                ]);
            }
        }

        // ── Contracts ──────────────────────────────────────────────────────────
        if (! Contract::where('shipper_id', $shipper->id)->exists()) {
            $contracts = [
                [$carrier1->id, 'Per mile',  2.85,  0.18, 55.00, 2, 'Dry Van',   45000, 'CO, WY, UT, NM',    'Net 30',   'First Call', true,  '2026-01-01', '2026-12-31', 'active',  'Preferred for Rocky Mountain region. Priority response within 2 hours.', 8],
                [$carrier2->id, 'Flat rate',  950.00, null, 50.00, 3, 'Reefer',   40000, 'Pacific Northwest',  'Net 15',   'Preferred',  false, '2026-03-01', '2026-08-31', 'active',  'Flat rate per full-truckload. Max 40,000 lbs.', 3],
                [$carrier3->id, 'Per mile',  3.10,  0.20, 60.00, 2, 'Flatbed',   48000, 'TX, LA, OK',         'Net 30',   'Standard',   false, '2026-06-01', '2026-11-30', 'pending', 'Awaiting carrier signature.', 0],
                [$carrier1->id, 'Hourly',    145.00, null, 45.00, 1, 'Dry Van',   26000, 'Denver metro',       'Quick Pay','Preferred',  false, '2025-01-01', '2025-12-31', 'expired', 'Local delivery contract — expired. Renew for 2026.', 12],
            ];

            foreach ($contracts as [$cid, $rtype, $rate, $fuel, $det, $free, $equip, $wt, $cov, $terms, $pri, $ar, $from, $to, $status, $notes, $ships]) {
                Contract::create([
                    'shipper_id'      => $shipper->id,
                    'carrier_id'      => $cid,
                    'rate_type'       => $rtype,
                    'rate'            => $rate,
                    'fuel_surcharge'  => $fuel,
                    'detention_rate'  => $det,
                    'free_time_hrs'   => $free,
                    'equipment_type'  => $equip,
                    'max_weight_lbs'  => $wt,
                    'coverage'        => $cov,
                    'payment_terms'   => $terms,
                    'priority'        => $pri,
                    'auto_renew'      => $ar,
                    'valid_from'      => $from,
                    'valid_to'        => $to,
                    'status'          => $status,
                    'notes'           => $notes,
                    'shipments_under' => $ships,
                ]);
            }
        }

        $this->command->info('');
        $this->command->info('✓ Demo users and shipments seeded successfully.');
        $this->command->info('');
        $this->command->table(
            ['Role', 'Email', 'Password'],
            [
                ['Shipper',    'alex@demo.com',   'password'],
                ['Carrier 1',  'jordan@demo.com', 'password'],
                ['Carrier 2',  'casey@demo.com',  'password'],
                ['Receiver',   'sam@demo.com',    'password'],
                ['Admin',      'admin@demo.com',  'password'],
                ['Factor',     'dana@demo.com',   'password'],
            ]
        );
        $this->command->info('');
        $this->command->table(
            ['Token', 'Route', 'Status'],
            [
                ['DEMO0001', 'Denver → Dallas (795 mi)',          'in_transit 🚚 (GPS ping near Amarillo)'],
                ['DEMO0002', 'Denver → Los Angeles (1,021 mi)',   'in_transit 🚚 (GPS ping near Grand Junction)'],
                ['DEMO0003', 'Chicago → Houston (1,086 mi)',      'in_transit 🚚 (GPS ping near Springfield, MO)'],
                ['DEMO0004', 'Dallas local: Deep Ellum → Medical','in_transit 🚚 (GPS ping mid-city)'],
                ['DEMO0005', 'NYC local: Penn Station → JFK',     'in_transit 🚚 (GPS ping in Queens)'],
                ['DEMO0006', 'Dallas zigzag: Singleton → Stemmons','in_transit 🚚 (GPS ping on Commerce)'],
                ['DEMO0007', 'LA: Studio City → Santa Monica',    'assigned'],
                ['DEMO0008', 'Seattle → Portland (175 mi)',        'assigned'],
                ['DEMO0009', 'Miami → Atlanta (661 mi)',           'pending'],
                ['DEMO0010', 'Houston local: IAH → Medical Center','pending'],
                ['DEMO0011', 'Boston → New York (215 mi)',         'delivered ✓'],
                ['DEMO0012', "Chicago: O'Hare → Navy Pier",        'assigned'],
            ]
        );

        // ── Preferred carriers for Alex ───────────────────────────────────────
        foreach ([
            [$carrier1->id, 'active'],
            [$carrier2->id, 'active'],
            [$carrier3->id, 'pending'],
        ] as [$cid, $status]) {
            PreferredCarrier::firstOrCreate(
                ['shipper_id' => $shipper->id, 'carrier_id' => $cid],
                ['status' => $status]
            );
        }

        // ── Payment methods for Alex Morgan (shipper demo account) ────────
        if (! PaymentMethod::where('user_id', $shipper->id)->exists()) {
            PaymentMethod::insert([
                [
                    'user_id'      => $shipper->id,
                    'type'         => 'card',
                    'brand'        => 'Visa',
                    'last4'        => '4242',
                    'exp_month'    => '08',
                    'exp_year'     => '27',
                    'bank_name'    => null,
                    'account_type' => null,
                    'is_default'   => true,
                    'stripe_pm_id' => null,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ],
                [
                    'user_id'      => $shipper->id,
                    'type'         => 'card',
                    'brand'        => 'Mastercard',
                    'last4'        => '5100',
                    'exp_month'    => '02',
                    'exp_year'     => '26',
                    'bank_name'    => null,
                    'account_type' => null,
                    'is_default'   => false,
                    'stripe_pm_id' => null,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ],
                [
                    'user_id'      => $shipper->id,
                    'type'         => 'bank',
                    'brand'        => null,
                    'last4'        => '4821',
                    'exp_month'    => null,
                    'exp_year'     => null,
                    'bank_name'    => 'Chase Bank',
                    'account_type' => 'checking',
                    'is_default'   => false,
                    'stripe_pm_id' => null,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ],
            ]);
        }

        $this->call(LocationSeeder::class);
        $this->call(FactoringDemoSeeder::class);
        $this->call(PaymentsDemoSeeder::class);
    }
}
