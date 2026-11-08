<?php

namespace App\Services;

use App\Models\Location;
use App\Models\OrgClaim;
use App\Models\OrgContact;
use App\Models\OrgMember;
use App\Models\OrgPartner;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The organizations directory: listing an organization for someone else, its locations and contacts,
 * claiming it, and the shapes the API returns.
 */
class OrgDirectory
{
    /** Validation rules for an organization's own details */
    public const ORG_RULES = [
        'name'    => 'string|max:200',
        'phone'   => 'nullable|string|max:30',
        'email'   => 'nullable|email|max:150',
        'website' => 'nullable|string|max:200',
        'street'  => 'nullable|string|max:255',
        'city'    => 'nullable|string|max:100',
        'state'   => 'nullable|string|max:50',
        'zip'     => 'nullable|string|max:20',
        'country' => 'nullable|string|size:2',
    ];

    public const LOCATION_RULES = [
        'name'                 => 'string|max:200',
        'visibility'           => 'in:public,private',
        'address'              => 'string|max:255',
        'city'                 => 'string|max:100',
        'state'                => 'nullable|string|max:50',
        'zip'                  => 'string|max:20',
        'country'              => 'nullable|string|size:2',
        'lat'                  => 'nullable|numeric|between:-90,90',
        'lng'                  => 'nullable|numeric|between:-180,180',
        'operating_hours'      => 'nullable|array',
        'dock_doors'           => 'nullable|integer|min:0|max:500',
        'appointment_required' => 'boolean',
        'site_instructions'    => 'nullable|string|max:2000',
        'notes'                => 'nullable|string|max:2000',
        'is_default'           => 'boolean',
    ];

    public const CONTACT_RULES = [
        'name'        => 'string|max:150',
        'location_id' => 'nullable|integer',
        'title'       => 'nullable|string|max:100',
        'phone'       => 'nullable|string|max:30',
        'mobile'      => 'nullable|string|max:30',
        'email'       => 'nullable|email|max:150',
        'is_primary'  => 'boolean',
        'notify'      => 'nullable|array',
        'notes'       => 'nullable|string|max:2000',
    ];

    /** Rules with the given fields required (for creates) */
    public static function required(array $rules, array $fields): array
    {
        foreach ($rules as $k => $r) {
            $rules[$k] = (in_array($k, $fields, true) ? 'required|' : 'sometimes|') . $r;
        }
        return $rules;
    }

    /** List an organization nobody from it has signed up for yet, with its locations and contacts */
    public function list(User $by, array $org, array $locations = [], array $contacts = []): Organization
    {
        return DB::transaction(function () use ($by, $org, $locations, $contacts) {
            $listed = Organization::create([
                ...array_intersect_key($org, self::ORG_RULES),
                'type'              => $org['type'],
                'slug'              => $this->slug($org['name'], $org['type']),
                'status'            => 'listed',
                'owner_id'          => null,
                'country'           => $org['country'] ?? 'US',
                'listed_by_org_id'  => $by->current_org_id,
                'listed_by_user_id' => $by->id,
                'verification_status' => 'not_required',
            ]);
            $ids = [];
            foreach ($locations as $i => $l) {
                $ids[$i] = $this->addLocation($listed, $by, $l)->id;
            }
            foreach ($contacts as $c) {
                // A contact may name a location by its position in the list just created
                if (isset($c['location_index'])) $c['location_id'] = $ids[$c['location_index']] ?? null;
                $this->addContact($listed, $by, $c);
            }
            if ($by->current_org_id) {
                OrgPartner::firstOrCreate(
                    ['org_id' => $by->current_org_id, 'partner_org_id' => $listed->id, 'relation' => $org['type'] === 'broker' ? 'broker' : 'receiver'],
                    ['added_by' => $by->id]
                );
            }
            return $listed;
        });
    }

    public function addLocation(Organization $org, User $by, array $data): Location
    {
        return Location::create([
            ...array_intersect_key($data, self::LOCATION_RULES),
            'org_id'            => $org->id,
            'created_by_org_id' => $by->current_org_id,
            'visibility'        => $data['visibility'] ?? 'public',
            'country'           => $data['country'] ?? 'US',
        ]);
    }

    public function addContact(Organization $org, User $by, array $data): OrgContact
    {
        $data['location_id'] = $this->ownLocation($org, $data['location_id'] ?? null);
        return OrgContact::create([
            ...array_intersect_key($data, self::CONTACT_RULES),
            'org_id'            => $org->id,
            'created_by_org_id' => $by->current_org_id,
            'notify'            => array_key_exists('notify', $data) ? OrgContact::cleanNotify($data['notify']) : OrgContact::DEFAULT_NOTIFY,
        ]);
    }

    /** A contact's location must be one of the organization's own */
    public function ownLocation(Organization $org, $locationId): ?int
    {
        if (!$locationId) return null;
        abort_unless(Location::where('id', $locationId)->where('org_id', $org->id)->exists(), 422, 'That location belongs to another company.');
        return (int) $locationId;
    }

    // ── Claiming ──────────────────────────────────────────────────────────────

    /** Ask to take over a listed organization; approved at once when the email is one of its contacts and verified */
    public function requestClaim(User $user, Organization $org, string $asType): OrgClaim
    {
        $claim = OrgClaim::firstOrCreate(
            ['org_id' => $org->id, 'user_id' => $user->id, 'status' => 'pending'],
            ['as_type' => $asType]
        );
        $this->autoApprove($user);
        return $claim->fresh();
    }

