<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Everything Stripe needs to open a payout account, collected in Shipmater and sent in one go
 * (docs/fees-and-billing.md). Business details sit on the company; people are the representative
 * (factors only; a carrier's representative is the owner's own profile) and owners with 25%+.
 * Bank numbers never reach Shipmater: Stripe.js turns them into a token, and only the token,
 * bank name, routing number and last 4 are kept.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $t) {
            $t->string('business_structure', 40)->nullable();   // individual, sole_proprietorship, single_member_llc, multi_member_llc, private_corporation, private_partnership
            $t->string('legal_name')->nullable();
            $t->string('representative_title', 100)->nullable();
            $t->decimal('representative_ownership', 5, 2)->nullable();
            $t->string('statement_descriptor', 22)->nullable();
            $t->string('product_description', 500)->nullable();
            $t->string('bank_token')->nullable();
            $t->string('bank_name')->nullable();
            $t->string('bank_last4', 4)->nullable();
            $t->string('bank_routing', 9)->nullable();
            $t->string('bank_holder_name')->nullable();
            $t->string('bank_holder_type', 10)->nullable();
            $t->json('stripe_requirements')->nullable();
            $t->timestamp('stripe_submitted_at')->nullable();
        });

        Schema::create('business_people', function (Blueprint $t) {
            $t->id();
            $t->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $t->boolean('is_representative')->default(false);
            $t->string('first_name', 100);
            $t->string('last_name', 100);
            $t->string('email');
            $t->string('phone', 40)->nullable();
            $t->date('dob')->nullable();
            $t->string('street')->nullable();
            $t->string('city', 100)->nullable();
            $t->string('state', 2)->nullable();
            $t->string('zip', 10)->nullable();
            $t->text('ssn_last_4')->nullable();                 // encrypted
            $t->string('title', 100)->nullable();
            $t->decimal('percent_ownership', 5, 2)->nullable();
            $t->string('stripe_person_id')->nullable();
            $t->timestamps();
            $t->index(['organization_id', 'is_representative']);
        });

        // SSN last 4 is now encrypted at rest
        Schema::table('carrier_profiles', fn (Blueprint $t) => $t->text('ssn_last_4')->nullable()->change());
        DB::table('carrier_profiles')->whereNotNull('ssn_last_4')->where('ssn_last_4', '!=', '')->orderBy('id')
            ->each(function ($row) {
                if (strlen($row->ssn_last_4) <= 4) {
                    DB::table('carrier_profiles')->where('id', $row->id)->update(['ssn_last_4' => Crypt::encryptString($row->ssn_last_4)]);
                }
            });
    }

    public function down(): void
    {
        DB::table('carrier_profiles')->whereNotNull('ssn_last_4')->orderBy('id')->each(function ($row) {
            try { $plain = Crypt::decryptString($row->ssn_last_4); } catch (\Throwable) { $plain = null; }
            DB::table('carrier_profiles')->where('id', $row->id)->update(['ssn_last_4' => $plain]);
        });
        Schema::table('carrier_profiles', fn (Blueprint $t) => $t->string('ssn_last_4', 4)->nullable()->change());

        Schema::dropIfExists('business_people');
        Schema::table('organizations', function (Blueprint $t) {
            $t->dropColumn([
                'business_structure', 'legal_name', 'representative_title', 'representative_ownership', 'statement_descriptor',
                'product_description', 'bank_token', 'bank_name', 'bank_last4', 'bank_routing', 'bank_holder_name', 'bank_holder_type',
                'stripe_requirements', 'stripe_submitted_at',
            ]);
        });
    }
};
