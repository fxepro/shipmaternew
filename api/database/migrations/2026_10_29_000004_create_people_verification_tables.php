<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Person-level checks for everyone at a carrier or shipper company (docs/people-types-and-checks.md):
 *  - person_verifications: approval status and background check, one row per person
 *  - person_identities:    the identity record Shipmater keeps, one row per person
 *  - person_credentials:   licences, medical cards, certifications, MVR etc., many per person
 * Fields that carrier_profiles still collects are mirrored in (see CarrierProfile::booted) and copied here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('person_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();

            // not_required | incomplete | pending_payment | pending_background | pending_review | approved | rejected
            $table->string('status', 30)->default('incomplete')->index();
            $table->text('notes')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();

            // not_started | invitation_sent | pending | in_progress | clear | consider | failed
            $table->string('background_check_status', 30)->default('not_started');
            $table->string('background_check_reference')->nullable();
            $table->text('background_check_notes')->nullable();
            $table->timestamp('background_checked_at')->nullable();

            $table->timestamps();
        });

        Schema::create('person_identities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();

            $table->string('legal_first_name')->nullable();
            $table->string('legal_middle_name')->nullable();
            $table->string('legal_last_name')->nullable();
            $table->string('suffix', 20)->nullable();
            $table->date('date_of_birth')->nullable();

            $table->string('street')->nullable();
            $table->string('unit', 50)->nullable();
            $table->string('city')->nullable();
            $table->string('state', 100)->nullable();
            $table->string('zip', 20)->nullable();
            $table->string('country', 2)->nullable();
            $table->string('phone', 40)->nullable();

            // driver_license | passport | state_id | national_id
            $table->string('id_type', 30)->nullable();
            $table->text('id_number')->nullable();          // encrypted
            $table->string('id_number_last4', 4)->nullable();
            $table->string('id_issuing_state', 100)->nullable();
            $table->string('id_issuing_country', 2)->nullable();
            $table->date('id_issue_date')->nullable();
            $table->date('id_expiry_date')->nullable();

            // Private storage paths
            $table->string('id_front_path')->nullable();
            $table->string('id_back_path')->nullable();
            $table->string('selfie_path')->nullable();

            $table->string('ssn_last4', 4)->nullable();     // the full SSN is never stored

            // not_started | submitted | pending | verified | failed
            $table->string('status', 30)->default('not_started');
            $table->string('verification_method', 30)->nullable();   // stripe_identity | manual
            $table->string('provider_reference')->nullable();        // Stripe VerificationSession id
            $table->text('failure_reason')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
        });

        Schema::create('person_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();

            // cdl | dot_medical | clearinghouse | mvr | drug_test | hazmat_endorsement | tanker_endorsement
            // | passenger_endorsement | dispatcher_certification | hazmat_shipper_training | other
            $table->string('type', 40)->index();
            $table->string('name')->nullable();
            $table->string('issuer')->nullable();
            $table->string('number')->nullable();
            $table->string('issuing_state', 100)->nullable();
            $table->string('class', 20)->nullable();         // CDL class A/B/C
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();

            // Outcome for checks (clearinghouse, mvr, drug_test): pending | clear | failed | violations_found
            $table->string('result', 30)->nullable();

            $table->string('document_path')->nullable();
            $table->string('source', 30)->default('self');  // self | carrier_profile | clearinghouse | admin
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();

            $table->timestamps();
            $table->index(['user_id', 'type']);
        });

        $this->backfill();
    }

    private function backfill(): void
    {
        // Every person at a carrier or shipper company gets a verification row
        DB::statement("
            INSERT INTO person_verifications (user_id, status, created_at, updated_at)
            SELECT DISTINCT u.id, 'incomplete', NOW(), NOW()
            FROM users u
            LEFT JOIN org_members m ON m.user_id = u.id
            LEFT JOIN organizations o ON o.id = m.org_id
            WHERE u.role IN ('carrier', 'shipper') OR o.type IN ('carrier', 'shipper')
            ON CONFLICT (user_id) DO NOTHING
        ");

        // Carrier people: approval and background from their carrier profile
        DB::statement("
            UPDATE person_verifications v SET
                status = COALESCE(p.verification_status, 'incomplete'),
                notes = p.verification_notes,
                reviewed_at = CASE WHEN p.verification_status IN ('approved', 'rejected') THEN p.verification_status_updated_at END,
                background_check_status = COALESCE(p.background_check_status, 'not_started')
            FROM carrier_profiles p WHERE p.user_id = v.user_id
        ");

        // Identity record from the carrier profile
        DB::statement("
            INSERT INTO person_identities
                (user_id, date_of_birth, street, city, state, zip, country, phone,
                 id_type, id_issuing_state, id_expiry_date, ssn_last4,
                 status, verification_method, verified_at, created_at, updated_at)
            SELECT p.user_id, p.date_of_birth, p.street, p.city, p.state, p.zip, LEFT(p.country, 2), p.phone,
                   CASE WHEN p.id_type = 'passport' THEN 'passport' WHEN p.dl_number IS NOT NULL THEN 'driver_license' END,
                   p.dl_state, p.dl_expiry, LEFT(p.ssn_last_4, 4),
                   CASE WHEN p.identity_verified THEN 'verified' ELSE 'not_started' END,
                   CASE WHEN p.identity_verified THEN 'stripe_identity' END,
                   CASE WHEN p.identity_verified THEN COALESCE(p.identity_verified_at, NOW()) END,
                   NOW(), NOW()
            FROM carrier_profiles p
            ON CONFLICT (user_id) DO NOTHING
        ");

        // Driver credentials from the carrier profile
        $credentials = [
            "'cdl', 'Commercial driver license', cdl_number, cdl_issuing_state, cdl_class, NULL::date, cdl_expiry_date, NULL WHERE cdl_number IS NOT NULL",
            "'dot_medical', 'DOT medical card', NULL, NULL, NULL, NULL::date, dot_medical_expiry, NULL WHERE dot_medical_expiry IS NOT NULL",
            "'drug_test', 'Pre-employment drug test', NULL, NULL, NULL, drug_test_date, NULL::date, drug_test_result WHERE drug_test_date IS NOT NULL",
            "'hazmat_endorsement', 'Hazmat endorsement', NULL, NULL, NULL, NULL::date, hazmat_expiry_date, NULL WHERE hazmat_endorsement",
            "'tanker_endorsement', 'Tanker endorsement', NULL, NULL, NULL, NULL::date, NULL::date, NULL WHERE tanker_endorsement",
            "'passenger_endorsement', 'Passenger endorsement', NULL, NULL, NULL, NULL::date, NULL::date, NULL WHERE passenger_endorsement",
            "'clearinghouse', 'FMCSA Clearinghouse query', clearinghouse_query_id, NULL, NULL, clearinghouse_completed_at::date, NULL::date, clearinghouse_query_status WHERE clearinghouse_query_status IS NOT NULL AND clearinghouse_query_status <> 'not_run'",
        ];
        foreach ($credentials as $select) {
            DB::statement("
                INSERT INTO person_credentials
                    (user_id, type, name, number, issuing_state, class, issued_at, expires_at, result, source, created_at, updated_at)
                SELECT user_id, {$this->withSource($select)}
            ");
        }

        // Clearinghouse results are verified by the query itself
        DB::statement("UPDATE person_credentials SET verified_at = updated_at WHERE type = 'clearinghouse' AND result = 'clear'");
    }

    /** Inserts 'carrier_profile' as the source and timestamps before the WHERE clause. */
    private function withSource(string $select): string
    {
        [$columns, $where] = explode(' WHERE ', $select, 2);
        return "{$columns}, 'carrier_profile', NOW(), NOW() FROM carrier_profiles WHERE {$where}";
    }

    public function down(): void
    {
        Schema::dropIfExists('person_credentials');
        Schema::dropIfExists('person_identities');
        Schema::dropIfExists('person_verifications');
    }
};
