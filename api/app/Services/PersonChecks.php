<?php

namespace App\Services;

use App\Models\CarrierProfile;
use App\Models\OrgMember;
use App\Models\Organization;
use App\Models\PersonCredential;
use App\Models\PersonIdentity;
use App\Models\PersonVerification;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * What each person must have, by company type and role, and whether they have it.
 * The rules are documented in docs/people-types-and-checks.md — keep the two in step.
 */
class PersonChecks
{
    public const ROLES = [
        'carrier' => ['owner', 'staff', 'dispatcher', 'driver', 'viewer'],
        'shipper' => ['owner', 'staff', 'viewer'],
        'factor'  => ['owner', 'staff', 'viewer'],
    ];

    public const ROLE_LABELS = [
        'owner' => 'Owner', 'staff' => 'Staff', 'dispatcher' => 'Dispatcher', 'driver' => 'Driver', 'viewer' => 'Viewer',
    ];

    public const CREDENTIAL_LABELS = [
        'cdl'                      => 'Commercial driver license (CDL)',
        'dot_medical'              => 'DOT medical card',
        'clearinghouse'            => 'FMCSA Drug & Alcohol Clearinghouse',
        'mvr'                      => 'Motor vehicle record (MVR)',
        'drug_test'                => 'Drug test',
        'hazmat_endorsement'       => 'Hazmat endorsement',
        'tanker_endorsement'       => 'Tanker endorsement',
        'passenger_endorsement'    => 'Passenger endorsement',
        'dispatcher_certification' => 'Dispatcher certification',
        'hazmat_shipper_training'  => 'Hazmat shipper training (49 CFR 172.704)',
        'other'                    => 'Other certification',
    ];

    private const NONE = ['approval' => false, 'auto_approve' => false, 'identity' => false, 'background' => false, 'min_age' => null, 'required' => [], 'recorded' => []];

    /** Requirements by company type and role */
    public static function rules(?string $type, ?string $role): array
    {
        return match ("{$type}.{$role}") {
            'carrier.driver' => [
                'approval' => true, 'identity' => true, 'background' => true, 'min_age' => 21,
                'required' => ['cdl', 'dot_medical', 'clearinghouse', 'mvr'],
                'recorded' => ['hazmat_endorsement', 'tanker_endorsement', 'passenger_endorsement', 'drug_test'],
            ],
            'carrier.owner' => [
                'approval' => true, 'identity' => true, 'background' => false, 'min_age' => 18,
                'required' => [], 'recorded' => [],
            ],
            // Factor owners: verified identity, cleared automatically with no Shipmater review (docs/noa-factoring.md)
            'factor.owner' => array_merge(self::NONE, ['approval' => true, 'auto_approve' => true, 'identity' => true, 'min_age' => 18]),
            'carrier.dispatcher' => array_merge(self::NONE, ['recorded' => ['dispatcher_certification']]),
            'shipper.staff'      => array_merge(self::NONE, ['recorded' => ['hazmat_shipper_training']]),
            default              => self::NONE,
        };
    }

    /** The person's company and role there: the current company first, then any carrier/shipper membership. */
    public static function membership(User $user): array
    {
        $members = OrgMember::where('user_id', $user->id)->with('org')->get()
            ->filter(fn ($m) => in_array($m->org?->type, ['carrier', 'shipper', 'factor'], true));

        $m = $members->firstWhere('org_id', $user->current_org_id) ?? $members->first();

        if ($m) {
            $role = $m->user_id === $m->org->owner_id ? 'owner' : $m->role;
            return ['org' => $m->org, 'type' => $m->org->type, 'role' => $role];
        }

        $type = in_array($user->role, ['carrier', 'shipper', 'factor'], true) ? $user->role : null;
        return ['org' => null, 'type' => $type, 'role' => $type ? 'owner' : null];
    }

