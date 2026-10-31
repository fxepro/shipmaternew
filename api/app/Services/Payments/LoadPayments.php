<?php

namespace App\Services\Payments;

use App\Models\FactoredLoad;
use App\Models\FeeCharge;
use App\Models\FreightJob;
use App\Models\LedgerEntry;
use App\Models\LoadPayment;
use App\Models\Organization;
use App\Models\OrgMember;
use App\Models\PaymentMethod;
use App\Models\Shipment;
use App\Models\User;
use App\Services\Fees;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Load payments (docs/fees-and-billing.md). Shipmater never holds the load money in 'direct' flow:
 * - Booking: a payment is scheduled once a load has a carrier and an amount.
 * - Day before pickup: the shipper's card is held on the payee's Stripe account (carrier, or factor if factored).
 * - Delivery, or just before the hold expires, whichever is first: the hold is charged.
 * - Early payment: charged at booking at the lower rate. Bank (ACH): charged at delivery, no hold.
 * - Shipmater's fee comes off as Stripe's application fee. Factored loads carry no application fee; the carrier
 *   is charged Shipmater's fee separately when the factor marks the load funded (chargeFactoredFee).
 * The 'platform' flow (admin setting) routes the full payment through Shipmater's account instead.
 */
class LoadPayments
{
    public function __construct(private Gateway $gateway) {}

    public static function flow(): string
    {
        $row = DB::table('platform_settings')->where('key', 'payments')->value('value');
        return (json_decode((string) $row, true)['flow'] ?? 'direct') === 'platform' ? 'platform' : 'direct';
    }

    public static function setFlow(string $flow, ?int $userId): void
    {
        DB::table('platform_settings')->updateOrInsert(['key' => 'payments'], [
            'value' => json_encode(['flow' => $flow]), 'updated_by' => $userId, 'updated_at' => now(),
        ]);
    }

    // ── Scheduling ───────────────────────────────────────────────────────────

    /** Create or refresh the payment for a load once it has a carrier. Places the hold now if pickup is within a day. */
    public function schedule(string $type, Model $load): ?LoadPayment
    {
        $facts = $this->facts($type, $load);
        if (!$facts['carrier_id'] || $facts['amount_cents'] <= 0) return null;

        $payment = LoadPayment::firstOrNew(['load_type' => $type, 'load_id' => $load->id]);
        if ($payment->exists && !in_array($payment->status, ['scheduled', 'hold_failed', 'canceled'], true)) return $payment;

        $payment->fill([
            'shipper_org_id' => self::orgOf($facts['shipper_id'], 'shipper')?->id,
            'carrier_org_id' => self::orgOf($facts['carrier_id'], 'carrier')?->id,
            'amount_cents'   => $facts['amount_cents'],
            'pickup_date'    => $facts['pickup_date'],
            'flow'           => self::flow(),
            'status'         => 'scheduled',
            'failure_reason' => null,
        ]);
        $this->applyPayee($payment);
        $payment->save();

        if ($this->holdDue($payment)) $this->placeHold($payment);

        return $payment->fresh();
    }

    /** The hold is due the day before pickup (or now, if pickup is today or unknown and the load is moving) */
    public function holdDue(LoadPayment $p): bool
    {
        if (!in_array($p->status, ['scheduled', 'hold_failed'], true) || $p->early) return false;
        if (!$p->pickup_date) return false;

        return $p->pickup_date->copy()->startOfDay()->subHours(config('payments.hold_lead_hours'))->lte(now());
    }

    // ── Hold (day before pickup) ─────────────────────────────────────────────

    public function placeHold(LoadPayment $p): LoadPayment
    {
        if (!in_array($p->status, ['scheduled', 'hold_failed'], true)) return $p;
        $this->applyPayee($p);

        $pm = $this->defaultMethod($p->shipper_org_id);
        if (!$pm) return $this->holdFailed($p, 'No card or bank account on file. Add one in Payments.');
        $p->payment_method_id = $pm->id;
        $p->method = $pm->type === 'card' ? 'card' : 'us_bank_account';

        // Banks can't be held: charged at delivery
        if ($p->method !== 'card') {
            $p->fill(['status' => 'scheduled', 'failure_reason' => null])->save();
            return $p;
        }
        if (!$p->stripe_account) return $this->holdFailed($p, $this->notConnectedMessage($p));

        $result = $this->intent($p, $pm, manual: true);
        $p->attempts++;
        if ($result['status'] === 'requires_capture') {
            $p->fill([
                'status'            => 'held',
                'payment_intent_id' => $result['id'],
                'charge_id'         => $result['charge_id'],
                'held_at'           => now(),
                'capture_before'    => $result['capture_before'] ? now()->setTimestamp($result['capture_before']) : now()->addDays(config('payments.default_hold_days')),
                'failure_reason'    => null,
            ])->save();
            return $p;
        }

        return $this->holdFailed($p, $result['error'] ?? 'The card could not be held.');
    }

