<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A record each time a Shipmater admin opens a company's pages read-only
 * (Carrier View or Shipper View in the Admin Console). One row per admin, company and half hour.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_company_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('path', 255)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['org_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_company_views');
    }
};