    /** Display name for a company: the owner's registered company name until profiles move to the company (phase 2) */
    public static function companyName(?Organization $org): ?string
    {
        if (!$org) return null;
        if ($org->type === 'factor') return $org->name;
        $profile = $org->type === 'carrier'
            ? CarrierProfile::where('user_id', $org->owner_id)->value('company_name')
            : \App\Models\ShipperProfile::where('user_id', $org->owner_id)->value('company_name');

        return $profile ?: $org->name;
    }

    public static function verification(User $user): PersonVerification
    {
        return PersonVerification::firstOrCreate(['user_id' => $user->id], ['status' => 'incomplete']);
    }

    public static function identity(User $user): PersonIdentity
    {
        return PersonIdentity::firstOrCreate(['user_id' => $user->id], ['status' => 'not_started']);
    }

    /** Latest credential of each type for a person */
    public static function credentials(User $user)
    {
        return PersonCredential::where('user_id', $user->id)->orderByDesc('updated_at')->get();
    }

    public static function credentialState(?PersonCredential $c): string
    {
        return match (true) {
            $c === null             => 'missing',
            $c->isExpired()         => 'expired',
            $c->hasFailedResult()   => 'failed',
            $c->verified_at === null || $c->result === 'pending' => 'pending',
            default                 => 'met',
        };
    }

    /**
     * Checklist for a person: every item their role needs or records, and its state.
     * state: met | pending | missing | expired | failed. ready = every required item is met.
     */
    public static function checklist(User $user, ?array $membership = null): array
    {
        $membership ??= self::membership($user);
        $rules = self::rules($membership['type'], $membership['role']);

        $pv       = PersonVerification::where('user_id', $user->id)->first();
        $identity = PersonIdentity::where('user_id', $user->id)->first();
        $creds    = self::credentials($user)->groupBy('type');
        $items    = [];

        if ($rules['identity'] || $identity?->status === 'verified') {
            $state = match ($identity?->status) {
                'verified'             => 'met',
                'submitted', 'pending' => 'pending',
                'failed'               => 'failed',
                default                => 'missing',
            };
            $detail = $identity?->failure_reason;

            $age = $identity?->age();
            if ($rules['min_age'] && $age !== null && $age < $rules['min_age']) {
                $state  = 'failed';
                $detail = "Must be {$rules['min_age']} or older (age {$age}).";
            }

            $items[] = ['key' => 'identity', 'label' => 'Identity', 'required' => $rules['identity'], 'state' => $state, 'detail' => $detail];
        }

        if ($rules['background']) {
            $bg = $pv?->background_check_status ?? 'not_started';
            $items[] = [
                'key' => 'background', 'label' => 'Background check', 'required' => true,
                'state' => match (true) {
                    in_array($bg, PersonVerification::BACKGROUND_PASSED, true)        => 'met',
                    $bg === 'failed'                                                  => 'failed',
                    in_array($bg, ['pending', 'invitation_sent', 'in_progress', 'consider'], true) => 'pending',
                    default                                                           => 'missing',
                },
                'detail' => $bg === 'consider' ? 'Results need admin review.' : null,
            ];
        }

        foreach ([[$rules['required'], true], [$rules['recorded'], false]] as [$types, $required]) {
            foreach ($types as $type) {
                $c = $creds->get($type)?->first();
                $items[] = [
                    'key'      => "credential:{$type}",
                    'label'    => self::CREDENTIAL_LABELS[$type],
                    'required' => $required,
                    'state'    => self::credentialState($c),
                    'detail'   => $c?->expires_at ? 'Expires ' . $c->expires_at->toDateString() : null,
                    'credential_id' => $c?->id,
                ];
            }
        }

        $required = array_filter($items, fn ($i) => $i['required']);

        return [
            'company_type'      => $membership['type'],
            'role'              => $membership['role'],
            'approval_required' => $rules['approval'],
            'auto_approve'      => $rules['auto_approve'] ?? false,
            'items'             => $items,
            'required_total'    => count($required),
            'required_met'      => count(array_filter($required, fn ($i) => $i['state'] === 'met')),
            'ready'             => count(array_filter($required, fn ($i) => $i['state'] !== 'met')) === 0,
        ];
    }

