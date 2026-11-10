<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rate check (market rate guidance), App\Services\Rates\RateEstimator.
 *
 * freight_jobs.posted_rate_cents  the price a shipper or broker posts a Marketplace load at; carriers offer around it
 * freight_jobs.market_rate        the estimate when the rate was set: low, typical and high in cents, per mile, miles, source
 * rate_checks                     each rate check someone ran, kept so lanes can be compared
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('freight_jobs', function (Blueprint $t) {
            $t->unsignedInteger('posted_rate_cents')->nullable()->after('payment_amount_cents');
            $t->json('market_rate')->nullable()->after('posted_rate_cents');
        });

        Schema::create('rate_checks', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->nullable()->constrained('organizations')->nullOnDelete();   // the company that ran it
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();          // the person
            $t->string('origin', 200);
            $t->string('destination', 200);
            $t->string('equipment', 40);
            $t->date('pickup_date')->nullable();
            $t->boolean('hazmat')->default(false);
            $t->boolean('temp_controlled')->default(false);
            $t->unsignedSmallInteger('extra_stops')->default(0);
            $t->decimal('miles', 8, 1)->nullable();
            $t->json('result');
            $t->timestamps();
            $t->index(['org_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rate_checks');
        Schema::table('freight_jobs', fn (Blueprint $t) => $t->dropColumn(['posted_rate_cents', 'market_rate']));
    }
};
