<?php

namespace Database\Seeders;

use App\Models\FactoredLoad;
use App\Models\FeeCharge;
use App\Models\LedgerEntry;
use App\Models\LoadPayment;
use App\Models\Organization;
use App\Models\PaymentMethod;
use App\Models\Shipment;
use App\Models\User;
use App\Services\Payments\LoadPayments;
use Illuminate\Database\Seeder;

/**
 * Demo load payments for Jordan's carrier and Alex's shipper company, one in each state, plus the Shipmater fee
 * on Jordan's funded factored load. Writes rows directly (no Stripe calls). Run after FactoringDemoSeeder.
 * Fake saved cards are added only when PAYMENTS_DRIVER=fake, so a real server never tries to charge them.
 */
class PaymentsDemoSeeder extends Seeder
{
    public function run(): void
    {
        $jordan = User::where('email', 'jordan@demo.com')->first();
        $alex   = User::where('email', 'alex@demo.com')->first();
        if (!$jordan || !$alex) return;

        $carrier = LoadPayments::orgOf($jordan->id, 'carrier');
        $shipper = LoadPayments::orgOf($alex->id, 'shipper');
        if (!$carrier || !$shipper || LoadPayment::where('carrier_org_id', $carrier->id)->exists()) return;

        $card = null;
        if (config('payments.driver') === 'fake') {
            // Local test mode only: treat the demo carrier and factor as Stripe-connected
            $jordan->carrierProfile?->update(['stripe_account_id' => 'acct_fake_jordan', 'stripe_account_status' => 'verified']);
            Organization::where('type', 'factor')->whereNull('stripe_connect_id')->update(['stripe_connect_id' => 'acct_fake_factor']);
            $card = PaymentMethod::firstOrCreate(['stripe_pm_id' => 'pm_fake_card_4242'], [
                'user_id' => $alex->id, 'org_id' => $shipper->id, 'type' => 'card', 'brand' => 'visa', 'last4' => '4242',
                'exp_month' => '12', 'exp_year' => substr((string) (now()->year + 3), -2), 'is_default' => true,
            ]);
        }

        $shipments = Shipment::where('carrier_id', $jordan->id)->get()->keyBy('item_description');
        $factored  = FactoredLoad::where('carrier_org_id', $carrier->id)->get()->keyBy('load_id');
        $standard  = \App\Services\Fees::standardRate();

        // [title, status, extra]
        $plan = [
            ['Restaurant kitchen equipment',   'paid',        ['paid_at' => now()->subDays(3)]],
            ['Pallet of surgical instruments', 'held',        ['held_at' => now()->subDay(), 'capture_before' => now()->addDays(4)]],
            ['Film production equipment',      'hold_failed', ['failure_reason' => 'Your card was declined.', 'failed_at' => now()->subHours(5)]],
            ['Film set props — breakables',    'scheduled',   ['pickup_date' => now()->addDays(3)->toDateString()]],
            ['Art gallery installation',       'paid',        ['paid_at' => now()->subDays(5)]],
        ];

        $carrierAccount = $jordan->carrierProfile?->fresh()?->stripe_account_id;
        foreach ($plan as [$title, $status, $extra]) {
            $s = $shipments->get($title);
            if (!$s) continue;
            $fl     = $factored->get($s->id);
            $factor = $fl && in_array($fl->status, ['accepted', 'funded'], true) ? Organization::find($fl->factor_org_id) : null;
            $amount = (int) round((float) $s->agreed_cost * 100);
            $fee    = $factor ? 0 : (int) round($amount * $standard);

            $p = LoadPayment::create(array_merge([
                'load_type' => 'shipment', 'load_id' => $s->id, 'shipper_org_id' => $shipper->id, 'carrier_org_id' => $carrier->id,
                'payee_org_id' => $factor?->id ?? $carrier->id, 'payee_type' => $factor ? 'factor' : 'carrier', 'factored_load_id' => $factor ? $fl->id : null,
                'amount_cents' => $amount, 'fee_cents' => $fee, 'fee_rate' => $standard, 'flow' => 'direct', 'method' => 'card',
                'pickup_date' => $s->pickup_date, 'status' => $status, 'payment_method_id' => $card?->id,
                'stripe_account' => $factor ? $factor->stripe_connect_id : $carrierAccount,
                'payment_intent_id' => in_array($status, ['paid', 'held'], true) ? 'pi_demo_' . $s->id : null,
            ], $extra));

            if ($status === 'paid') {
                $s->update(['payment_status' => 'paid']);
                LedgerEntry::record($fee > 0 ? 'load_fee' : 'load_volume', $fee, [
                    'gross_cents' => $amount, 'org_id' => $carrier->id, 'source_type' => 'load_payment', 'source_id' => $p->id,
                    'reference' => $p->payment_intent_id, 'description' => "Shipment #{$s->id}" . ($factor ? ' (factored)' : ''), 'occurred_at' => $p->paid_at,
                ]);
            }
        }

        // Shipmater's fee on the funded factored load, paid by the carrier
        $funded = $factored->firstWhere('status', 'funded');
        if ($funded && !FeeCharge::where('factored_load_id', $funded->id)->exists()) {
            $loadCents = (int) round((float) $funded->load_amount * 100);
            $fee = FeeCharge::create([
                'factored_load_id' => $funded->id, 'carrier_org_id' => $carrier->id, 'load_amount_cents' => $loadCents,
                'amount_cents' => (int) round($loadCents * $standard), 'fee_rate' => $standard, 'status' => 'paid',
                'payment_intent_id' => 'pi_demo_fee_' . $funded->id, 'paid_at' => $funded->funded_at ?? now()->subDays(5),
            ]);
            LedgerEntry::record('factored_fee', (int) $fee->amount_cents, [
                'org_id' => $carrier->id, 'source_type' => 'fee_charge', 'source_id' => $fee->id, 'reference' => $fee->payment_intent_id,
                'description' => "Factored load #{$funded->id}", 'occurred_at' => $fee->paid_at,
            ]);
        }
    }
}
