<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use App\Services\Payments\Gateway;
use App\Services\Payments\LoadPayments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A company's saved cards and bank accounts, stored at Stripe (docs/fees-and-billing.md).
 * Shippers pay loads with them; carriers pay Shipmater's fee on factored loads with them.
 * The browser saves a method with Stripe Elements (setup intent), then sends us its id.
 */
class PaymentMethodController extends Controller
{
    public function __construct(private Gateway $gateway, private LoadPayments $payments) {}

    // GET /payment-methods
    public function index(Request $request): JsonResponse
    {
        $org = $request->user()->currentOrg;
        $methods = $org
            ? PaymentMethod::where('org_id', $org->id)->whereNotNull('stripe_pm_id')->orderByDesc('is_default')->orderBy('created_at')->get()
            : collect();

        return response()->json(['data' => $methods->map(fn ($m) => $this->present($m)), 'fake' => config('payments.driver') === 'fake']);
    }

    // POST /payment-methods/setup-intent
    public function setupIntent(Request $request): JsonResponse
    {
        $org = $this->manageable($request);
        $si  = $this->gateway->setupIntent($this->payments->customerFor($org));

        return response()->json(['client_secret' => $si['client_secret'], 'fake' => config('payments.driver') === 'fake']);
    }

    // POST /payment-methods   { payment_method_id }
    public function store(Request $request): JsonResponse
    {
        $org  = $this->manageable($request);
        $data = $request->validate(['payment_method_id' => ['required', 'string', 'max:255']]);

        if (config('payments.driver') === 'fake') {
            abort_unless(str_starts_with($data['payment_method_id'], 'pm_fake_'), 422, 'Test mode: use a pm_fake_ id.');
        }
        abort_if(PaymentMethod::where('stripe_pm_id', $data['payment_method_id'])->exists(), 422, 'This payment method is already saved.');

        $d = $this->gateway->paymentMethodDetails($data['payment_method_id']);
        // The method must belong to this company's Stripe customer (saved through our setup intent)
        if (config('payments.driver') !== 'fake') {
            abort_unless(($d['customer'] ?? null) === $org->stripe_customer_id, 422, 'This payment method was not saved for your company.');
        }

        $method = PaymentMethod::create([
            'user_id'      => $request->user()->id,
            'org_id'       => $org->id,
            'type'         => $d['type'] === 'card' ? 'card' : 'bank',
            'brand'        => $d['brand'] ?? null,
            'last4'        => $d['last4'],
            'exp_month'    => $d['exp_month'] ?? null,
            'exp_year'     => $d['exp_year'] ?? null,
            'bank_name'    => $d['bank_name'] ?? null,
            'account_type' => $d['account_type'] ?? null,
            'stripe_pm_id' => $data['payment_method_id'],
            'is_default'   => !PaymentMethod::where('org_id', $org->id)->whereNotNull('stripe_pm_id')->exists(),
        ]);

        return response()->json(['data' => $this->present($method)], 201);
    }

    // DELETE /payment-methods/{paymentMethod}
    public function destroy(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $org = $this->manageable($request);
        abort_unless($paymentMethod->org_id === $org->id, 403);

        if ($paymentMethod->stripe_pm_id) $this->gateway->detachPaymentMethod($paymentMethod->stripe_pm_id);
        $wasDefault = $paymentMethod->is_default;
        $paymentMethod->delete();

        if ($wasDefault) {
            PaymentMethod::where('org_id', $org->id)->whereNotNull('stripe_pm_id')->orderBy('created_at')->first()?->update(['is_default' => true]);
        }

        return response()->json(['message' => 'Payment method removed']);
    }

    // POST /payment-methods/{paymentMethod}/default
    public function setDefault(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $org = $this->manageable($request);
        abort_unless($paymentMethod->org_id === $org->id, 403);

        PaymentMethod::where('org_id', $org->id)->update(['is_default' => false]);
        $paymentMethod->update(['is_default' => true]);

        return response()->json(['data' => $this->present($paymentMethod->fresh())]);
    }

    private function manageable(Request $request)
    {
        $user = $request->user();
        $org  = $user->currentOrg;
        abort_unless($org, 403, 'No company selected.');
        abort_unless($user->isOrgAdmin(), 403, 'Only the owner or staff can manage payment methods.');
        return $org;
    }

    private function present(PaymentMethod $m): array
    {
        return [
            'id' => $m->id, 'type' => $m->type, 'brand' => $m->brand, 'last4' => $m->last4, 'exp_month' => $m->exp_month,
            'exp_year' => $m->exp_year, 'bank_name' => $m->bank_name, 'account_type' => $m->account_type, 'is_default' => (bool) $m->is_default,
            'label' => $m->type === 'card' ? ucfirst((string) $m->brand) . " •••• {$m->last4}" : ($m->bank_name ?: 'Bank') . " •••• {$m->last4}",
        ];
    }
}
