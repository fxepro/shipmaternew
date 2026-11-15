<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Law enforcement (demo/law-enforcement.html): agencies as a company type, officers' details, a log of every
 * officer search and sign-in, records requests (Tier 3) and paid business reports on companies not on Shipmater.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check');
        DB::statement("ALTER TABLE organizations ADD CONSTRAINT organizations_type_check CHECK (type IN ('shipper','carrier','factor','receiver','broker','agency'))");
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('shipper','carrier','receiver','admin','factor','broker','agency'))");

        Schema::table('organizations', function (Blueprint $t) {
            $t->string('agency_kind', 40)->nullable();     // state_police, sheriff, police, federal, port, other
            $t->string('ori_number', 20)->nullable();      // NCIC Originating Agency Identifier
            $t->string('jurisdiction', 120)->nullable();
        });

        Schema::create('officer_profiles', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('badge_number', 40)->nullable();
            $t->string('title', 80)->nullable();
            $t->string('unit', 120)->nullable();
            $t->string('work_phone', 40)->nullable();
            $t->string('supervisor_name', 120)->nullable();
            $t->string('supervisor_email', 160)->nullable();
            $t->string('supervisor_phone', 40)->nullable();
            $t->timestamps();
        });

        Schema::create('le_access_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('org_id')->nullable()->constrained('organizations')->nullOnDelete();
            $t->string('action', 20);          // login, search, view, report, request
            $t->string('page', 30)->nullable(); // companies, people, vehicles, loads, tracking, reports, records
            $t->string('subject_type', 30)->nullable();
            $t->unsignedBigInteger('subject_id')->nullable();
            $t->string('subject_label', 200)->nullable();
            $t->string('query', 200)->nullable();
            $t->string('reason', 500)->nullable();
            $t->string('case_number', 80)->nullable();
            $t->unsignedInteger('results')->nullable();
            $t->string('ip', 45)->nullable();
            $t->string('user_agent', 300)->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['user_id', 'created_at']);
            $t->index(['org_id', 'created_at']);
            $t->index(['subject_type', 'subject_id']);
        });

        Schema::create('le_records_requests', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('case_number', 80);
            $t->string('legal_basis', 20);   // subpoena, court_order, warrant, emergency
            $t->string('subject', 300);
            $t->text('details')->nullable();
            $t->string('document_path')->nullable();
            $t->string('status', 20)->default('submitted'); // submitted, in_review, released, declined
            $t->text('response_notes')->nullable();
            $t->timestamp('decided_at')->nullable();
            $t->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('le_reports', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('query_type', 10);    // usdot, mc, ein, name
            $t->string('query', 200);
            $t->string('state', 2)->nullable();
            $t->string('case_number', 80)->nullable();
            $t->string('company_name', 200)->nullable();
            $t->string('status', 20)->default('running'); // running, ready, not_found, failed
            $t->json('sections')->nullable();
            $t->unsignedInteger('price_cents')->default(0);
            $t->string('charge_status', 20)->default('pending'); // pending, charged, invoiced, not_charged
            $t->timestamp('completed_at')->nullable();
            $t->timestamps();
            $t->index(['org_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('le_reports');
        Schema::dropIfExists('le_records_requests');
        Schema::dropIfExists('le_access_logs');
        Schema::dropIfExists('officer_profiles');
        Schema::table('organizations', fn (Blueprint $t) => $t->dropColumn(['agency_kind', 'ori_number', 'jurisdiction']));
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('shipper','carrier','receiver','admin','factor','broker'))");
        DB::statement('ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check');
        DB::statement("ALTER TABLE organizations ADD CONSTRAINT organizations_type_check CHECK (type IN ('shipper','carrier','factor','receiver','broker'))");
    }
};