    /**
     * Move the person's status to match their checks:
     * roles without approval → not_required; complete → pending_review; an approved person whose
     * required item has expired or failed → back to pending_review.
     */
    public static function refresh(User $user): PersonVerification
    {
        $pv        = self::verification($user);
        $checklist = self::checklist($user);
        $status    = $pv->status;

        if (!$checklist['approval_required']) {
            $status = 'not_required';
        } elseif ($checklist['auto_approve']) {
            // Cleared as soon as every required item is met; drops back when one lapses
            $status = $checklist['ready'] ? 'approved' : 'incomplete';
        } elseif ($status === 'approved' && !$checklist['ready']) {
            $status = 'pending_review';
            $pv->notes = 'A required item expired or changed after approval.';
        } elseif (in_array($status, ['incomplete', 'not_required', 'pending_review'], true)) {
            $status = $checklist['ready'] ? 'pending_review' : 'incomplete';
        }

        if ($status !== $pv->status) {
            $pv->status = $status;
            $pv->save();

            // Carrier screens and access still read the carrier profile's status
            if ($status === 'pending_review' && $profile = CarrierProfile::where('user_id', $user->id)->first()) {
                if ($profile->verification_status === 'approved') {
                    $profile->updateQuietly(['verification_status' => 'pending_review', 'verification_status_updated_at' => now()]);
                }
            }
        }

        return $pv;
    }

    /** Approved, with every required item still current */
    public static function isCleared(User $user): bool
    {
        $pv = PersonVerification::where('user_id', $user->id)->first();
        return $pv?->status === 'approved' && self::checklist($user)['ready'];
    }

    // ── Mirroring from carrier_profiles ──────────────────────────────────────

    private const PROFILE_FIELDS = [
        'verification_status', 'verification_notes', 'background_check_status', 'identity_verified', 'identity_verified_at',
        'date_of_birth', 'street', 'city', 'state', 'zip', 'country', 'phone', 'id_type', 'dl_number', 'dl_state', 'dl_expiry', 'ssn_last_4',
        'cdl_number', 'cdl_issuing_state', 'cdl_class', 'cdl_expiry_date', 'dot_medical_expiry', 'drug_test_date', 'drug_test_result',
        'hazmat_endorsement', 'hazmat_expiry_date', 'tanker_endorsement', 'passenger_endorsement',
        'clearinghouse_query_id', 'clearinghouse_query_status', 'clearinghouse_completed_at',
    ];

