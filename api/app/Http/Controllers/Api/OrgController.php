<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\OrgInvitation;
use App\Models\OrgMember;
use App\Notifications\OrgInvitationNotification;
use App\Services\PersonChecks;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrgController extends Controller
{
    // GET /api/v1/org
    public function show(Request $request): JsonResponse
    {
        $org = $request->user()->currentOrg;
        abort_if(!$org, 404);

        return response()->json([
            'data' => [
                'id'       => $org->id,
                'name'     => $org->name,
                'slug'     => $org->slug,
                'type'     => $org->type,
                'status'   => $org->status,
                'plan'     => $org->plan,
                'logo_url' => $org->logo_url,
                'phone'    => $org->phone,
                'email'    => $org->email,
                'website'  => $org->website,
                'street'   => $org->street,
                'city'     => $org->city,
                'state'    => $org->state,
                'zip'      => $org->zip,
                'country'  => $org->country,
                'tax_id'   => $org->tax_id,
            ],
        ]);
    }

    // PUT /api/v1/org
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $org  = $user->currentOrg;
        abort_if(!$org, 404);
        abort_unless($user->canDo('company.profile'), 403);

        $validated = $request->validate([
            'name'     => ['sometimes', 'string', 'max:255'],
            'phone'    => ['sometimes', 'nullable', 'string', 'max:40'],
            'email'    => ['sometimes', 'nullable', 'email'],
            'website'  => ['sometimes', 'nullable', 'string', 'max:255'],
            'logo_url' => ['sometimes', 'nullable', 'string'],
            'street'   => ['sometimes', 'nullable', 'string', 'max:255'],
            'city'     => ['sometimes', 'nullable', 'string', 'max:120'],
            'state'    => ['sometimes', 'nullable', 'string', 'max:60'],
            'zip'      => ['sometimes', 'nullable', 'string', 'max:20'],
            'country'  => ['sometimes', 'nullable', 'string', 'size:2'],
            'tax_id'   => ['sometimes', 'nullable', 'string', 'max:20'],
        ]);

        $org->update($validated);

        return response()->json(['data' => $org->fresh()]);
    }

    // GET /api/v1/org/members
    public function members(Request $request): JsonResponse
    {
        $org = $request->user()->currentOrg;
        abort_if(!$org, 404);

        $memberRows = OrgMember::where('org_id', $org->id)->with('user.personVerification')->get();
        $userIds = $memberRows->pluck('user_id');
        $endorsements = \App\Support\Endorsements::forUsers($userIds);
        $creds = \App\Models\PersonCredential::whereIn('user_id', $userIds)->whereIn('type', ['cdl', 'dot_medical'])
            ->orderByDesc('updated_at')->get()->groupBy(fn ($c) => $c->user_id . ':' . $c->type)->map->first();
        $members = $memberRows
            ->map(function ($m) use ($org, $endorsements, $creds) {
                $cdl = $creds[$m->user_id . ':cdl'] ?? null;
                $med = $creds[$m->user_id . ':dot_medical'] ?? null;
                $role      = $m->user_id === $org->owner_id ? 'owner' : $m->role;
                $checklist = PersonChecks::checklist($m->user, ['org' => $org, 'type' => $org->type, 'role' => $role]);
                return [
                    'id'        => $m->id,
                    'user_id'   => $m->user_id,
                    'name'      => $m->user->name,
                    'email'     => $m->user->email,
                    'role'      => $m->role,
                    'status'    => $m->status,
                    'joined_at' => $m->joined_at?->toDateString(),
                    'is_owner'  => $m->user_id === $org->owner_id,
                    // Person checks: only carrier owners and drivers need approval
                    'approval_required' => $checklist['approval_required'],
                    'person_status'     => $checklist['approval_required'] ? ($m->user->personVerification?->status ?? 'incomplete') : 'not_required',
                    'required_met'      => $checklist['required_met'],
                    'required_total'    => $checklist['required_total'],
                    // Driving: anyone with a CDL drives, the owner-operator included
                    'drives'            => $m->role === 'driver' || (bool) $cdl?->number,
                    'cdl'               => $cdl?->number ? [
                        'class' => $cdl->class, 'state' => $cdl->issuing_state, 'expires' => $cdl->expires_at?->toDateString(),
                        'verified' => (bool) $cdl->verified_at,
                    ] : null,
                    'endorsements'      => $endorsements[$m->user_id] ?? [],
                    'medical_expires'   => $med?->expires_at?->toDateString(),
                ];
            });

        return response()->json(['data' => $members, 'roles' => $this->roleOptions($org)]);
    }

    // PUT /api/v1/org/members/{id}
    public function updateMember(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->canDo('team.manage'), 403);

        $member = OrgMember::where('org_id', $user->current_org_id)
                            ->where('id', $id)
                            ->firstOrFail();

        // Cannot change owner role
        abort_if($member->user_id === $user->currentOrg->owner_id, 403, 'Cannot change org owner role.');
        abort_if($member->user_id === $user->id, 403, 'You cannot change your own role.');

        $validated = $request->validate([
            'role' => ['required', Rule::in($this->assignableRoles($user->currentOrg))],
        ]);

        $member->update($validated);
        PersonChecks::refresh($member->user);

        return response()->json(['data' => $member->fresh()]);
    }

    // DELETE /api/v1/org/members/{id}
    public function removeMember(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->canDo('team.manage'), 403);

        $member = OrgMember::where('org_id', $user->current_org_id)
                            ->where('id', $id)
                            ->firstOrFail();

        abort_if($member->user_id === $user->currentOrg->owner_id, 403, 'Cannot remove org owner.');
        abort_if($member->user_id === $user->id, 403, 'Cannot remove yourself.');

        $member->delete();

        // They can no longer act for this company: switch them to another company they belong to, or none
        $removed = $member->user;
        if ($removed && $removed->current_org_id === $member->org_id) {
            $next = OrgMember::where('user_id', $removed->id)->where('status', 'active')->with('org')->first();
            $removed->forceFill(['current_org_id' => $next?->org_id] + ($next?->org && $removed->role !== 'admin' ? ['role' => $next->org->type] : []))->save();
        }

        return response()->json(['message' => 'Member removed.']);
    }

    // GET /api/v1/org/invitations
    public function invitations(Request $request): JsonResponse
    {
        $org = $request->user()->currentOrg;
        abort_if(!$org, 404);

        // Pending, and expired in the last 30 days so they can be resent
        $invitations = OrgInvitation::where('org_id', $org->id)
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now()->subDays(30))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn($i) => $this->invitationRow($i));

        return response()->json(['data' => $invitations]);
    }

    // POST /api/v1/org/invitations
    public function invite(Request $request): JsonResponse
    {
        $user = $request->user();
        $org  = $user->currentOrg;
        abort_if(!$org, 404);
        abort_unless($user->canDo('team.manage'), 403);

        $validated = $request->validate([
            'email' => ['required', 'email'],
            'role'  => ['required', Rule::in($this->assignableRoles($org))],
        ]);
        $validated['email'] = strtolower(trim($validated['email']));

        $isMember = OrgMember::where('org_id', $org->id)
            ->whereHas('user', fn ($q) => $q->whereRaw('lower(email) = ?', [$validated['email']]))->exists();
        abort_if($isMember, 422, 'This person is already on your team.');

        // Delete any existing pending invite for this email
        OrgInvitation::where('org_id', $org->id)
            ->whereRaw('lower(email) = ?', [$validated['email']])
            ->whereNull('accepted_at')
            ->delete();

        $invitation = OrgInvitation::create([
            'org_id'     => $org->id,
            'email'      => $validated['email'],
            'role'       => $validated['role'],
            'token'      => Str::random(64),
            'invited_by' => $user->id,
            'expires_at' => now()->addDays(7),
        ]);

        $this->sendInvitation($invitation, $org, $user->name);

        return response()->json(['data' => $this->invitationRow($invitation)], 201);
    }

    // POST /api/v1/org/invitations/{id}/resend
    // Emails the same link again and gives it another 7 days.
    public function resendInvitation(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->canDo('team.manage'), 403);

        $invitation = OrgInvitation::where('org_id', $user->current_org_id)->where('id', $id)->whereNull('accepted_at')->firstOrFail();
        $invitation->update(['expires_at' => now()->addDays(7), 'invited_by' => $user->id]);
        $this->sendInvitation($invitation, $user->currentOrg, $user->name);

        return response()->json(['data' => $this->invitationRow($invitation)]);
    }

    private function sendInvitation(OrgInvitation $invitation, Organization $org, string $invitedBy): void
    {
        try {
            Notification::route('mail', $invitation->email)
                ->notify(new OrgInvitationNotification($invitation, PersonChecks::companyName($org), $invitedBy));
        } catch (\Throwable $e) {
            Log::warning('Invitation email failed', ['invitation_id' => $invitation->id, 'error' => $e->getMessage()]);
        }
    }

    private function invitationRow(OrgInvitation $i): array
    {
        return [
            'id'         => $i->id,
            'email'      => $i->email,
            'role'       => $i->role,
            'expires_at' => $i->expires_at->toDateString(),
            'expired'    => $i->expires_at->isPast(),
            'invite_url' => OrgInvitationNotification::url($i),
        ];
    }

    /** Roles an owner or staff member can give: carriers have dispatchers and drivers, shippers don't. */
    private function assignableRoles(?Organization $org): array
    {
        return array_values(array_diff(PersonChecks::ROLES[$org?->type] ?? ['staff', 'viewer'], ['owner']));
    }

    /** The roles a company can give, with a label and what each does (for the invite and role pickers) */
    private function roleOptions(?Organization $org): array
    {
        return array_map(fn ($r) => [
            'value' => $r, 'label' => PersonChecks::ROLE_LABELS[$r] ?? ucfirst($r), 'help' => PersonChecks::ROLE_HELP[$r] ?? '',
        ], $this->assignableRoles($org));
    }

    // GET /api/v1/invitations/{token}   (public)
    // What the invite link shows before signing up or signing in.
    public function showInvitation(string $token): JsonResponse
    {
        $invitation = OrgInvitation::where('token', $token)->first();
        abort_if(!$invitation, 404, 'Invitation not found.');

        $org = Organization::find($invitation->org_id);

        return response()->json(['data' => [
            'email'        => $invitation->email,
            'role'         => $invitation->role,
            'role_label'   => PersonChecks::ROLE_LABELS[$invitation->role] ?? $invitation->role,
            'role_help'    => PersonChecks::ROLE_HELP[$invitation->role] ?? null,
            'company_name' => PersonChecks::companyName($org),
            'company_type' => $org?->type,
            'expired'      => $invitation->expires_at->isPast(),
            'accepted'     => $invitation->accepted_at !== null,
        ]]);
    }

    // DELETE /api/v1/org/invitations/{id}
    public function cancelInvitation(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->canDo('team.manage'), 403);

        OrgInvitation::where('org_id', $user->current_org_id)
                     ->where('id', $id)
                     ->firstOrFail()
                     ->delete();

        return response()->json(['message' => 'Invitation cancelled.']);
    }

    // POST /api/v1/org/invitations/accept
    // Authenticated — user must be logged in (or register) before accepting.
    // The invitation token proves intent; email must match.
    public function acceptInvitation(Request $request): JsonResponse
    {
        $user      = $request->user();
        $validated = $request->validate(['token' => ['required', 'string', 'size:64']]);

        $invitation = OrgInvitation::where('token', $validated['token'])
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->firstOrFail();

        abort_unless(
            strtolower($invitation->email) === strtolower($user->email),
            403,
            'This invitation was sent to a different email address.'
        );

        // Join, or take the invited role if already a member (never for the owner)
        $org    = Organization::find($invitation->org_id);
        $member = OrgMember::firstOrNew(['org_id' => $invitation->org_id, 'user_id' => $user->id]);
        if ($org?->owner_id !== $user->id) $member->role = $invitation->role;
        $member->status = 'active';
        $member->joined_at ??= now();
        $member->save();

        $invitation->update(['accepted_at' => now()]);

        // Switch the user's active company to the one they just joined; their portal follows its type
        $user->update(['current_org_id' => $invitation->org_id] + ($org && $user->role !== 'admin' ? ['role' => $org->type] : []));
        PersonChecks::refresh($user);

        return response()->json([
            'message' => 'Invitation accepted.',
            'org_id'  => $invitation->org_id,
        ]);
    }

    // PUT /api/v1/org/switch
    // Allows a user who belongs to multiple orgs to change their active org.
    public function switchOrg(Request $request): JsonResponse
    {
        $user      = $request->user();
        $validated = $request->validate(['org_id' => ['required', 'integer']]);

        // Verify the user is an active member of the target org.
        $member = OrgMember::where('user_id', $user->id)
            ->where('org_id', $validated['org_id'])
            ->where('status', 'active')
            ->firstOrFail();

        $user->update(['current_org_id' => $member->org_id]);

        $org = Organization::find($member->org_id);

        return response()->json([
            'message' => 'Active org switched.',
            'org'     => [
                'id'   => $org->id,
                'name' => $org->name,
                'slug' => $org->slug,
                'type' => $org->type,
            ],
        ]);
    }

    // GET /api/v1/user/organizations
    // Lists all orgs the authenticated user belongs to (for an org-switcher UI).
    public function userOrgs(Request $request): JsonResponse
    {
        $user = $request->user();

        $orgs = OrgMember::where('user_id', $user->id)
            ->where('status', 'active')
            ->with('org')
            ->get()
            ->map(fn($m) => [
                'id'         => $m->org->id,
                'name'       => $m->org->name,
                'slug'       => $m->org->slug,
                'type'       => $m->org->type,
                'plan'       => $m->org->plan,
                'logo_url'   => $m->org->logo_url,
                'org_role'   => $m->role,
                'is_current' => $m->org_id === $user->current_org_id,
            ]);

        return response()->json(['data' => $orgs]);
    }
}
