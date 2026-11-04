<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * carrier_profiles.background_check_status was an enum of not_submitted | pending | approved | rejected,
 * but the Checkr flow and the profile page use Checkr's own states. Make it a plain string holding
 * not_started | invitation_sent | pending | clear | consider | suspended ('suspended' = not passed).
 */
return new class extends Migration
{
    private const UP   = ['not_submitted' => 'not_started', 'approved' => 'clear', 'rejected' => 'suspended'];

    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE carrier_profiles DROP CONSTRAINT IF EXISTS carrier_profiles_background_check_status_check');
        }
        Schema::table('carrier_profiles', function (Blueprint $t) {
            $t->string('background_check_status', 30)->default('not_started')->change();
        });
        foreach (self::UP as $old => $new) {
            DB::table('carrier_profiles')->where('background_check_status', $old)->update(['background_check_status' => $new]);
        }
    }

    public function down(): void
    {
        $back = ['not_started' => 'not_submitted', 'clear' => 'approved', 'suspended' => 'rejected',
                 'invitation_sent' => 'pending', 'consider' => 'pending'];
        foreach ($back as $new => $old) {
            DB::table('carrier_profiles')->where('background_check_status', $new)->update(['background_check_status' => $old]);
        }
        Schema::table('carrier_profiles', function (Blueprint $t) {
            $t->enum('background_check_status', ['not_submitted', 'pending', 'approved', 'rejected'])->default('not_submitted')->change();
        });
    }
};