    /** Copy what the carrier profile collects into the person's records. Called whenever a carrier profile is saved. */
    public static function syncFromCarrierProfile(CarrierProfile $p): void
    {
        if (!$p->wasRecentlyCreated && !$p->wasChanged(self::PROFILE_FIELDS)) {
            return;
        }
        $user = User::find($p->user_id);
        if (!$user) return;

        // Approval and background
        $pv = self::verification($user);
        $pv->background_check_status = self::backgroundFromProfile($p->background_check_status);
        if (in_array($p->verification_status, ['pending_payment', 'pending_background'], true)
            && !in_array($pv->status, ['approved', 'rejected'], true)) {
            $pv->status = $p->verification_status;
        } elseif (in_array($pv->status, ['pending_payment', 'pending_background'], true)
            && !in_array($p->verification_status, ['pending_payment', 'pending_background'], true)) {
            $pv->status = 'incomplete';   // onboarding steps done; refresh() decides the rest
        }
        $pv->save();

        // Identity record
        $identity = self::identity($user);
        $identity->fill(array_filter([
            'date_of_birth'    => $p->date_of_birth,
            'street'           => $p->street,
            'city'             => $p->city,
            'state'            => $p->state,
            'zip'              => $p->zip,
            'country'          => $p->country ? substr($p->country, 0, 2) : null,
            'phone'            => $p->phone,
            'id_type'          => $p->id_type === 'passport' ? 'passport' : ($p->dl_number ? 'driver_license' : null),
            'id_issuing_state' => $p->dl_state,
            'id_expiry_date'   => $p->dl_expiry,
            'ssn_last4'        => $p->ssn_last_4 ? substr($p->ssn_last_4, -4) : null,
        ], fn ($v) => $v !== null && $v !== ''));
        if ($p->dl_number && $p->dl_number !== $identity->id_number) {
            $identity->id_number = $p->dl_number;
        }
        if ($p->identity_verified && $identity->status !== 'verified') {
            $identity->fill([
                'status' => 'verified', 'verification_method' => $identity->verification_method ?? 'stripe_identity',
                'verified_at' => $p->identity_verified_at ?? now(), 'failure_reason' => null,
            ]);
        }
        $identity->save();

        // Credentials
        $mirror = fn (string $type, bool $present, array $fields) => self::mirrorCredential($user->id, $type, $present, $fields);
        $mirror('cdl', (bool) $p->cdl_number, [
            'number' => $p->cdl_number, 'issuing_state' => $p->cdl_issuing_state, 'class' => $p->cdl_class, 'expires_at' => $p->cdl_expiry_date,
        ]);
        $mirror('dot_medical', (bool) $p->dot_medical_expiry, ['expires_at' => $p->dot_medical_expiry]);
        $mirror('drug_test', (bool) $p->drug_test_date, ['issued_at' => $p->drug_test_date, 'result' => $p->drug_test_result]);
        $mirror('hazmat_endorsement', (bool) $p->hazmat_endorsement, ['expires_at' => $p->hazmat_expiry_date]);
        $mirror('tanker_endorsement', (bool) $p->tanker_endorsement, []);
        $mirror('passenger_endorsement', (bool) $p->passenger_endorsement, []);

        $chStatus = $p->clearinghouse_query_status;
        if ($chStatus && $chStatus !== 'not_run') {
            $c = self::mirrorCredential($user->id, 'clearinghouse', true, [
                'number' => $p->clearinghouse_query_id, 'issued_at' => $p->clearinghouse_completed_at, 'result' => self::clearinghouseResult($chStatus),
            ]);
            // The query itself verifies the result
            if ($c && $c->result === 'clear' && !$c->verified_at) {
                $c->update(['verified_at' => $p->clearinghouse_completed_at ?? now()]);
            }
        }

        self::refresh($user);
    }

    /**
     * carrier_profiles.background_check_status only allows not_submitted | pending | approved | rejected.
     * Person records use not_started | pending | clear | consider | failed.
     */
    public static function backgroundForProfile(string $result): string
    {
        return match ($result) {
            'clear', 'approved', 'passed' => 'approved',
            'failed'                      => 'rejected',
            'not_started'                 => 'not_submitted',
            default                       => 'pending',
        };
    }

    private static function backgroundFromProfile(?string $status): string
    {
        return match ($status) {
            null, '', 'not_submitted' => 'not_started',
            'approved'                => 'clear',
            'rejected'                => 'failed',
            default                   => $status,
        };
    }

    private static function clearinghouseResult(string $status): string
    {
        return match ($status) {
            'clear'            => 'clear',
            'violations_found' => 'violations_found',
            'error'            => 'failed',
            default            => 'pending',
        };
    }

    /** Upsert the profile-sourced credential of a type. Changing its number, expiry or result clears the admin's verification. */
    private static function mirrorCredential(int $userId, string $type, bool $present, array $fields): ?PersonCredential
    {
        $c = PersonCredential::where('user_id', $userId)->where('type', $type)->where('source', 'carrier_profile')->first();

        if (!$present) {
            if ($c && !$c->verified_at) $c->delete();
            return null;
        }

        $c ??= new PersonCredential(['user_id' => $userId, 'type' => $type, 'source' => 'carrier_profile', 'name' => self::CREDENTIAL_LABELS[$type]]);
        $c->fill($fields);
        if ($c->exists && $c->isDirty(['number', 'expires_at', 'result', 'class', 'issuing_state'])) {
            $c->verified_at = null;
            $c->verified_by = null;
        }
        $c->save();

        return $c;
    }

