<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Last step of the profile cleanup: the old shipper and carrier profiles are gone.
 * Company data is on organizations (2026_11_05_000004), personal data on the person tables.
 *
 * Not reversible: restore from the database backup taken before this migration if needed.
 */
return new class extends Migration
{
    public function up(): void
    {
        // The child tables are keyed by company now (carrier_id / shipper_id)
        foreach (['carrier_vehicles', 'carrier_documents', 'carrier_verifications'] as $table) {
            if (Schema::hasColumn($table, 'carrier_profile_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->dropForeign(['carrier_profile_id']);
                    $t->dropColumn('carrier_profile_id');
                });
            }
        }
        if (Schema::hasColumn('shipper_documents', 'shipper_profile_id')) {
            Schema::table('shipper_documents', function (Blueprint $t) {
                $t->dropForeign(['shipper_profile_id']);
                $t->dropColumn('shipper_profile_id');
            });
        }

        // Services and certifications are on the company (org_service_types, org_certifications)
        Schema::dropIfExists('carrier_profile_service_types');
        Schema::dropIfExists('carrier_profile_certifications');
        Schema::dropIfExists('carrier_profiles');
        Schema::dropIfExists('shipper_profiles');

        // Credentials entered on a profile page are just "profile" now
        DB::table('person_credentials')->where('source', 'carrier_profile')->update(['source' => 'profile']);
    }

    public function down(): void
    {
        throw new RuntimeException('Dropping the old profiles cannot be undone by a migration. Restore the database backup instead.');
    }
};