    // ── Charge (delivery, hold deadline, early payment) ──────────────────────

    /** Delivery: charge the hold, or charge now if there is no hold (bank, or the hold failed) */
    public function charge(LoadPayment $p): LoadPayment
    {
        if (in_array($p->status, ['paid', 'processing', 'refunded'], true)) return $p;

        if ($p->status === 'held' && $p->payment_intent_id) {
            $result = $this->gateway->captureIntent($p->payment_intent_id, $p->flow === 'direct' ? $p->stripe_account : null);
            return $this->settle($p, $result);
        }

        $this->applyPayee($p);
        $pm = $this->defaultMethod($p->shipper_org_id);
        if (!$pm) return $this->failed($p, 'No card or bank account on file.');
        if (!$p->stripe_account) return $this->failed($p, $this->notConnectedMessage($p));

        $p->payment_method_id = $pm->id;
        $p->method = $pm->type === 'card' ? 'card' : 'us_bank_account';
        $p->attempts++;

        return $this->settle($p, $this->intent($p, $pm, manual: false));
    }

    /** Shipper pays now, before pickup, at the early rate */
    public function payEarly(LoadPayment $p): LoadPayment
    {
        abort_unless(in_array($p->status, ['scheduled', 'hold_failed', 'held'], true), 422, 'This load is already paid or being paid.');
        $this->applyPayee($p);
        abort_unless($p->stripe_account, 422, $this->notConnectedMessage($p));
        abort_unless($this->defaultMethod($p->shipper_org_id), 422, 'Add a card or bank account first.');

        if ($p->status === 'held' && $p->payment_intent_id) {
            $this->gateway->cancelIntent($p->payment_intent_id, $p->flow === 'direct' ? $p->stripe_account : null);
            $p->fill(['status' => 'scheduled', 'payment_intent_id' => null, 'held_at' => null, 'capture_before' => null]);
        }

        $p->early = true;
        $this->applyPayee($p);
        $p->save();

        return $this->charge($p);
    }

    /** Factoring accepted (or released) after scheduling: the money must go to the new payee */
    public function repoint(string $type, int $loadId): void
    {
        $p = LoadPayment::where('load_type', $type)->where('load_id', $loadId)->first();
        if (!$p || in_array($p->status, ['paid', 'processing', 'refunded'], true)) return;

        if ($p->status === 'held' && $p->payment_intent_id) {
            $this->gateway->cancelIntent($p->payment_intent_id, $p->flow === 'direct' ? $p->stripe_account : null);
            $p->fill(['status' => 'scheduled', 'payment_intent_id' => null, 'held_at' => null, 'capture_before' => null]);
        }
        $this->applyPayee($p);
        $p->save();

        if ($this->holdDue($p)) $this->placeHold($p);
    }

    public function cancel(LoadPayment $p): void
    {
        if ($p->status === 'held' && $p->payment_intent_id) {
            $this->gateway->cancelIntent($p->payment_intent_id, $p->flow === 'direct' ? $p->stripe_account : null);
        }
        if (!in_array($p->status, ['paid', 'processing', 'refunded'], true)) $p->update(['status' => 'canceled']);
    }

    // ── Factored loads: carrier pays Shipmater's fee when the factor funds ───

    public function chargeFactoredFee(FactoredLoad $load): FeeCharge
    {
        $amountCents = (int) round((float) $load->load_amount * 100);
        $rate        = Fees::standardRate();

        $fee = FeeCharge::firstOrCreate(['factored_load_id' => $load->id], [
            'carrier_org_id'    => $load->carrier_org_id,
            'load_amount_cents' => $amountCents,
            'amount_cents'      => (int) round($amountCents * $rate),
            'fee_rate'          => $rate,
        ]);

        return $this->collectFee($fee);
    }

