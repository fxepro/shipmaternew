<?php

namespace App\Services\Payments;

use App\Models\BusinessPerson;
use App\Models\CarrierProfile;
use App\Models\Organization;
use App\Models\User;
use App\Services\SmsOtpService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

/**
 * Opens a carrier's or factor's Stripe payout account from what Shipmater already collected
 * (carrier: Personal, Business and Financial tabs; factor: Company and Finance tabs).
 *
 * Stripe Express lets the platform prefill everything except the terms: Stripe shows one screen to
 * review and accept. KYC is locked once an onboarding link is created, so an account that was never
 * finished is deleted and sent again with the latest details.
 *
 * A carrier's account id stays on carrier_profiles.stripe_account_id (where LoadPayments looks);
 * a factor's on organizations.stripe_connect_id.
 */
class StripeOnboarding
{
    public const STRUCTURES = [
        'individual'          => 'Individual / owner-operator',
        'sole_proprietorship' => 'Sole proprietorship',
        'single_member_llc'   => 'Single-member LLC',
        'multi_member_llc'    => 'Multi-member LLC',
        'private_corporation' => 'Corporation',
        'private_partnership' => 'Partnership',
    ];

    /** Structures where Stripe asks for the representative's title and every owner with 25%+ */
    public const WITH_OWNERS = ['multi_member_llc', 'private_corporation', 'private_partnership'];

    private const MCC = ['carrier' => '4214', 'factor' => '7399'];

    private const DESCRIPTION = [
        'carrier' => 'Trucking and freight hauling for shippers who book loads on Shipmater.',
        'factor'  => 'Freight factoring: buys carriers\' invoices for loads booked on Shipmater.',
    ];

    public function __construct(private SmsOtpService $sms) {}

    private function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    // ── What's missing ───────────────────────────────────────────────────────

    /**
     * Every field Stripe needs that Shipmater doesn't have yet.
     * area: person (carrier Personal tab / factor representative), business, bank.
     * @return list<array{area: string, field: string, label: string}>
     */
    public function missing(Organization $org): array
    {
        $out = [];
        $add = function (string $area, string $field, string $label) use (&$out) { $out[] = compact('area', 'field', 'label'); };

        $person = $this->representative($org);
        if (!$person['first_name'] || !$person['last_name']) $add('person', 'name', 'Legal first and last name');
        if (!$person['email']) $add('person', 'email', 'Email');
        if (!$person['phone']) $add('person', 'phone', 'Phone number');
        if (!$person['dob']) $add('person', 'dob', 'Date of birth');
        elseif ($person['dob']->age < 18) $add('person', 'dob', 'Date of birth (must be 18 or older)');
        if (!$person['street'] || !$person['city'] || !$person['state'] || !$person['zip']) $add('person', 'address', 'Home address');
        if (!preg_match('/^\d{4}$/', (string) $person['ssn_last_4'])) $add('person', 'ssn_last_4', 'Last 4 of SSN');

        $structure = $org->business_structure;
        if (!isset(self::STRUCTURES[$structure])) {
            $add('business', 'business_structure', 'How your business is set up');
        } elseif ($structure !== 'individual') {
            if (!$org->legal_name) $add('business', 'legal_name', 'Legal business name');
            if (!preg_match('/^\d{9}$/', (string) preg_replace('/\D/', '', (string) $org->tax_id))) $add('business', 'tax_id', 'EIN (9 digits)');
            if (!$org->street || !$org->city || !$org->state || !$org->zip) $add('business', 'address', 'Business address');
            if (!$org->phone) $add('business', 'phone', 'Business phone');
        }
        if ($structure && in_array($structure, self::WITH_OWNERS, true)) {
            if (!$org->representative_title) $add('business', 'representative_title', 'Your job title');
            if ($org->representative_ownership === null) $add('business', 'representative_ownership', 'Your ownership %');
            if (!($org->settings['owners_confirmed'] ?? false)) $add('business', 'owners', 'Confirm all owners with 25% or more');
            foreach ($this->owners($org) as $i => $o) {
                if (!$o->first_name || !$o->last_name || !$o->email || $o->percent_ownership === null) $add('business', 'owners', 'Owner ' . ($i + 1) . ': name, email and ownership %');
            }
        }
        if (!$this->descriptorValid((string) $org->statement_descriptor)) $add('business', 'statement_descriptor', 'Card statement name (5–22 letters or numbers)');

        if (!$org->bank_token && !$this->accountId($org)) $add('bank', 'bank', 'Bank account for payouts');

        return $out;
    }

