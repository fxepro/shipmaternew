<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Compliance checked against outside sources (demo/compliance-checks.html):
 *  - org_checks: one row per company and outside check (kyb, fmcsa_broker, sam_gov) with the provider's results
 *  - carrier_vehicles: the VIN decoded by NHTSA vPIC
 *  - the admin policy loses the items that were not real checks, and the owner check splits into identity and background
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('org_checks', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->string('check', 30);                 // kyb, fmcsa_broker, sam_gov
            $t->string('provider', 30);              // middesk, fake, fmcsa, sam_gov
            $t->string('mode', 10)->default('test');
            $t->string('external_id')->nullable();   // the provider's id (Middesk business id)
            $t->string('status', 20)->default('pending'); // pending, completed, error
            $t->json('results')->nullable();         // per item: passed, failed, review, with messages
            $t->string('input_hash', 64)->nullable(); // what was sent, so a change runs it again
            $t->text('error')->nullable();
            $t->timestamp('requested_at')->nullable();
            $t->timestamp('completed_at')->nullable();
            $t->timestamps();
            $t->unique(['org_id', 'check']);
            $t->index(['check', 'external_id']);
        });

        Schema::table('carrier_vehicles', function (Blueprint $t) {
            $t->string('vin_status', 20)->nullable();   // valid, invalid, error
            $t->json('vin_decoded')->nullable();
            $t->timestamp('vin_checked_at')->nullable();
        });

        // Not real checks (removed), or folded into another item
        DB::table('verification_policies')->whereIn('check_key', [
            'background', 'submitted', 'documents', 'authority_type', 'authority_number', 'auto_coverage', 'cargo_coverage',
        ])->delete();

        // Owner approved → owner identity and owner background, keeping the admin's setting
        foreach (DB::table('verification_policies')->where('check_key', 'owner_approved')->get() as $r) {
            foreach (['owner_identity', 'owner_background'] as $k) {
                DB::table('verification_policies')->updateOrInsert(['type' => $r->type, 'check_key' => $k],
                    ['setting' => $r->setting, 'defer_days' => $r->defer_days, 'updated_by' => $r->updated_by, 'created_at' => now(), 'updated_at' => now()]);
            }
        }
        DB::table('verification_policies')->where('check_key', 'owner_approved')->delete();
    }

    public function down(): void
    {
        Schema::table('carrier_vehicles', fn (Blueprint $t) => $t->dropColumn(['vin_status', 'vin_decoded', 'vin_checked_at']));
        Schema::dropIfExists('org_checks');
    }
};
