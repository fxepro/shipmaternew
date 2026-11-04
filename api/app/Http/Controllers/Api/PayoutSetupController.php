<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\Payments\StripeOnboarding;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Payout account setup for carriers and factors: business details, owners, bank account,
 * then one submission to Stripe (StripeOnboarding). Owner or staff only.
 */
class PayoutSetupController extends Controller
{
    public function __construct(private StripeOnboarding $onboarding) {}

    // GET /payouts/setup
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->present($this->org($request, manage: false))]);
    }

    // PUT /payouts/business
    public function business(Request $request): JsonResponse
    {
        $org = $this->org($request);
        $structures = array_keys(StripeOnboarding::STRUCTURES);
        $company = fn () => $request->input('business_structure') !== 'individual';
        $withOwners = fn () => in_array($request->input('business_structure'), StripeOnboarding::WITH_OWNERS, true);
        $isFactor = $org->type === 'factor';

        $v = $request->validate([
            'business_structure'       => ['required', Rule::in($structures)],
            'legal_name'               => [Rule::requiredIf($company), 'nullable', 'string', 'max:200'],
            'tax_id'                   => [Rule::requiredIf($company), 'nullable', 'regex:/^\d{2}-?\d{7}$/'],
            'street'                   => [Rule::requiredIf($company), 'nullable', 'string', 'max:255'],
            'city'                     => [Rule::requiredIf($company), 'nullable', 'string', 'max:100'],
            'state'                    => [Rule::requiredIf($company), 'nullable', 'string', 'size:2'],
            'zip'                      => [Rule::requiredIf($company), 'nullable', 'regex:/^\d{5}(-\d{4})?$/'],
            'phone'                    => [Rule::requiredIf($company), 'nullable', 'string', 'max:40'],
            'website'                  => ['nullable', 'string', 'max:255'],
            'statement_descriptor'     => ['required', 'string', 'min:5', 'max:22', 'regex:/[A-Za-z]/', 'not_regex:/[<>\\\\\'"*]/'],
            'representative_title'     => [Rule::requiredIf($withOwners), 'nullable', 'string', 'max:100'],
            'representative_ownership' => [Rule::requiredIf($withOwners), 'nullable', 'numeric', 'min:0', 'max:100'],
            'owners_confirmed'         => [Rule::requiredIf($withOwners), 'boolean'],
            'owners'                   => ['array', 'max:4'],
            'owners.*.first_name'      => ['required', 'string', 'max:100'],
            'owners.*.last_name'       => ['required', 'string', 'max:100'],
            'owners.*.email'           => ['required', 'email', 'max:255'],
            'owners.*.percent_ownership' => ['required', 'numeric', 'min:25', 'max:100'],
            // Factors name the person who opens the account here; a carrier's is the owner's Personal tab
            'representative'            => [Rule::requiredIf($isFactor), 'array'],
            'representative.first_name' => [Rule::requiredIf($isFactor), 'string', 'max:100'],
            'representative.last_name'  => [Rule::requiredIf($isFactor), 'string', 'max:100'],
            'representative.email'      => [Rule::requiredIf($isFactor), 'email', 'max:255'],
            'representative.phone'      => [Rule::requiredIf($isFactor), 'string', 'max:40'],
            'representative.dob'        => [Rule::requiredIf($isFactor), 'date', 'before_or_equal:' . now()->subYears(18)->toDateString()],
            'representative.street'     => [Rule::requiredIf($isFactor), 'string', 'max:255'],
            'representative.city'       => [Rule::requiredIf($isFactor), 'string', 'max:100'],
            'representative.state'      => [Rule::requiredIf($isFactor), 'string', 'size:2'],
            'representative.zip'        => [Rule::requiredIf($isFactor), 'regex:/^\d{5}(-\d{4})?$/'],
            'representative.ssn_last_4' => [Rule::requiredIf($isFactor), 'nullable', 'digits:4'],
        ], [
            'representative.dob.before_or_equal' => 'The representative must be 18 or older.',
            'owners.*.percent_ownership.min'     => 'List owners with 25% or more.',
        ]);

        $total = (float) ($v['representative_ownership'] ?? 0) + collect($v['owners'] ?? [])->sum('percent_ownership');
        abort_if($withOwners() && $total > 100, 422, 'Ownership adds up to more than 100%.');

        DB::transaction(function () use ($org, $v, $withOwners, $isFactor) {
            $company = $v['business_structure'] !== 'individual';
            $owners = $withOwners();
            $org->update([
                'business_structure'       => $v['business_structure'],
                'legal_name'               => $company ? $v['legal_name'] : null,
                'tax_id'                   => $company ? preg_replace('/\D/', '', $v['tax_id']) : $org->tax_id,
                'tax_id_type'              => $company ? 'ein' : $org->tax_id_type,
                'website'                  => $v['website'] ?? null,
                'statement_descriptor'     => strtoupper(trim($v['statement_descriptor'])),
                'representative_title'     => $owners ? $v['representative_title'] : null,
                'representative_ownership' => $owners ? $v['representative_ownership'] : null,
                'settings'                 => array_merge($org->settings ?? [], ['owners_confirmed' => $owners && !empty($v['owners_confirmed'])]),
            ] + ($company ? [
                'street' => $v['street'], 'city' => $v['city'], 'state' => strtoupper($v['state']), 'zip' => $v['zip'], 'phone' => $v['phone'],
            ] : []));

            $org->people()->where('is_representative', false)->delete();
            foreach ($owners ? ($v['owners'] ?? []) : [] as $o) {
                $org->people()->create($o + ['is_representative' => false]);
            }

            if ($isFactor) {
                $r = $v['representative'];
                $rep = $org->people()->firstOrNew(['is_representative' => true]);
                // Keep the stored SSN when the form leaves it blank (it is never sent back to the browser)
                if (empty($r['ssn_last_4'])) unset($r['ssn_last_4']);
                $rep->fill($r + ['title' => $v['representative_title'] ?? null, 'percent_ownership' => $v['representative_ownership'] ?? null])->save();
            }
        });

        return response()->json(['data' => $this->present($org->fresh())]);
    }

    // PUT /payouts/bank   { token, bank_name, last4, routing_number, holder_name, holder_type } from Stripe.js
    public function bank(Request $request): JsonResponse
    {
        $org = $this->org($request);
        $v = $request->validate([
            'token'          => ['required', 'string', 'starts_with:btok_', 'max:255'],
            'bank_name'      => ['nullable', 'string', 'max:255'],
            'last4'          => ['required', 'digits:4'],
            'routing_number' => ['required', 'digits:9'],
            'holder_name'    => ['required', 'string', 'max:255'],
            'holder_type'    => ['required', Rule::in(['individual', 'company'])],
        ]);
        abort_if($this->onboarding->accountId($org) && ($org->stripe_requirements['details_submitted'] ?? false), 422,
            'Your payout account is already set up. Change the bank account from Stripe.');

        $org->update([
            'bank_token' => $v['token'], 'bank_name' => $v['bank_name'] ?? null, 'bank_last4' => $v['last4'],
            'bank_routing' => $v['routing_number'], 'bank_holder_name' => $v['holder_name'], 'bank_holder_type' => $v['holder_type'],
        ]);

        return response()->json(['data' => $this->present($org->fresh())]);
    }

    // POST /payouts/submit → { url } Stripe's review-and-accept page
    public function submit(Request $request): JsonResponse
    {
        $org = $this->org($request);
        $base = rtrim((string) config('app.frontend_url'), '/') . ($org->type === 'factor' ? '/factor/profile?tab=finance' : '/carrier/profile?tab=financial');

        return response()->json(['url' => $this->onboarding->submit($org, $base . '&stripe=success', $base . '&stripe=refresh')]);
    }

    // POST /payouts/refresh   (back from Stripe)
    public function refresh(Request $request): JsonResponse
    {
        $org = $this->org($request, manage: false);
        $this->onboarding->refresh($org);
        return response()->json(['data' => $this->present($org->fresh())]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function org(Request $request, bool $manage = true): Organization
    {
        $user = $request->user();
        $org = $user->currentOrg;
        abort_unless($org && in_array($org->type, ['carrier', 'factor'], true), 403);
        if ($manage) abort_unless($user->isOrgAdmin(), 403, 'Only the owner or staff can set up payouts.');
        return $org;
    }

    private function present(Organization $org): array
    {
        $rep = $org->type === 'factor' ? $org->people()->where('is_representative', true)->first() : null;

        return [
            'kind'       => $org->type,
            'structures' => StripeOnboarding::STRUCTURES,
            'with_owners' => StripeOnboarding::WITH_OWNERS,
            'business'   => [
                'business_structure'       => $org->business_structure,
                'legal_name'               => $org->legal_name,
                'tax_id'                   => $org->tax_id ? substr(preg_replace('/\D/', '', $org->tax_id), 0, 2) . '-' . substr(preg_replace('/\D/', '', $org->tax_id), 2) : null,
                'street'                   => $org->street, 'city' => $org->city, 'state' => $org->state, 'zip' => $org->zip, 'phone' => $org->phone,
                'website'                  => $org->website,
                'statement_descriptor'     => $org->statement_descriptor,
                'representative_title'     => $org->representative_title,
                'representative_ownership' => $org->representative_ownership,
                'owners_confirmed'         => (bool) ($org->settings['owners_confirmed'] ?? false),
                'owners'                   => $this->onboarding->owners($org)->map(fn ($o) => $o->only(['first_name', 'last_name', 'email', 'percent_ownership']))->values(),
                'representative'           => $rep ? array_merge($rep->only(['first_name', 'last_name', 'email', 'phone', 'street', 'city', 'state', 'zip']), [
                    'dob' => $rep->dob?->toDateString(), 'has_ssn' => (bool) $rep->ssn_last_4,
                ]) : null,
            ],
            'bank'    => $org->bank_last4 ? [
                'bank_name' => $org->bank_name, 'last4' => $org->bank_last4, 'routing_number' => $org->bank_routing,
                'holder_name' => $org->bank_holder_name, 'holder_type' => $org->bank_holder_type, 'pending' => (bool) $org->bank_token,
            ] : null,
            'missing' => $this->onboarding->missing($org),
            'stripe'  => $this->onboarding->status($org),
        ];
    }
}
