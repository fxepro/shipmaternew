<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrierProfile;
use App\Services\CheckrService;
use App\Services\Payments\StripeNotice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\StripeClient;

class StripeConnectController extends Controller
{
    public function __construct(private CheckrService $checkr) {}

    private function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    // POST /api/v1/stripe/connect/onboard
    // Creates a Stripe Express account (or reuses existing) and returns onboarding URL
    public function onboard(Request $request): JsonResponse
    {
        $user    = $request->user();
        abort_unless($user->isCarrier(), 403);

        $profile = $user->carrierProfile;
        $stripe  = $this->stripe();

        // Create Stripe account if carrier doesn't have one yet
        if (!$profile?->stripe_account_id) {
            $account = StripeNotice::quiet(fn () => $stripe->accounts->create([
                'type'         => 'express',
                'country'      => 'US',
                'email'        => $user->email,
                'capabilities' => [
                    'card_payments' => ['requested' => true],
                    'transfers'     => ['requested' => true],
                ],
                'metadata' => ['carrier_id' => $user->id],
            ]));

            CarrierProfile::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'stripe_account_id'     => $account->id,
                    'stripe_account_status' => 'pending',
                ]
            );

            $stripeAccountId = $account->id;
        } else {
            $stripeAccountId = $profile->stripe_account_id;
        }

        // Generate onboarding link
        $link = $stripe->accountLinks->create([
            'account'     => $stripeAccountId,
            'refresh_url' => config('app.frontend_url') . '/carrier/profile?tab=financial&stripe=refresh',
            'return_url'  => config('app.frontend_url') . '/carrier/profile?tab=financial&stripe=success',
            'type'        => 'account_onboarding',
        ]);

        return response()->json(['url' => $link->url]);
    }

    // GET /api/v1/stripe/connect/status
    // Check account verification status from Stripe
    public function status(Request $request): JsonResponse
    {
        $user    = $request->user();
        abort_unless($user->isCarrier(), 403);

        $profile = $user->carrierProfile;

        if (!$profile?->stripe_account_id) {
            return response()->json(['status' => 'not_connected']);
        }

        $stripe  = $this->stripe();
        $account = $stripe->accounts->retrieve($profile->stripe_account_id);

        // Map Stripe status to our status
        $status = 'pending';
        if ($account->details_submitted && $account->charges_enabled && $account->payouts_enabled) {
            $status = 'verified';
        } elseif ($account->requirements?->disabled_reason) {
            $status = 'restricted';
        }

        // Persist latest status
        $profile->update(['stripe_account_status' => $status]);

        return response()->json([
            'status'           => $status,
            'charges_enabled'  => $account->charges_enabled,
            'payouts_enabled'  => $account->payouts_enabled,
            'details_submitted'=> $account->details_submitted,
        ]);
    }

    // POST /api/v1/stripe/onboarding-fee
    // Creates a $99 PaymentIntent. Frontend confirms with Stripe.js.
    // On payment_intent.succeeded webhook → fee marked paid, Checkr triggered.

    public function onboardingFee(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isCarrier(), 403);

        $profile = $user->carrierProfile()->firstOrCreate(['user_id' => $user->id]);

        if ($profile->onboarding_fee_paid) {
            return response()->json(['error' => 'Onboarding fee already paid.'], 422);
        }

        $stripe = $this->stripe();

        $intent = $stripe->paymentIntents->create([
            'amount'               => 9900, // $99.00 in cents
            'currency'             => 'usd',
            'automatic_payment_methods' => ['enabled' => true],
            'description'          => 'Shipmater carrier onboarding fee',
            'metadata'             => [
                'user_id'            => (string) $user->id,
                'carrier_profile_id' => (string) $profile->id,
                'type'               => 'onboarding_fee',
            ],
        ]);

        $profile->update([
            'onboarding_fee_payment_intent_id' => $intent->id,
            'verification_status'              => 'pending_payment',
        ]);

        return response()->json(['client_secret' => $intent->client_secret]);
    }

    // POST /api/v1/stripe/identity/session
    // Creates a Stripe Identity VerificationSession and returns the hosted URL.
    // The carrier is redirected to Stripe, verifies their ID, then returned
    // to /carrier/profile?identity=success (or ?identity=cancelled).

    public function identitySession(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isCarrier() || $user->isFactor(), 403);

        $stripe  = $this->stripe();
        $options = [
            'document' => [
                'allowed_types'          => ['driving_license', 'passport'],
                'require_id_number'      => true,
                'require_live_capture'   => true,
                'require_matching_selfie'=> true,
            ],
        ];

        // Factor owners have no carrier profile: the result goes straight to their person record
        if (!$user->isCarrier()) {
            $session = $stripe->identity->verificationSessions->create([
                'type'       => 'document',
                'options'    => $options,
                'return_url' => config('app.frontend_url') . '/factor/verification?identity=success',
                'metadata'   => ['user_id' => (string) $user->id],
            ]);
            \App\Models\PersonIdentity::firstOrCreate(['user_id' => $user->id])
                ->update(['provider_reference' => $session->id, 'verification_method' => 'stripe_identity']);

            return response()->json(['url' => $session->url]);
        }

        $profile = $user->carrierProfile()->firstOrCreate(['user_id' => $user->id]);

        $session = $stripe->identity->verificationSessions->create([
            'type'       => 'document',
            'options'    => [
                'document' => [
                    'allowed_types'          => ['driving_license', 'passport'],
                    'require_id_number'      => true,
                    'require_live_capture'   => true,
                    'require_matching_selfie'=> true,
                ],
            ],
            'return_url' => config('app.frontend_url') . '/carrier/verification?identity=success',
            'metadata'   => [
                'user_id'            => (string) $user->id,
                'carrier_profile_id' => (string) $profile->id,
            ],
        ]);

        // Track session ID so we can match the webhook
        \App\Models\CarrierVerification::updateOrCreate(
            ['carrier_profile_id' => $profile->id, 'check_type' => 'identity'],
            [
                'status'      => 'pending',
                'external_id' => $session->id,
                'result_data' => ['session_id' => $session->id, 'created_at' => now()->toISOString()],
            ]
        );

        return response()->json(['url' => $session->url]);
    }

    // POST /api/v1/stripe/connect/webhook
    // Handles account.updated (Connect) and identity.verification_session.* events.

    public function webhook(Request $request): JsonResponse
    {
        $payload   = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');

        // Platform events and connected-account events (load payments charged on carrier/factor accounts)
        // arrive on two Stripe webhook endpoints with their own secrets
        $event = null;
        // STRIPE_CONNECT_WEBHOOK_SECRET may list several secrets, comma-separated (e.g. live and sandbox destinations)
        $secrets = array_merge([config('services.stripe.webhook_secret')], explode(',', (string) config('services.stripe.connect_webhook_secret')));
        foreach (array_filter(array_map('trim', $secrets)) as $secret) {
            try {
                $event = \Stripe\Webhook::constructEvent($payload, $sigHeader, $secret);
                break;
            } catch (\Exception) {
                // Try the next secret
            }
        }
        if (!$event) return response()->json(['error' => 'Invalid signature'], 400);

        // Load payments and Shipmater's fee on factored loads (docs/fees-and-billing.md)
        $payments = app(\App\Services\Payments\LoadPayments::class);
        if (str_starts_with($event->type, 'payment_intent.')) $payments->handleIntentEvent($event->type, $event->data->object);
        if ($event->type === 'charge.refunded') $payments->handleRefund($event->data->object);

        match ($event->type) {

            // ── Shipper subscription payments → Shipmater revenue ───────────
            'invoice.paid' => (function () use ($event) {
                $invoice = $event->data->object;
                $meta    = $invoice->subscription_details->metadata ?? $invoice->parent->subscription_details->metadata ?? null;
                if (($meta['type'] ?? '') !== 'shipper_subscription' || (int) $invoice->amount_paid <= 0) return;
                \App\Models\LedgerEntry::record('subscription', (int) $invoice->amount_paid, [
                    'org_id' => (int) ($meta['org_id'] ?? 0) ?: null, 'source_type' => 'invoice', 'reference' => $invoice->id,
                    'description' => 'Shipper subscription', 'occurred_at' => now()->setTimestamp($invoice->status_transitions->paid_at ?? time()),
                ]);
            })(),

            // ── Shipper subscription (docs/fees-and-billing.md) ────────────
            'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted' => (function () use ($event) {
                $stripeSub = $event->data->object;
                if (($stripeSub->metadata['type'] ?? '') !== 'shipper_subscription') return;
                $sub = \App\Models\ShipperSubscription::where('stripe_subscription_id', $stripeSub->id)
                    ->orWhere('org_id', (int) ($stripeSub->metadata['org_id'] ?? 0))->first();
                if ($sub) SubscriptionController::syncFromStripe($sub, $stripeSub);
            })(),

            // ── Onboarding fee paid → trigger Checkr ───────────────────────
            'payment_intent.succeeded' => (function () use ($event) {
                $intent = $event->data->object;
                if (($intent->metadata['type'] ?? '') !== 'onboarding_fee') return;

                $profileId = $intent->metadata['carrier_profile_id'] ?? null;
                if (!$profileId) return;

                $profile = CarrierProfile::find($profileId);
                if ($profile) {
                    \App\Models\LedgerEntry::record('onboarding', (int) $intent->amount_received, [
                        'org_id' => \App\Services\Payments\LoadPayments::orgOf($profile->user_id, 'carrier')?->id,
                        'source_type' => 'carrier_profile', 'source_id' => $profile->id, 'reference' => $intent->id, 'description' => 'Carrier onboarding fee',
                    ]);
                }
                if (!$profile || $profile->onboarding_fee_paid) return;

                $profile->update([
                    'onboarding_fee_paid'  => true,
                    'verification_status'  => 'pending_background',
                ]);

                // Auto-trigger Checkr background check
                $user = $profile->user;
                if ($user && !$profile->checkr_candidate_id && $profile->date_of_birth) {
                    $parts     = preg_split('/\s+/', trim((string) $user->name), -1, PREG_SPLIT_NO_EMPTY) ?: [];
                    $firstName = $parts[0] ?? '';
                    $lastName  = count($parts) > 1 ? $parts[count($parts) - 1] : '';
                    if ($firstName === '' || $lastName === '') {
                        return;
                    }
                    $candidate = $this->checkr->createCandidate([
                        'first_name' => $firstName,
                        'last_name'  => $lastName,
                        'email'      => $user->email,
                        'dob'        => $profile->date_of_birth->format('Y-m-d'),
                    ]);

                    if ($candidate) {
                        $profile->update(['checkr_candidate_id' => $candidate['id']]);
                        $invitation = $this->checkr->createInvitation($candidate['id'], 'driver_pro');

                        if ($invitation) {
                            $profile->update(['background_check_status' => 'invitation_sent']);
                            \App\Models\CarrierVerification::updateOrCreate(
                                ['carrier_profile_id' => $profile->id, 'check_type' => 'background'],
                                [
                                    'status'      => 'pending',
                                    'external_id' => $candidate['id'],
                                    'result_data' => [
                                        'invitation_url' => $invitation['invitation_url'],
                                        'invitation_id'  => $invitation['id'],
                                    ],
                                ]
                            );
                        }
                    }
                }
            })(),

            // ── Stripe Connect: carrier account updated ─────────────────────
            'account.updated' => (function () use ($event) {
                $account = $event->data->object;
                $profile = CarrierProfile::where('stripe_account_id', $account->id)->first();
                if ($profile) {
                    $status = 'pending';
                    if ($account->details_submitted && $account->charges_enabled && $account->payouts_enabled) {
                        $status = 'verified';
                    } elseif ($account->requirements?->disabled_reason) {
                        $status = 'restricted';
                    }
                    $profile->update(['stripe_account_status' => $status]);
                }
            })(),

            // ── Stripe Identity: verification completed ─────────────────────
            'identity.verification_session.verified' => (function () use ($event) {
                $session   = $event->data->object;
                $profileId = $session->metadata['carrier_profile_id'] ?? null;
                if (!$profileId) {
                    // Not a carrier (e.g. a factor owner): just the person record
                    if ($userId = $session->metadata['user_id'] ?? null) $this->saveVerifiedIdentity($session->id, (int) $userId);
                    return;
                }

                $profile = CarrierProfile::find($profileId);
                if (!$profile) return;

                // Extract verified DOB from document scan — more authoritative than self-reported
                $verifiedDob  = $session->verified_outputs?->dob ?? null;
                $dobString    = $verifiedDob
                    ? sprintf('%04d-%02d-%02d', $verifiedDob->year, $verifiedDob->month, $verifiedDob->day)
                    : null;
                $isAdult      = $dobString ? \Carbon\Carbon::parse($dobString)->age >= 18 : null;

                $updates = [
                    'identity_verified'    => true,
                    'identity_verified_at' => now(),
                ];

                // Only overwrite DOB + age_verified if Stripe gave us a verified date
                if ($dobString) {
                    $updates['date_of_birth']  = $dobString;
                    $updates['age_verified']   = (bool) $isAdult;
                    $updates['age_verified_at']= $isAdult ? now() : null;
                }

                $profile->update($updates);

                $this->saveVerifiedIdentity($session->id, (int) ($session->metadata['user_id'] ?? $profile->user_id));

                \App\Models\CarrierVerification::updateOrCreate(
                    ['carrier_profile_id' => $profile->id, 'check_type' => 'identity'],
                    [
                        'status'      => 'passed',
                        'external_id' => $session->id,
                        'result_data' => [
                            'session_id'  => $session->id,
                            'verified_at' => now()->toISOString(),
                            'verified_dob'=> $dobString,
                            'last_error'  => null,
                        ],
                        'expires_at'  => now()->addYears(2),
                    ]
                );
            })(),

            // ── Stripe Identity: verification requires input (failed) ────────
            'identity.verification_session.requires_input' => (function () use ($event) {
                $session   = $event->data->object;
                $profileId = $session->metadata['carrier_profile_id'] ?? null;

                if ($userId = $session->metadata['user_id'] ?? null) {
                    $identity = \App\Models\PersonIdentity::firstOrCreate(['user_id' => (int) $userId]);
                    if ($identity->status !== 'verified') {
                        $identity->update([
                            'status'             => 'failed',
                            'provider_reference' => $session->id,
                            'failure_reason'     => $session->last_error?->reason ?? 'Stripe could not verify the ID. Try again or upload your ID here.',
                        ]);
                    }
                }
                if (!$profileId) return;

                $profile = CarrierProfile::find($profileId);
                if (!$profile) return;

                \App\Models\CarrierVerification::updateOrCreate(
                    ['carrier_profile_id' => $profile->id, 'check_type' => 'identity'],
                    [
                        'status'      => 'manual_review',
                        'external_id' => $session->id,
                        'result_data' => [
                            'session_id' => $session->id,
                            'last_error' => $session->last_error?->reason ?? 'Verification requires additional input',
                        ],
                    ]
                );
            })(),

            default => null,
        };

        return response()->json(['received' => true]);
    }

    /**
     * Copy Stripe Identity's verified outputs into the identity record Shipmater keeps.
     * The webhook payload omits them, so the session is re-fetched with them expanded.
     */
    private function saveVerifiedIdentity(string $sessionId, int $userId): void
    {
        try {
            $session = $this->stripe()->identity->verificationSessions->retrieve($sessionId, [
                'expand' => ['verified_outputs', 'verified_outputs.id_number', 'last_verification_report'],
            ]);
            $out = $session->verified_outputs;
            $doc = $session->last_verification_report?->document;
            $date = fn ($d) => $d && $d->year ? sprintf('%04d-%02d-%02d', $d->year, $d->month ?? 1, $d->day ?? 1) : null;

            $identity = \App\Models\PersonIdentity::firstOrCreate(['user_id' => $userId]);
            $identity->fill(array_filter([
                'legal_first_name'   => $out?->first_name,
                'legal_last_name'    => $out?->last_name,
                'date_of_birth'      => $date($out?->dob),
                'street'             => $out?->address?->line1,
                'unit'               => $out?->address?->line2,
                'city'               => $out?->address?->city,
                'state'              => $out?->address?->state,
                'zip'                => $out?->address?->postal_code,
                'country'            => $out?->address?->country,
                'id_number'          => $out?->id_number,
                'id_type'            => match ($doc?->type) { 'driving_license' => 'driver_license', 'passport' => 'passport', 'id_card' => 'state_id', default => null },
                'id_issuing_country' => $doc?->issuing_country,
                'id_issue_date'      => $date($doc?->issued_date),
                'id_expiry_date'     => $date($doc?->expiration_date),
            ], fn ($v) => $v !== null && $v !== ''));
            $identity->fill([
                'status' => 'verified', 'verification_method' => 'stripe_identity', 'provider_reference' => $session->id,
                'verified_at' => now(), 'verified_by' => null, 'failure_reason' => null,
            ]);
            $identity->save();

            if ($user = \App\Models\User::find($userId)) {
                \App\Services\PersonChecks::refresh($user);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Could not save Stripe Identity outputs', ['session' => $sessionId, 'error' => $e->getMessage()]);
        }
    }
}
