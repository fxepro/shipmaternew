<?php

namespace Database\Seeders;

use App\Models\FreightJob;
use App\Models\Organization;
use App\Models\OrgMember;
use App\Models\PersonIdentity;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Brokers in the demo:
 *  - Morgan Freight Co. (alex@demo.com) is a freight broker. Its loads are posted for shipper customers.
 *  - morgan.agent@demo.com is a broker agent at Morgan Freight.
 *  - Front Range Foods (riley@demo.com) is a shipper: a food manufacturer that can post its own loads
 *    or have Morgan Freight handle them. Half of Morgan's demo loads are for Front Range Foods; the
 *    rest are for Boulder Organic Co., a shipper that is not on Shipmater.
 * Every login uses the demo password. Safe to run again.
 */
class BrokerDemoSeeder extends Seeder
{
    public function run(): void
    {
        $alex   = User::where('email', 'alex@demo.com')->first();
        $morgan = $alex ? Organization::where('owner_id', $alex->id)->whereIn('type', ['shipper', 'broker'])->first() : null;
        if (!$morgan) {
            $this->command?->warn('Skipped: run the main seeder first.');
            return;
        }

        // ── Morgan Freight becomes a broker ──────────────────────────────
        $morgan->forceFill([
            'type' => 'broker', 'industry' => 'Freight brokerage',
            'fmcsa_broker_mc' => $morgan->fmcsa_broker_mc ?: '884213',
            'categories' => array_values(array_unique(array_merge(array_diff($morgan->categories ?? [], ['shipper']), ['broker']))),
        ])->save();
        $memberIds = OrgMember::where('org_id', $morgan->id)->pluck('user_id');
        User::whereIn('id', $memberIds)->where('role', 'shipper')->update(['role' => 'broker']);

        // A broker agent
        $agent = User::firstOrCreate(['email' => 'morgan.agent@demo.com'], [
            'name' => 'Diego Ramirez', 'password' => 'password', 'role' => 'broker', 'current_org_id' => $morgan->id,
        ]);
        if (!$agent->email_verified_at) $agent->forceFill(['email_verified_at' => now()])->save();
        OrgMember::firstOrCreate(['org_id' => $morgan->id, 'user_id' => $agent->id], ['role' => 'agent', 'status' => 'active', 'joined_at' => now()]);
        PersonIdentity::firstOrCreate(['user_id' => $agent->id], ['legal_first_name' => 'Diego', 'legal_last_name' => 'Ramirez']);

        // ── A shipper: Front Range Foods ─────────────────────────────────
        $riley = User::firstOrCreate(['email' => 'riley@demo.com'], ['name' => 'Riley Park', 'password' => 'password', 'role' => 'shipper']);
        if (!$riley->email_verified_at) $riley->forceFill(['email_verified_at' => now()])->save();
        $foods = Organization::firstOrCreate(['owner_id' => $riley->id, 'type' => 'shipper'], [
            'name' => 'Front Range Foods', 'legal_name' => 'Front Range Foods Inc.', 'slug' => 'front-range-foods', 'status' => 'active',
            'business_type' => 'Corporation', 'tax_id' => '84-3329107', 'tax_id_type' => 'EIN', 'industry' => 'Food manufacturing',
            'website' => 'https://frontrangefoods.test', 'phone' => '+1 (303) 555-0142',
            'street' => '5100 Race St', 'city' => 'Denver', 'state' => 'CO', 'zip' => '80216', 'country' => 'US',
            'shipper_verification_status' => 'incomplete', 'categories' => ['shipper'],
        ]);
        OrgMember::firstOrCreate(['org_id' => $foods->id, 'user_id' => $riley->id], ['role' => 'owner', 'status' => 'active', 'joined_at' => now()]);
        if (!$riley->current_org_id) $riley->update(['current_org_id' => $foods->id]);
        PersonIdentity::firstOrCreate(['user_id' => $riley->id], ['legal_first_name' => 'Riley', 'legal_last_name' => 'Park', 'phone' => '+1 (303) 555-0142']);

        // Front Range Foods ships from its own sites: copies of the pickup sites from Morgan's demo data
        // (a broker has no pickup sites of its own; its customers do)
        $pickups = ['Denver DC North', 'Denver DC East', 'Chicago Distribution Center', 'Chicago Warehouse B', 'Aurora Fulfillment Hub', 'Indianapolis Depot'];
        foreach (\App\Models\Location::where('org_id', $morgan->id)->whereIn('name', $pickups)->get() as $loc) {
            \App\Models\Location::firstOrCreate(['org_id' => $foods->id, 'name' => $loc->name], collect($loc->only([
                'visibility', 'dock_doors', 'appointment_required', 'site_instructions', 'contact_name', 'contact_phone', 'contact_email',
                'address', 'city', 'state', 'zip', 'country', 'lat', 'lng', 'operating_hours', 'notes',
            ]))->merge(['created_by_org_id' => $foods->id, 'is_default' => $loc->name === 'Denver DC North'])->all());
        }

        // ── Morgan's loads are posted for its shipper customers ──────────
        $loads = FreightJob::where(fn ($q) => $q->where('shipper_id', $morgan->id)->orWhere('broker_id', $morgan->id))->orderBy('id')->get();
        foreach ($loads as $i => $job) {
            if ($job->broker_id) continue;
            $job->forceFill($i % 2 === 0
                ? ['broker_id' => $morgan->id, 'shipper_id' => $foods->id, 'shipper_name' => null]
                : ['broker_id' => $morgan->id, 'shipper_id' => null, 'shipper_name' => 'Boulder Organic Co.'])->save();
        }

        $this->command?->info("Morgan Freight is a broker ({$loads->count()} loads); agent morgan.agent@demo.com; shipper Front Range Foods (riley@demo.com).");
    }
}
