<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Law enforcement agencies: supervisors and officers are members too (App\Support\Permissions::ROLES)
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_role_check');
        DB::statement("ALTER TABLE org_members ADD CONSTRAINT org_members_role_check CHECK (role IN ('owner','staff','dispatcher','agent','driver','viewer','supervisor','officer'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE org_members DROP CONSTRAINT IF EXISTS org_members_role_check');
        DB::statement("ALTER TABLE org_members ADD CONSTRAINT org_members_role_check CHECK (role IN ('owner','staff','dispatcher','agent','driver','viewer'))");
    }
};
