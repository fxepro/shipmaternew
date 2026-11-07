<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JobStop;
use App\Models\Location;
use App\Models\OrgClaim;
use App\Models\OrgContact;
use App\Models\OrgPartner;
use App\Models\Organization;
use App\Services\OrgDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The organizations directory: search every company in shipping, list a receiver or broker that isn't on
 * Shipmater yet, keep your own list of them (partners), and manage the locations and contacts of
 * organizations you may edit (Organization::editableBy).
 */
class DirectoryController extends Controller
{
    public function __construct(private OrgDirectory $dir) {}

    private function myOrg(Request $request): ?int
    {
        return $request->user()->viewingAs?->id ?? $request->user()->current_org_id;
    }

    // GET /directory/orgs?q=&type=
    public function search(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q'     => 'nullable|string|max:100',
            'type'  => ['nullable', Rule::in([...Organization::TYPES, 'all'])],
            'limit' => 'nullable|integer|min:1|max:50',
        ]);
        $q = trim($data['q'] ?? '');

        $orgs = Organization::where('status', '!=', 'suspended')
            ->when(($data['type'] ?? 'all') !== 'all', fn ($w) => $w->where('type', $data['type']))
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('name', 'ilike', "%{$q}%")->orWhere('city', 'ilike', "%{$q}%")
                ->orWhereHas('locations', fn ($l) => $l->where('visibility', 'public')->where(fn ($y) => $y->where('name', 'ilike', "%{$q}%")->orWhere('city', 'ilike', "%{$q}%")))))
            ->withCount(['locations' => fn ($l) => $l->where('visibility', 'public')])
            ->with('listedBy:id,name')
            ->orderBy('name')
            ->limit($data['limit'] ?? 20)
            ->get();

        $me = $this->myOrg($request);
        return response()->json(['data' => $orgs->map(fn ($o) => $this->dir->summary($o, $request->user(), $me))->values()]);
    }

    // POST /directory/orgs — list a receiver or broker, with locations and contacts
    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->current_org_id, 422, 'Join or create a company first.');
        $data = $request->validate([
            'type'                  => ['required', Rule::in(Organization::LISTABLE)],
            ...OrgDirectory::required(OrgDirectory::ORG_RULES, ['name']),
            'locations'             => 'nullable|array|max:50',
            ...$this->nested('locations', OrgDirectory::required(OrgDirectory::LOCATION_RULES, ['name', 'address', 'city', 'zip'])),
            'contacts'              => 'nullable|array|max:50',
            ...$this->nested('contacts', OrgDirectory::required(array_diff_key(OrgDirectory::CONTACT_RULES, ['location_id' => 1]), ['name'])),
            'contacts.*.location_index' => 'nullable|integer|min:0',
        ]);

        // Don't list the same company twice: an exact name match in the same city is the same place
        $dupe = Organization::whereRaw('lower(name) = ?', [mb_strtolower(trim($data['name']))])
            ->when(!empty($data['city']), fn ($q) => $q->whereRaw('lower(city) = ?', [mb_strtolower($data['city'])]))
            ->first();
        if ($dupe) {
            return response()->json([
                'message' => "{$dupe->name} is already in the directory. Add it to your list instead.",
                'code'    => 'already_listed',
                'org'     => $this->dir->summary($dupe, $request->user(), $request->user()->current_org_id),
            ], 409);
        }

        $org = $this->dir->list($request->user(), $data, $data['locations'] ?? [], $data['contacts'] ?? []);
        return response()->json(['data' => $this->dir->detail($org->fresh(), $request->user())], 201);
    }

    // GET /directory/orgs/{org}
    public function show(Request $request, Organization $org): JsonResponse
    {
        abort_if($org->status === 'suspended' && !$request->user()->isPlatformAdmin(), 404);
        return response()->json(['data' => $this->dir->detail($org, $request->user())]);
    }

    // PUT /directory/orgs/{org}
    public function update(Request $request, Organization $org): JsonResponse
    {
        abort_unless($org->editableBy($request->user()), 403, 'You can\'t change this company.');
        $data = $request->validate(OrgDirectory::required(OrgDirectory::ORG_RULES, []));
        $org->update($data);
        return response()->json(['data' => $this->dir->detail($org->fresh(), $request->user())]);
    }

    // ── Locations ────────────────────────────────────────────────────────────

    // POST /directory/orgs/{org}/locations
    public function storeLocation(Request $request, Organization $org): JsonResponse
    {
        abort_unless($org->editableBy($request->user()), 403, 'You can\'t change this company.');
        $data = $request->validate(OrgDirectory::required(OrgDirectory::LOCATION_RULES, ['name', 'address', 'city', 'zip']));
        $loc = $this->dir->addLocation($org, $request->user(), $data);
        return response()->json(['data' => $this->dir->location($loc)], 201);
    }

    // PUT /directory/locations/{location}
    public function updateLocation(Request $request, Location $location): JsonResponse
    {
        abort_unless($location->org->editableBy($request->user()), 403, 'You can\'t change this company.');
        $location->update($request->validate(OrgDirectory::required(OrgDirectory::LOCATION_RULES, [])));
        return response()->json(['data' => $this->dir->location($location->fresh())]);
    }

    // DELETE /directory/locations/{location}
    public function destroyLocation(Request $request, Location $location): JsonResponse
    {
        abort_unless($location->org->editableBy($request->user()), 403, 'You can\'t change this company.');
        if (JobStop::where('location_id', $location->id)->exists()) {
            return response()->json(['message' => 'This location is on loads, so it can\'t be removed. Make it private instead.', 'code' => 'location_in_use'], 422);
        }
        $location->delete();
        return response()->json(['message' => 'Location removed.']);
    }

    // ── Contacts ─────────────────────────────────────────────────────────────

    // POST /directory/orgs/{org}/contacts
    public function storeContact(Request $request, Organization $org): JsonResponse
    {
        abort_unless($org->editableBy($request->user()), 403, 'You can\'t change this company.');
        $data = $request->validate(OrgDirectory::required(OrgDirectory::CONTACT_RULES, ['name']));
        $contact = $this->dir->addContact($org, $request->user(), $data);
        return response()->json(['data' => $this->dir->contact($contact)], 201);
    }

    // PUT /directory/contacts/{contact}
    public function updateContact(Request $request, OrgContact $contact): JsonResponse
    {
        abort_unless($contact->org->editableBy($request->user()), 403, 'You can\'t change this company.');
        $data = $request->validate(OrgDirectory::required(OrgDirectory::CONTACT_RULES, []));
        if (array_key_exists('location_id', $data)) $data['location_id'] = $this->dir->ownLocation($contact->org, $data['location_id']);
        if (array_key_exists('notify', $data)) $data['notify'] = OrgContact::cleanNotify($data['notify']);
        $contact->update($data);
        return response()->json(['data' => $this->dir->contact($contact->fresh())]);
    }

    // DELETE /directory/contacts/{contact}
    public function destroyContact(Request $request, OrgContact $contact): JsonResponse
    {
        abort_unless($contact->org->editableBy($request->user()), 403, 'You can\'t change this company.');
        $contact->delete();
        return response()->json(['message' => 'Contact removed.']);
    }

    // ── A company's own list (partners) ──────────────────────────────────────

    // GET /partners?relation=receiver
    public function partners(Request $request): JsonResponse
    {
        $me = $this->myOrg($request);
        $relation = $request->validate(['relation' => ['nullable', Rule::in(OrgPartner::RELATIONS)]])['relation'] ?? null;
        $orgs = Organization::whereIn('id', OrgPartner::where('org_id', $me)->when($relation, fn ($q) => $q->where('relation', $relation))->pluck('partner_org_id'))
            ->withCount(['locations', 'contacts'])->with('listedBy:id,name')->orderBy('name')->get();
        return response()->json(['data' => $orgs->map(fn ($o) => $this->dir->summary($o, $request->user(), $me))->values()]);
    }

    // POST /partners { partner_org_id, relation }
    public function addPartner(Request $request): JsonResponse
    {
        $me = $request->user()->current_org_id;
        abort_unless($me, 422, 'Join or create a company first.');
        $data = $request->validate([
            'partner_org_id' => 'required|integer|exists:organizations,id',
            'relation'       => ['nullable', Rule::in(OrgPartner::RELATIONS)],
        ]);
        abort_if((int) $data['partner_org_id'] === (int) $me, 422, 'That is your own company.');
        OrgPartner::firstOrCreate(
            ['org_id' => $me, 'partner_org_id' => $data['partner_org_id'], 'relation' => $data['relation'] ?? 'receiver'],
            ['added_by' => $request->user()->id]
        );
        return response()->json(['data' => $this->dir->detail(Organization::find($data['partner_org_id']), $request->user())], 201);
    }

    // DELETE /partners/{org}
    public function removePartner(Request $request, Organization $org): JsonResponse
    {
        OrgPartner::where('org_id', $request->user()->current_org_id)->where('partner_org_id', $org->id)->delete();
        return response()->json(['message' => 'Removed from your list.']);
    }

    // GET /locations/usable?q= — for building a load: your own locations, your partners', and public matches
    public function usableLocations(Request $request): JsonResponse
    {
        $me = $this->myOrg($request);
        $q  = trim((string) ($request->validate(['q' => 'nullable|string|max:100'])['q'] ?? ''));
        $partners = OrgPartner::where('org_id', $me)->pluck('partner_org_id');

        $rows = Location::with('org:id,name,type')
            ->usableBy($me)
            ->where(function ($w) use ($me, $partners, $q) {
                $w->where('org_id', $me)->orWhereIn('org_id', $partners);
                if ($q !== '') $w->orWhere(fn ($x) => $x->where('visibility', 'public')->where(fn ($y) => $y
                    ->where('name', 'ilike', "%{$q}%")->orWhere('city', 'ilike', "%{$q}%")->orWhere('address', 'ilike', "%{$q}%")
                    ->orWhereHas('org', fn ($o) => $o->where('name', 'ilike', "%{$q}%"))));
            })
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('name', 'ilike', "%{$q}%")->orWhere('city', 'ilike', "%{$q}%")
                ->orWhere('address', 'ilike', "%{$q}%")->orWhereHas('org', fn ($o) => $o->where('name', 'ilike', "%{$q}%"))))
            ->orderByRaw('CASE WHEN org_id = ? THEN 0 ELSE 1 END', [$me ?? 0])
            ->orderByDesc('usage_count')->orderBy('name')
            ->limit(50)->get();

        // The stop's contact: the location's own contact (or the company's primary one), only for your own and your partners' locations
        $known = $rows->filter(fn ($l) => (int) $l->org_id === (int) $me || $partners->contains($l->org_id));
        $contacts = OrgContact::whereIn('org_id', $known->pluck('org_id')->unique())
            ->orderByDesc('is_primary')->orderBy('id')->get()->groupBy('org_id');

        return response()->json(['data' => $rows->map(function ($l) use ($me, $partners, $contacts) {
            $source = (int) $l->org_id === (int) $me ? 'mine' : ($partners->contains($l->org_id) ? 'partner' : 'directory');
            $orgContacts = $contacts->get($l->org_id, collect());
            $c = $orgContacts->firstWhere('location_id', $l->id) ?? $orgContacts->firstWhere('location_id', null);
            $own = $source === 'mine';
            return $this->dir->location($l) + [
                'org_type'      => $l->org?->type,
                'source'        => $source,
                'contact_name'  => $c?->name ?? ($own ? $l->contact_name : null),
                'contact_phone' => $c ? ($c->mobile ?: $c->phone) : ($own ? $l->contact_phone : null),
            ];
        })->values()]);
    }

    // ── Claims ───────────────────────────────────────────────────────────────

    // GET /directory/claimable?q= — public, for sign-up: listed organizations by name
    public function claimable(Request $request): JsonResponse
    {
        $q = trim((string) $request->validate(['q' => 'required|string|min:3|max:100'])['q']);
        $orgs = Organization::where('status', 'listed')->whereNull('owner_id')->where('name', 'ilike', "%{$q}%")
            ->orderBy('name')->limit(8)->get(['id', 'name', 'type', 'city', 'state']);
        return response()->json(['data' => $orgs]);
    }

    // POST /directory/orgs/{org}/claim — someone signed in without a company asks to take over a listing
    public function claim(Request $request, Organization $org): JsonResponse
    {
        $user = $request->user();
        abort_unless($org->isListed(), 422, 'This company has already been claimed.');
        abort_if($user->current_org_id, 422, 'You already belong to a company.');
        $as = $request->validate(['as_type' => ['nullable', Rule::in(['receiver', 'shipper', 'carrier', 'broker'])]])['as_type'] ?? $org->type;
        $claim = $this->dir->requestClaim($user, $org, $as);
        return response()->json(['data' => ['status' => $claim->status, 'org' => $org->only(['id', 'name'])]], 201);
    }

    // GET /admin/claims?status=pending
    public function adminClaims(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $status = $request->validate(['status' => 'nullable|in:pending,approved,rejected,all'])['status'] ?? 'pending';
        $claims = OrgClaim::with(['org:id,name,type,city,state,status', 'user:id,name,email'])
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->latest()->limit(200)->get();
        return response()->json(['data' => $claims->map(fn ($c) => [
            'id' => $c->id, 'status' => $c->status, 'as_type' => $c->as_type, 'method' => $c->method, 'note' => $c->note,
            'org' => $c->org?->only(['id', 'name', 'type', 'city', 'state', 'status']),
            'user' => $c->user?->only(['id', 'name', 'email']),
            'email_is_contact' => $c->org && $c->user && $c->org->contacts()->whereRaw('lower(email) = ?', [strtolower($c->user->email)])->exists(),
            'created_at' => $c->created_at?->toISOString(), 'decided_at' => $c->decided_at?->toISOString(),
        ])]);
    }

    // POST /admin/claims/{claim}/decide { action: approve|reject, note }
    public function decideClaim(Request $request, OrgClaim $claim): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $data = $request->validate(['action' => 'required|in:approve,reject', 'note' => 'nullable|string|max:1000']);
        abort_unless($claim->status === 'pending', 422, 'This claim was already decided.');
        if ($data['action'] === 'approve') {
            $this->dir->approveClaim($claim, $request->user(), 'admin', $data['note'] ?? null);
        } else {
            $claim->update(['status' => 'rejected', 'method' => 'admin', 'note' => $data['note'] ?? null, 'decided_by' => $request->user()->id, 'decided_at' => now()]);
        }
        return response()->json(['message' => $data['action'] === 'approve' ? 'Claim approved.' : 'Claim rejected.']);
    }

    /** Prefix rules for array items: locations.*.name */
    private function nested(string $key, array $rules): array
    {
        $out = [];
        foreach ($rules as $k => $r) $out["{$key}.*.{$k}"] = $r;
        return $out;
    }
}
