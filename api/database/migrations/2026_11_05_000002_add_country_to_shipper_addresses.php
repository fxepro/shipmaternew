<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** The Business tab asks for the country of the registered and operating addresses; there was nowhere to keep it. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipper_profiles', function (Blueprint $t) {
            $t->string('biz_country', 2)->nullable()->after('biz_zip');
            $t->string('ops_country', 2)->nullable()->after('ops_zip');
        });
    }

    public function down(): void
    {
        Schema::table('shipper_profiles', fn (Blueprint $t) => $t->dropColumn(['biz_country', 'ops_country']));
    }
};
