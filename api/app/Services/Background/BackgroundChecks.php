<?php

namespace App\Services\Background;

use App\Models\BackgroundCheck;
use App\Models\CarrierVerification;
use App\Models\Contract;
use App\Models\OrgMember;
use App\Models\Organization;
use App\Models\PersonCredential;
use App\Models\PersonIdentity;
use App\Models\User;
use App\Services\Fees;
use App\Services\PersonChecks;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;

/**
 * Background checks for carrier owners and drivers, through whichever provider Admin → Settings names.
 *
 * Two levels, priced on the Fees page:
 * - basic ($39 default): the provider's lowest package, with the identity check and carrier verification (FMCSA).
 * - complete ($99 default): basic plus the provider's full package and the Clearinghouse query.
 *   A person who already passed basic pays only the difference (an "upgrade" check with the rest of the package).
 * A carrier owner, a driver, or a shipper with a contract with the carrier can pay.
 * Results never reject anyone by themselves: a "consider" result goes to admin review and only the provider's
 * post-adverse-action event (after the FCRA notices) marks the person not passed.
 */
class BackgroundChecks
{
    public const PROVIDERS = ['checkr', 'foley', 'fake'];
    public const COMPLETE_VALID_MONTHS = 12;

    private const DEFAULTS = [
        'provider' => 'checkr',
        'mode'     => 'test',
        'packages' => [
            'checkr' => ['basic' => '', 'full' => '', 'upgrade' => ''],
            'foley'  => ['basic' => '', 'full' => '', 'upgrade' => ''],
            'fake'   => ['basic' => 'test_basic', 'full' => 'test_full', 'upgrade' => 'test_upgrade'],
        ],
    ];

    // ── Settings ─────────────────────────────────────────────────────────────

    public static function settings(): array
    {
        $saved = Cache::remember('background_settings', 300, function () {
            $row = DB::table('platform_settings')->where('key', 'background')->value('value');
            return $row ? json_decode($row, true) : [];
        });
        $s = array_replace_recursive(self::DEFAULTS, $saved);
        if (!$s['packages']['checkr']['basic'] && config('services.checkr.package')) {
            $s['packages']['checkr']['basic'] = config('services.checkr.package');
        }
        return $s;
    }

    public static function save(array $settings, ?int $userId): array
    {
        DB::table('platform_settings')->updateOrInsert(
            ['key' => 'background'],
            ['value' => json_encode($settings), 'updated_by' => $userId, 'updated_at' => now()]
        );
        Cache::forget('background_settings');
        return self::settings();
    }

    /** Live checks are never run from a developer's computer */
    public static function liveAllowed(): bool
    {
        return \App\Support\PlatformMode::liveAllowed();
    }

    /** The platform-wide Test / Live switch (App\Support\PlatformMode) */
    public static function mode(): string
    {
        return \App\Support\PlatformMode::current();
    }

    public static function provider(?string $name = null): Provider
    {
        return match ($name ?? self::settings()['provider']) {
            'foley' => new FoleyProvider(),
            'fake'  => new FakeProvider(),
            default => new CheckrProvider(),
        };
    }

    /** Package slug for a kind on a provider; an upgrade without its own package uses the full one */
    public static function package(string $provider, string $kind): ?string
    {
        $p = self::settings()['packages'][$provider] ?? [];
        $slug = $p[$kind] ?? '';
        if ($kind === 'upgrade' && !$slug) $slug = $p['full'] ?? '';
        return $slug ?: null;
    }

    // ── Prices (Fees page) ───────────────────────────────────────────────────

    public static function prices(): array
    {
        $fees     = Fees::all();
        $basic    = (float) $fees['onboarding_fee'];
        $complete = (float) ($fees['complete_fee'] ?? 99);
        return ['basic' => $basic, 'complete' => $complete, 'upgrade' => max(0, round($complete - $basic, 2))];
    }

