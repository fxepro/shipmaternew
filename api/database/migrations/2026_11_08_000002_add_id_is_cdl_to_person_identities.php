<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A driver whose government ID is their CDL enters it once: with id_is_cdl the ID number, state and expiry
 * are copied from the CDL (person_credentials type cdl) whenever either is saved.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('person_identities', function (Blueprint $t) {
            $t->boolean('id_is_cdl')->default(false)->after('id_type');
        });
    }

    public function down(): void
    {
        Schema::table('person_identities', fn (Blueprint $t) => $t->dropColumn('id_is_cdl'));
    }
};
