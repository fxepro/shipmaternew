<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Separate entities: company, person, vehicle and operating authority.
 *
 * - operating_authorities: a company's DOT / MC / broker authority, with its insurance. A company can hold
 *   carrier and broker authority at once; a vehicle can run under another company's authority (lease-on).
 * - capabilities: the catalog of equipment (reefer, flatbed, tanker…), vehicle features (liftgate, food grade…)
 *   and driver endorsements (H, N, T…). Vehicles and loads use these keys, so a load can be matched to carriers.
 * - carrier_vehicles: owner (company or person) separate from the carrier operating it, a standard equipment type,
 *   temperature range, features.
 * - organizations.categories: what a company is in the directory (3PL, warehouse, equipment provider…),
 *   several at once. organizations.type stays the role it plays on Shipmater.
 * - pro_profiles: a person's professional profile (CDL, endorsements, experience, open to work).
 * - freight_jobs: equipment and requirements a load needs.
 * - service_types: the remaining carrier specializations.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── Operating authority ────────────────────────────────────────────────
        Schema::create('operating_authorities', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->string('kind', 20);                         // carrier | broker | forwarder
            $t->string('country', 3)->default('US');
            $t->string('dot_number', 20)->nullable();
            $t->string('mc_number', 30)->nullable();
            $t->string('authority_number', 60)->nullable(); // non-US: NSC, Permiso SCT…
            $t->string('authority_type', 30)->nullable();   // common | contract | intrastate | private
            $t->string('status', 20)->default('pending');   // pending | active | inactive | revoked
            $t->boolean('hazmat_authorized')->default(false);
            $t->boolean('is_primary')->default(false);
            $t->string('source', 20)->default('self');      // self | fmcsa | admin
            $t->timestamp('verified_at')->nullable();
            $t->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $t->string('auto_insurer_name')->nullable();
            $t->string('auto_policy_number')->nullable();
            $t->decimal('auto_coverage_amount', 12, 2)->nullable();
            $t->date('auto_expiry_date')->nullable();
            $t->string('cargo_insurer_name')->nullable();
            $t->string('cargo_policy_number')->nullable();
            $t->decimal('cargo_coverage_amount', 12, 2)->nullable();
            $t->date('cargo_expiry_date')->nullable();
            $t->string('bond_number')->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();
            $t->index(['org_id', 'kind']);
            $t->index('dot_number');
            $t->index('mc_number');
        });

        // ── Capability catalog ─────────────────────────────────────────────────
        Schema::create('capabilities', function (Blueprint $t) {
            $t->id();
            $t->string('key', 50)->unique();
            $t->string('name');
            $t->string('kind', 20);                          // equipment | feature | endorsement
            $t->string('service_type_key', 60)->nullable();  // equipment → the carrier specialization it implies
            $t->string('description')->nullable();
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->boolean('active')->default(true);
            $t->timestamps();
        });
        $now = now();
        $rows = [];
        $add = function (string $kind, array $items) use (&$rows, $now) {
            foreach (array_values($items) as $i => $it) {
                $rows[] = ['key' => $it[0], 'name' => $it[1], 'kind' => $kind, 'service_type_key' => $it[2] ?? null,
                    'description' => $it[3] ?? null, 'sort_order' => $i + 1, 'active' => true, 'created_at' => $now, 'updated_at' => $now];
            }
        };
        $add('equipment', [
            ['dry_van', 'Dry van', 'dry_van'],
            ['reefer', 'Refrigerated (reefer)', 'refrigerated'],
            ['flatbed', 'Flatbed', 'flatbed'],
            ['step_deck', 'Step deck', 'flatbed'],
            ['conestoga', 'Conestoga', 'flatbed'],
            ['lowboy', 'Lowboy / RGN', 'oversized_load'],
            ['double_drop', 'Double drop', 'oversized_load'],
            ['tanker', 'Tanker (liquid bulk)', 'tanker_liquid'],
            ['pneumatic', 'Dry bulk / pneumatic', 'dry_bulk'],
            ['hopper', 'Hopper', 'dry_bulk'],
            ['dump', 'Dump', 'construction_materials'],
            ['livestock', 'Livestock trailer', 'livestock'],
            ['car_hauler', 'Car hauler (open)', 'auto_transport_open'],
            ['car_hauler_enclosed', 'Car hauler (enclosed)', 'auto_transport_enclosed'],
            ['log_trailer', 'Log trailer', 'logging_forestry'],
            ['container_chassis', 'Container chassis', 'intermodal_container'],
            ['power_only', 'Power only', 'general_freight'],
            ['box_truck', 'Box truck', 'general_freight'],
            ['cargo_van', 'Cargo van / sprinter', 'hotshot'],
            ['hotshot', 'Hotshot (pickup + gooseneck)', 'hotshot'],
        ]);
        $add('feature', [
            ['liftgate', 'Liftgate'],
            ['team', 'Team drivers'],
            ['hazmat_placard', 'Hazmat placarded'],
            ['food_grade', 'Food grade'],
            ['tarps', 'Tarps'],
            ['straps_chains', 'Straps and chains'],
            ['pallet_jack', 'Pallet jack'],
            ['ramps', 'Ramps'],
            ['oversize_permits', 'Oversize permits'],
            ['escort', 'Pilot / escort car'],
            ['twic', 'TWIC card (ports)'],
            ['blower', 'Blower / pump'],
            ['air_ride', 'Air ride'],
            ['e_track', 'E-track / load bars'],
        ]);
        $add('endorsement', [
            ['endorse_h', 'H — Hazardous materials'],
            ['endorse_n', 'N — Tank vehicle'],
            ['endorse_x', 'X — Tank + hazmat'],
            ['endorse_t', 'T — Double / triple trailers'],
            ['endorse_p', 'P — Passenger'],
            ['endorse_s', 'S — School bus'],
        ]);
        DB::table('capabilities')->insert($rows);

        // ── Specializations still missing from service_types ───────────────────
        $sortBase = (int) DB::table('service_types')->whereNull('parent_id')->max('sort_order');
        $parents = [
            ['bulk_liquid', 'Bulk & Liquid', '🛢️', [
                ['tanker_liquid', 'Tanker & Liquid Bulk', true, true, true, false],
                ['dry_bulk', 'Dry Bulk & Pneumatic', true, true, false, false],
            ]],
            ['agri_livestock', 'Agriculture, Livestock & Forestry', '🌾', [
                ['livestock', 'Livestock', true, true, false, false],
                ['agricultural', 'Agricultural Freight', true, true, false, false],
                ['logging_forestry', 'Logging & Forestry', true, true, false, false],
            ]],
            ['intermodal', 'Intermodal & Drayage', '🚢', [
                ['intermodal_container', 'Intermodal Container', true, true, false, false],
                ['drayage', 'Port & Rail Drayage', true, true, false, false],
            ]],
        ];
        foreach ($parents as $i => [$key, $name, $icon, $children]) {
            if (DB::table('service_types')->where('key', $key)->exists()) continue;
            $pid = DB::table('service_types')->insertGetId([
                'key' => $key, 'name' => $name, 'icon' => $icon, 'category' => 'specialized', 'requires_dot' => false, 'requires_mc' => false,
                'requires_cdl' => false, 'requires_hazmat' => false, 'active' => true, 'sort_order' => $sortBase + $i + 1, 'created_at' => $now, 'updated_at' => $now,
            ]);
            foreach ($children as $j => [$ck, $cn, $dot, $mc, $cdl, $hz]) {
                DB::table('service_types')->insert([
                    'parent_id' => $pid, 'key' => $ck, 'name' => $cn, 'category' => 'specialized', 'requires_dot' => $dot, 'requires_mc' => $mc,
                    'requires_cdl' => $cdl, 'requires_hazmat' => $hz, 'active' => true, 'sort_order' => $j + 1, 'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        // ── Vehicles: owner vs operator, equipment, temperature, features ──────
        Schema::table('carrier_vehicles', function (Blueprint $t) {
            $t->string('unit_number', 40)->nullable()->after('id');
            $t->string('vehicle_class', 20)->nullable()->after('type');      // tractor | trailer | straight_truck | van | pickup
            $t->string('equipment_type', 50)->nullable()->after('vehicle_class');
            $t->foreignId('owner_org_id')->nullable()->constrained('organizations')->nullOnDelete();
            $t->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('operating_authority_id')->nullable()->constrained('operating_authorities')->nullOnDelete();
            $t->smallInteger('temp_min_f')->nullable();
            $t->smallInteger('temp_max_f')->nullable();
            $t->decimal('trailer_length_ft', 5, 1)->nullable();
            $t->string('status', 20)->default('active');                      // active | out_of_service | sold
            $t->index('equipment_type');
        });
        $map = [
            'box_truck' => 'box_truck', 'flatbed' => 'flatbed', 'enclosed_trailer' => 'dry_van', 'refrigerated' => 'reefer',
            'tanker' => 'tanker', 'pickup_with_trailer' => 'hotshot', 'step_deck' => 'step_deck', 'lowboy' => 'lowboy',
        ];
        foreach ($map as $old => $new) {
            DB::table('carrier_vehicles')->where('type', $old)->update(['equipment_type' => $new]);
        }
        DB::statement('UPDATE carrier_vehicles SET owner_org_id = carrier_id WHERE owner_org_id IS NULL');

        Schema::create('vehicle_capabilities', function (Blueprint $t) {
            $t->id();
            $t->foreignId('vehicle_id')->constrained('carrier_vehicles')->cascadeOnDelete();
            $t->string('capability_key', 50);
            $t->timestamps();
            $t->unique(['vehicle_id', 'capability_key']);
        });
        foreach (DB::table('carrier_vehicles')->where('liftgate', true)->pluck('id') as $vid) {
            DB::table('vehicle_capabilities')->insert(['vehicle_id' => $vid, 'capability_key' => 'liftgate', 'created_at' => $now, 'updated_at' => $now]);
        }

        // ── Company categories ─────────────────────────────────────────────────
        Schema::table('organizations', function (Blueprint $t) {
            $t->jsonb('categories')->default('[]');
        });
        foreach (['carrier' => 'trucking_company', 'broker' => 'freight_broker', 'factor' => 'financial', 'shipper' => 'shipper', 'receiver' => 'receiver'] as $type => $cat) {
            DB::table('organizations')->where('type', $type)->update(['categories' => json_encode([$cat])]);
        }
        DB::table('organizations')->where('type', 'carrier')->where('carrier_type', 'sole_proprietor')
            ->update(['categories' => json_encode(['owner_operator'])]);

        // ── Professional profile ───────────────────────────────────────────────
        Schema::create('pro_profiles', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $t->string('headline')->nullable();
            $t->jsonb('roles')->default('[]');                 // company_driver, owner_operator, dispatcher…
            $t->string('cdl_class', 2)->nullable();            // A | B | C
            $t->string('cdl_state', 10)->nullable();
            $t->jsonb('endorsements')->default('[]');          // capability keys of kind endorsement
            $t->unsignedSmallInteger('years_experience')->nullable();
            $t->jsonb('equipment_experience')->default('[]');  // capability keys of kind equipment
            $t->jsonb('haul_types')->default('[]');            // local, regional, otr, dedicated
            $t->boolean('team_ok')->default(false);
            $t->string('home_city')->nullable();
            $t->string('home_state', 10)->nullable();
            $t->string('home_country', 2)->default('US');
            $t->jsonb('preferred_regions')->default('[]');
            $t->boolean('open_to_work')->default(false);
            $t->date('available_from')->nullable();
            $t->text('bio')->nullable();
            $t->string('visibility', 20)->default('private');  // private | platform
            $t->timestamps();
            $t->index('open_to_work');
        });
        // Bring over CDLs already on file
        foreach (DB::table('person_credentials')->where('type', 'cdl')->orderBy('id')->get() as $c) {
            DB::table('pro_profiles')->updateOrInsert(['user_id' => $c->user_id], [
                'cdl_class' => $c->class ? strtoupper(substr($c->class, 0, 1)) : null, 'cdl_state' => $c->issuing_state ? substr($c->issuing_state, 0, 10) : null,
                'roles' => json_encode(['company_driver']), 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        // ── Load requirements ──────────────────────────────────────────────────
        Schema::table('freight_jobs', function (Blueprint $t) {
            $t->jsonb('equipment_types')->default('[]');        // any of these
            $t->jsonb('required_capabilities')->default('[]');  // all of these (features, endorsements)
            $t->jsonb('required_service_types')->default('[]'); // all of these (specializations)
            $t->boolean('hazmat')->default(false);
            $t->smallInteger('temp_min_f')->nullable();
            $t->smallInteger('temp_max_f')->nullable();
        });

        // ── Authorities from the columns on organizations ──────────────────────
        foreach (DB::table('organizations')->where('type', 'carrier')->get() as $o) {
            if (!$o->carrier_dot_number && !$o->carrier_mc_number && !$o->carrier_operating_authority_number) continue;
            DB::table('operating_authorities')->insert([
                'org_id' => $o->id, 'kind' => 'carrier', 'country' => $o->carrier_operating_country ?: 'US', 'is_primary' => true,
                'dot_number' => $o->carrier_dot_number, 'mc_number' => $o->carrier_mc_number,
                'authority_number' => $o->carrier_operating_authority_number, 'authority_type' => $o->carrier_operating_authority_type,
                'status' => ($o->carrier_dot_verified || $o->carrier_mc_verified) ? 'active' : 'pending',
                'source' => ($o->carrier_dot_verified || $o->carrier_mc_verified) ? 'fmcsa' : 'self',
                'auto_insurer_name' => $o->carrier_auto_insurer_name, 'auto_policy_number' => $o->carrier_auto_policy_number,
                'auto_coverage_amount' => $o->carrier_auto_coverage_amount, 'auto_expiry_date' => $o->carrier_auto_expiry_date,
                'cargo_insurer_name' => $o->carrier_cargo_insurer_name, 'cargo_policy_number' => $o->carrier_cargo_policy_number,
                'cargo_coverage_amount' => $o->carrier_cargo_coverage_amount, 'cargo_expiry_date' => $o->carrier_cargo_expiry_date,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
        foreach (DB::table('organizations')->whereNotNull('fmcsa_broker_mc')->where('fmcsa_broker_mc', '!=', '')->get() as $o) {
            DB::table('operating_authorities')->insert([
                'org_id' => $o->id, 'kind' => 'broker', 'mc_number' => $o->fmcsa_broker_mc, 'is_primary' => true,
                'status' => 'pending', 'source' => 'self', 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
        DB::statement("UPDATE carrier_vehicles v SET operating_authority_id = a.id FROM operating_authorities a
                       WHERE a.org_id = v.carrier_id AND a.kind = 'carrier' AND a.is_primary AND v.operating_authority_id IS NULL");
    }

    public function down(): void
    {
        Schema::table('freight_jobs', function (Blueprint $t) {
            $t->dropColumn(['equipment_types', 'required_capabilities', 'required_service_types', 'hazmat', 'temp_min_f', 'temp_max_f']);
        });
        Schema::dropIfExists('pro_profiles');
        Schema::table('organizations', fn (Blueprint $t) => $t->dropColumn('categories'));
        Schema::dropIfExists('vehicle_capabilities');
        Schema::table('carrier_vehicles', function (Blueprint $t) {
            $t->dropConstrainedForeignId('owner_org_id');
            $t->dropConstrainedForeignId('owner_user_id');
            $t->dropConstrainedForeignId('operating_authority_id');
            $t->dropIndex(['equipment_type']);
            $t->dropColumn(['unit_number', 'vehicle_class', 'equipment_type', 'temp_min_f', 'temp_max_f', 'trailer_length_ft', 'status']);
        });
        foreach (['bulk_liquid', 'agri_livestock', 'intermodal'] as $k) {
            $id = DB::table('service_types')->where('key', $k)->value('id');
            if ($id) { DB::table('service_types')->where('parent_id', $id)->delete(); DB::table('service_types')->where('id', $id)->delete(); }
        }
        Schema::dropIfExists('capabilities');
        Schema::dropIfExists('operating_authorities');
    }
};
