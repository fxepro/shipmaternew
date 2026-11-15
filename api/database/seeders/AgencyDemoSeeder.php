<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\OrgMember;
use App\Models\PersonIdentity;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * A law enforcement agency, approved, with one officer (trooper@demo.com) and a supervisor (morgan.lt@demo.com).
 * Every login uses the demo password. Safe to run again.
 */
class AgencyDemoSeeder extends Seeder
{
    public function run(): void
    {
        $chief = User::firstOrCreate(['email' => 'morgan.lt@demo.com'], ['name' => 'Morgan Ellis', 'password' => 'password', 'role' => 'agency']);
        $agency = Organization::firstOrCreate(['owner_id' => $chief->id, 'type' => 'agency'], [
            'name' => 'Colorado State Patrol', 'legal_name' => 'Colorado State Patrol', 'slug' => 'colorado-state-patrol', 'status' => 'active',
            'phone' => '+1 (303) 555-0190', 'email' => 'cve@csp.test',
            'street' => '700 Kipling St', 'city' => 'Lakewood', 'state' => 'CO', 'zip' => '80215', 'country' => 'US',
            'agency_kind' => 'state_police', 'ori_number' => 'COCSP0000', 'jurisdiction' => 'State of Colorado',
            'categories' => ['agency'],
        ]);
        $agency->forceFill(['verification_status' => 'approved'])->save();

        $casey = User::firstOrCreate(['email' => 'trooper@demo.com'], ['name' => 'Casey Ruiz', 'password' => 'password', 'role' => 'agency']);
        foreach ([[$chief, 'supervisor', 'Lieutenant', 'L-2207'], [$casey, 'officer', 'Trooper', 'T-4418']] as [$u, $role, $title, $badge]) {
            OrgMember::firstOrCreate(['org_id' => $agency->id, 'user_id' => $u->id], ['role' => $role, 'status' => 'active', 'joined_at' => now()]);
            $u->forceFill(['role' => 'agency', 'current_org_id' => $agency->id, 'email_verified_at' => $u->email_verified_at ?? now()])->save();
            [$first, $last] = explode(' ', $u->name);
            PersonIdentity::firstOrCreate(['user_id' => $u->id], ['legal_first_name' => $first, 'legal_last_name' => $last]);
            DB::table('officer_profiles')->updateOrInsert(['user_id' => $u->id], [
                'badge_number' => $badge, 'title' => $title, 'unit' => 'Commercial Vehicle Enforcement', 'work_phone' => '+1 (303) 555-0190',
                'supervisor_name' => $role === 'officer' ? 'Lt. Morgan Ellis' : null, 'supervisor_email' => $role === 'officer' ? 'morgan.lt@demo.com' : null,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }
}