    /** What the next check for this person is, and its price: basic, upgrade (basic passed) or full */
    public static function nextKind(User $user, string $level): string
    {
        if ($level === 'basic') return 'basic';
        return PersonChecks::verification($user)->backgroundPassed() ? 'upgrade' : 'full';
    }

    public static function priceCents(string $kind): int
    {
        $p = self::prices();
        return (int) round(100 * match ($kind) { 'basic' => $p['basic'], 'upgrade' => $p['upgrade'], default => $p['complete'] });
    }

    // ── People ───────────────────────────────────────────────────────────────

    /** The carrier company a person belongs to (as owner or driver) */
    public static function carrierOrg(User $user): ?Organization
    {
        $m = PersonChecks::membership($user);
        return $m['type'] === 'carrier' ? $m['org'] : null;
    }

    /** Everyone at a carrier who needs a background check: the owner and every driver */
    public static function people(Organization $org): \Illuminate\Support\Collection
    {
        $ids = OrgMember::where('org_id', $org->id)->drivers()->pluck('user_id')
            ->prepend($org->owner_id)->filter()->unique();
        return User::whereIn('id', $ids)->get()->sortBy(fn ($u) => $u->id === $org->owner_id ? 0 : 1)->values();
    }

    /** True when the user may pay for or view this person's checks: the person, or the owner of their carrier */
    public static function canManage(User $actor, User $subject): bool
    {
        if ($actor->id === $subject->id) return true;
        $org = self::carrierOrg($subject);
        return $org && $org->owner_id === $actor->id;
    }

    /** A shipper sees and orders complete checks only for carriers it has an active contract with */
    public static function shipperHasContract(User $shipper, Organization $carrierOrg): bool
    {
        // Contracts are company to company
        return $shipper->current_org_id && Contract::where('shipper_id', $shipper->current_org_id)
            ->where('carrier_id', $carrierOrg->id)->where('status', 'active')->exists();
    }

