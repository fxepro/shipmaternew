<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Payments\StripeOnboarding;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\StripeClient;

class StripeConnectController extends Controller
{
    private function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    // POST /api/v1/stripe/connect/onboard   (older clients; same as POST /payouts/submit)
    public function onboard(Request $request): JsonResponse
    {
        return app(PayoutSetupController::class)->submit($request);
    }

    // GET /api/v1/stripe/connect/status
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isCarrier(), 403);
        $org = $user->currentOrg;
        abort_unless($org?->type === 'carrier', 403);

        $s = app(StripeOnboarding::class)->refresh($org);
        return response()->json(['status' => $s['status'], 'items' => $s['items']]);
    }

    // POST /api/v1/stripe/onboarding-fee   (older clients; same as POST /background/pay with level=basic)
    public function onboardingFee(Request $request): JsonResponse
    {
        $request->merge(['level' => 'basic']);
        return app(BackgroundCheckController::class)->pay($request);
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
                'user_id' => (string) $user->id,
                'carrier' => '1',
            ],
        ]);
        \App\Models\PersonIdentity::firstOrCreate(['user_id' => $user->id])
            ->update(['provider_reference' => $session->id, 'verification_method' => 'stripe_identity']);

        // Track session ID so we can match the webhook (a check on the person)
        \App\Models\CarrierVerification::updateOrCreate(
            ['user_id' => $user->id, 'check_type' => 'identity'],
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

            // ── Background check paid → start it (App\Services\Background) ──
            'payment_intent.succeeded' => (function () use ($event) {
                $intent = $event->data->object;
                $meta   = $intent->metadata?->toArray() ?? [];
                // Intents made before checks had levels: the carrier's own basic check
                if (($meta['type'] ?? '') === 'onboarding_fee' && ($payer = (int) ($meta['user_id'] ?? 0))) {
                    $meta = ['type' => 'background_check', 'level' => 'basic', 'subjects' => (string) $payer, 'paid_by' => 'carrier', 'payer_user_id' => (string) $payer];
                }
                if (($meta['type'] ?? '') !== 'background_check') return;
                \App\Services\Background\BackgroundChecks::paid($meta, $intent->id, (int) $intent->amount_received);
            })(),

            // ── Stripe Connect: carrier account updated ─────────────────────
            'account.updated' => app(StripeOnboarding::class)->sync($event->data->object),

            // ── Stripe Identity: verification completed ─────────────────────
            'identity.verification_session.verified' => (function () use ($event) {
                $session = $event->data->object;
                $userId  = (int) ($session->metadata['user_id'] ?? 0);
                if (!$userId) return;

                // The verified name, date of birth and address go on the person's identity record
                $this->saveVerifiedIdentity($session->id, $userId);
                if (empty($session->metadata['carrier']) && empty($session->metadata['carrier_profile_id'])) return;

                $verifiedDob = $session->verified_outputs?->dob ?? null;
                $dobString   = $verifiedDob ? sprintf('%04d-%02d-%02d', $verifiedDob->year, $verifiedDob->month, $verifiedDob->day) : null;

                \App\Models\CarrierVerification::updateOrCreate(
                    ['user_id' => $userId, 'check_type' => 'identity'],
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
                $session = $event->data->object;
                $userId  = $session->metadata['user_id'] ?? null;
                $isCarrier = !empty($session->metadata['carrier']) || !empty($session->metadata['carrier_profile_id']);

                if ($userId) {
                    $identity = \App\Models\PersonIdentity::firstOrCreate(['user_id' => (int) $userId]);
                    if ($identity->status !== 'verified') {
                        $identity->update([
                            'status'             => 'failed',
                            'provider_reference' => $session->id,
                            'failure_reason'     => $session->last_error?->reason ?? 'Stripe could not verify the ID. Try again or upload your ID here.',
                        ]);
                    }
                }
                if (!$userId || !$isCarrier) return;

                \App\Models\CarrierVerification::updateOrCreate(
                    ['user_id' => (int) $userId, 'check_type' => 'identity'],
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
