<?php

namespace Database\Seeders;

use App\Models\FreightJob;
use App\Models\JobStop;
use App\Models\JobStopItem;

/**
 * Demo loads for the seeders. A load is a freight job with stops; this builds one from a simple
 * pickup-and-delivery description (the same fields a single shipment had), or from a list of stops.
 * Idempotent by tracking token.
 */
class DemoLoad
{
    private const STATUS = ['pending' => 'posted', 'assigned' => 'posted', 'in_transit' => 'in_progress',
                            'delivered' => 'completed', 'cancelled' => 'cancelled', 'disputed' => 'disputed'];

    /**
     * @param array $key   ['tracking_token' => 'DEMO0001']
     * @param array $a     shipper_id, carrier_id, receiver_id, status (pending|assigned|in_transit|delivered),
     *                     item_description, weight_lbs, handling_requirements, special_notes, agreed_cost,
     *                     distance_miles, estimated_duration_mins, delivered_at, and pickup_* / delivery_* fields,
     *                     or 'stops' => [[stop_type, name, address, city, state, zip, lat, lng, date], ...]
     */
    public static function firstOrCreate(array $key, array $a): FreightJob
    {
        $token = $key['tracking_token'];
        if ($job = FreightJob::where('tracking_token', $token)->first()) return $job;

        $status   = $a['status'] ?? 'pending';
        $weight   = isset($a['weight_lbs']) ? (int) round((float) $a['weight_lbs']) : null;
        $handling = !empty($a['handling_requirements']) ? 'Handling: ' . implode(', ', (array) $a['handling_requirements']) : null;

        $job = FreightJob::create([
            'shipper_id'             => $a['shipper_id'],
            'carrier_id'             => $a['carrier_id'] ?? null,
            'contract_id'            => $a['contract_id'] ?? null,
            'title'                  => $a['item_description'] ?? 'Freight',
            'reference_number'       => $token,
            'tracking_token'         => $token,
            'special_instructions'   => trim(implode("\n", array_filter([$handling, $a['special_notes'] ?? null]))) ?: null,
            'total_weight_lbs'       => $weight,
            'status'                 => self::STATUS[$status] ?? 'posted',
            'route_distance_miles'   => $a['distance_miles'] ?? null,
            'route_duration_minutes' => $a['estimated_duration_mins'] ?? null,
            'payment_amount_cents'   => isset($a['agreed_cost']) ? (int) round($a['agreed_cost'] * 100) : null,
            'payment_status'         => $a['payment_status'] ?? 'unpaid',
            'posted_at'              => now(),
            'completed_at'           => $status === 'delivered' ? ($a['delivered_at'] ?? now()) : null,
        ]);

        $stops = $a['stops'] ?? [
            ['pickup',  null, $a['pickup_address'] ?? '',   $a['pickup_city'] ?? '',   $a['pickup_state'] ?? '',   '', $a['pickup_lat'] ?? null,   $a['pickup_lng'] ?? null,   $a['pickup_date'] ?? null,   $a['pickup_contact_name'] ?? null,   $a['pickup_contact_phone'] ?? null],
            ['dropoff', null, $a['delivery_address'] ?? '', $a['delivery_city'] ?? '', $a['delivery_state'] ?? '', '', $a['delivery_lat'] ?? null, $a['delivery_lng'] ?? null, $a['delivery_date'] ?? null, $a['delivery_contact_name'] ?? null, $a['delivery_contact_phone'] ?? null],
        ];

        // Stops already done: pickups once the load is moving, everything once delivered
        $made = [];
        foreach (array_values($stops) as $i => $s) {
            [$type, $name, $address, $city, $state, $zip, $lat, $lng, $date] = $s;
            $done = $status === 'delivered' || ($status === 'in_transit' && $type === 'pickup');
            $made[] = JobStop::create([
                'freight_job_id' => $job->id, 'stop_type' => $type, 'name' => $name,
                'sequence' => $i + 1, 'optimized_sequence' => $i + 1,
                'address' => $address, 'city' => $city, 'state' => $state, 'zip' => $zip, 'country' => 'US',
                'lat' => $lat, 'lng' => $lng, 'scheduled_date' => $date,
                'contact_name' => $s[9] ?? null, 'contact_phone' => $s[10] ?? null,
                'weight_lbs' => $weight, 'status' => $done ? 'completed' : 'pending', 'completed_at' => $done ? now() : null,
            ]);
        }

        // One line of freight from the first pickup to the last drop-off
        $first = collect($made)->firstWhere('stop_type', 'pickup');
        $last  = collect($made)->where('stop_type', 'dropoff')->last();
        if ($first && $last) {
            JobStopItem::create([
                'pickup_stop_id' => $first->id, 'delivery_stop_id' => $last->id,
                'description' => $job->title, 'quantity' => 1, 'unit' => 'pallet', 'weight_lbs' => $weight,
            ]);
        }

        // The receiver is a person on the load until receivers are companies
        if (!empty($a['receiver_id'])) {
            \App\Models\LoadPerson::firstOrCreate(['load_type' => 'freight_job', 'load_id' => $job->id, 'user_id' => $a['receiver_id']], ['org_id' => null]);
        }

        return $job;
    }
}
