<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One naming rule for every table:
 *   org_id, shipper_id, carrier_id, factor_id, payee_id, payer_id, rater_id, ratee_id → organizations.id (a company)
 *   user_id → users.id (a person)
 *
 * Before this, shipper_id and carrier_id on loads, bids, transactions, contracts, preferred carriers
 * and locations held a person. They now hold the person's company, and the person moves to user_id.
 * The people on a load (the shipper's dispatcher, the carrier's drivers) are rows in load_people,
 * each with their company and user_id. Their role comes from org_members.
 */
return new class extends Migration
{
    /** The id of the company of a given type that a person (users.id in $col) owns or belongs to */
    private function orgOf(string $col, string $type): string
    {
        return "(select o.id from organizations o where o.type = '{$type}' and (o.owner_id = {$col}"
            . " or o.id in (select m.org_id from org_members m where m.user_id = {$col})) order by o.id limit 1)";
    }

    private function notNull(string $table, string $col): void
    {
        DB::statement("alter table {$table} alter column {$col} set not null");
    }

    private function renameForeign(string $table, string $from, string $to): void
    {
        DB::statement("alter table {$table} rename constraint {$table}_{$from}_foreign to {$table}_{$to}_foreign");
    }

    public function up(): void
    {
        // ── People on a load ────────────────────────────────────────────────
        Schema::create('load_people', function (Blueprint $t) {
            $t->id();
            $t->string('load_type', 20);                 // shipment | freight_job
            $t->unsignedBigInteger('load_id');
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $t->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->unique(['load_type', 'load_id', 'user_id']);
            $t->index(['load_type', 'load_id']);
            $t->index('org_id');
            $t->index('user_id');
        });

        // ── Shipments and freight jobs ──────────────────────────────────────
        foreach (['shipments' => 'shipment', 'freight_jobs' => 'freight_job'] as $table => $loadType) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropForeign(['shipper_id']);
                $t->dropForeign(['carrier_id']);
            });
            Schema::table($table, function (Blueprint $t) {
                $t->renameColumn('shipper_id', 'old_shipper_person');
                $t->renameColumn('carrier_id', 'old_carrier_person');
            });
            Schema::table($table, function (Blueprint $t) {
                $t->foreignId('shipper_id')->nullable()->constrained('organizations');
                $t->foreignId('carrier_id')->nullable()->constrained('organizations');
            });
            DB::statement("update {$table} t set shipper_id = {$this->orgOf('t.old_shipper_person', 'shipper')},"
                . " carrier_id = {$this->orgOf('t.old_carrier_person', 'carrier')}");

            DB::statement("insert into load_people (load_type, load_id, org_id, user_id, created_at, updated_at)
                select '{$loadType}', id, shipper_id, old_shipper_person, created_at, now() from {$table}
                where shipper_id is not null and old_shipper_person is not null
                on conflict do nothing");
            DB::statement("insert into load_people (load_type, load_id, org_id, user_id, created_at, updated_at)
                select '{$loadType}', id, carrier_id, old_carrier_person, created_at, now() from {$table}
                where carrier_id is not null and old_carrier_person is not null
                on conflict do nothing");
            DB::statement("insert into load_people (load_type, load_id, org_id, user_id, added_by, created_at, updated_at)
                select '{$loadType}', id, carrier_id, driver_id, driver_assigned_by, coalesce(driver_assigned_at, now()), now() from {$table}
                where carrier_id is not null and driver_id is not null
                on conflict do nothing");

            Schema::table($table, function (Blueprint $t) {
                $t->dropColumn(['old_shipper_person', 'old_carrier_person', 'driver_id', 'driver_assigned_at', 'driver_assigned_by', 'org_id']);
            });
            $this->notNull($table, 'shipper_id');
            if ($table === 'freight_jobs') {
                Schema::table($table, function (Blueprint $t) {
                    $t->index(['shipper_id', 'status']);
                    $t->index(['carrier_id', 'status']);
                });
            }
        }

        // ── Bids: one per carrier company; user_id is who placed it ────────
        DB::statement('alter table bids drop constraint if exists bids_shipment_id_carrier_id_unique'); DB::statement('drop index if exists bids_shipment_id_carrier_id_unique');
        Schema::table('bids', function (Blueprint $t) {
            $t->renameColumn('carrier_id', 'user_id');
        });
        $this->renameForeign('bids', 'carrier_id', 'user_id');
        Schema::table('bids', function (Blueprint $t) {
            $t->renameColumn('org_id', 'carrier_id');
        });
        DB::statement("update bids b set carrier_id = {$this->orgOf('b.user_id', 'carrier')} where carrier_id is null");
        $this->notNull('bids', 'carrier_id');
        Schema::table('bids', fn (Blueprint $t) => $t->unique(['shipment_id', 'carrier_id']));

        // ── Freight job offers: the same ────────────────────────────────────
        DB::statement('alter table freight_job_offers drop constraint if exists freight_job_offers_freight_job_id_carrier_id_unique'); DB::statement('drop index if exists freight_job_offers_freight_job_id_carrier_id_unique');
        Schema::table('freight_job_offers', fn (Blueprint $t) => $t->renameColumn('carrier_id', 'user_id'));
        $this->renameForeign('freight_job_offers', 'carrier_id', 'user_id');
        Schema::table('freight_job_offers', fn (Blueprint $t) => $t->foreignId('carrier_id')->nullable()->after('freight_job_id')->constrained('organizations'));
        DB::statement("update freight_job_offers f set carrier_id = {$this->orgOf('f.user_id', 'carrier')}");
        $this->notNull('freight_job_offers', 'carrier_id');
        Schema::table('freight_job_offers', fn (Blueprint $t) => $t->unique(['freight_job_id', 'carrier_id']));

        // ── Transactions: the two companies, and the carrier person who did the work ──
        Schema::table('transactions', function (Blueprint $t) {
            $t->dropForeign(['shipper_id']);
        });
        Schema::table('transactions', function (Blueprint $t) {
            $t->renameColumn('shipper_id', 'old_shipper_person');
            $t->renameColumn('carrier_id', 'user_id');
        });
        $this->renameForeign('transactions', 'carrier_id', 'user_id');
        Schema::table('transactions', function (Blueprint $t) {
            $t->foreignId('shipper_id')->nullable()->constrained('organizations');
            $t->foreignId('carrier_id')->nullable()->constrained('organizations');
        });
        DB::statement("update transactions t set shipper_id = {$this->orgOf('t.old_shipper_person', 'shipper')},"
            . " carrier_id = {$this->orgOf('t.user_id', 'carrier')}");
        Schema::table('transactions', fn (Blueprint $t) => $t->dropColumn('old_shipper_person'));
        $this->notNull('transactions', 'shipper_id');
        $this->notNull('transactions', 'carrier_id');

        // ── Contracts and preferred carriers: companies only ────────────────
        foreach (['contracts', 'preferred_carriers'] as $table) {
            DB::statement("update {$table} t set shipper_org_id = {$this->orgOf('t.shipper_id', 'shipper')} where shipper_org_id is null");
            DB::statement("update {$table} t set carrier_org_id = {$this->orgOf('t.carrier_id', 'carrier')} where carrier_org_id is null");
            Schema::table($table, fn (Blueprint $t) => $t->dropColumn(['shipper_id', 'carrier_id']));
            Schema::table($table, function (Blueprint $t) {
                $t->renameColumn('shipper_org_id', 'shipper_id');
                $t->renameColumn('carrier_org_id', 'carrier_id');
            });
            $this->notNull($table, 'shipper_id');
            $this->notNull($table, 'carrier_id');
        }
        Schema::table('preferred_carriers', fn (Blueprint $t) => $t->unique(['shipper_id', 'carrier_id']));
        Schema::table('contracts', function (Blueprint $t) {
            $t->index(['shipper_id', 'status']);
            $t->index(['carrier_id', 'status']);
        });

        // ── Locations: belong to a company ──────────────────────────────────
        DB::statement("update locations l set org_id = {$this->orgOf('l.shipper_id', 'shipper')} where org_id is null");
        Schema::table('locations', fn (Blueprint $t) => $t->dropColumn('shipper_id'));
        $this->notNull('locations', 'org_id');
        Schema::table('locations', fn (Blueprint $t) => $t->index(['org_id', 'type']));

        // ── Ratings: company rates company; user_id is who wrote it ─────────
        DB::statement('alter table ratings drop constraint if exists ratings_freight_job_id_rater_id_unique'); DB::statement('drop index if exists ratings_freight_job_id_rater_id_unique');
        Schema::table('ratings', fn (Blueprint $t) => $t->dropColumn('ratee_id'));
        Schema::table('ratings', fn (Blueprint $t) => $t->renameColumn('rater_id', 'user_id'));
        Schema::table('ratings', function (Blueprint $t) {
            $t->renameColumn('rater_org_id', 'rater_id');
            $t->renameColumn('ratee_org_id', 'ratee_id');
        });
        Schema::table('ratings', fn (Blueprint $t) => $t->unique(['freight_job_id', 'rater_id']));

        // ── Money tables: drop the _org suffix ──────────────────────────────
        Schema::table('load_payments', function (Blueprint $t) {
            $t->renameColumn('shipper_org_id', 'shipper_id');
            $t->renameColumn('carrier_org_id', 'carrier_id');
            $t->renameColumn('payee_org_id', 'payee_id');
        });
        Schema::table('load_payments', fn (Blueprint $t) => $t->foreignId('user_id')->nullable()->after('payee_type')->constrained('users')->nullOnDelete());
        Schema::table('factored_loads', function (Blueprint $t) {
            $t->renameColumn('carrier_org_id', 'carrier_id');
            $t->renameColumn('factor_org_id', 'factor_id');
        });
        Schema::table('noas', function (Blueprint $t) {
            $t->renameColumn('carrier_org_id', 'carrier_id');
            $t->renameColumn('factor_org_id', 'factor_id');
        });
        Schema::table('fee_charges', fn (Blueprint $t) => $t->renameColumn('carrier_org_id', 'carrier_id'));
        Schema::table('background_checks', fn (Blueprint $t) => $t->renameColumn('payer_org_id', 'payer_id'));

        // Foreign keys keep their name through a column rename; name each after its column again
        $tables = "'shipments','freight_jobs','bids','freight_job_offers','transactions','contracts','preferred_carriers',"
            . "'locations','ratings','load_payments','factored_loads','noas','fee_charges','background_checks'";
        foreach (DB::select("select c.conname, t.relname tbl, a.attname col from pg_constraint c
                join pg_class t on t.oid = c.conrelid
                join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
                where c.contype = 'f' and array_length(c.conkey, 1) = 1 and t.relname in ({$tables})") as $fk) {
            $want = "{$fk->tbl}_{$fk->col}_foreign";
            if ($fk->conname !== $want) DB::statement("alter table {$fk->tbl} rename constraint {$fk->conname} to {$want}");
        }
    }

    public function down(): void
    {
        throw new RuntimeException('This migration changes what shipper_id and carrier_id mean and cannot be undone automatically. Restore the database from the backup taken before it ran.');
    }
};