    public function collectFee(FeeCharge $fee): FeeCharge
    {
        if (in_array($fee->status, ['paid', 'processing'], true) || $fee->amount_cents <= 0) return $fee;

        $pm = $this->defaultMethod($fee->carrier_org_id);
        if (!$pm) {
            $fee->update(['status' => 'failed', 'failure_reason' => 'No card or bank account on file. Add one in Earnings.']);
            return $fee;
        }
        $org      = Organization::find($fee->carrier_org_id);
        $customer = $this->customerFor($org);
        $result   = $this->gateway->createIntent([
            'amount'         => $fee->amount_cents,
            'currency'       => 'usd',
            'customer'       => $customer,
            'payment_method' => $pm->stripe_pm_id,
            'off_session'    => true,
            'confirm'        => true,
            'description'    => "Shipmater fee, factored load #{$fee->factored_load_id}",
            'metadata'       => ['type' => 'factored_fee', 'fee_charge_id' => (string) $fee->id],
        ]);

        $fee->attempts++;
        $fee->payment_method_id = $pm->id;
        $fee->payment_intent_id = $result['id'];
        match ($result['status']) {
            'succeeded'  => $this->feePaid($fee),
            'processing' => $fee->fill(['status' => 'processing', 'failure_reason' => null])->save(),
            default      => $fee->fill(['status' => 'failed', 'failure_reason' => $result['error'] ?? 'The charge failed.'])->save(),
        };

        return $fee;
    }

    /** A carrier with an unpaid Shipmater fee can't factor new loads */
    public static function carrierOwesFees(int $carrierOrgId): bool
    {
        return FeeCharge::where('carrier_org_id', $carrierOrgId)->where('status', 'failed')->exists();
    }

    // ── Stripe events (webhook) ──────────────────────────────────────────────

    public function handleIntentEvent(string $eventType, object $intent): void
    {
        $kind = $intent->metadata['type'] ?? null;

        if ($kind === 'factored_fee') {
            $fee = FeeCharge::find((int) ($intent->metadata['fee_charge_id'] ?? 0));
            if (!$fee) return;
            if ($eventType === 'payment_intent.succeeded') $this->feePaid($fee);
            if ($eventType === 'payment_intent.payment_failed') $fee->update(['status' => 'failed', 'failure_reason' => $intent->last_payment_error?->message ?? 'The charge failed.']);
            return;
        }

        if ($kind !== 'load_payment') return;
        $p = LoadPayment::where('payment_intent_id', $intent->id)->first();
        if (!$p) return;

        match ($eventType) {
            'payment_intent.succeeded'       => $this->markPaid($p, null),
            'payment_intent.payment_failed'  => $p->status === 'held' || $p->status === 'processing'
                                                 ? $this->failed($p, $intent->last_payment_error?->message ?? 'The payment failed.') : null,
            // A hold that expired or was canceled outside Shipmater goes back to scheduled, to be held or charged again
            'payment_intent.canceled'        => $p->status === 'held'
                                                 ? $p->update(['status' => 'hold_failed', 'payment_intent_id' => null, 'failure_reason' => 'The card hold expired.']) : null,
            default                          => null,
        };
    }

    public function handleRefund(object $charge): void
    {
        $p = LoadPayment::where('charge_id', $charge->id)->orWhere('payment_intent_id', $charge->payment_intent)->first();
        if (!$p) return;

        $refunded = (int) $charge->amount_refunded;
        $p->update(['refunded_cents' => $refunded, 'status' => $refunded >= $p->amount_cents ? 'refunded' : $p->status]);
        $feeBack = (int) round($p->fee_cents * min(1, $refunded / max(1, $p->amount_cents)));
        if ($feeBack > 0) {
            LedgerEntry::record('refund', -$feeBack, ['gross_cents' => -$refunded, 'org_id' => $p->carrier_org_id, 'source_type' => 'load_payment',
                'source_id' => $p->id, 'reference' => $charge->id . ':' . $refunded, 'description' => "Refund, {$p->load_type} #{$p->load_id}"]);
        }
    }

    // ── Scheduler: holds due and holds about to expire ───────────────────────

    public function run(): array
    {
        $held = $charged = $retried = 0;

        // Holds due (day before pickup); failed holds retried every 6 hours until pickup
        LoadPayment::whereIn('status', ['scheduled', 'hold_failed'])->where('early', false)->whereNotNull('pickup_date')
            ->whereDate('pickup_date', '<=', now()->addHours(config('payments.hold_lead_hours'))->toDateString())
            ->where(fn ($q) => $q->where('status', 'scheduled')->orWhere('updated_at', '<=', now()->subHours(6)))
            ->where(fn ($q) => $q->whereNull('method')->orWhere('method', 'card'))
            ->chunkById(100, function ($rows) use (&$held, &$retried) {
                foreach ($rows as $p) {
                    $was = $p->status;
                    if ($this->placeHold($p)->status === 'held') $was === 'hold_failed' ? $retried++ : $held++;
                }
            });

        // Charge before the hold expires, delivered or not
        LoadPayment::where('status', 'held')->where('capture_before', '<=', now()->addHours(config('payments.capture_margin_hours')))
            ->chunkById(100, function ($rows) use (&$charged) {
                foreach ($rows as $p) if ($this->charge($p)->status === 'paid') $charged++;
            });

        return compact('held', 'retried', 'charged');
    }

