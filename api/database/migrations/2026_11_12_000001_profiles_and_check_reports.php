<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Profiles people get hired from, and the check reports they paid for.
 * - pro_profiles.slug: the public link, /p/{slug}. visibility gains "public" (anyone with the link).
 * - pro_experiences: work history, like a resume. Jobs at a Shipmater company can be matched to it (org_id).
 * - person_credentials: what document AI read from the uploaded certificate, and how it was verified.
 * - background_checks: the provider's report PDF, kept privately.
 * - document_downloads: every download of a check PDF (who, whose, which, when).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pro_profiles', function (Blueprint $t) {
            $t->string('slug', 80)->nullable()->unique()->after('user_id');
        });
        foreach (DB::table('pro_profiles')->join('users', 'users.id', '=', 'pro_profiles.user_id')->select('pro_profiles.id', 'users.name')->get() as $p) {
            DB::table('pro_profiles')->where('id', $p->id)->update(['slug' => self::slug($p->name)]);
        }

        Schema::create('pro_experiences', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('title', 120);
            $t->string('company_name', 160);
            $t->foreignId('org_id')->nullable()->constrained('organizations')->nullOnDelete();
            $t->string('employment_type', 30)->nullable();   // company_driver, owner_operator, lease, contract, training
            $t->string('location', 120)->nullable();
            $t->date('start_date');
            $t->date('end_date')->nullable();                // null = current
            $t->text('description')->nullable();
            $t->jsonb('equipment')->default('[]');
            $t->timestamps();
            $t->index(['user_id', 'start_date']);
        });

        Schema::table('person_credentials', function (Blueprint $t) {
            $t->string('verification_method', 30)->nullable()->after('verified_by');   // admin | document_ai | check
            $t->string('ai_status', 20)->nullable();                                  // verified | review | unreadable | error
            $t->jsonb('ai_fields')->nullable();
            $t->unsignedSmallInteger('ai_name_score')->nullable();
            $t->text('ai_reason')->nullable();
            $t->timestamp('ai_checked_at')->nullable();
        });

        Schema::table('background_checks', function (Blueprint $t) {
            $t->string('report_pdf_path')->nullable();
            $t->timestamp('report_pdf_at')->nullable();
        });

        Schema::create('document_downloads', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();          // who downloaded
            $t->foreignId('subject_user_id')->nullable()->constrained('users')->nullOnDelete();  // whose document
            $t->string('kind', 40);                                                              // check_summary | check_report | check_email
            $t->string('ref_type', 40);
            $t->unsignedBigInteger('ref_id');
            $t->string('ip', 45)->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['subject_user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_downloads');
        Schema::table('background_checks', fn (Blueprint $t) => $t->dropColumn(['report_pdf_path', 'report_pdf_at']));
        Schema::table('person_credentials', fn (Blueprint $t) => $t->dropColumn(['verification_method', 'ai_status', 'ai_fields', 'ai_name_score', 'ai_reason', 'ai_checked_at']));
        Schema::dropIfExists('pro_experiences');
        Schema::table('pro_profiles', fn (Blueprint $t) => $t->dropColumn('slug'));
    }

    private static function slug(?string $name): string
    {
        $base = Str::slug(Str::limit((string) $name, 60, '')) ?: 'driver';
        do { $slug = $base . '-' . Str::lower(Str::random(4)); } while (DB::table('pro_profiles')->where('slug', $slug)->exists());
        return $slug;
    }
};