    // ── Send it to Stripe ────────────────────────────────────────────────────

    /** Creates (or re-creates) the account with everything filled in and returns Stripe's review-and-accept link */
    public function submit(Organization $org, string $returnUrl, string $refreshUrl): string
    {
        abort_if($missing = $this->missing($org), 422, 'Some details are still missing: ' . implode(', ', array_column($missing, 'label')) . '.');
        abort_unless(str_starts_with((string) config('services.stripe.secret'), 'sk_'), 503, 'Stripe is not configured.');

        $stripe = $this->stripe();
        $id = $this->accountId($org);

        if ($id) {
            $account = $stripe->accounts->retrieve($id);
            $changed = ($org->settings['stripe_payload_hash'] ?? null) !== $this->hash($org);
            if (!$account->details_submitted && $changed) {
                // Never finished and the details changed: they're locked to the old link, so start again with the new ones
                abort_unless($org->bank_token, 422, 'You changed your details, so Stripe will open a fresh account. Enter your bank account again in the Financial section first.');
                try { $stripe->accounts->delete($id); } catch (ApiErrorException $e) { Log::warning('Stripe account delete failed', ['account' => $id, 'error' => $e->getMessage()]); }
                $this->setAccount($org, null, 'not_connected');
                $id = null;
            }
        }

        if (!$id) {
            abort_unless($org->bank_token, 422, 'Add your bank account for payouts first.');
            $id = $this->create($org);
        }

        $link = $stripe->accountLinks->create([
            'account' => $id, 'type' => 'account_onboarding', 'return_url' => $returnUrl, 'refresh_url' => $refreshUrl,
        ]);
        $org->update(['stripe_submitted_at' => now()]);
        $this->refresh($org);

        return $link->url;
    }

    private function create(Organization $org): string
    {
        $stripe    = $this->stripe();
        $structure = $org->business_structure;
        $person    = $this->representative($org);
        $company   = $structure !== 'individual';
        $params    = $this->accountParams($org) + ['external_account' => $org->bank_token];

        try {
            $account = StripeNotice::quiet(fn () => $stripe->accounts->create($params));
        } catch (ApiErrorException $e) {
            $this->fail($e);
        }
        // The bank token is single-use and now belongs to this account
        $org->update(['bank_token' => null, 'settings' => array_merge($org->settings ?? [], ['stripe_payload_hash' => $this->hash($org)])]);
        $this->setAccount($org, $account->id, 'action_needed');

        if ($company) {
            try {
                $ownsAll = !in_array($structure, self::WITH_OWNERS, true);
                $stripe->accounts->createPerson($account->id, $this->personParams($person) + ['relationship' => array_filter([
                    'representative'    => true,
                    'executive'         => true,
                    'owner'             => $ownsAll || ($org->representative_ownership ?? 0) > 0,
                    'percent_ownership' => $ownsAll ? 100 : ($org->representative_ownership ?: null),
                    'title'             => $org->representative_title ?: ($ownsAll ? 'Owner' : null),
                ], fn ($v) => $v !== null && $v !== false)]);

                foreach ($ownsAll ? [] : $this->owners($org) as $o) {
                    $p = $stripe->accounts->createPerson($account->id, [
                        'first_name' => $o->first_name, 'last_name' => $o->last_name, 'email' => $o->email,
                        'relationship' => ['owner' => true, 'percent_ownership' => $o->percent_ownership],
                    ]);
                    $o->update(['stripe_person_id' => $p->id]);
                }
                $stripe->accounts->update($account->id, ['company' => ['owners_provided' => true]]);
            } catch (ApiErrorException $e) {
                // Leave nothing half-made behind: the next attempt starts clean
                try { $stripe->accounts->delete($account->id); } catch (ApiErrorException) {}
                $this->setAccount($org, null, 'not_connected');
                $this->fail($e);
            }
        }

        return $account->id;
    }

