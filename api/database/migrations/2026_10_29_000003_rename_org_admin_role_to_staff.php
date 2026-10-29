<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Company roles are now: owner, staff, dispatcher, driver, viewer.
 * "staff" replaces "admin". Shipper companies have no dispatchers or drivers, so those become staff too.
 * See docs/people-types-and-checks.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_role_check');
        DB::statement('ALTER TABLE org_invitations DROP CONSTRAINT IF EXISTS org_invitations_role_check');

        DB::statement("UPDATE org_members SET role = 'staff' WHERE role = 'admin'");
        DB::statement("UPDATE org_invitations SET role = 'staff' WHERE role = 'admin'");
        DB::statement("
            UPDATE org_members m SET role = 'staff' FROM organizations o
            WHERE o.id = m.org_id AND o.type = 'shipper' AND m.role IN ('dispatcher', 'driver')
        ");
        DB::statement("
            UPDATE org_invitations i SET role = 'staff' FROM organizations o
            WHERE o.id = i.org_id AND o.type = 'shipper' AND i.role IN ('dispatcher', 'driver')
        ");

        DB::statement("ALTER TABLE org_members ADD CONSTRAINT org_members_role_check
            CHECK (role IN ('owner', 'staff', 'dispatcher', 'driver', 'viewer'))");
        DB::statement("ALTER TABLE org_invitations ADD CONSTRAINT org_invitations_role_check
            CHECK (role IN ('staff', 'dispatcher', 'driver', 'viewer'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_role_check');
        DB::statement('ALTER TABLE org_invitations DROP CONSTRAINT IF EXISTS org_invitations_role_check');

        DB::statement("UPDATE org_members SET role = 'admin' WHERE role = 'staff'");
        DB::statement("UPDATE org_invitations SET role = 'admin' WHERE role = 'staff'");

        DB::statement("ALTER TABLE org_members ADD CONSTRAINT org_members_role_check
            CHECK (role IN ('owner', 'admin', 'dispatcher', 'driver', 'viewer'))");
        DB::statement("ALTER TABLE org_invitations ADD CONSTRAINT org_invitations_role_check
            CHECK (role IN ('admin', 'dispatcher', 'driver', 'viewer'))");
    }
};
