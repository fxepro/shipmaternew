<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** A carrier company's public details (wraps the carrier Organization). */
class CarrierProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'org_id'                   => $this->id,
            'dot_number'               => $this->carrier_dot_number,
            'dot_verified'             => (bool) $this->carrier_dot_verified,
            'mc_number'                => $this->carrier_mc_number,
            'insurance_verified'       => (bool) $this->carrier_insurance_verified,
            'background_check_status'  => $this->background_check_status,
            'rating'                   => (float) $this->rating,
            'total_deliveries'         => (int) $this->carrier_total_deliveries,
            'company_name'             => $this->name,
            'phone'                    => $this->phone,
        ];
    }
}
