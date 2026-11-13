<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** The person's consent, given in Shipmater, for Shipmater to query the FMCSA Clearinghouse about them (sent once the integration is live) */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('person_verifications', function (Blueprint $t) {
            $t->timestamp('clearinghouse_consent_at')->nullable();
            $t->string('clearinghouse_consent_ip', 45)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('person_verifications', fn (Blueprint $t) => $t->dropColumn(['clearinghouse_consent_at', 'clearinghouse_consent_ip']));
    }
};
