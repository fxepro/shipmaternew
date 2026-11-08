<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What the shipper (or the broker for it) declares when a load is posted: the commodity and weight are
 * accurate and the hazmat flag is right (the shipper is legally responsible for these), and, for
 * temperature-controlled food, the written sanitary and temperature instructions (FSMA sanitary transport).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('freight_jobs', function (Blueprint $t) {
            $t->string('commodity', 200)->nullable()->after('title');
            $t->text('sanitary_instructions')->nullable()->after('special_instructions');
            $t->timestamp('declared_at')->nullable()->after('posted_at');
            $t->foreignId('declared_by')->nullable()->after('declared_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('freight_jobs', function (Blueprint $t) {
            $t->dropConstrainedForeignId('declared_by');
            $t->dropColumn(['commodity', 'sanitary_instructions', 'declared_at']);
        });
    }
};