    // ── Files ────────────────────────────────────────────────────────────────

    /** Private document storage: R2 when configured, otherwise the local private disk. Stored as "disk:path". */
    public static function storeFile(UploadedFile $file, int $userId, string $kind): string
    {
        $r2   = config('filesystems.disks.r2');
        $disk = !empty($r2['key']) && !empty($r2['bucket']) ? 'r2' : 'local';
        $path = $file->storeAs("people/{$userId}", "{$kind}_" . time() . '.' . $file->getClientOriginalExtension(), $disk);

        return "{$disk}:{$path}";
    }

    /** Stream a stored private file */
    public static function fileResponse(?string $stored)
    {
        abort_unless($stored && str_contains($stored, ':'), 404);
        [$disk, $path] = explode(':', $stored, 2);
        abort_unless(Storage::disk($disk)->exists($path), 404);

        return Storage::disk($disk)->response($path);
    }

    /** Admin/owner-facing summary of the identity record. The ID number is never returned in full. */
    public static function identitySummary(?PersonIdentity $i): ?array
    {
        if (!$i) return null;

        return [
            'legal_first_name' => $i->legal_first_name, 'legal_middle_name' => $i->legal_middle_name,
            'legal_last_name' => $i->legal_last_name, 'suffix' => $i->suffix,
            'date_of_birth' => $i->date_of_birth?->toDateString(), 'age' => $i->age(),
            'street' => $i->street, 'unit' => $i->unit, 'city' => $i->city, 'state' => $i->state, 'zip' => $i->zip,
            'country' => $i->country, 'phone' => $i->phone,
            'id_type' => $i->id_type, 'id_number_masked' => $i->id_number_last4 ? '•••• ' . $i->id_number_last4 : null,
            'id_issuing_state' => $i->id_issuing_state, 'id_issuing_country' => $i->id_issuing_country,
            'id_issue_date' => $i->id_issue_date?->toDateString(), 'id_expiry_date' => $i->id_expiry_date?->toDateString(),
            'ssn_last4' => $i->ssn_last4 ? '•••• ' . $i->ssn_last4 : null,
            'has_id_front' => (bool) $i->id_front_path, 'has_id_back' => (bool) $i->id_back_path, 'has_selfie' => (bool) $i->selfie_path,
            'status' => $i->status, 'verification_method' => $i->verification_method, 'provider_reference' => $i->provider_reference,
            'failure_reason' => $i->failure_reason,
            'submitted_at' => $i->submitted_at?->toISOString(), 'verified_at' => $i->verified_at?->toISOString(),
            'verified_by' => $i->verified_by ? User::where('id', $i->verified_by)->value('name') : null,
        ];
    }

    public static function credentialSummary(PersonCredential $c): array
    {
        return [
            'id' => $c->id, 'type' => $c->type, 'type_label' => self::CREDENTIAL_LABELS[$c->type] ?? $c->type,
            'name' => $c->name, 'issuer' => $c->issuer, 'number' => $c->number, 'issuing_state' => $c->issuing_state,
            'class' => $c->class, 'issued_at' => $c->issued_at?->toDateString(), 'expires_at' => $c->expires_at?->toDateString(),
            'result' => $c->result, 'source' => $c->source, 'has_document' => (bool) $c->document_path,
            'state' => self::credentialState($c), 'notes' => $c->notes,
            'verified_at' => $c->verified_at?->toISOString(),
            'verified_by' => $c->verified_by ? User::where('id', $c->verified_by)->value('name') : null,
        ];
    }
}
