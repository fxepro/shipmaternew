<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Company-level approval for carrier and shipper organizations.
 * People are approved separately (carrier_profiles for now); both levels need a background check.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            // incomplete | pending_review | approved | rejected
            $table->string('verification_status', 30)->default('incomplete')->index();
            $table->text('verification_notes')->nullable();
            $table->timestamp('verification_updated_at')->nullable();
            $table->foreignId('verification_updated_by')->nullable()->constrained('users')->nullOnDelete();

            // not_started | pending | clear | consider | failed
            $table->string('background_check_status', 30)->default('not_started');
            $table->string('background_check_reference')->nullable();
            $table->text('background_check_notes')->nullable();
            $table->timestamp('background_checked_at')->nullable();
        });

        // Carry over any existing approval from the owner's profile
        DB::statement("
            UPDATE organizations o SET verification_status = p.verification_status
            FROM carrier_profiles p
            WHERE o.type = 'carrier' AND p.user_id = o.owner_id
              AND p.verification_status IN ('pending_review', 'approved', 'rejected')
        ");
        DB::statement("
            UPDATE organizations o SET verification_status = CASE p.verification_status
                WHEN 'verified' THEN 'approved' WHEN 'submitted' THEN 'pending_review' END
            FROM shipper_profiles p
            WHERE o.type = 'shipper' AND p.user_id = o.owner_id
              AND p.verification_status IN ('verified', 'submitted')
        ");
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('verification_updated_by');
            $table->dropColumn([
                'verification_status', 'verification_notes', 'verification_updated_at',
                'background_check_status', 'background_check_reference', 'background_check_notes', 'background_checked_at',
            ]);
        });
    }
};
