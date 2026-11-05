<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $org = $this->relationLoaded('currentOrg') ? $this->currentOrg : null;

        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'email'      => $this->email,
            'role'       => $this->role,
            'avatar_url' => $this->avatar_url,
            'created_at' => $this->created_at?->toISOString(),

            // Org context
            'org' => $org ? [
                'id'                => $org->id,
                'name'              => $org->name,
                'slug'              => $org->slug,
                'type'              => $org->type,
                'status'            => $org->status,
                'plan'              => $org->plan,
                'logo_url'          => $org->logo_url,
                'is_platform_tenant'=> (bool) $org->is_platform_tenant,
            ] : null,
            'org_role' => $this->orgRole(),

            // The carrier company's public details (for carrier companies)
            'carrier_profile' => $this->when(
                $org?->type === 'carrier',
                fn () => new CarrierProfileResource($org)
            ),
        ];
    }
}
