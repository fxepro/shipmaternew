<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The driver a carrier assigns to a load (marketplace shipments and contracted freight jobs).
 * Only approved drivers with current credentials can be assigned.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['shipments', 'freight_jobs'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->foreignId('driver_id')->nullable()->constrained('users')->nullOnDelete();
                $t->timestamp('driver_assigned_at')->nullable();
                $t->foreignId('driver_assigned_by')->nullable()->constrained('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach (['shipments', 'freight_jobs'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropConstrainedForeignId('driver_assigned_by');
                $t->dropConstrainedForeignId('driver_id');
                $t->dropColumn('driver_assigned_at');
            });
        }
    }
};