    /** Everything sent to Stripe for the account itself (the bank token is added on create) */
    private function accountParams(Organization $org): array
    {
        $kind      = $org->type === 'factor' ? 'factor' : 'carrier';
        $structure = $org->business_structure;
        $person    = $this->representative($org);
        $company   = $structure !== 'individual';
        $website   = $this->website($org->website);

        $params = [
            'type'             => 'express',
            'country'          => 'US',
            'email'            => $company ? ($org->email ?: $person['email']) : $person['email'],
            'capabilities'     => ['card_payments' => ['requested' => true], 'transfers' => ['requested' => true]],
            'business_type'    => $company ? 'company' : 'individual',
            'business_profile' => array_filter([
                'mcc'                 => self::MCC[$kind],
                'name'                => $company ? $org->legal_name : trim($person['first_name'] . ' ' . $person['last_name']),
                'url'                 => $website,
                'product_description' => $org->product_description ?: self::DESCRIPTION[$kind],
            ]),
            'settings'         => ['payments' => ['statement_descriptor' => strtoupper(trim((string) $org->statement_descriptor))]],
            'metadata'         => ['platform' => 'shipmater', 'type' => $kind, 'org_id' => (string) $org->id],
        ];
        if ($company) {
            $params['company'] = array_filter([
                'name'      => $org->legal_name,
                'tax_id'    => preg_replace('/\D/', '', (string) $org->tax_id),
                'phone'     => $this->e164($org->phone),
                'structure' => $structure,
                'address'   => $this->address($org->street, $org->city, $org->state, $org->zip),
            ]);
        } else {
            $params['individual'] = $this->personParams($person);
        }

        return $params;
    }

    /** Fingerprint of the details sent, to know whether an unfinished account must be rebuilt */
    private function hash(Organization $org): string
    {
        return md5(json_encode([
            $this->accountParams($org), $org->representative_title, $org->representative_ownership, $org->bank_routing, $org->bank_last4,
            $this->owners($org)->map(fn ($o) => $o->only(['first_name', 'last_name', 'email', 'percent_ownership']))->all(),
            $org->type === 'factor' ? null : $this->representative($org)['email'],
        ]));
    }

    // ── Stripe's answer ──────────────────────────────────────────────────────

    /** Reads the account from Stripe, stores what it still needs and returns the status */
    public function refresh(Organization $org): array
    {
        $id = $this->accountId($org);
        if (!$id) return $this->status($org);

        try {
            $this->sync($this->stripe()->accounts->retrieve($id));
        } catch (ApiErrorException $e) {
            Log::warning('Stripe account refresh failed', ['account' => $id, 'error' => $e->getMessage()]);
        }
        return $this->status($org->fresh());
    }

    /** account.updated webhook and refresh(): store Stripe's view of the account */
    public function sync(\Stripe\Account $a): void
    {
        $org = Organization::where('stripe_connect_id', $a->id)->first();
        $profile = $org ? null : CarrierProfile::where('stripe_account_id', $a->id)->first();
        if ($profile) $org = LoadPayments::orgOf($profile->user_id, 'carrier');

        $r = $a->requirements;
        $status = match (true) {
            str_starts_with((string) $r?->disabled_reason, 'rejected') => 'rejected',
            $a->charges_enabled && $a->payouts_enabled                => 'verified',
            !empty($r?->currently_due) || !empty($r?->past_due)       => 'action_needed',
            default                                                   => 'reviewing',
        };

        $profile?->update(['stripe_account_status' => $status]);
        $org?->update(['stripe_requirements' => [
            'status'            => $status,
            'currently_due'     => array_values(array_unique(array_merge($r?->past_due ?? [], $r?->currently_due ?? []))),
            'eventually_due'    => $r?->eventually_due ?? [],
            'pending'           => $r?->pending_verification ?? [],
            'errors'            => collect($r?->errors ?? [])->map(fn ($e) => ['requirement' => $e->requirement, 'reason' => $e->reason])->all(),
            'disabled_reason'   => $r?->disabled_reason,
            'details_submitted' => (bool) $a->details_submitted,
            'charges_enabled'   => (bool) $a->charges_enabled,
            'payouts_enabled'   => (bool) $a->payouts_enabled,
            'checked_at'        => now()->toISOString(),
        ]]);
    }

