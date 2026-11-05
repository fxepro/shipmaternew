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
                'name'      => $user->name . (str_ends_with($user->name, 's') ? "'" : "'s") . ' ' . ucfirst($orgType),
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

            // Migrate payment methods
            \DB::table('payment_methods')
                ->where('user_id', $user->id)
                ->update(['org_id' => $org->id]);

            $this->command->info("Created org for {$user->email} → {$org->name}");
        }
    }
}
