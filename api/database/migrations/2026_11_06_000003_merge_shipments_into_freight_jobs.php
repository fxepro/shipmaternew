<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * One load model. A shipment is a freight job: its places are stops (job_stops), each pointing to a
 * location, any number of pickups and drop-offs. The old shipments table (one pickup and one delivery as
 * fixed columns) is converted and dropped:
 *   - each shipment becomes a freight job with a pickup stop and a drop-off stop and one item;
 *   - its payments, factoring, people, GPS pings and invoices move to the freight job;
 *   - its receiver becomes a person on the load (load_people);
 *   - bids become freight job offers.
 * Not reversible. Take a database backup first.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('freight_jobs', function (Blueprint $t) {
            $t->string('tracking_token', 40)->nullable()->unique()->after('reference_number');
            $t->timestamp('completed_at')->nullable()->after('posted_at');
        });
        Schema::table('gps_pings', function (Blueprint $t) {
            $t->foreignId('freight_job_id')->nullable()->after('id')->constrained('freight_jobs')->cascadeOnDelete();
            $t->index(['freight_job_id', 'pinged_at']);
        });
        Schema::table('transactions', function (Blueprint $t) {
            $t->foreignId('freight_job_id')->nullable()->after('user_id')->constrained('freight_jobs')->nullOnDelete();
        });

        // Receivers are people without a company until they become organizations
        Schema::table('load_people', function (Blueprint $t) {
            $t->unsignedBigInteger('org_id')->nullable()->change();
        });

        $status = ['pending' => 'posted', 'assigned' => 'posted', 'offered' => 'posted', 'in_transit' => 'in_progress',
                   'delivered' => 'completed', 'cancelled' => 'cancelled', 'disputed' => 'disputed'];

        foreach (DB::table('shipments')->orderBy('id')->get() as $s) {
            $jobStatus = $status[$s->status] ?? 'posted';
            $token     = $s->tracking_token ?: strtoupper(Str::random(10));
            $weight    = $s->weight_lbs !== null ? (int) round((float) $s->weight_lbs) : null;
            $handling  = json_decode((string) $s->handling_requirements, true);
            $handling  = is_array($handling) ? implode(', ', $handling) : $s->handling_requirements;
            $jobId = DB::table('freight_jobs')->insertGetId([
                'contract_id'            => $s->contract_id,
                'shipper_id'             => $s->shipper_id,
                'carrier_id'             => $s->carrier_id,
                'title'                  => $s->item_description,
                'reference_number'       => $token,
                'tracking_token'         => $token,
                'special_instructions'   => trim(implode("\n", array_filter([$handling ? "Handling: $handling" : null, $s->special_notes]))) ?: null,
                'total_weight_lbs'       => $weight,
                'status'                 => $jobStatus,
                'route_distance_miles'   => $s->distance_miles,
                'route_duration_minutes' => $s->estimated_duration_mins,
                'payment_amount_cents'   => $s->agreed_cost !== null ? (int) round($s->agreed_cost * 100) : null,
                'payment_status'         => in_array($s->payment_status, ['unpaid', 'processing', 'paid'], true) ? $s->payment_status : 'unpaid',
                'currency'               => $s->currency ?: 'USD',
                'posted_at'              => $s->created_at,
                'completed_at'           => $s->delivered_at,
                'created_at'             => $s->created_at,
                'updated_at'             => $s->updated_at,
            ]);

            $started   = in_array($s->status, ['in_transit', 'delivered'], true);
            $delivered = $s->status === 'delivered';
            $stop = fn (string $type, int $seq, string $p, bool $done, ?string $doneAt) => DB::table('job_stops')->insertGetId([
                'freight_job_id' => $jobId, 'stop_type' => $type, 'sequence' => $seq, 'optimized_sequence' => $seq,
                'address' => $s->{"{$p}_address"} ?? '', 'city' => $s->{"{$p}_city"} ?? '', 'state' => $s->{"{$p}_state"} ?? '',
                'zip' => '', 'country' => 'US', 'lat' => $s->{"{$p}_lat"}, 'lng' => $s->{"{$p}_lng"},
                'contact_name' => $s->{"{$p}_contact_name"}, 'contact_phone' => $s->{"{$p}_contact_phone"},
                'scheduled_date' => $s->{"{$p}_date"},
                'special_instructions' => $s->{"{$p}_time_window"} ? 'Window: ' . $s->{"{$p}_time_window"} : null,
                'weight_lbs' => $weight,
                'status' => $done ? 'completed' : 'pending', 'completed_at' => $done ? ($doneAt ?? $s->updated_at) : null,
                'created_at' => $s->created_at, 'updated_at' => $s->updated_at,
            ]);
            $pickup  = $stop('pickup', 1, 'pickup', $started, $s->updated_at);
            $dropoff = $stop('dropoff', 2, 'delivery', $delivered, $s->delivered_at);
            if ($delivered && $s->delivery_photo_url) {
                DB::table('job_stops')->where('id', $dropoff)->update(['pod_pdf_url' => $s->delivery_photo_url]);
            }
            DB::table('job_stop_items')->insert([
                'pickup_stop_id' => $pickup, 'delivery_stop_id' => $dropoff,
                'description' => $s->item_description ?: 'Freight', 'quantity' => 1, 'unit' => 'other',
                'weight_lbs' => $weight, 'created_at' => $s->created_at, 'updated_at' => $s->updated_at,
            ]);

            // Everything that pointed at the shipment now points at the freight job
            foreach (['load_payments', 'factored_loads', 'load_people'] as $table) {
                DB::table($table)->where('load_type', 'shipment')->where('load_id', $s->id)->update(['load_type' => 'freight_job', 'load_id' => $jobId]);
            }
            DB::table('gps_pings')->where('shipment_id', $s->id)->update(['freight_job_id' => $jobId]);
            DB::table('transactions')->where('shipment_id', $s->id)->update(['freight_job_id' => $jobId]);

            if ($s->receiver_id && !DB::table('load_people')->where('load_type', 'freight_job')->where('load_id', $jobId)->where('user_id', $s->receiver_id)->exists()) {
                DB::table('load_people')->insert(['load_type' => 'freight_job', 'load_id' => $jobId, 'org_id' => null, 'user_id' => $s->receiver_id, 'created_at' => now(), 'updated_at' => now()]);
            }

            foreach (DB::table('bids')->where('shipment_id', $s->id)->get() as $b) {
                DB::table('freight_job_offers')->insert([
                    'freight_job_id' => $jobId, 'user_id' => $b->user_id, 'carrier_id' => $b->carrier_id, 'amount' => $b->amount,
                    'note' => $b->note, 'status' => in_array($b->status, ['pending', 'accepted', 'rejected', 'withdrawn'], true) ? $b->status : 'rejected',
                    'rate_type' => 'flat', 'created_at' => $b->created_at, 'updated_at' => $b->updated_at,
                ]);
            }
        }

        DB::table('gps_pings')->whereNull('freight_job_id')->delete();
        Schema::table('gps_pings', function (Blueprint $t) { $t->dropConstrainedForeignId('shipment_id'); });
        Schema::table('transactions', function (Blueprint $t) { $t->dropConstrainedForeignId('shipment_id'); });
        Schema::dropIfExists('bids');
        Schema::dropIfExists('shipments');
    }

    public function down(): void
    {
        throw new RuntimeException('Not reversible: restore the database backup taken before this migration.');
    }
};
