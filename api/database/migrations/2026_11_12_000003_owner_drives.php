<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A carrier owner who also drives (owner-operator, or the company's only driver). They are a driver everywhere a driver
 * counts: load assignment, Drivers, driver checks (CDL, medical card, Clearinghouse, MVR). Members with the Driver role
 * always drive; this flag is for the owner.
 * Owners already treated as driving start ticked. The owner can untick it; carrier_type (ownership) doesn't lock it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('org_members', function (Blueprint $t) {
            $t->boolean('drives')->default(false);
        });

        DB::statement("
            UPDATE org_members m SET drives = true
            FROM organizations o
            WHERE o.id = m.org_id AND o.type = 'carrier' AND o.owner_id = m.user_id
              AND (o.carrier_type = 'sole_proprietor'
                   OR EXISTS (SELECT 1 FROM person_credentials c WHERE c.user_id = m.user_id AND c.type = 'cdl' AND c.number IS NOT NULL))
        ");
    }

    public function down(): void
    {
        Schema::table('org_members', fn (Blueprint $t) => $t->dropColumn('drives'));
    }
};
