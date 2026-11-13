<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BackgroundCheck;
use App\Models\Capability;
use App\Models\OrgMember;
use App\Models\PersonCredential;
use App\Models\PersonIdentity;
use App\Models\ProExperience;
use App\Models\ProProfile;
use App\Models\User;
use App\Services\Background\BackgroundChecks;
use App\Services\PersonChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * A person's professional profile: CDL, experience, work history, About, and the public profile at /p/{slug}.
 * It belongs to the person and goes with them from company to company.
 * visibility: private (only the person) | platform (signed-in Shipmater users) | public (anyone with the link).
 * Contact details are shown only to signed-in users at a company. Personal documents and check details are never shown:
 * checks appear as a result and a date only.
 */
class ProProfileController extends Controller
{
    public const ABOUT_MAX_WORDS = 1000;

    public function show(Request $request): JsonResponse
    {
        $p = ProProfile::for($request->user());
        return response()->json(['data' => [...$p->toCard(), 'experiences' => $this->experiences($p->user_id)]]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'headline'               => 'nullable|string|max:160',
            'roles'                  => 'sometimes|array',
            'roles.*'                => [Rule::in(array_keys(ProProfile::ROLES))],
            'years_experience'       => 'nullable|integer|min:0|max:70',
            'equipment_experience'   => 'sometimes|array',
            'equipment_experience.*' => [Rule::in(Capability::keys('equipment'))],
            'haul_types'             => 'sometimes|array',
            'haul_types.*'           => [Rule::in(array_keys(ProProfile::HAUL_TYPES))],
            'team_ok'                => 'sometimes|boolean',
            'home_city'              => 'nullable|string|max:120',
            'home_state'             => 'nullable|string|max:10',
            'home_country'           => 'sometimes|string|size:2',
            'preferred_regions'      => 'sometimes|array|max:20',
            'preferred_regions.*'    => 'string|max:40',
            'open_to_work'           => 'sometimes|boolean',
            'available_from'         => 'nullable|date',
            'bio'                    => 'nullable|string|max:8000',
            'visibility'             => 'sometimes|in:private,platform,public',
        ]);
        if (!empty($data['bio']) && self::words($data['bio']) > self::ABOUT_MAX_WORDS) {
            throw ValidationException::withMessages(['bio' => 'About can be up to ' . self::ABOUT_MAX_WORDS . ' words.']);
        }
        foreach (['roles', 'equipment_experience', 'haul_types', 'preferred_regions'] as $k) {
            if (isset($data[$k])) $data[$k] = array_values(array_unique($data[$k]));
        }
        $p = ProProfile::for($request->user());
        $p->update($data);
        return response()->json(['data' => [...$p->fresh()->toCard(), 'experiences' => $this->experiences($p->user_id)]]);
    }

    // ── Work history ─────────────────────────────────────────────────────────

    // POST /api/v1/me/experiences
    public function storeExperience(Request $request): JsonResponse
    {
        $data = $this->validateExperience($request);
        $e = ProExperience::create([...$data, 'user_id' => $request->user()->id]);
        return response()->json(['data' => $e->toCard()], 201);
    }

    // PUT /api/v1/me/experiences/{experience}
    public function updateExperience(Request $request, ProExperience $experience): JsonResponse
    {
        abort_unless($experience->user_id === $request->user()->id, 404);
        $experience->update($this->validateExperience($request));
        return response()->json(['data' => $experience->fresh()->toCard()]);
    }

    // DELETE /api/v1/me/experiences/{experience}
    public function destroyExperience(Request $request, ProExperience $experience): JsonResponse
    {
        abort_unless($experience->user_id === $request->user()->id, 404);
        $experience->delete();
        return response()->json(['message' => 'Removed.']);
    }

    private function validateExperience(Request $request): array
    {
        $data = $request->validate([
            'title'           => 'required|string|max:120',
            'company_name'    => 'required|string|max:160',
            'org_id'          => 'nullable|integer|exists:organizations,id',
            'employment_type' => ['nullable', Rule::in(array_keys(ProExperience::TYPES))],
            'location'        => 'nullable|string|max:120',
            'start_date'      => 'required|date|before_or_equal:today',
            'end_date'        => 'nullable|date|after_or_equal:start_date|before_or_equal:today',
            'description'     => 'nullable|string|max:3000',
            'equipment'       => 'sometimes|array',
            'equipment.*'     => [Rule::in(Capability::keys('equipment'))],
        ]);
        // A job can only be linked to a Shipmater company the person is a member of (that is what makes it "verified")
        if (!empty($data['org_id']) && !OrgMember::where('org_id', $data['org_id'])->where('user_id', $request->user()->id)->exists()) {
            $data['org_id'] = null;
        }
        return $data;
    }

    // GET /api/v1/me/experiences/companies   Shipmater companies the person can link a job to
    public function myCompanies(Request $request): JsonResponse
    {
        $orgs = OrgMember::where('user_id', $request->user()->id)->with('org')->get()
            ->map(fn ($m) => $m->org ? ['id' => $m->org->id, 'name' => PersonChecks::companyName($m->org)] : null)
            ->filter()->values();
        return response()->json(['data' => $orgs]);
    }

    private function experiences(int $userId): array
    {
        return ProExperience::where('user_id', $userId)
            ->orderByRaw('end_date IS NOT NULL')->orderByDesc('end_date')->orderByDesc('start_date')
            ->get()->map->toCard()->values()->all();
    }

    // ── Public profile ───────────────────────────────────────────────────────

    // GET /api/v1/public/people/{slug}   (optionally signed in)
    public function publicShow(Request $request, string $slug): JsonResponse
    {
        $p = ProProfile::where('slug', $slug)->first();
        $user = $p ? User::find($p->user_id) : null;
        abort_unless($p && $user, 404);

        $viewer  = auth('sanctum')->user();
        $isSelf  = $viewer && $viewer->id === $user->id;
        $allowed = $isSelf || $p->visibility === 'public' || ($p->visibility === 'platform' && $viewer);
        if (!$allowed) {
            return response()->json(['message' => $p->visibility === 'platform' ? 'Sign in to see this profile.' : 'This profile is private.',
                'code' => $p->visibility === 'platform' ? 'sign_in' : 'private'], $p->visibility === 'platform' ? 401 : 404);
        }

        $card = $p->toCard();
        $caps = Capability::whereIn('key', [...$card['endorsements'], ...$card['equipment_experience']])->pluck('name', 'key');
        $name = fn (array $keys) => collect($keys)->map(fn ($k) => $caps[$k] ?? null)->filter()->values();

        $m = PersonChecks::membership($user);
        $identity = PersonIdentity::where('user_id', $user->id)->first();

        // Contact details: signed-in people at a company (and the person themself)
        $canContact = $isSelf || ($viewer && ($viewer->current_org_id || $viewer->isPlatformAdmin()));

        return response()->json(['data' => [
            'slug'         => $p->slug,
            'name'         => $user->name,
            'initials'     => collect(preg_split('/\s+/', trim((string) $user->name)))->filter()->map(fn ($w) => mb_strtoupper(mb_substr($w, 0, 1)))->take(2)->implode(''),
            'headline'     => $card['headline'],
            'roles'        => collect($card['roles'])->map(fn ($r) => ProProfile::ROLES[$r] ?? null)->filter()->values(),
            'location'     => collect([$card['home_city'], $card['home_state']])->filter()->implode(', ') ?: null,
            'company'      => $m['org'] ? ['name' => PersonChecks::companyName($m['org']), 'role' => PersonChecks::ROLE_LABELS[$m['role']] ?? $m['role']] : null,
            'member_since' => $user->created_at?->format('M Y'),
            'open_to_work' => $card['open_to_work'],
            'available_from' => $card['available_from'],
            'about'        => $card['bio'],
            'driving'      => ($m['type'] ?? null) === 'carrier',
            'details'      => [
                'cdl_class'    => $card['cdl_class'],
                'cdl_state'    => $card['cdl_state'],
                'endorsements' => $name($card['endorsements']),
                'years'        => $card['years_experience'],
                'equipment'    => $name($card['equipment_experience']),
                'haul_types'   => collect($card['haul_types'])->map(fn ($h) => ProProfile::HAUL_TYPES[$h] ?? null)->filter()->values(),
                'team_ok'      => $card['team_ok'],
            ],
            'experiences'    => collect($this->experiences($user->id))->map(fn ($e) => collect($e)->except(['org_id'])->all())->values(),
            'certifications' => $this->publicCertifications($user->id),
            'verification'   => $this->publicVerification($user, $identity),
            'contact'        => $canContact ? ['email' => $user->email, 'phone' => $identity?->phone ?? $user->phone ?? null] : null,
            'contact_hidden' => !$canContact,
            'visibility'     => $p->visibility,
            'is_self'        => $isSelf,
            'edit_path'      => $isSelf ? '/' . ($user->role === 'broker' ? 'broker' : $user->role) . '/profile?tab=pro' : null,
        ]]);
    }

    /** Certifications that are verified and current: name, issuer and dates only. Numbers and documents are never shown. */
    private function publicCertifications(int $userId): array
    {
        return PersonCredential::where('user_id', $userId)->whereIn('type', PersonChecks::CERT_TYPES)->whereNotNull('verified_at')
            ->orderByDesc('issued_at')->get()->filter(fn ($c) => !$c->isExpired() && !$c->hasFailedResult())
            ->map(fn ($c) => [
                'name' => $c->name ?: (PersonChecks::CREDENTIAL_LABELS[$c->type] ?? $c->type), 'type' => PersonChecks::CREDENTIAL_LABELS[$c->type] ?? $c->type,
                'issuer' => $c->issuer, 'issued' => $c->issued_at?->format('M Y'), 'expires' => $c->expires_at?->format('M Y'),
                'verified_by' => $c->verification_method === 'document_ai' ? 'Document checked automatically' : 'Verified by Shipmater',
            ])->values()->all();
    }

    /** Each check as a result and a date. No findings, no report, no download. */
    private function publicVerification(User $user, ?PersonIdentity $identity): array
    {
        $pv = PersonChecks::verification($user);
        $checks = BackgroundCheck::where('user_id', $user->id)->whereIn('status', BackgroundCheck::FINISHED)->latest('completed_at')->get();
        $basic = $checks->first(fn ($c) => $c->coversBasic() && $c->status === 'clear');
        $complete = $checks->first(fn ($c) => $c->coversComplete() && $c->status === 'clear');
        $cred = fn (string $t) => PersonCredential::where('user_id', $user->id)->where('type', $t)->latest('id')->first();
        $state = fn (?PersonCredential $c) => $c ? PersonChecks::credentialState($c) : 'missing';
        $completeValid = $complete?->completed_at?->copy()->addMonths(BackgroundChecks::COMPLETE_VALID_MONTHS);

        $row = fn (string $key, string $label, bool $passed, ?string $date, string $passText = 'Passed', ?string $note = null) =>
            ['key' => $key, 'label' => $label, 'passed' => $passed, 'result' => $passed ? $passText : 'Not on file', 'date' => $passed ? $date : null, 'note' => $passed ? $note : null];

        $cdl = $cred('cdl'); $medical = $cred('dot_medical'); $ch = $cred('clearinghouse');

        return [
            'level' => $pv->check_level,
            'items' => [
                $row('identity', 'Identity verification', $identity?->status === 'verified', $identity?->verified_at?->format('M j, Y'), 'Verified'),
                $row('basic', 'Basic criminal screening', (bool) $basic, $basic?->completed_at?->format('M j, Y')),
                $row('complete', 'Complete check (county records, MVR with CDLIS)', (bool) $complete && $completeValid?->isFuture(),
                    $complete?->completed_at?->format('M j, Y'), 'Passed', $completeValid ? 'Valid until ' . $completeValid->format('M j, Y') : null),
                $row('clearinghouse', 'FMCSA Drug & Alcohol Clearinghouse', $state($ch) === 'met', $ch?->issued_at?->format('M j, Y') ?? $ch?->verified_at?->format('M j, Y'), 'Clear'),
                $row('cdl', 'CDL verified', $state($cdl) === 'met', $cdl?->verified_at?->format('M j, Y'), 'Verified'),
                $row('dot_medical', 'DOT medical card', $state($medical) === 'met', null, 'Current', $medical?->expires_at ? 'Through ' . $medical->expires_at->format('M Y') : null),
            ],
        ];
    }

    private static function words(string $s): int
    {
        return count(preg_split('/\s+/u', trim($s), -1, PREG_SPLIT_NO_EMPTY));
    }

    public function adminShow(User $user): JsonResponse
    {
        $p = ProProfile::firstOrNew(['user_id' => $user->id]);
        return response()->json(['data' => [...$p->toCard(), 'experiences' => $this->experiences($user->id)]]);
    }
}
