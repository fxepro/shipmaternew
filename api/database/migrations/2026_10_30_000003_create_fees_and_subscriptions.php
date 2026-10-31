<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fees set by admins (docs/fees-and-billing.md) and shipper subscriptions.
 * - platform_settings: key → JSON value. 'fees' holds the platform fee rates, onboarding fee and subscription tiers.
 * - shipper_subscriptions: one per shipper company, tiered by self-stated yearly load value, re-tiered every 12 months.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->json('value');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        DB::table('platform_settings')->insert([
            'key'   => 'fees',
            'value' => json_encode([
                'standard_rate'  => 0.10,   // X: every load, paid by the carrier
                'early_rate'     => 0.075,  // Y: shipper pays at booking
                'onboarding_fee' => 99,     // carrier, one-time
                'tiers' => [
                    ['key' => 'small',  'label' => 'Up to $10,000',          'max_annual_value' => 10000,    'monthly_price' => 35],
                    ['key' => 'medium', 'label' => '$10,000 to $10,000,000', 'max_annual_value' => 10000000, 'monthly_price' => 75],
                    ['key' => 'large',  'label' => 'Over $10,000,000',       'max_annual_value' => null,     'monthly_price' => 199],
                ],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Schema::create('shipper_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('org_id')->unique()->constrained('organizations')->cascadeOnDelete();
            $table->string('tier', 20);
            $table->decimal('monthly_price', 10, 2);
            $table->decimal('stated_annual_value', 14, 2);
            // pending (awaiting card) | active | past_due | canceled
            $table->string('status', 20)->default('pending');
            $table->string('stripe_customer_id')->nullable();
            $table->string('stripe_subscription_id')->nullable();
            $table->string('stripe_checkout_session_id')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('tier_review_at')->nullable();   // 12 months after start; re-tier on actual load value
            $table->foreignId('started_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipper_subscriptions');
        Schema::dropIfExists('platform_settings');
    }
};
