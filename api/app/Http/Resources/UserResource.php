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
            // Sign-up isn't finished until this is true (admins are exempt)
            'email_verified' => $this->hasVerifiedEmail() || $this->isPlatformAdmin(),
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
            'org_role' => $role = $this->orgRole(),
            // This person's level for each action in the role matrix (Settings, Roles & Permissions)
            'permissions' => (object) ($this->viewingAs
                ? array_map(fn () => 'view', \App\Support\Permissions::forRole($org?->type, $role))
                : \App\Support\Permissions::forRole($org?->type, $role)),
            // An admin reading a company's pages (Carrier View or Shipper View): read-only
            'viewing_as' => $this->viewingAs ? $this->viewingAs->only(['id', 'name', 'type']) : null,
            // Waiting to take over a listed company (sign-up with a claim)
            'pending_claim' => $this->current_org_id ? null : (function () {
                $c = \App\Models\OrgClaim::where('user_id', $this->id)->where('status', 'pending')->with('org:id,name,city,state')->latest()->first();
                return $c ? ['id' => $c->id, 'as_type' => $c->as_type, 'org' => $c->org?->only(['id', 'name', 'city', 'state'])] : null;
            })(),

            // The carrier company's public details (for carrier companies)
            'carrier_profile' => $this->when(
                $org?->type === 'carrier',
                fn () => new CarrierProfileResource($org)
            ),
        ];
    }
}