    // ── Internals ────────────────────────────────────────────────────────────

    /** Who gets paid: the factor if the load is factored and accepted, otherwise the carrier */
    private function applyPayee(LoadPayment $p): void
    {
        $factored = FactoredLoad::where('load_type', $p->load_type)->where('load_id', $p->load_id)->whereIn('status', ['accepted', 'funded'])->latest()->first();

        if ($factored) {
            $factor = Organization::find($factored->factor_org_id);
            $p->fill(['payee_type' => 'factor', 'payee_org_id' => $factor?->id, 'factored_load_id' => $factored->id, 'stripe_account' => $factor?->stripe_connect_id]);
        } else {
            $carrier = $p->carrier_org_id ? Organization::find($p->carrier_org_id) : null;
            $p->fill(['payee_type' => 'carrier', 'payee_org_id' => $carrier?->id, 'factored_load_id' => null, 'stripe_account' => $this->carrierAccount($p)]);
        }

        // Factored loads: Shipmater's fee is charged to the carrier at funding, not taken from the shipper's payment
        $p->fee_rate  = $p->early ? Fees::earlyRate() : Fees::standardRate();
        $p->fee_cents = $p->payee_type === 'factor' ? 0 : (int) round($p->amount_cents * (float) $p->fee_rate);
    }

    private function carrierAccount(LoadPayment $p): ?string
    {
        $org = $p->carrier_org_id ? Organization::find($p->carrier_org_id) : null;
        if ($org?->stripe_connect_id) return $org->stripe_connect_id;

        $load    = $p->loadRecord();
        $owner   = $org ? User::find($org->owner_id) : null;
        $profile = $owner?->carrierProfile ?? ($load?->carrier_id ? User::find($load->carrier_id)?->carrierProfile : null);

        return $profile?->stripe_account_id ?: null;
    }

    private function intent(LoadPayment $p, PaymentMethod $pm, bool $manual): array
    {
        $shipperOrg = Organization::find($p->shipper_org_id);
        $customer   = $this->customerFor($shipperOrg);
        $params = [
            'amount'               => $p->amount_cents,
            'currency'             => 'usd',
            'capture_method'       => $manual ? 'manual' : 'automatic',
            'off_session'          => true,
            'confirm'              => true,
            'payment_method_types' => [$p->method === 'card' ? 'card' : 'us_bank_account'],
            'description'          => ucfirst(str_replace('_', ' ', $p->load_type)) . " #{$p->load_id}",
            'metadata'             => ['type' => 'load_payment', 'load_payment_id' => (string) $p->id, 'load_type' => $p->load_type, 'load_id' => (string) $p->load_id],
        ];
        if ($p->fee_cents > 0) $params['application_fee_amount'] = $p->fee_cents;

        if ($p->flow === 'platform') {
            // Through Shipmater's account: destination charge, payee settles as merchant of record
            return $this->gateway->createIntent($params + [
                'customer'       => $customer,
                'payment_method' => $pm->stripe_pm_id,
                'on_behalf_of'   => $p->stripe_account,
                'transfer_data'  => ['destination' => $p->stripe_account],
            ]);
        }

        // Direct: charged on the payee's own account; Shipmater receives only the application fee
        try {
            $clone = $this->gateway->clonePaymentMethod($customer, $pm->stripe_pm_id, $p->stripe_account);
        } catch (\Throwable $e) {
            Log::warning('LoadPayments: could not copy payment method to payee', ['payment' => $p->id, 'error' => $e->getMessage()]);
            return ['id' => null, 'status' => 'failed', 'charge_id' => null, 'capture_before' => null, 'error' => 'This payment method could not be used for this carrier.'];
        }

        return $this->gateway->createIntent($params + ['payment_method' => $clone], $p->stripe_account);
    }

    private function settle(LoadPayment $p, array $result): LoadPayment
    {
        $p->payment_intent_id = $result['id'] ?? $p->payment_intent_id;
        $p->charge_id         = $result['charge_id'] ?? $p->charge_id;

        return match ($result['status']) {
            'succeeded'  => $this->markPaid($p, null),
            'processing' => $this->processing($p),
            default      => $this->failed($p, $result['error'] ?? 'The payment failed.'),
        };
    }

