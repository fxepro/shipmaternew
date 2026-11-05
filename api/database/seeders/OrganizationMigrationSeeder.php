<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\OrgMember;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class OrganizationMigrationSeeder extends Seeder
{
    public function run(): void
    {
        // For every existing user that is a carrier or shipper,
        // create a solo org and make them the owner.
        $users = User::whereIn('role', ['carrier', 'shipper'])->get();

        foreach ($users as $user) {
            // Skip if they already have an org
            if ($user->current_org_id) continue;

            $orgType = $user->role; // 'carrier' or 'shipper'

            $org = Organization::create([
                // The company is named by its legal business name when the profile has one
                'name'      => ($orgType === 'carrier' ? $user->carrierProfile?->company_name : $user->shipperProfile?->company_name)
                    ?: $user->name . (str_ends_with($user->name, 's') ? "'" : "'s") . ' ' . ucfirst($orgType),
                'slug'      => Str::slug($user->name . '-' . $orgType . '-' . $user->id),
                'type'      => $orgType,
                'status'    => 'active',
                'owner_id'  => $user->id,
            ]);

            // Add as owner member
            OrgMember::create([
                'org_id'    => $org->id,
                'user_id'   => $user->id,
                'role'      => 'owner',
                'status'    => 'active',
                'joined_at' => now(),
            ]);

            // Set as current org
            $user->update(['current_org_id' => $org->id]);

            // Sync org_id onto their profile
            if ($orgType === 'carrier' && $user->carrierProfile) {
                $user->carrierProfile->update(['org_id' => $org->id]);

                // Migrate service types from carrier_profile_service_types → org_service_types
                $serviceTypeIds = \DB::table('carrier_profile_service_types')
                    ->where('carrier_profile_id', $user->carrierProfile->id)
                    ->pluck('service_type_id');

                foreach ($serviceTypeIds as $stId) {
                    \DB::table('org_service_types')->insertOrIgnore([
                        'org_id'          => $org->id,
                        'service_type_id' => $stId,
                        'created_at'      => now(),
                        'updated_at'      => now(),
                    ]);
                }

                // Migrate carrier assets
                foreach (['carrier_vehicles', 'carrier_documents', 'carrier_verifications'] as $table) {
                    \DB::table($table)
                        ->where('carrier_profile_id', $user->carrierProfile->id)
                        ->update(['org_id' => $org->id]);
                }
            }

            if ($orgType === 'shipper' && $user->shipperProfile) {
                $user->shipperProfile->update(['org_id' => $org->id]);
            }

            // Migrate payment methods
            \DB::table('payment_methods')
                ->where('user_id', $user->id)
                ->update(['org_id' => $org->id]);

            $this->command->info("Created org for {$user->email} → {$org->name}");
        }
    }
}
