<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use App\Services\PersonChecks;
use Illuminate\Http\Resources\Json\JsonResource;

class ShipmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var \App\Models\Shipment $this */
        $ping = $this->relationLoaded('latestPing') ? $this->latestPing->first() : null;

        return [
            'id'             => $this->id,
            'shipper_id'     => $this->shipper_id,
            'carrier_id'     => $this->carrier_id,
            'status'         => $this->status,
            'job_type'       => $this->job_type ?? 'open',
            'contract_id'    => $this->contract_id,
            'tracking_token' => $this->tracking_token,

            // Item
            'item_description'      => $this->item_description,
            'item_category'         => $this->item_category,
            'weight_lbs'            => $this->weight_lbs ? (float) $this->weight_lbs : null,
            'handling_requirements' => $this->handling_requirements ?? [],
            'special_notes'         => $this->special_notes,

            // Pickup
            'pickup_address'       => $this->pickup_address,
            'pickup_city'          => $this->pickup_city,
            'pickup_state'         => $this->pickup_state,
            'pickup_lat'           => $this->pickup_lat  ? (float) $this->pickup_lat  : null,
            'pickup_lng'           => $this->pickup_lng  ? (float) $this->pickup_lng  : null,
            'pickup_contact_name'  => $this->pickup_contact_name,
            'pickup_contact_phone' => $this->pickup_contact_phone,
            'pickup_date'          => $this->pickup_date?->toDateString(),
            'pickup_time_window'   => $this->pickup_time_window,

            // Delivery
            'delivery_address'       => $this->delivery_address,
            'delivery_city'          => $this->delivery_city,
            'delivery_state'         => $this->delivery_state,
            'delivery_lat'           => $this->delivery_lat ? (float) $this->delivery_lat : null,
            'delivery_lng'           => $this->delivery_lng ? (float) $this->delivery_lng : null,
            'delivery_contact_name'  => $this->delivery_contact_name,
            'delivery_contact_phone' => $this->delivery_contact_phone,
            'delivery_date'          => $this->delivery_date?->toDateString(),
            'delivery_time_window'   => $this->delivery_time_window,
            'delivered_at'           => $this->delivered_at?->toISOString(),
            'delivery_photo_url'     => $this->delivery_photo_url ?? null,

            // Route
            'distance_miles'          => $this->distance_miles ? (float) $this->distance_miles : null,
            'estimated_duration_mins' => $this->estimated_duration_mins,
            'route_polyline'          => $this->route_polyline,

            // Cost
            'agreed_cost' => $this->agreed_cost ? (float) $this->agreed_cost : null,

            // Parties: shipper and carrier are companies; people are the load_people rows
            'shipper' => $this->when(
                $this->relationLoaded('shipper') && $this->shipper,
                fn () => ['id' => $this->shipper->id, 'name' => PersonChecks::companyName($this->shipper), 'email' => $this->shipper->email]
            ),
            'carrier' => $this->when(
                $this->relationLoaded('carrier') && $this->carrier,
                fn () => [
                    'id'              => $this->carrier->id,
                    'name'            => PersonChecks::companyName($this->carrier),
                    'email'           => $this->carrier->email,
                    'carrier_profile' => $this->carrier->relationLoaded('carrierProfile') && $this->carrier->carrierProfile
                        ? [
                            'company_name'     => $this->carrier->carrierProfile->company_name,
                            'dot_number'       => $this->carrier->carrierProfile->dot_number,
                            'dot_verified'     => $this->carrier->carrierProfile->dot_verified,
                            'rating'           => $this->carrier->carrierProfile->rating ? (float) $this->carrier->carrierProfile->rating : null,
                            'total_deliveries' => $this->carrier->carrierProfile->total_deliveries,
                        ]
                        : null,
                ]
            ),
            'people' => $this->when(
                $this->relationLoaded('people'),
                fn () => $this->people->map(fn ($p) => [
                    'org_id'  => $p->org_id,
                    'user_id' => $p->user_id,
                    'name'    => $p->user?->name,
                    'role'    => \App\Models\OrgMember::where('org_id', $p->org_id)->where('user_id', $p->user_id)->value('role'),
                ])->values()
            ),
            'receiver' => $this->when(
                $this->relationLoaded('receiver') && $this->receiver,
                fn () => ['id' => $this->receiver->id, 'name' => $this->receiver->name, 'email' => $this->receiver->email]
            ),

            // Latest GPS ping
            'latest_ping' => $ping ? [
                'lat'       => (float) $ping->lat,
                'lng'       => (float) $ping->lng,
                'speed'     => $ping->speed ? (float) $ping->speed : null,
                'eta'       => $ping->eta,
                'pinged_at' => $ping->pinged_at?->toISOString(),
            ] : null,

            // Bids (loaded only when with_bids=1 or show())
            'bids' => $this->when(
                $this->relationLoaded('bids'),
                fn () => $this->bids->map(fn ($bid) => [
                    'id'                      => $bid->id,
                    'carrier_id'              => $bid->carrier_id,
                    'user_id'                 => $bid->user_id,
                    'carrier_name'            => PersonChecks::companyName($bid->carrier) ?? '',
                    'carrier_rating'          => (float) ($bid->carrier?->carrierProfile?->rating ?? 5.0),
                    'carrier_dot_verified'    => (bool) ($bid->carrier?->carrierProfile?->dot_verified ?? false),
                    'amount'                  => (float) $bid->amount,
                    'estimated_pickup_date'   => $bid->estimated_pickup_date?->toDateString(),
                    'estimated_delivery_date' => $bid->estimated_delivery_date?->toDateString(),
                    'note'                    => $bid->note,
                    'status'                  => $bid->status,
                    'created_at'              => $bid->created_at?->toISOString(),
                ])
            ),

            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}