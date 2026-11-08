<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Verification policy, set by admins (Admin Console, Compliance):
 * - verification_policies: per company type and check, required / optional / deferred (N days) / off.
 *   No row = the default in App\Services\VerificationPolicy.
 * - verification_type_settings: approval mode per type (manual review or automatic when required checks pass).
 * - compliance_promotions: open season. While it runs, chosen checks drop to deferred or off for the types it covers;
 *   companies that joined during it get catch_up_days after it ends.
 * - verification_policy_changes: who changed what, when.
 * - organizations.joined_promotion_id / compliance_due_at: companies that joined under relaxed rules.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('verification_policies', function (Blueprint $t) {
            $t->id();
            $t->string('type', 20);
            $t->string('check_key', 50);
            $t->string('setting', 10);               // required | optional | deferred | off
            $t->unsignedSmallInteger('defer_days')->nullable();
            $t->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->unique(['type', 'check_key']);
        });

        Schema::create('verification_type_settings', function (Blueprint $t) {
            $t->id();
            $t->string('type', 20)->unique();
            $t->string('approval_mode', 10)->default('manual');  // manual | auto
            $t->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('compliance_promotions', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->timestamp('starts_at');
            $t->timestamp('ends_at');
            $t->json('types');                        // ["shipper","carrier"]
            $t->json('settings');                     // {"shipper": {"background": "off", "coi": "deferred"}}
            $t->unsignedSmallInteger('catch_up_days')->default(30);
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('verification_policy_changes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('type', 20)->nullable();
            $t->string('subject', 80);                // check key, "approval_mode" or "promotion:<id>"
            $t->string('from')->nullable();
            $t->string('to')->nullable();
            $t->timestamp('created_at')->useCurrent();
        });

        Schema::table('organizations', function (Blueprint $t) {
            $t->foreignId('joined_promotion_id')->nullable()->constrained('compliance_promotions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $t) {
            $t->dropConstrainedForeignId('joined_promotion_id');
        });
        Schema::dropIfExists('verification_policy_changes');
        Schema::dropIfExists('compliance_promotions');
        Schema::dropIfExists('verification_type_settings');
        Schema::dropIfExists('verification_policies');
    }
};