    /** After the email is verified: approve pending claims where the address is one of the organization's contacts */
    public function autoApprove(User $user): void
    {
        if (!$user->hasVerifiedEmail()) return;
        foreach (OrgClaim::where('user_id', $user->id)->where('status', 'pending')->with('org')->get() as $claim) {
            $match = $claim->org && $claim->org->isListed()
                && $claim->org->contacts()->whereRaw('lower(email) = ?', [strtolower($user->email)])->exists();
            if ($match) $this->approveClaim($claim, null, 'contact_email');
        }
    }

    /** The claimant becomes the owner; the organization takes the type they signed up as */
    public function approveClaim(OrgClaim $claim, ?User $admin, string $method = 'admin', ?string $note = null): void
    {
        DB::transaction(function () use ($claim, $admin, $method, $note) {
            $org  = $claim->org()->lockForUpdate()->first();
            $user = $claim->user;
            abort_unless($org->isListed(), 422, 'Someone has already claimed this organization.');

            $org->update([
                'owner_id' => $user->id, 'status' => 'active', 'claimed_at' => now(), 'type' => $claim->as_type,
                'legal_name' => $org->legal_name ?? $org->name,
                'verification_status' => $claim->as_type === 'receiver' ? 'not_required' : 'incomplete',
            ]);
            OrgMember::firstOrCreate(['org_id' => $org->id, 'user_id' => $user->id], ['role' => 'owner', 'status' => 'active', 'joined_at' => now()]);
            $user->update(['current_org_id' => $org->id, 'role' => in_array($claim->as_type, ['shipper', 'broker', 'carrier', 'receiver', 'factor'], true) ? $claim->as_type : $user->role]);
            // A contact with this email is this person
            $org->contacts()->whereRaw('lower(email) = ?', [strtolower($user->email)])->update(['user_id' => $user->id]);

            $claim->update(['status' => 'approved', 'method' => $method, 'note' => $note, 'decided_by' => $admin?->id, 'decided_at' => now()]);
            OrgClaim::where('org_id', $org->id)->where('status', 'pending')->where('id', '!=', $claim->id)
                ->update(['status' => 'rejected', 'note' => 'Claimed by someone else', 'decided_at' => now()]);
        });
    }

    // ── Shapes ────────────────────────────────────────────────────────────────

    /** A row in a directory search or a company's saved list */
    public function summary(Organization $o, ?User $viewer = null, ?int $myOrg = null): array
    {
        return [
            'id'              => $o->id,
            'name'            => $o->name,
            'type'            => $o->type,
            'listed'          => $o->isListed(),
            'listed_by'       => $o->isListed() ? $o->listedBy?->name : null,
            'city'            => $o->city,
            'state'           => $o->state,
            'phone'           => $o->phone,
            'email'           => $o->email,
            'website'         => $o->website,
            'locations_count' => $o->locations_count ?? $o->locations()->where('visibility', 'public')->count(),
            'contacts_count'  => $o->contacts_count ?? null,
            'is_partner'      => $myOrg ? OrgPartner::where('org_id', $myOrg)->where('partner_org_id', $o->id)->exists() : false,
            'is_mine'         => $myOrg && (int) $myOrg === (int) $o->id,
            'can_edit'        => $viewer ? $o->editableBy($viewer) : false,
        ];
    }

    /** One organization with the locations and contacts the viewer may see */
    public function detail(Organization $o, User $viewer): array
    {
        $myOrg = $viewer->viewingAs?->id ?? $viewer->current_org_id;
        $own   = $viewer->isPlatformAdmin() || (int) $myOrg === (int) $o->id || $o->editableBy($viewer);
        $locations = $o->locations()->when(!$own, fn ($q) => $q->where('visibility', 'public'))->orderBy('name')->get();

        return $this->summary($o, $viewer, $myOrg) + [
            'street'    => $o->street,
            'zip'       => $o->zip,
            'country'   => $o->country,
            'claimed_at' => $o->claimed_at?->toISOString(),
            'locations' => $locations->map(fn ($l) => $this->location($l))->values(),
            'contacts'  => $o->contactsVisibleTo($viewer)
                ? $o->contacts()->orderByDesc('is_primary')->orderBy('name')->get()->map(fn ($c) => $this->contact($c))->values()
                : null,
            'pending_claims' => $viewer->isPlatformAdmin()
                ? $o->claims()->where('status', 'pending')->with('user:id,name,email')->get()
                    ->map(fn ($c) => ['id' => $c->id, 'as_type' => $c->as_type, 'user' => $c->user?->only(['id', 'name', 'email']), 'created_at' => $c->created_at?->toISOString()])
                : [],
            'events'    => OrgContact::EVENTS,
        ];
    }

    public function location(Location $l): array
    {
        return $l->only([
            'id', 'org_id', 'name', 'visibility', 'address', 'city', 'state', 'zip', 'country', 'lat', 'lng',
            'operating_hours', 'dock_doors', 'appointment_required', 'site_instructions', 'notes', 'is_default',
            'usage_count',
        ]) + ['org_name' => $l->relationLoaded('org') ? $l->org?->name : null];
    }

    public function contact(OrgContact $c): array
    {
        return $c->only(['id', 'org_id', 'location_id', 'user_id', 'name', 'title', 'phone', 'mobile', 'email', 'is_primary', 'notes'])
            + ['notify' => OrgContact::cleanNotify($c->notify ?? OrgContact::DEFAULT_NOTIFY)];
    }

    private function slug(string $name, string $type): string
    {
        $base = Str::slug($name . '-' . $type) ?: 'org-' . Str::random(6);
        $slug = $base;
        for ($i = 1; Organization::where('slug', $slug)->exists(); $i++) $slug = "{$base}-{$i}";
        return $slug;
    }
}