    /** First and last name, email, date of birth and state for the provider */
    public static function personData(User $user): array
    {
        $identity = PersonIdentity::where('user_id', $user->id)->first();
        $parts    = preg_split('/\s+/', trim((string) $user->name), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $first = $identity?->legal_first_name ?: ($parts[0] ?? '');
        $last  = $identity?->legal_last_name ?: (count($parts) > 1 ? $parts[count($parts) - 1] : '');
        $dob   = $identity?->date_of_birth;

        if (!$first || !$last || !$dob) {
            throw new \RuntimeException($user->isCarrier()
                ? 'Complete your first name, last name, and date of birth in the Personal tab before running a background check.'
                : 'Add your legal name and date of birth under Identity before running a background check.');
        }
        $dob = \Carbon\Carbon::parse($dob);
        if ($dob->age < 18) {
            throw new \RuntimeException('You must be 18 or older to run a background check.');
        }

        return [
            'first_name' => $first, 'last_name' => $last, 'email' => $user->email,
            'dob' => $dob->format('Y-m-d'), 'state' => $identity?->state,
        ];
    }

    // ── Paying and starting ──────────────────────────────────────────────────

    /**
     * A payment for checks succeeded: record a check for each person and start it.
     * $meta is the PaymentIntent metadata: subjects (comma-separated user ids), level, paid_by, payer_user_id, payer_id.
     */
    public static function paid(array $meta, string $intentId, int $amountCents): void
    {
        $level   = $meta['level'] === 'complete' ? 'complete' : 'basic';
        $subjects = User::whereIn('id', array_filter(array_map('intval', explode(',', (string) ($meta['subjects'] ?? '')))))->get();
        if ($subjects->isEmpty()) return;

        \App\Models\LedgerEntry::record('background_check', $amountCents, [
            'org_id' => (int) ($meta['payer_id'] ?? $meta['payer_org_id'] ?? 0) ?: null, 'source_type' => 'payment_intent', 'reference' => $intentId,
            'description' => $level === 'complete' ? 'Complete background check' : 'Basic background check',
        ]);

        foreach ($subjects as $subject) {
            if (BackgroundCheck::where('payment_intent_id', $intentId)->where('user_id', $subject->id)->exists()) continue;

            $kind  = self::nextKind($subject, $level);
            $check = BackgroundCheck::create([
                'user_id' => $subject->id, 'org_id' => self::carrierOrg($subject)?->id,
                'provider' => self::settings()['provider'], 'mode' => self::mode(), 'kind' => $kind,
                'package' => self::package(self::settings()['provider'], $kind), 'status' => 'paid',
                'paid_by' => ($meta['paid_by'] ?? 'carrier') === 'shipper' ? 'shipper' : 'carrier',
                'payer_user_id' => (int) ($meta['payer_user_id'] ?? 0) ?: null, 'payer_id' => (int) ($meta['payer_id'] ?? $meta['payer_org_id'] ?? 0) ?: null,
                'amount_cents' => self::priceCents($kind), 'payment_intent_id' => $intentId,
            ]);

            // The owner's paid basic level is what the carrier onboarding steps check for
            if ($check->coversBasic() && ($carrier = self::ownedCarrier($subject))) {
                $carrier->update(['carrier_onboarding_fee_paid' => true]);
                $pv = PersonChecks::verification($subject);
                if (!in_array($pv->status, ['approved', 'rejected'], true)) $pv->update(['status' => 'pending_background']);
            }

            try {
                self::start($check);
            } catch (\RuntimeException $e) {
                \Illuminate\Support\Facades\Log::info('[Background] Not started after payment: ' . $e->getMessage(), ['check' => $check->id]);
            }
        }
    }

    /** Send the person the provider's form. Works for a paid check not yet started, or one whose form expired. */
    public static function start(BackgroundCheck $check): BackgroundCheck
    {
        if (!in_array($check->status, ['paid', 'expired'], true)) {
            throw new \RuntimeException('This background check has already started.');
        }

        // A check that hasn't reached a provider yet follows the current settings
        if ($check->status === 'paid') {
            $check->provider = self::settings()['provider'];
            $check->mode     = self::mode();
            $check->package  = self::package($check->provider, $check->kind);
        }
        $provider = self::provider($check->provider);
        if (!$check->package) {
            throw new \RuntimeException('Background checks aren\'t set up yet. Contact Shipmater support.');
        }

        $user   = $check->user;
        $person = self::personData($user);
        $pv     = PersonChecks::verification($user);

        $candidateId = $pv->bg_provider === $provider->name() ? $pv->bg_candidate_id : null;
        if (!$candidateId) {
            $candidateId = $provider->createCandidate($person, $check->mode);
            $pv->update(['bg_provider' => $provider->name(), 'bg_candidate_id' => $candidateId]);
        }

        $invitation = $provider->invite($candidateId, $check->package, $person['state'], $check->mode);
        $check->fill(['candidate_id' => $candidateId, 'invitation_id' => $invitation['id'], 'status' => 'invitation_sent']);
        $check->save();
        $check->invitation_url = $provider->name() === 'fake'
            ? URL::temporarySignedRoute('background.fake', now()->addDays(7), ['check' => $check->id])
            : $invitation['url'];
        $check->save();

        self::apply($check);
        return $check;
    }

    // ── Results ──────────────────────────────────────────────────────────────

    /** A provider event, already verified and normalised by the provider */
    public static function handle(string $providerName, array $event): void
    {
        $check = self::findCheck($providerName, $event);
        if (!$check) return;

        $status = match ($event['event']) {
            'invitation_completed', 'report_created' => $check->isOpen() ? 'pending' : null,
            'invitation_expired'                     => $check->status === 'invitation_sent' ? 'expired' : null,
            'report_completed'                       => $event['result'] === 'clear' ? 'clear' : 'consider',
            'adverse_action'                         => 'suspended',
            default                                  => null,
        };
        if (!$status) return;

        $check->fill([
            'status'       => $status,
            'report_id'    => $event['report_id'] ?? $check->report_id,
            'completed_at' => in_array($status, BackgroundCheck::FINISHED, true) ? now() : $check->completed_at,
        ])->save();

        self::apply($check);

        // Keep the provider's report and email the person their summary
        if ($event['event'] === 'report_completed') {
            dispatch(fn () => CheckReports::finished($check->fresh()))->afterResponse();
        }
    }

    private static function findCheck(string $provider, array $event): ?BackgroundCheck
    {
        $q = fn () => BackgroundCheck::where('provider', $provider);
        if (!empty($event['report_id']) && $c = $q()->where('report_id', $event['report_id'])->first()) return $c;
        if (!empty($event['invitation_id']) && $c = $q()->where('invitation_id', $event['invitation_id'])->first()) return $c;
        if (empty($event['candidate_id'])) return null;

        // A report for a candidate: the oldest check of theirs still waiting for one
        return $q()->where('candidate_id', $event['candidate_id'])
            ->whereIn('status', ['invitation_sent', 'pending'])->orderBy('id')->first()
            ?? $q()->where('candidate_id', $event['candidate_id'])->latest('id')->first();
    }

    /** The carrier company the person owns, if any */
    private static function ownedCarrier(User $user): ?Organization
    {
        return Organization::where('type', 'carrier')->where('owner_id', $user->id)->first();
    }

    /** Copy a check's state onto the person, then their level */
    public static function apply(BackgroundCheck $check): void
    {
        $user    = $check->user;
        $pv      = PersonChecks::verification($user);
        $owner   = (bool) self::ownedCarrier($user);
        $s       = $check->status;

        if ($check->coversComplete()) {
            $pv->update(['complete_check_status' => $s === 'paid' ? null : $s]);
        }

        if ($check->coversBasic()) {
            $finished = in_array($s, BackgroundCheck::FINISHED, true);
            // Person records use not_started | invitation_sent | pending | clear | consider | failed
            $pv->update(array_filter([
                'background_check_status'    => match ($s) { 'paid', 'expired' => 'not_started', 'suspended' => 'failed', default => $s },
                'background_check_reference' => $check->report_id ?? $pv->background_check_reference,
                'bg_report_id'               => $check->report_id ?? $pv->bg_report_id,
                'background_checked_at'      => $finished ? now() : $pv->background_checked_at,
                // The carrier owner's onboarding step is done once the check finishes; refresh() decides the rest
                'status'                     => $owner && $finished && in_array($pv->status, ['pending_payment', 'pending_background'], true) ? 'incomplete' : null,
            ], fn ($v) => $v !== null));

            if ($owner) {
                CarrierVerification::updateOrCreate(
                    ['user_id' => $user->id, 'check_type' => 'background'],
                    [
                        'status'      => match ($s) { 'clear' => 'passed', 'suspended' => 'failed', 'consider' => 'manual_review', default => 'pending' },
                        'external_id' => $check->report_id ?? $check->candidate_id,
                        'result_data' => ['provider' => $check->provider, 'kind' => $check->kind, 'status' => $s, 'report_id' => $check->report_id, 'completed_at' => $check->completed_at?->toISOString()],
                    ]
                );
            }
        }

        // Not passed after the adverse-action process: a carrier owner at either level, anyone at the complete level
        if ($s === 'suspended' && ($owner || $check->kind === 'upgrade')) {
            $pv->update(['status' => 'rejected', 'notes' => $check->kind === 'upgrade' ? 'Did not pass the complete background check.' : 'Did not pass the background check.']);
        }

        PersonChecks::refresh($user->fresh());
    }

    // ── Levels ───────────────────────────────────────────────────────────────

    /**
     * basic: background check passed and identity verified.
     * complete: basic, plus the complete check passed in the last 12 months, the Clearinghouse query clear (CDL holders),
     * and, for an owner, the carrier's FMCSA authority verified. Called from PersonChecks::refresh().
     */
    public static function refreshLevel(User $user): ?string
    {
        $pv       = PersonChecks::verification($user);
        $carrier  = self::ownedCarrier($user);
        $identity = PersonIdentity::where('user_id', $user->id)->first();

        $basic = $pv->backgroundPassed() && $identity?->status === 'verified';

        $completeCheck = BackgroundCheck::where('user_id', $user->id)->whereIn('kind', ['full', 'upgrade'])
            ->where('status', 'clear')->latest('completed_at')->first();
        $expires = $completeCheck?->completed_at?->copy()->addMonths(self::COMPLETE_VALID_MONTHS);

        $needsClearinghouse = (PersonChecks::membership($user)['drives'] ?? false) || (bool) PersonChecks::credential($user->id, 'cdl')?->number;
        $clearinghouse = !$needsClearinghouse
            || PersonChecks::credentialState(PersonCredential::where('user_id', $user->id)->where('type', 'clearinghouse')->latest('id')->first()) === 'met';
        $authority = !$carrier || ($carrier->carrier_operating_country ?? 'US') !== 'US' || $carrier->carrier_dot_verified;

        $complete = $basic && $completeCheck && $expires->isFuture() && $clearinghouse && $authority;
        $level    = $complete ? 'complete' : ($basic ? 'basic' : null);

        $expiresAt = $complete ? $expires->toDateTimeString() : null;
        if ($level !== $pv->check_level || $pv->complete_expires_at?->toDateTimeString() !== $expiresAt) {
            $pv->updateQuietly([
                'check_level'         => $level,
                'check_level_at'      => $level !== $pv->check_level ? now() : $pv->check_level_at,
                'complete_expires_at' => $complete ? $expires : null,
            ]);
        }
        return $level;
    }

    /** A carrier's level is its lowest person's: complete only when the owner and every driver are complete */
    public static function carrierLevel(Organization $org): ?string
    {
        $levels = self::people($org)->map(fn ($u) => PersonChecks::verification($u)->check_level);
        if ($levels->isEmpty() || $levels->contains(null)) return null;
        return $levels->every(fn ($l) => $l === 'complete') ? 'complete' : 'basic';
    }

    // ── What pages show ──────────────────────────────────────────────────────

    /** One person's checks, for their own page, their carrier's owner, or a contracted shipper */
    public static function summary(User $user, bool $withForms = true): array
    {
        $pv     = PersonChecks::verification($user);
        $checks = BackgroundCheck::where('user_id', $user->id)->latest('id')->get();
        $basic  = $checks->first(fn ($c) => $c->coversBasic());
        $complete = $checks->first(fn ($c) => $c->coversComplete());
        $form = fn (?BackgroundCheck $c) => $c ? [
            'status'         => $c->status,
            'paid_by'        => $c->paid_by,
            'payer'          => $c->paid_by === 'shipper' ? $c->payerOrg?->name : null,
            'invitation_url' => $withForms && $c->status === 'invitation_sent' ? $c->invitation_url : null,
            'check_id'       => $withForms && in_array($c->status, ['paid', 'expired'], true) ? $c->id : null,
            'completed_at'   => $c->completed_at?->toDateString(),
            // PDFs, once the check has a result (CheckReports decides who may download)
            'id'             => $c->id,
            'downloads'      => $c->isFinished() ? ['summary' => true, 'report' => CheckReports::hasReport($c)] : null,
        ] : null;

        return [
            'user_id'            => $user->id,
            'name'               => $user->name,
            'role'               => PersonChecks::membership($user)['role'],
            'level'              => $pv->check_level,
            'complete_expires_at'=> $pv->complete_expires_at?->toDateString(),
            'basic'              => $form($basic),
            'complete'           => $form($complete),
            'next_complete_kind' => self::nextKind($user, 'complete'),
        ];
    }
}
