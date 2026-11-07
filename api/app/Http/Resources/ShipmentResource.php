<?php

namespace App\Http\Resources;

use App\Models\FreightJob;
use App\Services\PersonChecks;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A load (freight job) summarised for lists and panels: My Shipments, dashboards, receiver pages, admin.
 * Pickup is the first pickup stop and delivery is the last drop-off; every stop is in `stops`.
 * Status is the one people see (FreightJob::displayStatus); job_status is the stored value.
 */
class ShipmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var FreightJob $job */
        $job   = $this->resource;
        $stops = $job->relationLoaded('stops') ? $job->stops : $job->stops()->get();
        $from  = $stops->firstWhere('stop_type', 'pickup');
        $to    = $stops->where('stop_type', 'dropoff')->last();
        $ping  = $job->relationLoaded('latestPing') ? $job->latestPing->first() : null;
        $time  = fn ($t) => $t ? substr((string) $t, 0, 5) : null;
        $window = fn ($s) => $s && ($s->window_start || $s->window_end)
            ? trim(($time($s->window_start) ?? '') . ' – ' . ($time($s->window_end) ?? ''), ' –')
            : null;
        $company = fn ($o) => $o ? ['id' => $o->id, 'name' => PersonChecks::companyName($o), 'email' => $o->email] : null;
        $receiver = $job->relationLoaded('people') ? $job->people->first(fn ($p) => $p->org_id === null) : null;

        return [
            'id'               => $job->id,
            'reference_number' => $job->reference_number,
            'shipper_id'       => $job->shipper_id,
            'carrier_id'       => $job->carrier_id,
            'status'           => $job->displayStatus(),
            'job_status'       => $job->status,
            'job_type'         => $job->contract_id ? 'contracted' : 'open',
            'contract_id'      => $job->contract_id,
            'tracking_token'   => $job->tracking_token,

            'item_description' => $job->title ?: "Load #{$job->id}",
            'weight_lbs'       => $job->total_weight_lbs ? (float) $job->total_weight_lbs : null,
            'special_notes'    => $job->special_instructions,

            // First pickup
            'pickup_address'       => $from?->address,
            'pickup_city'          => $from?->city,
            'pickup_state'         => $from?->state,
            'pickup_lat'           => $from?->lat ? (float) $from->lat : null,
            'pickup_lng'           => $from?->lng ? (float) $from->lng : null,
            'pickup_contact_name'  => $from?->contact_name,
            'pickup_contact_phone' => $from?->contact_phone,
            'pickup_date'          => $from?->scheduled_date?->toDateString(),
            'pickup_time_window'   => $window($from),

            // Last drop-off
            'delivery_address'       => $to?->address,
            'delivery_city'          => $to?->city,
            'delivery_state'         => $to?->state,
            'delivery_lat'           => $to?->lat ? (float) $to->lat : null,
            'delivery_lng'           => $to?->lng ? (float) $to->lng : null,
            'delivery_contact_name'  => $to?->contact_name,
            'delivery_contact_phone' => $to?->contact_phone,
            'delivery_date'          => $to?->scheduled_date?->toDateString(),
            'delivery_time_window'   => $window($to),
            'delivered_at'           => $job->completed_at?->toISOString(),
            'delivery_photo_url'     => $to?->pod_pdf_url,

            // Every stop, in route order
            'stops' => $stops->map(fn ($s) => [
                'id'             => $s->id,
                'location_id'    => $s->location_id,
                'sequence'       => $s->optimized_sequence ?? $s->sequence,
                'stop_type'      => $s->stop_type,
                'name'           => $s->name,
                'address'        => $s->address,
                'city'           => $s->city,
                'state'          => $s->state,
                'zip'            => $s->zip,
                'lat'            => $s->lat ? (float) $s->lat : null,
                'lng'            => $s->lng ? (float) $s->lng : null,
                'scheduled_date' => $s->scheduled_date?->toDateString(),
                'time_window'    => $window($s),
                'status'         => $s->status,
                'completed_at'   => $s->completed_at?->toISOString(),
            ])->values(),
            'stops_count' => $stops->count(),

            'distance_miles'          => $job->route_distance_miles ? (float) $job->route_distance_miles : null,
            'estimated_duration_mins' => $job->route_duration_minutes,
            'agreed_cost'             => $job->amount(),
            'payment_status'          => $job->payment_status,

            // Shipper and carrier are companies; people are the load_people rows
            'shipper' => $this->when($job->relationLoaded('shipper') && $job->shipper, fn () => $company($job->shipper)),
            'carrier' => $this->when($job->relationLoaded('carrier') && $job->carrier, fn () => $company($job->carrier) + [
                'carrier_profile' => [
                    'company_name'     => $job->carrier->name,
                    'dot_number'       => $job->carrier->carrier_dot_number,
                    'dot_verified'     => (bool) $job->carrier->carrier_dot_verified,
                    'rating'           => $job->carrier->rating ? (float) $job->carrier->rating : null,
                    'total_deliveries' => (int) $job->carrier->carrier_total_deliveries,
                ],
            ]),
            'people' => $this->when($job->relationLoaded('people'), fn () => $job->people->map(fn ($p) => [
                'org_id'  => $p->org_id,
                'user_id' => $p->user_id,
                'name'    => $p->user?->name,
                'role'    => $p->org_id ? \App\Models\OrgMember::where('org_id', $p->org_id)->where('user_id', $p->user_id)->value('role') : 'receiver',
            ])->values()),
            'receiver' => $receiver?->user ? ['id' => $receiver->user->id, 'name' => $receiver->user->name, 'email' => $receiver->user->email] : null,

            'latest_ping' => $ping ? [
                'lat'       => (float) $ping->lat,
                'lng'       => (float) $ping->lng,
                'speed'     => $ping->speed ? (float) $ping->speed : null,
                'eta'       => $ping->eta,
                'pinged_at' => $ping->pinged_at?->toISOString(),
            ] : null,

            'offers_count' => $job->offers_count ?? null,
            'created_at'   => $job->created_at?->toISOString(),
            'updated_at'   => $job->updated_at?->toISOString(),
        ];
    }
}
