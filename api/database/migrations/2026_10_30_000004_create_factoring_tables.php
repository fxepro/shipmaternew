<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * NOAs and factored loads (docs/noa-factoring.md).
 * - noas: a carrier company's notice of assignment to a factor; the factor confirms it, and only the factor releases it.
 * - factored_loads: loads the carrier asks to factor under an active NOA; the factor accepts, then marks them funded.
 *   Shippers pay accepted loads through Shipmater into the factor's own Stripe account.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('noas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('carrier_org_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('factor_org_id')->constrained('organizations')->cascadeOnDelete();
            // pending_factor | active | declined | released
            $table->string('status', 20)->default('pending_factor');
            $table->date('effective_date');
            $table->string('document_path');
            $table->string('release_document_path')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->string('decline_reason', 500)->nullable();
            $table->timestamp('release_requested_at')->nullable();
            $table->foreignId('released_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
            $table->index(['carrier_org_id', 'status']);
            $table->index(['factor_org_id', 'status']);
        });

        Schema::create('factored_loads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('noa_id')->constrained('noas')->cascadeOnDelete();
            $table->foreignId('carrier_org_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('factor_org_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('load_type', 20);   // shipment | freight_job
            $table->unsignedBigInteger('load_id');
            $table->decimal('load_amount', 12, 2)->nullable();
            // requested | accepted | declined | funded
            $table->string('status', 20)->default('requested');
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->string('decline_reason', 500)->nullable();
            $table->timestamp('funded_at')->nullable();
            $table->foreignId('funded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('shipper_acknowledged_at')->nullable();
            $table->foreignId('shipper_acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['load_type', 'load_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('factored_loads');
        Schema::dropIfExists('noas');
    }
};
