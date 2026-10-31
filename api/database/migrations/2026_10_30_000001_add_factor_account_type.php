<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Factoring companies get their own account type, like carriers and shippers
 * (docs/noa-factoring.md): users.role 'factor' and organizations.type 'factor'.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('shipper', 'carrier', 'receiver', 'admin', 'factor'))");

        DB::statement('ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check');
        DB::statement("ALTER TABLE organizations ADD CONSTRAINT organizations_type_check CHECK (type IN ('carrier', 'shipper', 'factor'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('shipper', 'carrier', 'receiver', 'admin'))");

        DB::statement('ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check');
        DB::statement("ALTER TABLE organizations ADD CONSTRAINT organizations_type_check CHECK (type IN ('carrier', 'shipper'))");
    }
};
