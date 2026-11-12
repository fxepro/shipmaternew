<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * VIN checks on carrier vehicles (NHTSA, free):
 *  - vin_decoded now keeps the full vPIC decode (engine, fuel, axles, trailer type, weight class…) plus the raw response
 *  - vin_mismatches: where what the carrier entered differs from the decoded VIN (year, make, vehicle class, GVWR)
 *  - vin_recalls: NHTSA recalls for the decoded year, make and model
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carrier_vehicles', function (Blueprint $t) {
            $t->json('vin_mismatches')->nullable();
            $t->json('vin_recalls')->nullable();
            $t->timestamp('recalls_checked_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('carrier_vehicles', fn (Blueprint $t) => $t->dropColumn(['vin_mismatches', 'vin_recalls', 'recalls_checked_at']));
    }
};
