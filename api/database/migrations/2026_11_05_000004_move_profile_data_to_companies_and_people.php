<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Profile cleanup, step 1 (copy, nothing removed): company data moves from shipper_profiles and
 * carrier_profiles onto organizations, and personal data into the person tables (by user_id).
 *
 * organizations: columns every company has carry no prefix; shipper-only columns start with shipper_
 * and carrier-only ones with carrier_, and stay empty for the other type.
 * Child tables point at the company by type: carrier_vehicles.carrier_id, carrier_documents.carrier_id,
 * carrier_verifications.carrier_id (+ user_id for person checks), shipper_documents.shipper_id.
 * Company certifications get org_certifications, next to org_service_types.
 * The old tables and columns are dropped by a later migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $t) {
            // Every company
            $t->string('dba', 255)->nullable();
            $t->string('business_type', 100)->nullable();
            $t->string('industry', 100)->nullable();
            $t->string('state_of_incorporation', 2)->nullable();
            $t->string('year_established', 4)->nullable();
            $t->string('employee_count', 255)->nullable();
            $t->string('sam_gov_number', 255)->nullable();
            $t->string('phone_country_code', 2)->nullable();
            $t->string('phone_e164', 25)->nullable();
            $t->string('whatsapp', 40)->nullable();
            $t->string('whatsapp_country_code', 2)->nullable();
            $t->boolean('ops_same_as_biz')->default(true);
            $t->string('ops_street', 200)->nullable();
            $t->string('ops_city', 100)->nullable();
            $t->string('ops_state', 50)->nullable();
            $t->string('ops_zip', 20)->nullable();
            $t->string('ops_country', 2)->nullable();
            $t->decimal('rating', 3, 2)->nullable();
            $t->integer('total_ratings')->default(0);
            $t->timestamp('verification_submitted_at')->nullable();
            $t->string('stripe_connect_status', 30)->nullable();

            // Shippers only
            $t->string('shipper_verification_status', 30)->nullable();
            $t->timestamp('shipper_email_verified_at')->nullable();
            $t->timestamp('shipper_phone_verified_at')->nullable();
            $t->timestamp('shipper_ein_verified_at')->nullable();
            $t->string('shipper_default_pickup_contact_name', 255)->nullable();
            $t->string('shipper_default_pickup_contact_phone', 40)->nullable();
            $t->string('shipper_internal_ref_format', 255)->nullable();
            $t->json('shipper_preferred_categories')->nullable();
            $t->json('shipper_notif_recipients')->nullable();
            $t->json('shipper_notif_email')->nullable();
            $t->json('shipper_notif_sms')->nullable();
            $t->string('shipper_coi_url', 255)->nullable();
            $t->date('shipper_coi_expiry')->nullable();
            $t->string('shipper_hipaa_baa_url', 255)->nullable();
            $t->date('shipper_hipaa_baa_expiry')->nullable();
            $t->string('shipper_hazmat_reg_url', 255)->nullable();
            $t->date('shipper_hazmat_reg_expiry')->nullable();
            $t->text('shipper_plaid_access_token')->nullable();
            $t->string('shipper_plaid_item_id', 255)->nullable();
            $t->string('shipper_plaid_account_id', 255)->nullable();
            $t->timestamp('shipper_plaid_connected_at')->nullable();
            $t->string('shipper_bank_institution_name', 255)->nullable();
            $t->string('shipper_stripe_bank_source_id', 255)->nullable();

            // Carriers only
            $t->string('carrier_type', 255)->nullable();
            $t->timestamp('carrier_type_selected_at')->nullable();
            $t->string('carrier_dot_number', 20)->nullable()->index();
            $t->string('carrier_mc_number', 30)->nullable();
            $t->boolean('carrier_dot_verified')->default(false);
            $t->boolean('carrier_mc_verified')->default(false);
            $t->string('carrier_operating_country', 3)->nullable();
            $t->string('carrier_operating_authority_number', 60)->nullable();
            $t->string('carrier_operating_authority_type', 30)->nullable();
            $t->boolean('carrier_insurance_verified')->default(false);
            $t->string('carrier_auto_policy_number', 255)->nullable();
            $t->string('carrier_auto_insurer_name', 255)->nullable();
            $t->decimal('carrier_auto_coverage_amount', 12, 2)->nullable();
            $t->date('carrier_auto_effective_date')->nullable();
            $t->date('carrier_auto_expiry_date')->nullable();
            $t->string('carrier_cargo_policy_number', 255)->nullable();
            $t->string('carrier_cargo_insurer_name', 255)->nullable();
            $t->decimal('carrier_cargo_coverage_amount', 12, 2)->nullable();
            $t->date('carrier_cargo_expiry_date')->nullable();
            $t->integer('carrier_total_deliveries')->default(0);
            $t->boolean('carrier_onboarding_fee_paid')->default(false);
            $t->string('carrier_onboarding_fee_payment_intent_id', 255)->nullable();
            $t->timestamp('carrier_submitted_for_verification_at')->nullable();
            $t->timestamp('carrier_last_verification_at')->nullable();
            $t->timestamp('carrier_next_reverification_at')->nullable();
        });

        // Personal contact details and the second ID kept for non-US people; the SSN last 4 is encrypted like the ID number
        Schema::table('person_identities', function (Blueprint $t) {
            $t->string('photo_url', 255)->nullable();
            $t->string('phone_country_code', 2)->nullable();
            $t->string('phone_e164', 25)->nullable();
            $t->string('whatsapp', 40)->nullable();
            $t->string('whatsapp_country_code', 2)->nullable();
            $t->string('national_id_type', 50)->nullable();
            $t->text('national_id_number')->nullable();
        });
        DB::statement('ALTER TABLE person_identities ALTER COLUMN ssn_last4 TYPE text');
        foreach (DB::table('person_identities')->whereNotNull('ssn_last4')->get(['id', 'ssn_last4']) as $r) {
            if (strlen($r->ssn_last4) <= 4) {
                DB::table('person_identities')->where('id', $r->id)->update(['ssn_last4' => Crypt::encryptString($r->ssn_last4)]);
            }
        }

        Schema::table('person_verifications', function (Blueprint $t) {
            $t->string('bg_report_id', 255)->nullable();
            $t->string('clearinghouse_query_id', 255)->nullable();
            $t->string('clearinghouse_query_status', 255)->default('not_run');
            $t->timestamp('clearinghouse_queried_at')->nullable();
            $t->timestamp('clearinghouse_completed_at')->nullable();
            $t->json('clearinghouse_result_data')->nullable();
        });

        // Child tables point at the company by type
        Schema::table('carrier_vehicles', fn (Blueprint $t) => $t->renameColumn('org_id', 'carrier_id'));
        Schema::table('carrier_documents', fn (Blueprint $t) => $t->renameColumn('org_id', 'carrier_id'));
        Schema::table('carrier_verifications', function (Blueprint $t) {
            $t->renameColumn('org_id', 'carrier_id');
        });
        Schema::table('carrier_verifications', function (Blueprint $t) {
            $t->foreignId('user_id')->nullable()->after('carrier_id')->constrained('users')->nullOnDelete();
        });
        Schema::table('shipper_documents', function (Blueprint $t) {
            $t->foreignId('shipper_id')->nullable()->after('id')->constrained('organizations')->cascadeOnDelete();
        });
        foreach (['carrier_vehicles', 'carrier_documents', 'carrier_verifications', 'shipper_documents'] as $table) {
            $col = $table === 'shipper_documents' ? 'shipper_profile_id' : 'carrier_profile_id';
            DB::statement("ALTER TABLE {$table} ALTER COLUMN {$col} DROP NOT NULL");
        }

        Schema::create('org_certifications', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->foreignId('certification_id')->constrained('certifications')->cascadeOnDelete();
            $t->timestamps();
            $t->unique(['org_id', 'certification_id']);
        });

        $this->copyShippers();
        $this->copyCarriers();
    }

    // ── Data ───────────────────────────────────────────────────────────────────

    private function copyShippers(): void
    {
        foreach (DB::table('shipper_profiles')->get() as $p) {
            $org = $p->org_id ? DB::table('organizations')->find($p->org_id) : null;

            if ($org) {
                // Shared columns already set on the company win; empty ones are filled from the profile
                $fill = fn (string $col, $value) => ($org->{$col} === null || $org->{$col} === '') ? $value : $org->{$col};
                DB::table('organizations')->where('id', $org->id)->update([
                    'legal_name'             => $fill('legal_name', $p->company_name),
                    'dba'                    => $p->dba,
                    'business_type'          => $p->business_type,
                    'industry'               => $p->industry,
                    'state_of_incorporation' => $p->state_of_incorporation,
                    'year_established'       => $p->year_established,
                    'employee_count'         => $p->employee_count,
                    'sam_gov_number'         => $p->sam_gov_number,
                    'tax_id'                 => $fill('tax_id', $p->ein),
                    'website'                => $fill('website', $p->website),
                    'email'                  => $fill('email', $p->business_email),
                    'phone'                  => $fill('phone', $p->business_phone),
                    'street'                 => $fill('street', $p->biz_street),
                    'city'                   => $fill('city', $p->biz_city),
                    'state'                  => $fill('state', $p->biz_state),
                    'zip'                    => $fill('zip', $p->biz_zip),
                    'country'                => $fill('country', $p->biz_country),
                    'ops_same_as_biz'        => (bool) $p->ops_same_as_biz,
                    'ops_street'             => $p->ops_street,
                    'ops_city'               => $p->ops_city,
                    'ops_state'              => $p->ops_state,
                    'ops_zip'                => $p->ops_zip,
                    'ops_country'            => $p->ops_country,
                    'rating'                 => $p->rating,
                    'total_ratings'          => (int) $p->total_ratings,
                    'verification_submitted_at' => $p->verification_submitted_at,
                    'bank_name'              => $fill('bank_name', $p->bank_name),
                    'bank_last4'             => $fill('bank_last4', $p->bank_last4),
                    'shipper_verification_status'          => $p->verification_status,
                    'shipper_email_verified_at'            => $p->email_verified_at,
                    'shipper_phone_verified_at'            => $p->phone_verified_at,
                    'shipper_ein_verified_at'              => $p->ein_verified_at,
                    'shipper_default_pickup_contact_name'  => $p->default_pickup_contact_name,
                    'shipper_default_pickup_contact_phone' => $p->default_pickup_contact_phone,
                    'shipper_internal_ref_format'          => $p->internal_ref_format,
                    'shipper_preferred_categories'         => $p->preferred_categories,
                    'shipper_notif_recipients'             => $p->notif_recipients,
                    'shipper_notif_email'                  => $p->notif_email,
                    'shipper_notif_sms'                    => $p->notif_sms,
                    'shipper_coi_url'                      => $p->coi_url,
                    'shipper_coi_expiry'                   => $p->coi_expiry,
                    'shipper_hipaa_baa_url'                => $p->hipaa_baa_url,
                    'shipper_hipaa_baa_expiry'             => $p->hipaa_baa_expiry,
                    'shipper_hazmat_reg_url'               => $p->hazmat_reg_url,
                    'shipper_hazmat_reg_expiry'            => $p->hazmat_reg_expiry,
                    'shipper_plaid_access_token'           => $p->plaid_access_token ? Crypt::encryptString($p->plaid_access_token) : null,
                    'shipper_plaid_item_id'                => $p->plaid_item_id,
                    'shipper_plaid_account_id'             => $p->plaid_account_id,
                    'shipper_plaid_connected_at'           => $p->plaid_connected_at,
                    'shipper_bank_institution_name'        => $p->bank_institution_name,
                    'shipper_stripe_bank_source_id'        => $p->stripe_bank_source_id,
                ]);
                DB::table('shipper_documents')->where('shipper_profile_id', $p->id)->update(['shipper_id' => $org->id]);
            }

            // The person's own phone and home address
            $this->fillIdentity($p->user_id, [
                'phone'                 => $p->phone,
                'phone_country_code'    => $p->phone_country_code,
                'phone_e164'            => $p->phone_e164,
                'whatsapp'              => $p->whatsapp,
                'whatsapp_country_code' => $p->whatsapp_country_code,
                'street'                => $p->street,
                'city'                  => $p->city,
                'state'                 => $p->state,
                'zip'                   => $p->zip,
                'country'               => $this->countryCode($p->country),
            ]);
        }
    }

    private function copyCarriers(): void
    {
        foreach (DB::table('carrier_profiles')->get() as $p) {
            $org = $p->org_id ? DB::table('organizations')->find($p->org_id) : null;

            if ($org) {
                $dot = preg_replace('/\D/', '', (string) ($p->dot_number ?: $p->usdot_number)) ?: null;
                $mc  = preg_replace('/\D/', '', (string) $p->mc_number) ?: null;
                DB::table('organizations')->where('id', $org->id)->update([
                    'legal_name'                        => $org->legal_name ?: $p->company_name,
                    'rating'                            => $p->rating,
                    'total_ratings'                     => (int) $p->total_ratings,
                    'stripe_connect_id'                 => $org->stripe_connect_id ?: $p->stripe_account_id,
                    'stripe_connect_status'             => $p->stripe_account_id ? $p->stripe_account_status : null,
                    'verification_submitted_at'         => $p->submitted_for_verification_at,
                    'carrier_type'                      => $p->carrier_type,
                    'carrier_type_selected_at'          => $p->carrier_type_selected_at,
                    'carrier_dot_number'                => $dot,
                    'carrier_mc_number'                 => $mc,
                    'carrier_dot_verified'              => (bool) $p->dot_verified,
                    'carrier_mc_verified'               => (bool) $p->mc_verified,
                    'carrier_operating_country'         => $p->operating_country,
                    'carrier_operating_authority_number'=> $p->operating_authority_number,
                    'carrier_operating_authority_type'  => $p->operating_authority_type,
                    'carrier_insurance_verified'        => (bool) $p->insurance_verified,
                    'carrier_auto_policy_number'        => $p->auto_policy_number,
                    'carrier_auto_insurer_name'         => $p->auto_insurer_name,
                    'carrier_auto_coverage_amount'      => $p->auto_coverage_amount,
                    'carrier_auto_effective_date'       => $p->auto_effective_date,
                    'carrier_auto_expiry_date'          => $p->auto_expiry_date,
                    'carrier_cargo_policy_number'       => $p->cargo_policy_number,
                    'carrier_cargo_insurer_name'        => $p->cargo_insurer_name,
                    'carrier_cargo_coverage_amount'     => $p->cargo_coverage_amount,
                    'carrier_cargo_expiry_date'         => $p->cargo_expiry_date,
                    'carrier_total_deliveries'          => (int) $p->total_deliveries,
                    'carrier_onboarding_fee_paid'       => (bool) $p->onboarding_fee_paid,
                    'carrier_onboarding_fee_payment_intent_id' => $p->onboarding_fee_payment_intent_id,
                    'carrier_submitted_for_verification_at'    => $p->submitted_for_verification_at,
                    'carrier_last_verification_at'      => $p->last_verification_at,
                    'carrier_next_reverification_at'    => $p->next_reverification_at,
                ]);

                foreach (['carrier_vehicles', 'carrier_documents', 'carrier_verifications'] as $table) {
                    DB::table($table)->where('carrier_profile_id', $p->id)->whereNull('carrier_id')->update(['carrier_id' => $org->id]);
                }
                foreach (DB::table('carrier_profile_service_types')->where('carrier_profile_id', $p->id)->pluck('service_type_id') as $id) {
                    DB::table('org_service_types')->insertOrIgnore(['org_id' => $org->id, 'service_type_id' => $id, 'created_at' => now(), 'updated_at' => now()]);
                }
                foreach (DB::table('carrier_profile_certifications')->where('carrier_profile_id', $p->id)->pluck('certification_id') as $id) {
                    DB::table('org_certifications')->insertOrIgnore(['org_id' => $org->id, 'certification_id' => $id, 'created_at' => now(), 'updated_at' => now()]);
                }
            }
            // Identity and background checks recorded against the profile belong to its owner
            DB::table('carrier_verifications')->where('carrier_profile_id', $p->id)
                ->whereIn('check_type', ['identity', 'background', 'clearinghouse'])->update(['user_id' => $p->user_id]);

            // The person: identity, credentials, checks
            $ssn = null;
            if ($p->ssn_last_4) {
                try { $ssn = substr(Crypt::decryptString($p->ssn_last_4), -4); } catch (\Throwable) { $ssn = null; }
            }
            $idType = $p->id_type === 'passport' ? 'passport' : ($p->dl_number ? 'driver_license' : null);
            $this->fillIdentity($p->user_id, [
                'date_of_birth'         => $p->date_of_birth,
                'photo_url'             => $p->photo_url,
                'phone'                 => $p->phone,
                'phone_country_code'    => $p->phone_country_code,
                'phone_e164'            => $p->phone_e164,
                'whatsapp'              => $p->whatsapp,
                'whatsapp_country_code' => $p->whatsapp_country_code,
                'street'                => $p->street,
                'city'                  => $p->city,
                'state'                 => $p->state,
                'zip'                   => $p->zip,
                'country'               => $this->countryCode($p->country),
                'id_type'               => $idType,
                'id_issuing_state'      => $p->dl_state,
                'id_issuing_country'    => $this->countryCode($p->dl_country),
                'id_expiry_date'        => $p->dl_expiry,
                'national_id_type'      => $p->national_id_type,
            ], [
                'ssn_last4'          => $ssn,
                'id_number'          => $p->dl_number,
                'national_id_number' => $p->national_id_number,
            ], $p->identity_verified ? ($p->identity_verified_at ?? now()) : null);

            $credential = function (string $type, bool $present, array $fields) use ($p) {
                if (!$present) return;
                $exists = DB::table('person_credentials')->where('user_id', $p->user_id)->where('type', $type)->exists();
                if ($exists) {
                    // Fill gaps only; an admin may already have verified it
                    $row = DB::table('person_credentials')->where('user_id', $p->user_id)->where('type', $type)->orderByDesc('updated_at')->first();
                    $gaps = array_filter($fields, fn ($v, $k) => $v !== null && ($row->{$k} === null || $row->{$k} === ''), ARRAY_FILTER_USE_BOTH);
                    if ($gaps) DB::table('person_credentials')->where('id', $row->id)->update($gaps + ['updated_at' => now()]);
                    return;
                }
                DB::table('person_credentials')->insert($fields + [
                    'user_id' => $p->user_id, 'type' => $type, 'source' => 'carrier_profile',
                    'name' => \App\Services\PersonChecks::CREDENTIAL_LABELS[$type] ?? $type,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            };
            $credential('cdl', (bool) $p->cdl_number, ['number' => $p->cdl_number, 'issuing_state' => $p->cdl_issuing_state, 'class' => $p->cdl_class, 'expires_at' => $p->cdl_expiry_date]);
            $credential('dot_medical', (bool) ($p->dot_medical_expiry || $p->medical_examiner_name), ['issuer' => $p->medical_examiner_name, 'expires_at' => $p->dot_medical_expiry]);
            $credential('drug_test', (bool) $p->drug_test_date, ['issued_at' => $p->drug_test_date, 'result' => $p->drug_test_result]);
            $credential('hazmat_endorsement', (bool) $p->hazmat_endorsement, ['expires_at' => $p->hazmat_expiry_date]);
            $credential('tanker_endorsement', (bool) $p->tanker_endorsement, []);
            $credential('passenger_endorsement', (bool) $p->passenger_endorsement, []);

            $pv = DB::table('person_verifications')->where('user_id', $p->user_id)->first();
            $checks = [
                'bg_report_id'               => $p->bg_report_id,
                'clearinghouse_query_id'     => $p->clearinghouse_query_id,
                'clearinghouse_query_status' => $p->clearinghouse_query_status ?: 'not_run',
                'clearinghouse_queried_at'   => $p->clearinghouse_queried_at,
                'clearinghouse_completed_at' => $p->clearinghouse_completed_at,
                'clearinghouse_result_data'  => $p->clearinghouse_result_data,
            ];
            if ($pv) {
                DB::table('person_verifications')->where('id', $pv->id)->update($checks + [
                    'bg_candidate_id' => $pv->bg_candidate_id ?: $p->bg_candidate_id,
                    'notes'           => $pv->notes ?: $p->verification_notes,
                ]);
            } else {
                DB::table('person_verifications')->insert($checks + [
                    'user_id' => $p->user_id, 'status' => $p->verification_status ?: 'incomplete',
                    'background_check_status' => match ($p->background_check_status) {
                        null, '', 'not_submitted' => 'not_started', 'approved' => 'clear', 'rejected', 'suspended' => 'failed',
                        default => $p->background_check_status,
                    },
                    'bg_candidate_id' => $p->bg_candidate_id, 'notes' => $p->verification_notes,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    /** Fill the person's identity record: empty fields only, so nothing already verified is overwritten. */
    private function fillIdentity(int $userId, array $plain, array $encrypted = [], $verifiedAt = null): void
    {
        $row = DB::table('person_identities')->where('user_id', $userId)->first();
        if (!$row) {
            DB::table('person_identities')->insert(['user_id' => $userId, 'status' => 'not_started', 'created_at' => now(), 'updated_at' => now()]);
            $row = DB::table('person_identities')->where('user_id', $userId)->first();
        }

        $update = [];
        foreach ($plain as $col => $value) {
            if ($value !== null && $value !== '' && ($row->{$col} === null || $row->{$col} === '')) $update[$col] = $value;
        }
        foreach ($encrypted as $col => $value) {
            if ($value !== null && $value !== '' && ($row->{$col} === null || $row->{$col} === '')) {
                $update[$col] = Crypt::encryptString((string) $value);
                if ($col === 'id_number' && !$row->id_number_last4) $update['id_number_last4'] = substr((string) $value, -4);
            }
        }
        if ($verifiedAt && $row->status !== 'verified') {
            $update += ['status' => 'verified', 'verification_method' => $row->verification_method ?: 'stripe_identity', 'verified_at' => $verifiedAt];
        }
        if ($update) DB::table('person_identities')->where('id', $row->id)->update($update + ['updated_at' => now()]);
    }

    private function countryCode(?string $country): ?string
    {
        if (!$country) return null;
        $c = strtoupper(trim($country));
        if (strlen($c) === 2) return $c;
        return match ($c) {
            'USA', 'UNITED STATES', 'UNITED STATES OF AMERICA' => 'US',
            'CAN', 'CANADA' => 'CA',
            'MEX', 'MEXICO' => 'MX',
            default => null,
        };
    }

    public function down(): void
    {
        Schema::dropIfExists('org_certifications');
        Schema::table('shipper_documents', function (Blueprint $t) { $t->dropConstrainedForeignId('shipper_id'); });
        Schema::table('carrier_verifications', function (Blueprint $t) { $t->dropConstrainedForeignId('user_id'); });
        Schema::table('carrier_verifications', fn (Blueprint $t) => $t->renameColumn('carrier_id', 'org_id'));
        Schema::table('carrier_documents', fn (Blueprint $t) => $t->renameColumn('carrier_id', 'org_id'));
        Schema::table('carrier_vehicles', fn (Blueprint $t) => $t->renameColumn('carrier_id', 'org_id'));
        Schema::table('person_verifications', fn (Blueprint $t) => $t->dropColumn([
            'bg_report_id', 'clearinghouse_query_id', 'clearinghouse_query_status', 'clearinghouse_queried_at',
            'clearinghouse_completed_at', 'clearinghouse_result_data',
        ]));
        Schema::table('person_identities', fn (Blueprint $t) => $t->dropColumn([
            'photo_url', 'phone_country_code', 'phone_e164', 'whatsapp', 'whatsapp_country_code', 'national_id_type', 'national_id_number',
        ]));
        Schema::table('organizations', fn (Blueprint $t) => $t->dropColumn([
            'dba', 'business_type', 'industry', 'state_of_incorporation', 'year_established', 'employee_count', 'sam_gov_number',
            'phone_country_code', 'phone_e164', 'whatsapp', 'whatsapp_country_code', 'ops_same_as_biz', 'ops_street', 'ops_city',
            'ops_state', 'ops_zip', 'ops_country', 'rating', 'total_ratings', 'verification_submitted_at', 'stripe_connect_status',
            'shipper_verification_status', 'shipper_email_verified_at', 'shipper_phone_verified_at', 'shipper_ein_verified_at',
            'shipper_default_pickup_contact_name', 'shipper_default_pickup_contact_phone', 'shipper_internal_ref_format',
            'shipper_preferred_categories', 'shipper_notif_recipients', 'shipper_notif_email', 'shipper_notif_sms',
            'shipper_coi_url', 'shipper_coi_expiry', 'shipper_hipaa_baa_url', 'shipper_hipaa_baa_expiry', 'shipper_hazmat_reg_url',
            'shipper_hazmat_reg_expiry', 'shipper_plaid_access_token', 'shipper_plaid_item_id', 'shipper_plaid_account_id',
            'shipper_plaid_connected_at', 'shipper_bank_institution_name', 'shipper_stripe_bank_source_id',
            'carrier_type', 'carrier_type_selected_at', 'carrier_dot_number', 'carrier_mc_number', 'carrier_dot_verified',
            'carrier_mc_verified', 'carrier_operating_country', 'carrier_operating_authority_number', 'carrier_operating_authority_type',
            'carrier_insurance_verified', 'carrier_auto_policy_number', 'carrier_auto_insurer_name', 'carrier_auto_coverage_amount',
            'carrier_auto_effective_date', 'carrier_auto_expiry_date', 'carrier_cargo_policy_number', 'carrier_cargo_insurer_name',
            'carrier_cargo_coverage_amount', 'carrier_cargo_expiry_date', 'carrier_total_deliveries', 'carrier_onboarding_fee_paid',
            'carrier_onboarding_fee_payment_intent_id', 'carrier_submitted_for_verification_at', 'carrier_last_verification_at',
            'carrier_next_reverification_at',
        ]));
    }
};
