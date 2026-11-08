<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\PlatformLead;
use App\Models\PlatformTenant;
use App\Models\OrgMember;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Admin-only endpoints for managing organizations and white-label tenants.
 * All routes require the authenticated user to have role = 'admin'.
 */
class AdminOrgController extends Controller
{
    // ── Organization list ─────────────────────────────────────────────────────

    // GET /api/v1/admin/orgs
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        // Every organization: companies signed up on Shipmater and the third parties connected to them
        $query = Organization::query()->with(['owner', 'listedBy:id,name'])->withCount('locations')
            ->addSelect(['connected_count' => DB::table('org_partners')->selectRaw('count(*)')->whereColumn('org_partners.partner_org_id', 'organizations.id')]);

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }
        if ($request->input('relation') === 'companies') {
            $query->where('status', '!=', 'listed')->whereNotNull('owner_id');
        } elseif ($request->input('relation') === 'third_party') {
            $query->where(fn ($w) => $w->where('status', 'listed')->orWhereNull('owner_id'));
        }
        if ($request->filled('plan')) {
            $query->where('plan', $request->input('plan'));
        }
        if ($request->boolean('tenants_only')) {
            $query->where('is_platform_tenant', true);
        }
        if ($request->filled('search')) {
            $query->where('name', 'ilike', '%' . $request->input('search') . '%');
        }

        $orgs = $query->orderByDesc('created_at')->paginate(100);

        return response()->json([
            'data' => $orgs->map(fn($o) => $this->formatOrg($o)),
            'meta' => [
                'total'        => $orgs->total(),
                'current_page' => $orgs->currentPage(),
                'last_page'    => $orgs->lastPage(),
            ],
        ]);
    }

    // GET /api/v1/admin/orgs/{id}
    public function show(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $org = Organization::with(['owner', 'platformTenant', 'orgMembers.user'])->findOrFail($id);

        return response()->json(['data' => $this->formatOrg($org, detailed: true)]);
    }

    // ── Stripe settings (the pivotal admin toggle) ────────────────────────────

    // PUT /api/v1/admin/orgs/{id}/stripe
    // Flip an org between Shipmater's Stripe (platform) and their own (connect).
    // Default is 'platform' for all orgs — protects ARR.
    public function updateStripe(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $org = Organization::findOrFail($id);

        $validated = $request->validate([
            'stripe_mode'       => ['required', Rule::in(['platform', 'connect'])],
            'stripe_connect_id' => ['nullable', 'string', 'max:255'],
            'commission_rate'   => ['nullable', 'numeric', 'min:0', 'max:1'],
        ]);

        if ($validated['stripe_mode'] === 'connect' && empty($validated['stripe_connect_id'])) {
            return response()->json([
                'message' => 'stripe_connect_id is required when switching to connect mode.',
            ], 422);
        }

        // Clear the connect ID when reverting to platform mode.
        if ($validated['stripe_mode'] === 'platform') {
            $validated['stripe_connect_id'] = null;
        }

        $org->update($validated);

        return response()->json([
            'data' => [
                'id'                => $org->id,
                'name'              => $org->name,
                'stripe_mode'       => $org->stripe_mode,
                'stripe_connect_id' => $org->stripe_connect_id,
                'commission_rate'   => $org->commission_rate,
                'effective_rate'    => $org->commissionRate(),
            ],
        ]);
    }

    // ── Platform tenant provisioning ──────────────────────────────────────────

    // GET /api/v1/admin/platform-tenants
    public function tenants(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $tenants = PlatformTenant::with('org', 'lead')
            ->orderByDesc('created_at')
            ->paginate(25);

        return response()->json([
            'data' => $tenants->map(fn($t) => $this->formatTenant($t)),
            'meta' => [
                'total'        => $tenants->total(),
                'current_page' => $tenants->currentPage(),
                'last_page'    => $tenants->lastPage(),
            ],
        ]);
    }

    // POST /api/v1/admin/platform-tenants
    // Provision a new white-label tenant from scratch or from an existing org.
    public function createTenant(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $validated = $request->validate([
            'org_id'          => ['nullable', 'integer', 'exists:organizations,id'],
            'lead_id'         => ['nullable', 'integer', 'exists:platform_leads,id'],
            // New org fields (used when org_id is null)
            'org_name'        => ['required_without:org_id', 'string', 'max:255'],
            'org_type'        => ['required_without:org_id', Rule::in(['shipper', 'carrier'])],
            'owner_email'     => ['required_without:org_id', 'email', 'exists:users,email'],
            // Tenant config
            'subdomain'       => ['nullable', 'string', 'max:63', 'unique:platform_tenants,subdomain', 'regex:/^[a-z0-9-]+$/'],
            'custom_domain'   => ['nullable', 'string', 'max:255', 'unique:platform_tenants,custom_domain'],
            'brand_name'      => ['nullable', 'string', 'max:255'],
            'primary_color'   => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'secondary_color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'hide_powered_by' => ['boolean'],
            'fmcsa_broker_mc' => ['nullable', 'string', 'max:20'],
            'feature_flags'   => ['nullable', 'array'],
            'notes'           => ['nullable', 'string'],
        ]);

        // Reuse an existing org or create a new one.
        if (!empty($validated['org_id'])) {
            $org = Organization::findOrFail($validated['org_id']);
        } else {
            $owner = User::where('email', $validated['owner_email'])->firstOrFail();
            $org   = Organization::create([
                'name'     => $validated['org_name'],
                'slug'     => Str::slug($validated['org_name']) . '-' . Str::random(4),
                'type'     => $validated['org_type'],
                'plan'     => 'enterprise',
                'status'   => 'active',
                'owner_id' => $owner->id,
            ]);
            OrgMember::create([
                'org_id'    => $org->id,
                'user_id'   => $owner->id,
                'role'      => 'owner',
                'status'    => 'active',
                'joined_at' => now(),
            ]);
            $owner->update(['current_org_id' => $org->id]);
        }

        $org->update(['is_platform_tenant' => true, 'plan' => 'enterprise']);

        $tenant = PlatformTenant::create([
            'org_id'          => $org->id,
            'lead_id'         => $validated['lead_id'] ?? null,
            'subdomain'       => $validated['subdomain'] ?? null,
            'custom_domain'   => $validated['custom_domain'] ?? null,
            'brand_name'      => $validated['brand_name'] ?? null,
            'primary_color'   => $validated['primary_color'] ?? null,
            'secondary_color' => $validated['secondary_color'] ?? null,
            'hide_powered_by' => $validated['hide_powered_by'] ?? false,
            'fmcsa_broker_mc' => $validated['fmcsa_broker_mc'] ?? null,
            'feature_flags'   => $validated['feature_flags'] ?? null,
            'notes'           => $validated['notes'] ?? null,
            'status'          => 'active',
        ]);

        // Link the lead to this org if provided.
        if (!empty($validated['lead_id'])) {
            PlatformLead::where('id', $validated['lead_id'])
                ->update(['org_id' => $org->id, 'status' => 'won']);
        }

        return response()->json(['data' => $this->formatTenant($tenant->load('org', 'lead'))], 201);
    }

    // PUT /api/v1/admin/platform-tenants/{id}
    public function updateTenant(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $tenant = PlatformTenant::findOrFail($id);

        $validated = $request->validate([
            'subdomain'       => ['nullable', 'string', 'max:63', 'regex:/^[a-z0-9-]+$/', Rule::unique('platform_tenants', 'subdomain')->ignore($tenant->id)],
            'custom_domain'   => ['nullable', 'string', 'max:255', Rule::unique('platform_tenants', 'custom_domain')->ignore($tenant->id)],
            'brand_name'      => ['nullable', 'string', 'max:255'],
            'primary_color'   => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'secondary_color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'logo_url_dark'   => ['nullable', 'string'],
            'favicon_url'     => ['nullable', 'string'],
            'hide_powered_by' => ['boolean'],
            'fmcsa_broker_mc' => ['nullable', 'string', 'max:20'],
            'feature_flags'   => ['nullable', 'array'],
            'status'          => ['nullable', Rule::in(['pending', 'active', 'suspended'])],
            'notes'           => ['nullable', 'string'],
        ]);

        $tenant->update($validated);

        return response()->json(['data' => $this->formatTenant($tenant->load('org', 'lead'))]);
    }

    // POST /api/v1/admin/leads/{id}/convert
    // Convert a sales lead into a white-label tenant.
    public function convertLead(Request $request, int $id): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $lead = PlatformLead::findOrFail($id);

        abort_if($lead->isConverted(), 422, 'This lead has already been converted to a tenant.');

        $validated = $request->validate([
            'owner_email'     => ['required', 'email', 'exists:users,email'],
            'subdomain'       => ['nullable', 'string', 'max:63', 'unique:platform_tenants,subdomain', 'regex:/^[a-z0-9-]+$/'],
            'custom_domain'   => ['nullable', 'string', 'max:255', 'unique:platform_tenants,custom_domain'],
            'primary_color'   => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'hide_powered_by' => ['boolean'],
        ]);

        $owner = User::where('email', $validated['owner_email'])->firstOrFail();

        $org = Organization::create([
            'name'               => $lead->company,
            'slug'               => Str::slug($lead->company) . '-' . Str::random(4),
            'type'               => 'shipper',
            'plan'               => 'enterprise',
            'status'             => 'active',
            'owner_id'           => $owner->id,
            'email'              => $lead->email,
            'is_platform_tenant' => true,
        ]);

        OrgMember::create([
            'org_id'    => $org->id,
            'user_id'   => $owner->id,
            'role'      => 'owner',
            'status'    => 'active',
            'joined_at' => now(),
        ]);

        $owner->update(['current_org_id' => $org->id]);

        $tenant = PlatformTenant::create([
            'org_id'          => $org->id,
            'lead_id'         => $lead->id,
            'brand_name'      => $lead->company,
            'subdomain'       => $validated['subdomain'] ?? null,
            'custom_domain'   => $validated['custom_domain'] ?? null,
            'primary_color'   => $validated['primary_color'] ?? null,
            'hide_powered_by' => $validated['hide_powered_by'] ?? false,
            'status'          => 'active',
        ]);

        $lead->update(['org_id' => $org->id, 'status' => 'won']);

        return response()->json([
            'data' => [
                'tenant' => $this->formatTenant($tenant->load('org', 'lead')),
                'org_id' => $org->id,
            ],
        ], 201);
    }

    // ── Private formatters ────────────────────────────────────────────────────

    private function formatOrg(Organization $o, bool $detailed = false): array
    {
        $data = [
            'id'                => $o->id,
            'name'              => $o->name,
            'slug'              => $o->slug,
            'type'              => $o->type,
            'plan'              => $o->plan,
            'status'            => $o->status,
            'is_platform_tenant'=> $o->is_platform_tenant,
            'stripe_mode'       => $o->stripe_mode,
            'stripe_connect_id' => $o->stripe_connect_id,
            'commission_rate'   => $o->commission_rate,
            'effective_rate'    => $o->commissionRate(),
            'fmcsa_broker_mc'   => $o->fmcsa_broker_mc,
            'owner'             => $o->owner ? ['id' => $o->owner->id, 'name' => $o->owner->name, 'email' => $o->owner->email] : null,
            'created_at'        => $o->created_at->toDateString(),
            // Third party: added by a company, nobody from it signed up
            'third_party'       => $o->status === 'listed' || !$o->owner_id,
            'added_by'          => $o->relationLoaded('listedBy') ? $o->listedBy?->name : null,
            'connected_count'   => (int) ($o->connected_count ?? 0),
            'locations_count'   => (int) ($o->locations_count ?? 0),
            'city'              => $o->city,
            'state'             => $o->state,
        ];

        if ($detailed) {
            $data['members'] = $o->orgMembers->map(fn($m) => [
                'id'    => $m->id,
                'name'  => $m->user->name,
                'email' => $m->user->email,
                'role'  => $m->role,
            ]);
            $data['platform_tenant'] = $o->platformTenant
                ? $this->formatTenant($o->platformTenant)
                : null;
        }

        return $data;
    }

    private function formatTenant(PlatformTenant $t): array
    {
        return [
            'id'                    => $t->id,
            'org_id'                => $t->org_id,
            'org_name'              => $t->org?->name,
            'lead_id'               => $t->lead_id,
            'lead_company'          => $t->lead?->company,
            'subdomain'             => $t->subdomain,
            'custom_domain'         => $t->custom_domain,
            'app_url'               => $t->appUrl(),
            'brand_name'            => $t->brand_name,
            'primary_color'         => $t->primary_color,
            'secondary_color'       => $t->secondary_color,
            'logo_url_dark'         => $t->logo_url_dark,
            'favicon_url'           => $t->favicon_url,
            'hide_powered_by'       => $t->hide_powered_by,
            'fmcsa_broker_mc'       => $t->fmcsa_broker_mc,
            'feature_flags'         => $t->feature_flags,
            'stripe_subscription_id'=> $t->stripe_subscription_id,
            'status'                => $t->status,
            'notes'                 => $t->notes,
            'created_at'            => $t->created_at->toDateString(),
        ];
    }
}
