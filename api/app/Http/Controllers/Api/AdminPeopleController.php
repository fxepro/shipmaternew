<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrierProfile;
use App\Models\OrgMember;
use App\Models\PersonCredential;
use App\Models\PersonIdentity;
use App\Models\PersonVerification;
use App\Models\User;
use App\Services\PersonChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin review of people at carrier and shipper companies.
 * Which checks each person needs comes from their role (PersonChecks, docs/people-types-and-checks.md).
 * Only carrier owners and drivers need approval; only drivers need a background check.
 */
class AdminPeopleController extends Controller
{
    // GET /api/v1/admin/people?type=carrier|shipper&role=&status=&q=
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $data = $request->validate([
            'type'   => ['nullable', 'in:all,carrier,shipper'],
            'role'   => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
            'q'      => ['nullable', 'string', 'max:100'],
        ]);

        $memberIds = OrgMember::whereHas('org', fn ($q) => $q->whereIn('type', ['carrier', 'shipper']))->pluck('user_id');

        $query = User::where(fn ($q) => $q->whereIn('role', ['carrier', 'shipper'])->orWhereIn('id', $memberIds))
            ->with(['personVerification', 'personIdentity'])
            ->latest();

        if (!empty($data['q'])) {
            $query->where(fn ($q) => $q->where('name', 'ilike', "%{$data['q']}%")->orWhere('email', 'ilike', "%{$data['q']}%"));
        }

        $people = $query->limit(1000)->get()->map(function (User $u) {
            $m         = PersonChecks::membership($u);
            $checklist = PersonChecks::checklist($u, $m);
            $pv        = $u->personVerification;
            $status    = $checklist['approval_required'] ? ($pv?->status ?? 'incomplete') : 'not_required';
            $credItems = array_filter($checklist['items'], fn ($i) => str_starts_with($i['key'], 'credential:'));

            return [
                'id'                => $u->id,
                'name'              => $u->name,
                'email'             => $u->email,
                'company'           => $m['org'] ? ['id' => $m['org']->id, 'name' => PersonChecks::companyName($m['org'])] : null,
                'company_type'      => $m['type'],
                'role'              => $m['role'],
                'account_status'    => $u->status ?? 'active',
                'approval_required' => $checklist['approval_required'],
                'identity'          => $this->item($checklist, 'identity'),
                'background'        => $checklist['approval_required'] && $m['role'] === 'driver' ? ($pv?->background_check_status ?? 'not_started') : null,
                'credentials'       => [
                    'required_met'   => count(array_filter($credItems, fn ($i) => $i['required'] && $i['state'] === 'met')),
                    'required_total' => count(array_filter($credItems, fn ($i) => $i['required'])),
                    'recorded'       => count(array_filter($credItems, fn ($i) => !$i['required'] && $i['state'] !== 'missing')),
                    'problems'       => count(array_filter($credItems, fn ($i) => in_array($i['state'], ['expired', 'failed'], true))),
                ],
                'ready'             => $checklist['ready'],
                'status'            => $status,
                'created_at'        => $u->created_at?->toISOString(),
            ];
        });

        $people = $people
            ->when(($data['type'] ?? 'all') !== 'all', fn ($c) => $c->where('company_type', $data['type']))
            ->when(!empty($data['role']) && $data['role'] !== 'all', fn ($c) => $c->where('role', $data['role']))
            ->when(!empty($data['status']) && $data['status'] !== 'all', fn ($c) => $c->where('status', $data['status']))
            ->values();