    private function processing(LoadPayment $p): LoadPayment
    {
        $p->fill(['status' => 'processing', 'failure_reason' => null])->save();
        return $p;
    }

    private function markPaid(LoadPayment $p, ?string $chargeId): LoadPayment
    {
        $p->fill(['status' => 'paid', 'paid_at' => $p->paid_at ?? now(), 'failure_reason' => null, 'charge_id' => $chargeId ?? $p->charge_id])->save();

        if ($p->fee_cents > 0) {
            LedgerEntry::record('load_fee', (int) $p->fee_cents, [
                'gross_cents' => (int) $p->amount_cents, 'org_id' => $p->carrier_org_id, 'source_type' => 'load_payment', 'source_id' => $p->id,
                'reference' => $p->payment_intent_id, 'description' => ucfirst(str_replace('_', ' ', $p->load_type)) . " #{$p->load_id}" . ($p->early ? ' (early)' : ''),
            ]);
        } else {
            // Factored loads: volume only; the fee is booked when the carrier pays it
            LedgerEntry::record('load_volume', 0, [
                'gross_cents' => (int) $p->amount_cents, 'org_id' => $p->carrier_org_id, 'source_type' => 'load_payment', 'source_id' => $p->id,
                'reference' => $p->payment_intent_id, 'description' => ucfirst(str_replace('_', ' ', $p->load_type)) . " #{$p->load_id} (factored)",
            ]);
        }

        $load = $p->loadRecord();
        $load?->update(['payment_status' => 'paid']);

        return $p;
    }

    private function feePaid(FeeCharge $fee): void
    {
        $fee->fill(['status' => 'paid', 'paid_at' => $fee->paid_at ?? now(), 'failure_reason' => null])->save();
        LedgerEntry::record('factored_fee', (int) $fee->amount_cents, [
            'gross_cents' => 0, 'org_id' => $fee->carrier_org_id, 'source_type' => 'fee_charge', 'source_id' => $fee->id,
            'reference' => $fee->payment_intent_id, 'description' => "Factored load #{$fee->factored_load_id}",
        ]);
    }

    private function holdFailed(LoadPayment $p, string $reason): LoadPayment
    {
        $p->fill(['status' => 'hold_failed', 'failure_reason' => $reason, 'failed_at' => now()])->save();
        return $p;
    }

    private function failed(LoadPayment $p, string $reason): LoadPayment
    {
        $p->fill(['status' => 'failed', 'failure_reason' => $reason, 'failed_at' => now()])->save();
        $p->loadRecord()?->update(['payment_status' => 'failed']);
        return $p;
    }

    private function notConnectedMessage(LoadPayment $p): string
    {
        return $p->payee_type === 'factor'
            ? 'The factoring company has not connected Stripe yet.'
            : 'The carrier has not connected Stripe yet, so this load can\'t be paid.';
    }

    public function defaultMethod(?int $orgId): ?PaymentMethod
    {
        if (!$orgId) return null;
        return PaymentMethod::where('org_id', $orgId)->whereNotNull('stripe_pm_id')->orderByDesc('is_default')->orderBy('id')->first();
    }

    public function customerFor(Organization $org): string
    {
        if ($org->stripe_customer_id) return $org->stripe_customer_id;
        $id = $this->gateway->createCustomer($org->name, $org->email, ['org_id' => (string) $org->id, 'org_type' => $org->type]);
        $org->forceFill(['stripe_customer_id' => $id])->save();
        return $id;
    }

    /** amount, shipper, carrier and pickup date of a shipment or freight job */
    private function facts(string $type, Model $load): array
    {
        if ($type === 'freight_job') {
            /** @var FreightJob $load */
            $pickup = $load->stops()->where('stop_type', 'pickup')->whereNotNull('scheduled_date')->min('scheduled_date');
            return ['amount_cents' => (int) $load->payment_amount_cents, 'shipper_id' => $load->shipper_id, 'carrier_id' => $load->carrier_id, 'pickup_date' => $pickup];
        }
        /** @var Shipment $load */
        return ['amount_cents' => (int) round((float) $load->agreed_cost * 100), 'shipper_id' => $load->shipper_id, 'carrier_id' => $load->carrier_id,
                'pickup_date' => $load->pickup_date];
    }

    /** The company of a given type a user owns or belongs to */
    public static function orgOf(?int $userId, string $type): ?Organization
    {
        if (!$userId) return null;
        return Organization::where('type', $type)
            ->where(fn ($q) => $q->where('owner_id', $userId)->orWhereIn('id', OrgMember::where('user_id', $userId)->select('org_id')))
            ->orderBy('id')->first();
    }
}
