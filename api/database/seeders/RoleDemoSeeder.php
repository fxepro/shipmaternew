<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\OrgMember;
use App\Models\PersonIdentity;
use App\Models\FreightJob;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * One demo login for every role at each kind of company, to try the role matrix
 * (Admin Console, Settings, Roles & Permissions). Every login uses the demo password.
 *
 *   Reyes Transport (carrier): staff, dispatcher, driver, viewer   (jordan@demo.com is the owner)
 *   Morgan Freight (shipper):  staff, viewer                       (alex@demo.com is the owner)
 *   Summit Freight Capital (factor): staff, viewer                 (dana@demo.com is the owner)
 *
 * The driver is put on demo load DEMO0001 so they have one assigned load to see.
 * Safe to run again: existing logins are left as they are.
 */
class RoleDemoSeeder extends Seeder
{
    private const PEOPLE = [
        // company owner's email => [[email, first, last, role]]
        'jordan@demo.com' => [
            ['reyes.staff@demo.com',      'Priya',  'Shah',     'staff'],
            ['reyes.dispatcher@demo.com', 'Tom',    'Becker',   'dispatcher'],
            ['reyes.driver@demo.com',     'Luis',   'Ortega',   'driver'],
            ['reyes.viewer@demo.com',     'Nina',   'Hart',     'viewer'],
        ],
        'alex@demo.com' => [
            ['morgan.staff@demo.com',     'Ben',    'Carter',   'staff'],
            ['morgan.viewer@demo.com',    'Grace',  'Lee',      'viewer'],
        ],
        'dana@demo.com' => [
            ['summit.staff@demo.com',     'Omar',   'Haddad',   'staff'],
            ['summit.viewer@demo.com',    'Ruth',   'Kim',      'viewer'],
        ],
    ];

    public function run(): void
    {
        foreach (self::PEOPLE as $ownerEmail => $people) {
            $owner = User::where('email', $ownerEmail)->first();
            $org   = $owner ? Organization::where('owner_id', $owner->id)->first() : null;
            if (!$org) {
                $this->command?->warn("Skipped {$ownerEmail}: no company yet (run the main seeder first).");
                continue;
            }

            foreach ($people as [$email, $first, $last, $role]) {
                // Plain 'password': the User model hashes it (do not Hash::make here)
                $user = User::firstOrCreate(['email' => $email], [
                    'name'              => "{$first} {$last}",
                    'password'          => 'password',
                    'role'              => $org->type,
                ]);
                if (!$user->current_org_id) $user->update(['current_org_id' => $org->id]);
                if (!$user->email_verified_at) $user->forceFill(['email_verified_at' => now()])->save();

                OrgMember::firstOrCreate(
                    ['org_id' => $org->id, 'user_id' => $user->id],
                    ['role' => $role, 'status' => 'active', 'joined_at' => now()]
                );
                PersonIdentity::firstOrCreate(['user_id' => $user->id], ['legal_first_name' => $first, 'legal_last_name' => $last]);

                if ($role === 'driver' && ($load = FreightJob::where('tracking_token', 'DEMO0001')->where('carrier_id', $org->id)->first())) {
                    if (!$load->people()->where('user_id', $user->id)->exists()) $load->addPerson($org->id, $user->id, $owner->id);
                }

                $this->command?->info("{$org->name}: {$role} {$email}");
            }
        }
    }
}
