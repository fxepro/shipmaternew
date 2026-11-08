<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Compliance documents and numbers that don't have their own column on organizations:
 * a factor's W-9 and licence, a broker's surety bond, a receiver's COI, and so on.
 * One row per company per item (key), see App\Support\ComplianceRules.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('org_compliance_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->string('key', 50);
            $t->string('value')->nullable();          // a number or name, e.g. bond # or licence #
            $t->string('file_path')->nullable();
            $t->string('file_name')->nullable();
            $t->date('expires_at')->nullable();
            $t->timestamp('verified_at')->nullable();
            $t->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->unique(['org_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('org_compliance_items');
    }
};
