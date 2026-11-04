<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Background checks with more than one provider (Checkr, Foley) and two levels (docs: Resources → Profile / Verification).
 *
 * - background_checks: one row per order with a provider, for one person (a carrier owner or a driver).
 *   kind: basic (the $39 level) | full (the complete level ordered from scratch) | upgrade (the rest of the complete level, after basic).
 * - person_verifications: the person's level (basic | complete) and their provider candidate, so a re-run reuses it.
 * - carrier_profiles: the provider-named columns become provider-neutral.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('background_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();            // the person checked
            $table->foreignId('org_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->string('provider', 20);                                           // checkr | foley | fake
            $table->string('mode', 10)->default('test');                              // test | live
            $table->string('kind', 10);                                               // basic | full | upgrade
            $table->string('package', 100)->nullable();
            $table->string('status', 30)->default('invitation_sent');                 // invitation_sent | pending | clear | consider | suspended | expired
            $table->string('candidate_id')->nullable()->index();
            $table->string('invitation_id')->nullable()->index();
            $table->text('invitation_url')->nullable();
            $table->string('report_id')->nullable()->index();
            $table->string('paid_by', 10)->default('carrier');                        // carrier | shipper
            $table->foreignId('payer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('payer_org_id')->nullable()->constrained('organizations')->nullOnDelete();
            $table->unsignedInteger('amount_cents')->default(0);
            $table->string('payment_intent_id')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'kind']);
        });

        Schema::table('person_verifications', function (Blueprint $table) {
            $table->string('bg_provider', 20)->nullable();
            $table->string('bg_candidate_id')->nullable();
            $table->string('complete_check_status', 30)->nullable();
            $table->string('check_level', 10)->nullable();                            // basic | complete
            $table->timestamp('check_level_at')->nullable();
            $table->timestamp('complete_expires_at')->nullable();
        });

        Schema::table('carrier_profiles', function (Blueprint $table) {
            $table->renameColumn('checkr_candidate_id', 'bg_candidate_id');
            $table->renameColumn('checkr_report_id', 'bg_report_id');
        });

        // Checks already started with Checkr keep working: give each a row and copy the candidate to the person
        $profiles = DB::table('carrier_profiles')->whereNotNull('bg_candidate_id')->get(['id', 'user_id', 'bg_candidate_id', 'bg_report_id', 'background_check_status', 'onboarding_fee_paid']);
        foreach ($profiles as $p) {
            $status = in_array($p->background_check_status, ['invitation_sent', 'pending', 'clear', 'consider', 'suspended'], true) ? $p->background_check_status : 'expired';
            DB::table('background_checks')->insert([
                'user_id' => $p->user_id, 'provider' => 'checkr', 'mode' => 'test', 'kind' => 'basic',
                'status' => $status, 'candidate_id' => $p->bg_candidate_id, 'report_id' => $p->bg_report_id,
                'paid_by' => 'carrier', 'payer_user_id' => $p->user_id, 'amount_cents' => $p->onboarding_fee_paid ? 9900 : 0,
                'completed_at' => in_array($status, ['clear', 'consider', 'suspended'], true) ? now() : null,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('person_verifications')->where('user_id', $p->user_id)->update(['bg_provider' => 'checkr', 'bg_candidate_id' => $p->bg_candidate_id]);
        }

        // The carrier fee becomes the basic level ($39); the complete level is $99
        $fees = DB::table('platform_settings')->where('key', 'fees')->value('value');
        if ($fees) {
            $f = json_decode($fees, true);
            $f['onboarding_fee'] = 39;
            $f['complete_fee']   = $f['complete_fee'] ?? 99;
            DB::table('platform_settings')->where('key', 'fees')->update(['value' => json_encode($f)]);
        }
    }

    public function down(): void
    {
        Schema::table('carrier_profiles', function (Blueprint $table) {
            $table->renameColumn('bg_candidate_id', 'checkr_candidate_id');
            $table->renameColumn('bg_report_id', 'checkr_report_id');
        });
        Schema::table('person_verifications', function (Blueprint $table) {
            $table->dropColumn(['bg_provider', 'bg_candidate_id', 'complete_check_status', 'check_level', 'check_level_at', 'complete_expires_at']);
        });
        Schema::dropIfExists('background_checks');
    }
};
