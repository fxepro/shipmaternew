<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Brokers: a company type of their own that posts loads for shipper customers and books carriers.
 *
 * freight_jobs.shipper_id   the shipper (the customer whose freight it is); empty when that shipper is not on Shipmater
 * freight_jobs.broker_id    the broker handling the load, if any
 * freight_jobs.shipper_name the shipper's name when it is not on Shipmater
 * The company that books and pays the carrier is the broker when there is one, otherwise the shipper.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('freight_jobs', function (Blueprint $t) {
            $t->foreignId('broker_id')->nullable()->after('shipper_id')->constrained('organizations')->nullOnDelete();
            $t->string('shipper_name', 200)->nullable()->after('broker_id');
            $t->index(['broker_id', 'status']);
        });
        DB::statement('ALTER TABLE freight_jobs ALTER COLUMN shipper_id DROP NOT NULL');

        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('shipper','carrier','receiver','admin','factor','broker'))");

        // Broker agents
        DB::statement('ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_role_check');
        DB::statement("ALTER TABLE org_members ADD CONSTRAINT org_members_role_check CHECK (role IN ('owner','staff','dispatcher','agent','driver','viewer'))");
        DB::statement('ALTER TABLE org_invitations DROP CONSTRAINT IF EXISTS org_invitations_role_check');
        DB::statement("ALTER TABLE org_invitations ADD CONSTRAINT org_invitations_role_check CHECK (role IN ('staff','dispatcher','agent','driver','viewer'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('shipper','carrier','receiver','admin','factor'))");
        Schema::table('freight_jobs', function (Blueprint $t) {
            $t->dropConstrainedForeignId('broker_id');
            $t->dropColumn('shipper_name');
        });
    }
};
