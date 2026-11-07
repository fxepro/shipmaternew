<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Email verification is now required to use the app. Accounts created before that rule
 * are counted as verified, so nobody who already uses Shipmater is locked out.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->whereNull('email_verified_at')->update(['email_verified_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        // Not reversible: the accounts that were unverified are not recorded
    }
};
