<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrgMember;
use App\Models\PersonCredential;
use App\Models\PersonIdentity;
use App\Models\PersonVerification;
use App\Models\User;
use App\Services\PersonChecks;
use App\Support\LawEnforcement;
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
        // Officers search this page read only (App\Support\LawEnforcement); they never list everyone
        $staff = LawEnforcement::staffOr($request, 'le.people');
        if (!$staff) return $this->officerSearch($request);

        $data = $request->validate([
            'type'   => ['nullable', 'in:all,carrier,shipper,factor'],
            'role'   => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
            'q'      => ['nullable', 'string', 'max:100'],
        ]);

        $memberIds = OrgMember::whereHas('org', fn ($q) => $q->whereIn('type', ['carrier', 'shipper', 'broker', 'factor']))->pluck('user_id');

        $query = User::where(fn ($q) => $q->whereIn('role', ['carrier', 'shipper', 'broker', 'factor'])->orWhereIn('id', $memberIds))
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
                'drives'            => (bool) ($m['drives'] ?? false),
                'account_status'    => $u->status ?? 'active',
                'approval_required' => $checklist['approval_required'],
                'identity'          => $this->item($checklist, 'identity'),
                'background'        => $checklist['approval_required'] && ($m['drives'] ?? false) ? ($pv?->background_check_status ?? 'not_started') : null,
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
            ->when(!empty($data['role']) && $data['role'] !== 'all', fn ($c) => $data['role'] === 'driver' ? $c->filter(fn ($p) => $p['role'] === 'driver' || $p['drives']) : $c->where('role', $data['role']))
            ->when(!empty($data['status']) && $data['status'] !== 'all', fn ($c) => $c->where('status', $data['status']))
            ->values();

        return response()->json(['data' => $people]);
    }

    // GET /api/v1/admin/people/{user}
    public function show(Request $request, User $user): JsonResponse
    {
        $staff = LawEnforcement::staffOr($request, 'le.people');
        abort_if(!$staff && in_array($user->role, ['admin', 'agency'], true), 404);

        if ($staff) PersonChecks::refresh($user);
        $m  = PersonChecks::membership($user);
        $pv = PersonChecks::verification($user);

        if ($staff) return response()->json(['data' => $this->detail($user, $m, $pv)]);
        LawEnforcement::log($request, 'view', 'people', ['subject_type' => 'person', 'subject_id' => $user->id, 'subject_label' => $user->name]);
        return response()->json(['data' => $this->forOfficer($this->detail($user, $m, $pv))]);
    }

    /**
     * An officer's search: a CDL or other licence number (exact), or part of a name, at least three characters.
     * People at companies only; never Shipmater staff or other officers.
     */
    private function officerSearch(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < LawEnforcement::MIN_SEARCH) return response()->json(['data' => [], 'search_required' => true]);
        $number = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $q));
        $byLicence = PersonCredential::whereRaw("upper(regexp_replace(coalesce(number, ''), '[^A-Za-z0-9]', '', 'g')) = ?", [$number])->pluck('user_id');
        $people = User::whereNotIn('role', ['admin', 'agency'])
            ->where(fn ($w) => $w->where('name', 'ilike', "%{$q}%")->orWhereIn('id', $byLicence))
            ->orderBy('name')->limit(25)->get();
        LawEnforcement::log($request, 'search', 'people', ['query' => $q, 'results' => $people->count()]);
        return response()->json(['data' => $people->map(function (User $u) {
            $m = PersonChecks::membership($u);
            $checklist = PersonChecks::checklist($u, $m);
            $pv = $u->personVerification;
            $cdl = PersonCredential::where('user_id', $u->id)->where('type', 'cdl')->latest()->first();
            return [
                'id' => $u->id, 'name' => $u->name, 'email' => null,
                'company' => $m['org'] ? ['id' => $m['org']->id, 'name' => PersonChecks::companyName($m['org'])] : null,
                'company_type' => $m['type'], 'role' => $m['role'], 'drives' => (bool) ($m['drives'] ?? false),
                'account_status' => $u->status ?? 'active', 'approval_required' => $checklist['approval_required'],
                'identity' => $this->item($checklist, 'identity'),
                'background' => $pv?->background_checked_at ? 'done' : null,
                'credentials' => ['required_met' => 0, 'required_total' => 0, 'recorded' => 0, 'problems' => 0],
                'cdl' => $cdl ? trim(implode(' · ', array_filter([$cdl->number, $cdl->issuing_state, $cdl->class ? "Class {$cdl->class}" : null]))) : null,
                'ready' => $checklist['ready'],
                'status' => $checklist['approval_required'] ? ($pv?->status ?? 'incomplete') : 'not_required',
                'created_at' => $u->created_at?->toISOString(),
            ];
        })]);
    }

    /**
     * What an officer sees of a person: name, company, identity verified (not the documents), licence numbers,
     * credentials and whether a background check was done. Never date of birth, home address, SSN, ID images,
     * background results, notes or the document reader's findings.
     */
    private function forOfficer(array $d): array
    {
        $d['person']['email'] = null;
        $d['person']['phone'] = null;
        $d['person']['last_sign_in_at'] = null;
        $d['invitations'] = [];
        $d['verification'] = [
            'status' => $d['verification']['status'], 'notes' => null, 'reviewed_at' => $d['verification']['reviewed_at'], 'reviewed_by' => null,
            'background_status' => $d['verification']['background_checked_at'] ? 'done' : 'not_started',
            'background_reference' => null, 'background_notes' => null, 'background_checked_at' => $d['verification']['background_checked_at'],
        ];
        if ($d['identity']) {
            $d['identity'] = \Illuminate\Support\Arr::only($d['identity'], [
                'legal_first_name', 'legal_middle_name', 'legal_last_name', 'suffix', 'city', 'state', 'country',
                'id_type', 'id_issuing_state', 'id_issuing_country', 'id_expiry_date', 'status', 'verification_method', 'verified_at',
            ]) + ['has_id_front' => false, 'has_id_back' => false, 'has_selfie' => false, 'failure_reason' => null];
        }
        $d['credentials'] = collect($d['credentials'])->map(fn ($c) => array_merge($c, ['notes' => null, 'ai' => null, 'has_document' => false, 'verified_by' => null]))->values();
        $d['checklist']['items'] = collect($d['checklist']['items'])->map(fn ($i) => array_merge($i, ['detail' => null]))->values()->all();
        $d['all_checks'] = collect($d['all_checks'])->map(fn ($i) => array_merge($i, ['detail' => null]))->values()->all();
        $d['officer'] = true;
        return $d;
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
        if (!PersonChecks::rules($m['type'], $m['role'], $m['drives'] ?? false)['background']) {
            return response()->json(['error' => 'Only drivers need a person-level background check.', 'code' => 'background_not_required'], 422);
        }

        PersonChecks::verification($user)->update([
            'background_check_status'    => $data['result'],
            'background_check_reference' => $data['reference'] ?? null,
            'background_check_notes'     => $data['notes'] ?? null,
            'background_checked_at'      => now(),
        ]);

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
                'id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'user_role' => $user->role,
                'phone' => PersonIdentity::where('user_id', $user->id)->value('phone') ?? $user->phone ?? null,
                'account_status' => $user->status ?? 'active', 'created_at' => $user->created_at?->toISOString(),
                'last_sign_in_at' => $user->tokens()->max('created_at'),
            ],
            'company'      => $m['org'] ? ['id' => $m['org']->id, 'name' => PersonChecks::companyName($m['org']), 'type' => $m['org']->type,
                                'verification_status' => $m['org']->verification_status] : null,
            'company_type' => $m['type'],
            'role'         => $m['role'],
            'checklist'    => $checklist,
            'all_checks'   => PersonChecks::allChecks($user),
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
            'pro_profile' => \App\Models\ProProfile::firstOrNew(['user_id' => $user->id])->toCard() + [
                'experiences' => \App\Models\ProExperience::where('user_id', $user->id)
                    ->orderByRaw('end_date IS NOT NULL')->orderByDesc('end_date')->orderByDesc('start_date')->get()->map->toCard()->values()->all(),
            ],
            'cert_types'  => PersonChecks::CERT_TYPES,
            // Every company they work for now, and worked for before (org_members keeps the rows with left_at)
            'companies'   => OrgMember::history()->where('user_id', $user->id)->with('org')
                ->orderByRaw('left_at IS NOT NULL')->orderByDesc('joined_at')->get()
                ->filter(fn ($m) => $m->org)
                ->map(fn ($m) => [
                    'id' => $m->id, 'org_id' => $m->org_id, 'name' => $m->org->name, 'type' => $m->org->type,
                    'role' => $m->user_id === $m->org->owner_id && !$m->left_at ? 'owner' : $m->role, 'drives' => $m->isDriving(),
                    'status' => $m->left_at ? 'left' : $m->status, 'joined_at' => $m->joined_at?->toISOString(), 'left_at' => $m->left_at?->toISOString(),
                    'company_status' => $m->org->verification_status,
                ])->values(),
            // Invited and not yet joined
            'invitations' => \Illuminate\Support\Facades\DB::table('org_invitations as i')->join('organizations as o', 'o.id', '=', 'i.org_id')
                ->whereRaw('lower(i.email) = ?', [strtolower((string) $user->email)])->whereNull('i.accepted_at')->where('i.expires_at', '>', now())
                ->orderByDesc('i.created_at')->get(['i.id', 'o.id as org_id', 'o.name', 'o.type', 'i.role', 'i.created_at', 'i.expires_at']),
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
