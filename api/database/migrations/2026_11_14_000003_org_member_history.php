<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Membership history: a person who leaves a company keeps their row, with left_at set.
 * A row with no left_at is a current membership; rejoining starts a new row.
 * This is the record behind "worked here from ... to ..." on profiles.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('org_members', function (Blueprint $t) {
            $t->timestamp('left_at')->nullable()->after('joined_at');
            $t->dropUnique(['org_id', 'user_id']);
        });
        DB::statement('CREATE UNIQUE INDEX org_members_current_unique ON org_members (org_id, user_id) WHERE left_at IS NULL');
        DB::statement('UPDATE org_members SET joined_at = created_at WHERE joined_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DELETE FROM org_members WHERE left_at IS NOT NULL');
        DB::statement('DROP INDEX IF EXISTS org_members_current_unique');
        Schema::table('org_members', function (Blueprint $t) {
            $t->dropColumn('left_at');
            $t->unique(['org_id', 'user_id']);
        });
    }
};