    /** Status plus Stripe's open items translated to the Shipmater field that fixes each one */
    public function status(Organization $org): array
    {
        $req = $org->stripe_requirements ?? [];
        $id  = $this->accountId($org);
        $status = $id ? ($req['status'] ?? 'action_needed') : 'not_connected';

        $ownerIds = $this->owners($org)->pluck('stripe_person_id')->filter()->all();
        $errors = collect($req['errors'] ?? [])->keyBy('requirement');
        $items = collect($req['currently_due'] ?? [])
            ->map(fn ($key) => $this->describe($key, $ownerIds) + ['reason' => $errors[$key]['reason'] ?? null])
            ->unique(fn ($i) => $i['area'] . $i['label'])->values()->all();

        return [
            'status'       => $status,
            'connected'    => (bool) $id,
            'items'        => $items,
            'reviewing'    => array_values(array_unique(array_map(fn ($k) => str_replace('Full ', '', $this->describe($k, $ownerIds)['label']), $req['pending'] ?? []))),
            'submitted_at' => $org->stripe_submitted_at?->toISOString(),
            'checked_at'   => $req['checked_at'] ?? null,
        ];
    }

    /** @return array{area: string, label: string} area: person, business, bank or stripe (finish on Stripe's page) */
    private function describe(string $key, array $ownerIds): array
    {
        $isOwner = (bool) collect($ownerIds)->first(fn ($id) => str_starts_with($key, $id . '.'));
        $person  = $isOwner ? 'business' : 'person';
        $rest    = preg_replace('/^(individual|representative|person_[A-Za-z0-9]+|owners|company)\./', '', $key);
        $isCompany = str_starts_with($key, 'company.');

        return match (true) {
            str_starts_with($key, 'tos_acceptance')                 => ['area' => 'stripe', 'label' => "Accept Stripe's terms"],
            $key === 'external_account'                             => ['area' => 'bank', 'label' => 'Bank account'],
            str_contains($key, 'verification.')                     => ['area' => 'stripe', 'label' => 'Photo ID or document'],
            str_ends_with($key, 'id_number')                        => ['area' => 'stripe', 'label' => 'Full Social Security number'],
            str_starts_with($key, 'owners') || $key === 'company.owners_provided' || $isOwner => ['area' => 'business', 'label' => 'Owners'],
            $isCompany && $rest === 'name'                          => ['area' => 'business', 'label' => 'Legal business name'],
            $isCompany && $rest === 'tax_id'                        => ['area' => 'business', 'label' => 'EIN'],
            $isCompany && str_starts_with($rest, 'address')         => ['area' => 'business', 'label' => 'Business address'],
            $isCompany && $rest === 'phone'                         => ['area' => 'business', 'label' => 'Business phone'],
            str_starts_with($key, 'business_profile.mcc')           => ['area' => 'business', 'label' => 'Industry'],
            str_starts_with($key, 'business_profile')               => ['area' => 'business', 'label' => 'Website or business description'],
            str_starts_with($key, 'settings.')                      => ['area' => 'business', 'label' => 'Card statement name'],
            str_contains($rest, 'relationship.title')               => ['area' => 'business', 'label' => 'Your job title'],
            str_contains($rest, 'first_name') || str_contains($rest, 'last_name') => ['area' => $person, 'label' => 'Legal name'],
            str_starts_with($rest, 'dob')                           => ['area' => $person, 'label' => 'Date of birth'],
            str_starts_with($rest, 'address')                       => ['area' => $person, 'label' => 'Home address'],
            str_contains($rest, 'ssn_last_4')                       => ['area' => $person, 'label' => 'Last 4 of SSN'],
            str_contains($rest, 'phone')                            => ['area' => $person, 'label' => 'Phone number'],
            str_contains($rest, 'email')                            => ['area' => $person, 'label' => 'Email'],
            default                                                 => ['area' => 'stripe', 'label' => ucfirst(str_replace(['_', '.'], ' ', $rest))],
        };
    }

    // ── People and accounts ──────────────────────────────────────────────────

