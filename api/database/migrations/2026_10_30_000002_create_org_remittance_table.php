<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where a company is paid outside Shipmater. For a factor, this is what shippers see on the
 * loads it funds (docs/noa-factoring.md). Shipmater never moves this money.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('org_remittance', function (Blueprint $table) {
            $table->id();
            $table->foreignId('org_id')->unique()->constrained('organizations')->cascadeOnDelete();
            $table->string('payee_name')->nullable();
            // ACH
            $table->string('bank_name')->nullable();
            $table->string('routing_number', 9)->nullable();
            $table->text('account_number')->nullable();          // encrypted
            $table->string('account_last4', 4)->nullable();
            $table->string('account_type', 10)->nullable();      // checking | savings
            // Wire (optional)
            $table->string('wire_routing_number', 9)->nullable();
            // Check by mail
            $table->string('check_payable_to')->nullable();
            $table->string('check_street')->nullable();
            $table->string('check_city', 120)->nullable();
            $table->string('check_state', 60)->nullable();
            $table->string('check_zip', 20)->nullable();
            // Remittance advice
            $table->string('remittance_email')->nullable();
            $table->string('remittance_phone', 40)->nullable();
            $table->text('instructions')->nullable();
            // Billing contact (Shipmater invoices)
            $table->string('billing_name')->nullable();
            $table->string('billing_email')->nullable();
            $table->string('billing_phone', 40)->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('org_remittance');
    }
};
