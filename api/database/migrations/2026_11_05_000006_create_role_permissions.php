<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Role permissions for companies (Admin Console, Settings, Roles & Permissions).
 * The defaults are in App\Support\Permissions; role_permissions holds only the levels an admin changed,
 * so "Reset to defaults" removes rows. Every change is kept in role_permission_changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_permissions', function (Blueprint $t) {
            $t->id();
            $t->string('org_type', 20);     // shipper, carrier, factor
            $t->string('role', 30);         // org_members.role
            $t->string('permission', 60);   // action key, e.g. loads.bid
            $t->string('level', 20);        // full, view, assigned, self, none
            $t->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->unique(['org_type', 'role', 'permission']);
        });

        Schema::create('role_permission_changes', function (Blueprint $t) {
            $t->id();
            $t->string('org_type', 20);
            $t->string('role', 30);
            $t->string('permission', 60);
            $t->string('old_level', 20);
            $t->string('new_level', 20);
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete(); // the admin who changed it
            $t->timestamp('created_at')->useCurrent();
            $t->index(['org_type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permission_changes');
        Schema::dropIfExists('role_permissions');
    }
};