        return response()->json(['data' => $people]);
    }

    // GET /api/v1/admin/people/{user}
    public function show(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        PersonChecks::refresh($user);
        $m  = PersonChecks::membership($user);
        $pv = PersonChecks::verification($user);

        return response()->json(['data' => $this->detail($user, $m, $pv)]);
    }

    // POST /api/v1/admin/people/{user}/identity   { result: verified|failed, reason? }
    public function recordIdentity(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $data = $request->validate([
            'result' => ['required', 'in:verified,failed'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $identity = PersonChecks::identity($user);
        $verified = $data['result'] === 'verified';
        $identity->update([
            'status'              => $data['result'],
            'verification_method' => $verified ? 'manual' : $identity->verification_method,
            'failure_reason'      => $verified ? null : ($data['reason'] ?? null),
            'verified_at'         => $verified ? now() : null,
            'verified_by'         => $verified ? $request->user()->id : null,
        ]);

        // Carrier screens still read identity from the carrier profile
        CarrierProfile::where('user_id', $user->id)->first()?->updateQuietly([
            'identity_verified'    => $verified,
            'identity_verified_at' => $verified ? now() : null,
        ]);

        PersonChecks::refresh($user);

        return response()->json(['message' => $verified ? 'Identity verified.' : 'Identity marked failed.']);
    }

    // POST /api/v1/admin/people/{user}/background   { result, reference?, notes? }   (drivers only)
    public function recordBackground(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $data = $request->validate([
            'result'    => ['required', 'in:pending,clear,consider,failed'],
            'reference' => ['nullable', 'string', 'max:255'],
            'notes'     => ['nullable', 'string', 'max:1000'],
        ]);

        $m = PersonChecks::membership($user);
        if (!PersonChecks::rules($m['type'], $m['role'])['background']) {
            return response()->json(['error' => 'Only drivers need a person-level background check.', 'code' => 'background_not_required'], 422);
        }

        PersonChecks::verification($user)->update([
            'background_check_status'    => $data['result'],
            'background_check_reference' => $data['reference'] ?? null,
            'background_check_notes'     => $data['notes'] ?? null,
            'background_checked_at'      => now(),
        ]);
        CarrierProfile::where('user_id', $user->id)->first()?->updateQuietly(['background_check_status' => PersonChecks::backgroundForProfile($data['result'])]);

        PersonChecks::refresh($user);

        return response()->json(['message' => 'Background check recorded.']);
    }

    // POST /api/v1/admin/people/{user}/credentials   (multipart; document optional)
    public function storeCredential(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $data = $this->validateCredential($request);
        $cred = new PersonCredential(['user_id' => $user->id, 'source' => 'admin']);
        $this->fillCredential($cred, $data, $request);
        if ($request->boolean('verified')) {
            $cred->fill(['verified_at' => now(), 'verified_by' => $request->user()->id]);
        }
        $cred->save();

        PersonChecks::refresh($user);

        return response()->json(['data' => PersonChecks::credentialSummary($cred)], 201);
    }

    // POST /api/v1/admin/people/credentials/{credential}/verify   { verified: bool, result?, notes? }
    public function verifyCredential(Request $request, PersonCredential $credential): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $data = $request->validate([
            'verified' => ['required', 'boolean'],
            'result'   => ['nullable', 'in:pending,clear,failed,violations_found,negative,positive'],
            'notes'    => ['nullable', 'string', 'max:1000'],
        ]);

        $credential->fill([
            'verified_at' => $data['verified'] ? now() : null,
            'verified_by' => $data['verified'] ? $request->user()->id : null,
        ]);
        if (array_key_exists('result', $data) && $data['result'] !== null) $credential->result = $data['result'];
        if (!empty($data['notes'])) $credential->notes = $data['notes'];
        $credential->save();

        PersonChecks::refresh($credential->user);

        return response()->json(['data' => PersonChecks::credentialSummary($credential)]);
    }

    // DELETE /api/v1/admin/people/credentials/{credential}
    public function destroyCredential(Request $request, PersonCredential $credential): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $user = $credential->user;
        $credential->delete();
        PersonChecks::refresh($user);

        return response()->json(['message' => 'Credential removed.']);
    }

    // POST /api/v1/admin/people/{user}/review   { action: approve|reject, notes? }
    public function review(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        $data = $request->validate([
            'action' => ['required', 'in:approve,reject'],
            'notes'  => ['nullable', 'string', 'max:1000'],
        ]);

        $m         = PersonChecks::membership($user);
        $checklist = PersonChecks::checklist($user, $m);
        $pv        = PersonChecks::verification($user);

        if (!$checklist['approval_required']) {
            return response()->json(['error' => 'This role does not need approval.', 'code' => 'approval_not_required'], 422);
        }

        if ($data['action'] === 'approve') {
            if ($pv->status === 'pending_payment') {
                return response()->json(['error' => 'The onboarding fee has not been paid yet.', 'code' => 'fee_unpaid'], 422);
            }
            if (!$checklist['ready']) {
                $missing = collect($checklist['items'])->where('required', true)->where('state', '!=', 'met')->pluck('label')->implode(', ');
                return response()->json(['error' => "Still needed before approval: {$missing}.", 'code' => 'checks_incomplete'], 422);
            }
        }

        $status = $data['action'] === 'approve' ? 'approved' : 'rejected';
        $pv->update([
            'status'      => $status,
            'notes'       => $data['notes'] ?? null,
            'reviewed_at' => now(),
            'reviewed_by' => $request->user()->id,
        ]);

        // Carrier screens and access still read the carrier profile's status
        CarrierProfile::where('user_id', $user->id)->first()?->updateQuietly([
            'verification_status'            => $status,
            'verification_notes'             => $data['notes'] ?? null,
            'verification_status_updated_at' => now(),
        ]);

        return response()->json(['message' => "Person {$status}.", 'status' => $status]);
    }

    // GET /api/v1/admin/people/{user}/files/{kind}   kind: id_front | id_back | selfie
    public function identityFile(Request $request, User $user, string $kind)
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        abort_unless(in_array($kind, ['id_front', 'id_back', 'selfie'], true), 404);

        $identity = PersonIdentity::where('user_id', $user->id)->firstOrFail();

        return PersonChecks::fileResponse($identity->{"{$kind}_path"});
    }

    // GET /api/v1/admin/people/credentials/{credential}/file
    public function credentialFile(Request $request, PersonCredential $credential)
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        return PersonChecks::fileResponse($credential->document_path);
    }

    // ── Shared with the person's own endpoints ───────────────────────────────

    public function validateCredential(Request $request): array
    {
        return $request->validate([
            'type'          => ['required', Rule::in(array_keys(PersonChecks::CREDENTIAL_LABELS))],
            'name'          => ['nullable', 'string', 'max:255'],
            'issuer'        => ['nullable', 'string', 'max:255'],
            'number'        => ['nullable', 'string', 'max:100'],
            'issuing_state' => ['nullable', 'string', 'max:100'],
            'class'         => ['nullable', 'string', 'max:20'],
            'issued_at'     => ['nullable', 'date'],
            'expires_at'    => ['nullable', 'date'],
            'result'        => ['nullable', 'in:pending,clear,failed,violations_found,negative,positive'],
            'notes'         => ['nullable', 'string', 'max:1000'],
            'document'      => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,heic,webp', 'max:10240'],
        ]);
    }

    public function fillCredential(PersonCredential $cred, array $data, Request $request): void
    {
        $cred->fill(collect($data)->except('document')->all());
        $cred->name ??= PersonChecks::CREDENTIAL_LABELS[$cred->type] ?? null;
        if ($request->hasFile('document')) {
            $cred->document_path = PersonChecks::storeFile($request->file('document'), $cred->user_id, "credential_{$cred->type}");
        }
    }

    public function detail(User $user, array $m, PersonVerification $pv): array
    {
        $checklist = PersonChecks::checklist($user, $m);

        return [
            'person' => [
                'id' => $user->id, 'name' => $user->name, 'email' => $user->email,
                'account_status' => $user->status ?? 'active', 'created_at' => $user->created_at?->toISOString(),
            ],
            'company'      => $m['org'] ? ['id' => $m['org']->id, 'name' => PersonChecks::companyName($m['org']), 'type' => $m['org']->type,
                                'verification_status' => $m['org']->verification_status] : null,
            'company_type' => $m['type'],
            'role'         => $m['role'],
            'checklist'    => $checklist,
            'verification' => [
                'status'               => $checklist['approval_required'] ? $pv->status : 'not_required',
                'notes'                => $pv->notes,
                'reviewed_at'          => $pv->reviewed_at?->toISOString(),
                'reviewed_by'          => $pv->reviewed_by ? User::where('id', $pv->reviewed_by)->value('name') : null,
                'background_status'    => $pv->background_check_status,
                'background_reference' => $pv->background_check_reference,
                'background_notes'     => $pv->background_check_notes,
                'background_checked_at'=> $pv->background_checked_at?->toISOString(),
            ],
            'identity'    => PersonChecks::identitySummary(PersonIdentity::where('user_id', $user->id)->first()),
            'credentials' => PersonChecks::credentials($user)->map(fn ($c) => PersonChecks::credentialSummary($c))->values(),
        ];
    }

    private function item(array $checklist, string $key): ?string
    {
        foreach ($checklist['items'] as $i) {
            if ($i['key'] === $key) return $i['state'];
        }
        return null;
    }
}
