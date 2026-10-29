<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // active | paused (read-only) | deactivated (cannot sign in)
            $table->string('status', 20)->default('active')->index();
            $table->text('status_reason')->nullable();
            $table->timestamp('status_changed_at')->nullable();
            $table->foreignId('status_changed_by')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('status_changed_by');
            $table->dropColumn(['status', 'status_reason', 'status_changed_at']);
        });
    }
};
