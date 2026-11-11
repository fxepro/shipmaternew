<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reviews: each company gives feedback to the one it worked with (App\Http\Controllers\Api\ReviewController).
 *
 * On a load (freight_job_id): shipper ↔ broker, broker ↔ carrier, shipper ↔ carrier (no broker),
 * receiver ↔ carrier. On factoring (noa_id): carrier ↔ factor.
 * A receiver can be a person with no company, so reviewer_org_id may be empty; reviewer_user_id is always
 * the person who wrote it. Admins can hide a review (kept, with who and why); hidden reviews leave the average.
 *
 * Replaces the old ratings table (shipper ↔ carrier only, never used: no rows).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $t) {
            $t->id();
            $t->foreignId('freight_job_id')->nullable()->constrained('freight_jobs')->cascadeOnDelete();
            $t->foreignId('noa_id')->nullable()->constrained('noas')->cascadeOnDelete();
            $t->foreignId('reviewer_org_id')->nullable()->constrained('organizations')->cascadeOnDelete();
            $t->foreignId('reviewer_user_id')->constrained('users')->cascadeOnDelete();
            $t->string('reviewer_role', 20);   // shipper | broker | carrier | receiver | factor
            $t->foreignId('reviewee_org_id')->constrained('organizations')->cascadeOnDelete();
            $t->string('reviewee_role', 20);
            $t->unsignedTinyInteger('overall');         // 1–5
            $t->unsignedTinyInteger('communication');   // 1–5
            $t->unsignedTinyInteger('reliability');     // 1–5; what it means depends on who is reviewed
            $t->text('comment')->nullable();
            $t->boolean('is_public')->default(true);
            $t->timestamp('hidden_at')->nullable();
            $t->foreignId('hidden_by')->nullable()->constrained('users')->nullOnDelete();
            $t->string('hidden_reason', 500)->nullable();
            $t->timestamps();

            $t->unique(['freight_job_id', 'reviewer_user_id', 'reviewee_org_id']);
            $t->unique(['noa_id', 'reviewer_user_id', 'reviewee_org_id']);
            $t->index(['reviewee_org_id', 'hidden_at']);
            $t->index('reviewer_org_id');
        });

        Schema::dropIfExists('ratings');
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