    /** The person who opens the account: a carrier's owner (their own profile) or a factor's named representative */
    public function representative(Organization $org): array
    {
        if ($org->type === 'factor') {
            $p = $org->people()->where('is_representative', true)->first();
            return [
                'first_name' => $p?->first_name, 'last_name' => $p?->last_name, 'email' => $p?->email,
                'phone' => $this->e164($p?->phone), 'dob' => $p?->dob,
                'street' => $p?->street, 'city' => $p?->city, 'state' => $p?->state, 'zip' => $p?->zip,
                'ssn_last_4' => $p?->ssn_last_4,
            ];
        }

        $user = User::find($org->owner_id);
        $profile = $user?->carrierProfile;
        $parts = preg_split('/\s+/', trim((string) $user?->name)) ?: [];
        $parts = array_values(array_filter($parts, fn ($w) => !in_array(rtrim($w, '.'), ['Jr', 'Sr', 'II', 'III', 'IV'], true)));

        return [
            'first_name' => $parts[0] ?? null, 'last_name' => count($parts) > 1 ? end($parts) : null, 'email' => $user?->email,
            'phone' => $profile?->phone_e164 ?: $this->e164($profile?->phone), 'dob' => $profile?->date_of_birth,
            'street' => $profile?->street, 'city' => $profile?->city, 'state' => $profile?->state, 'zip' => $profile?->zip,
            'ssn_last_4' => $profile?->ssn_last_4,
        ];
    }

    public function owners(Organization $org)
    {
        return $org->people()->where('is_representative', false)->orderBy('id')->get();
    }

    public function accountId(Organization $org): ?string
    {
        if ($org->type === 'factor') return $org->stripe_connect_id ?: null;
        return CarrierProfile::where('user_id', $org->owner_id)->value('stripe_account_id') ?: null;
    }

    private function setAccount(Organization $org, ?string $id, string $status): void
    {
        if ($org->type === 'factor') {
            $org->update(['stripe_connect_id' => $id, 'stripe_requirements' => $id ? $org->stripe_requirements : null]);
            return;
        }
        CarrierProfile::where('user_id', $org->owner_id)->update(['stripe_account_id' => $id, 'stripe_account_status' => $status]);
        if (!$id) $org->update(['stripe_requirements' => null]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function personParams(array $p): array
    {
        /** @var Carbon|null $dob */
        $dob = $p['dob'];
        return array_filter([
            'first_name' => $p['first_name'],
            'last_name'  => $p['last_name'],
            'email'      => $p['email'],
            'phone'      => $p['phone'],
            'dob'        => $dob ? ['day' => $dob->day, 'month' => $dob->month, 'year' => $dob->year] : null,
            'address'    => $this->address($p['street'], $p['city'], $p['state'], $p['zip']),
            'ssn_last_4' => $p['ssn_last_4'],
        ]);
    }

    private function address(?string $line1, ?string $city, ?string $state, ?string $zip): array
    {
        return array_filter(['line1' => $line1, 'city' => $city, 'state' => $state ? strtoupper($state) : null, 'postal_code' => $zip, 'country' => 'US']);
    }

    private function e164(?string $phone): ?string
    {
        if (!$phone) return null;
        if (str_starts_with($phone, '+')) return $phone;
        try { return $this->sms->normalizeE164($phone, 'US'); } catch (\Throwable) { return null; }
    }

    private function website(?string $url): ?string
    {
        if (!$url) return null;
        $url = str_starts_with($url, 'http') ? $url : 'https://' . $url;
        return filter_var($url, FILTER_VALIDATE_URL) && !str_contains($url, 'localhost') ? $url : null;
    }

    public function descriptorValid(string $d): bool
    {
        $d = trim($d);
        return strlen($d) >= 5 && strlen($d) <= 22 && preg_match('/[A-Za-z]/', $d) && !preg_match('/[<>\\\\\'"*]/', $d);
    }

    /** A Stripe rejection as a 422 that names the Shipmater field */
    private function fail(ApiErrorException $e): never
    {
        $param = (string) ($e->getError()?->param ?? '');
        $key = str_replace(['][', '[', ']'], ['.', '.', ''], $param);
        $where = $key ? $this->describe($key, []) : null;
        Log::notice('Stripe rejected payout details', ['param' => $param, 'message' => $e->getMessage()]);
        abort(422, ($where && $where['area'] !== 'stripe' ? $where['label'] . ': ' : '') . $e->getMessage());
    }
}
