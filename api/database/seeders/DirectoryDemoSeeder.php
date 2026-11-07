<?php

namespace Database\Seeders;

use App\Models\FreightJob;
use App\Models\LoadPerson;
use App\Models\Location;
use App\Models\OrgContact;
use App\Models\OrgMember;
use App\Models\OrgPartner;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Demo organizations directory:
 * - King Soopers (Kroger), a receiver company run by the demo receiver, with a DC and stores, contacts and their updates
 * - Sprouts Farmers Market, a receiver the demo shipper listed (nobody from Sprouts has signed up)
 * - Front Range Freight Brokers, a broker the demo shipper listed
 * The demo shipper keeps all three in its list, and the multi-stop demo load (DEMO0013) delivers to King Soopers stores.
 * Contact emails use example.com, which never receives mail. Idempotent.
 */
class DirectoryDemoSeeder extends Seeder
{
    public function run(): void
    {
        $sam   = User::where('email', 'sam@demo.com')->first();
        $alex  = User::where('email', 'alex@demo.com')->first();
        $morgan = $alex?->current_org_id ? Organization::find($alex->current_org_id) : null;
        if (!$sam || !$morgan) return;

        // ── King Soopers (Kroger): claimed, run by Sam ───────────────────────
        $ks = $sam->current_org_id ? Organization::find($sam->current_org_id) : null;
        $ksFields = [
            'name' => 'King Soopers (Kroger)', 'legal_name' => 'Dillon Companies LLC', 'type' => 'receiver', 'status' => 'active',
            'owner_id' => $sam->id, 'phone' => '+1 303 555 0140', 'email' => 'receiving@kingsoopers.example.com',
            'website' => 'kingsoopers.example.com', 'street' => '65 Tejon St', 'city' => 'Denver', 'state' => 'CO', 'zip' => '80223',
            'country' => 'US', 'verification_status' => 'not_required',
        ];
        if ($ks && $ks->type === 'receiver') {
            $ks->update($ksFields + ['claimed_at' => $ks->claimed_at ?? now()]);
        } else {
            $ks = Organization::firstOrCreate(['slug' => 'king-soopers-kroger'], $ksFields + ['claimed_at' => now()]);
            OrgMember::firstOrCreate(['org_id' => $ks->id, 'user_id' => $sam->id], ['role' => 'owner', 'status' => 'active', 'joined_at' => now()]);
            $sam->update(['current_org_id' => $ks->id]);
        }

        $hours = ['mon' => '05:00-14:00', 'tue' => '05:00-14:00', 'wed' => '05:00-14:00', 'thu' => '05:00-14:00', 'fri' => '05:00-14:00', 'sat' => '06:00-12:00'];
        $loc = fn (Organization $o, array $a) => Location::firstOrCreate(
            ['org_id' => $o->id, 'name' => $a['name']],
            $a + ['country' => 'US', 'visibility' => 'public', 'created_by_org_id' => $o->id]
        );

        $dc = $loc($ks, ['name' => 'King Soopers Distribution Center', 'address' => '5101 Oakland St, Denver, CO 80239', 'city' => 'Denver', 'state' => 'CO', 'zip' => '80239',
            'lat' => 39.78590, 'lng' => -104.86450, 'operating_hours' => $hours, 'dock_doors' => 48, 'appointment_required' => true,
            'site_instructions' => 'Check in at the guard shack on Oakland St with the PO number. Reefer doors 1–20.']);
        $s118 = $loc($ks, ['name' => 'King Soopers #118 Boulder', 'address' => '1650 30th St, Boulder, CO 80301', 'city' => 'Boulder', 'state' => 'CO', 'zip' => '80301',
            'lat' => 40.01920, 'lng' => -105.25480, 'operating_hours' => $hours, 'dock_doors' => 2, 'appointment_required' => false,
            'site_instructions' => 'Receiving dock at the back of the store, off 30th St. No deliveries after 2 pm.']);
        $s41 = $loc($ks, ['name' => 'King Soopers #41 Fort Collins', 'address' => '1842 N College Ave, Fort Collins, CO 80524', 'city' => 'Fort Collins', 'state' => 'CO', 'zip' => '80524',
            'lat' => 40.60640, 'lng' => -105.07650, 'operating_hours' => $hours, 'dock_doors' => 2]);
        $loc($ks, ['name' => 'King Soopers #12 Colfax', 'address' => '1155 E 9th Ave, Denver, CO 80218', 'city' => 'Denver', 'state' => 'CO', 'zip' => '80218',
            'lat' => 39.73090, 'lng' => -104.97350, 'operating_hours' => $hours, 'dock_doors' => 1]);

        $contact = fn (Organization $o, ?Location $l, array $a) => OrgContact::firstOrCreate(
            ['org_id' => $o->id, 'name' => $a['name']],
            $a + ['location_id' => $l?->id, 'created_by_org_id' => $o->id]
        );
        $all = ['booked' => ['email'], 'en_route' => ['email', 'sms'], 'arrived' => ['sms'], 'done' => ['email']];
        $contact($ks, null, ['name' => 'Sam Chen', 'title' => 'Inbound logistics manager', 'email' => 'sam@demo.com', 'phone' => '+1 303 555 0140',
            'is_primary' => true, 'user_id' => $sam->id, 'notify' => ['booked' => ['email'], 'en_route' => [], 'arrived' => [], 'done' => ['email']]]);
        $contact($ks, $dc, ['name' => 'Maria Lopez', 'title' => 'Warehouse manager', 'email' => 'maria.lopez@kingsoopers.example.com',
            'phone' => '+1 303 555 0141', 'mobile' => '+1 303 555 0151', 'notify' => $all]);
        $contact($ks, $dc, ['name' => 'Dock office (DC)', 'title' => 'Receiving desk', 'phone' => '+1 303 555 0142',
            'email' => 'dc.receiving@kingsoopers.example.com', 'notify' => ['booked' => ['email'], 'en_route' => ['email'], 'arrived' => ['email'], 'done' => []]]);
        $contact($ks, $s118, ['name' => 'Kevin Park', 'title' => 'Receiving lead, store #118', 'mobile' => '+1 720 555 0118',
            'email' => 'kevin.park@kingsoopers.example.com', 'notify' => ['booked' => [], 'en_route' => ['sms'], 'arrived' => [], 'done' => ['email']]]);
        $contact($ks, $s41, ['name' => 'Alicia Gomez', 'title' => 'Store manager, store #41', 'phone' => '+1 970 555 0141',
            'email' => 'alicia.gomez@kingsoopers.example.com']);

        // ── Listed by the demo shipper: nobody from these companies has signed up ──
        $listed = fn (string $slug, array $a) => Organization::firstOrCreate(['slug' => $slug], $a + [
            'status' => 'listed', 'owner_id' => null, 'country' => 'US', 'verification_status' => 'not_required',
            'listed_by_org_id' => $morgan->id, 'listed_by_user_id' => $alex->id,
        ]);
        $sprouts = $listed('sprouts-farmers-market-receiver', ['name' => 'Sprouts Farmers Market', 'type' => 'receiver',
            'phone' => '+1 303 555 0170', 'city' => 'Aurora', 'state' => 'CO']);
        $sdc = $loc($sprouts, ['name' => 'Sprouts Aurora DC', 'address' => '17500 E 32nd Ave, Aurora, CO 80011', 'city' => 'Aurora', 'state' => 'CO', 'zip' => '80011',
            'lat' => 39.76290, 'lng' => -104.78050, 'dock_doors' => 30, 'appointment_required' => true,
            'site_instructions' => 'Appointments by email the day before. Bring two copies of the BOL.']);
        $sdc->update(['created_by_org_id' => $morgan->id]);
        $c = $contact($sprouts, $sdc, ['name' => 'Tom Reilly', 'title' => 'DC receiving supervisor', 'email' => 'treilly@sprouts.example.com',
            'phone' => '+1 303 555 0171', 'notify' => ['booked' => ['email'], 'en_route' => ['email'], 'arrived' => [], 'done' => ['email']]]);
        $c->update(['created_by_org_id' => $morgan->id]);

        $broker = $listed('front-range-freight-brokers-broker', ['name' => 'Front Range Freight Brokers', 'type' => 'broker',
            'phone' => '+1 720 555 0190', 'email' => 'loads@frontrange.example.com', 'city' => 'Denver', 'state' => 'CO']);
        $contact($broker, null, ['name' => 'Jess Alvarez', 'title' => 'Account manager', 'email' => 'jess@frontrange.example.com', 'phone' => '+1 720 555 0191', 'notify' => []]);

        foreach ([[$ks, 'receiver'], [$sprouts, 'receiver'], [$broker, 'broker']] as [$o, $rel]) {
            OrgPartner::firstOrCreate(['org_id' => $morgan->id, 'partner_org_id' => $o->id, 'relation' => $rel], ['added_by' => $alex->id]);
        }

        // ── The shipper's own DCs for the multi-stop load ─────────────────────
        $north = $loc($morgan, ['name' => 'Denver DC North', 'address' => '4800 Race St, Denver, CO 80216', 'city' => 'Denver', 'state' => 'CO', 'zip' => '80216',
            'lat' => 39.78310, 'lng' => -104.96260, 'dock_doors' => 12]);
        $east = $loc($morgan, ['name' => 'Denver DC East', 'address' => '18500 E 40th Ave, Aurora, CO 80011', 'city' => 'Aurora', 'state' => 'CO', 'zip' => '80011',
            'lat' => 39.77230, 'lng' => -104.78430, 'dock_doors' => 8]);

        // DEMO0013's stops point at those locations; the drop-offs are King Soopers stores
        if ($job = FreightJob::where('tracking_token', 'DEMO0013')->first()) {
            foreach ($job->stops as $stop) {
                $l = collect([$north, $east, $s118, $s41])->first(fn ($l) => $l->address === $stop->address);
                if ($l && $stop->location_id !== $l->id) $stop->update(['location_id' => $l->id, 'name' => $l->name]);
            }
        }

        // Loads Sam was the receiver on belong to King Soopers too
        LoadPerson::where('user_id', $sam->id)->whereNull('org_id')->update(['org_id' => $ks->id]);
    }
}
