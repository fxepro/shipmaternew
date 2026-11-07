<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One directory of organizations: every company in shipping (shipper, carrier, factor, receiver, broker)
 * is an organization, and any organization can have locations and contacts.
 *
 * - An organization can be listed before anyone from it signs up (no owner yet). A shipper lists a receiver,
 *   and someone from that receiver can later claim it.
 * - A location has no pickup or delivery type: any location can ship and receive. Public by default.
 * - Contacts belong to an organization (optionally one location) and choose which load updates they get.
 * - A shipper keeps its receivers in org_partners.
 * - Receivers who signed up before this had no company: each gets a receiver organization.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Organizations: more types, listed (unowned) organizations ─────────────
        DB::statement('ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check');
        DB::statement("ALTER TABLE organizations ADD CONSTRAINT organizations_type_check CHECK (type IN ('shipper','carrier','factor','receiver','broker'))");
        DB::statement('ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check');
        DB::statement("ALTER TABLE organizations ADD CONSTRAINT organizations_status_check CHECK (status IN ('active','suspended','onboarding','listed'))");
        DB::statement('ALTER TABLE organizations ALTER COLUMN owner_id DROP NOT NULL');

        Schema::table('organizations', function (Blueprint $t) {
            $t->foreignId('listed_by_org_id')->nullable()->after('owner_id')->constrained('organizations')->nullOnDelete();
            $t->foreignId('listed_by_user_id')->nullable()->after('listed_by_org_id')->constrained('users')->nullOnDelete();
            $t->timestamp('claimed_at')->nullable()->after('listed_by_user_id');
        });

        // ── Locations: no pickup/delivery type, public by default, site details ───
        DB::statement('ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_type_check');
        Schema::table('locations', function (Blueprint $t) {
            $t->dropColumn('type');
        });
        Schema::table('locations', function (Blueprint $t) {
            $t->string('visibility', 10)->default('public')->after('name');
            $t->unsignedSmallInteger('dock_doors')->nullable()->after('operating_hours');
            $t->boolean('appointment_required')->default(false)->after('dock_doors');
            $t->text('site_instructions')->nullable()->after('appointment_required');
            $t->foreignId('created_by_org_id')->nullable()->after('org_id')->constrained('organizations')->nullOnDelete();
        });
        DB::statement("ALTER TABLE locations ADD CONSTRAINT locations_visibility_check CHECK (visibility IN ('public','private'))");

        // ── Contacts with notification settings ───────────────────────────────────
        Schema::create('org_contacts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->foreignId('location_id')->nullable()->constrained('locations')->nullOnDelete();   // null = the whole company
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();           // set once the contact has an account
            $t->string('name', 150);
            $t->string('title', 100)->nullable();     // e.g. Warehouse manager, Receiving lead
            $t->string('phone', 30)->nullable();
            $t->string('mobile', 30)->nullable();     // texts go here
            $t->string('email', 150)->nullable();
            $t->boolean('is_primary')->default(false);
            $t->json('notify')->nullable();           // {event: [channel, ...]} — see App\Models\OrgContact::EVENTS
            $t->text('notes')->nullable();
            $t->foreignId('created_by_org_id')->nullable()->constrained('organizations')->nullOnDelete();
            $t->timestamps();
            $t->index(['org_id', 'location_id']);
        });

        // ── A company's saved organizations (a shipper's receivers) ───────────────
        Schema::create('org_partners', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->foreignId('partner_org_id')->constrained('organizations')->cascadeOnDelete();
            $t->string('relation', 20)->default('receiver');   // receiver, broker
            $t->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $t->text('notes')->nullable();
            $t->timestamps();
            $t->unique(['org_id', 'partner_org_id', 'relation']);
        });

        // ── Claiming a listed organization ────────────────────────────────────────
        Schema::create('org_claims', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->string('as_type', 20);                    // the type the organization becomes: receiver, shipper, carrier, broker
            $t->string('status', 20)->default('pending'); // pending, approved, rejected
            $t->string('method', 20)->nullable();         // contact_email (matched a listed contact), admin
            $t->text('note')->nullable();
            $t->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('decided_at')->nullable();
            $t->timestamps();
            $t->index(['status', 'created_at']);
        });

        // ── What each contact was sent ────────────────────────────────────────────
        Schema::create('contact_notifications', function (Blueprint $t) {
            $t->id();
            $t->foreignId('contact_id')->nullable()->constrained('org_contacts')->nullOnDelete();
            $t->foreignId('org_id')->nullable()->constrained('organizations')->nullOnDelete();
            $t->foreignId('freight_job_id')->nullable()->constrained('freight_jobs')->nullOnDelete();
            $t->foreignId('stop_id')->nullable()->constrained('job_stops')->nullOnDelete();
            $t->string('event', 20);
            $t->string('channel', 10);                    // email, sms
            $t->string('recipient', 150)->nullable();
            $t->string('status', 10);                     // sent, skipped, failed
            $t->string('detail', 255)->nullable();
            $t->timestamp('created_at')->nullable();
            $t->index(['freight_job_id', 'created_at']);
        });

        // ── Receivers who signed up without a company get one ─────────────────────
        $receivers = DB::table('users')->where('role', 'receiver')
            ->whereNotExists(fn ($q) => $q->from('org_members')->whereColumn('org_members.user_id', 'users.id'))
            ->get(['id', 'name', 'email']);
        foreach ($receivers as $u) {
            $name = $u->name . ' (receiving)';
            $slug = \Illuminate\Support\Str::slug($name . '-receiver') . '-' . $u->id;
            $orgId = DB::table('organizations')->insertGetId([
                'name' => $name, 'legal_name' => null, 'slug' => $slug, 'type' => 'receiver', 'plan' => 'free',
                'status' => 'active', 'owner_id' => $u->id, 'email' => $u->email, 'country' => 'US',
                'verification_status' => 'not_required', 'claimed_at' => now(),
                'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('org_members')->insert([
                'org_id' => $orgId, 'user_id' => $u->id, 'role' => 'owner', 'status' => 'active',
                'joined_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('users')->where('id', $u->id)->update(['current_org_id' => $orgId]);
            DB::table('load_people')->whereNull('org_id')->where('user_id', $u->id)->update(['org_id' => $orgId]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_notifications');
        Schema::dropIfExists('org_claims');
        Schema::dropIfExists('org_partners');
        Schema::dropIfExists('org_contacts');
        DB::statement('ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_visibility_check');
        Schema::table('locations', function (Blueprint $t) {
            $t->dropConstrainedForeignId('created_by_org_id');
            $t->dropColumn(['visibility', 'dock_doors', 'appointment_required', 'site_instructions']);
            $t->string('type', 20)->default('both');
        });
        Schema::table('organizations', function (Blueprint $t) {
            $t->dropConstrainedForeignId('listed_by_user_id');
            $t->dropConstrainedForeignId('listed_by_org_id');
            $t->dropColumn('claimed_at');
        });
    }
};
