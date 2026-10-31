<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Load payments and Shipmater revenue (docs/fees-and-billing.md).
 * - load_payments: one per load (shipment or freight job). The shipper's card is held the day before pickup and
 *   charged at delivery, or just before the hold expires. Early payment is charged at booking at the lower rate.
 *   Bank payments are charged at delivery. The money goes to the payee's own Stripe account (carrier, or factor
 *   when the load is factored); Shipmater's fee comes off as Stripe's application fee.
 * - fee_charges: Shipmater's fee on a factored load, charged to the carrier when the factor marks it funded.
 * - ledger_entries: every amount Shipmater earns (load fees, factored fees, subscriptions, onboarding),
 *   with the gross load volume alongside.
 * - platform_settings.payments.flow: 'direct' (to the payee) or 'platform' (through Shipmater's account).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('stripe_customer_id')->nullable();
        });
        Schema::table('payment_methods', function (Blueprint $table) {
            $table->index('org_id');
        });

        Schema::create('load_payments', function (Blueprint $table) {
            $table->id();
            $table->string('load_type', 20);            // shipment | freight_job
            $table->unsignedBigInteger('load_id');
            $table->foreignId('shipper_org_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->foreignId('carrier_org_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->foreignId('payee_org_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->string('payee_type', 10)->default('carrier');   // carrier | factor
            $table->foreignId('factored_load_id')->nullable()->constrained('factored_loads')->nullOnDelete();
            $table->unsignedBigInteger('amount_cents');
            $table->unsignedBigInteger('fee_cents')->default(0);
            $table->decimal('fee_rate', 6, 4);
            $table->boolean('early')->default(false);
            $table->string('flow', 10)->default('direct');           // direct | platform
            $table->string('method', 20)->nullable();                // card | us_bank_account
            $table->date('pickup_date')->nullable();
            // scheduled | hold_failed | held | processing | paid | failed | canceled | refunded
            $table->string('status', 20)->default('scheduled');
            $table->foreignId('payment_method_id')->nullable()->constrained('payment_methods')->nullOnDelete();
            $table->string('stripe_account')->nullable();            // payee's connected account
            $table->string('payment_intent_id')->nullable()->index();
            $table->string('charge_id')->nullable();
            $table->timestamp('held_at')->nullable();
            $table->timestamp('capture_before')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('failure_reason', 500)->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->unsignedBigInteger('refunded_cents')->default(0);
            $table->timestamps();
            $table->unique(['load_type', 'load_id']);
            $table->index(['status', 'pickup_date']);
        });

        Schema::create('fee_charges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factored_load_id')->constrained('factored_loads')->cascadeOnDelete();
            $table->foreignId('carrier_org_id')->constrained('organizations')->cascadeOnDelete();
            $table->unsignedBigInteger('load_amount_cents');
            $table->unsignedBigInteger('amount_cents');
            $table->decimal('fee_rate', 6, 4);
            $table->string('status', 20)->default('pending');        // pending | processing | paid | failed
            $table->foreignId('payment_method_id')->nullable()->constrained('payment_methods')->nullOnDelete();
            $table->string('payment_intent_id')->nullable()->index();
            $table->string('failure_reason', 500)->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            $table->unique('factored_load_id');
        });

        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 20);                  // load_fee | factored_fee | subscription | onboarding | refund
            $table->bigInteger('amount_cents');          // Shipmater revenue (negative for refunds)
            $table->bigInteger('gross_cents')->default(0); // load volume it came from
            $table->foreignId('org_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->string('source_type', 30)->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('reference')->nullable();     // Stripe id
            $table->string('description')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
            $table->unique(['kind', 'source_type', 'source_id', 'reference']);
            $table->index('occurred_at');
        });

        DB::table('platform_settings')->insertOrIgnore([
            'key' => 'payments', 'value' => json_encode(['flow' => 'direct']), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('platform_settings')->where('key', 'payments')->delete();
        Schema::dropIfExists('ledger_entries');
        Schema::dropIfExists('fee_charges');
        Schema::dropIfExists('load_payments');
        Schema::table('payment_methods', fn (Blueprint $table) => $table->dropIndex(['org_id']));
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn('stripe_customer_id'));
    }
};
