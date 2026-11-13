<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Performance metrics per company (demo/public-profiles.html), calculated daily from load records so the internal
 * Performance tab and the public profile always show the same number, with its period and sample size.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('org_metrics', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->string('key', 60);
            $t->decimal('value', 14, 4)->nullable();
            $t->unsignedInteger('sample')->default(0);
            $t->date('period_from');
            $t->date('period_to');
            $t->timestamp('computed_at');
            $t->unique(['org_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('org_metrics');
    }
};
