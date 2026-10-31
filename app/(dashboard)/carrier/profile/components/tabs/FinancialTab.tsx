'use client';

import { useQuery } from '@tanstack/react-query';
import { api, verificationApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  CheckCircle,
  AlertCircle,
  Loader,
  ExternalLink,
  CreditCard,
  Clock,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// ── Stripe public key ─────────────────────────────────────────────────────
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PK ?? ''
);

// ── Stripe appearance ─────────────────────────────────────────────────────
const stripeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#0f9d8f',
    colorBackground: '#ffffff',
    colorText: '#1a1a1a',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '8px',
  },
};

// ── Inner payment form (must be inside <Elements>) ─────────────────────────
function PaymentForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  const [payError, setPayError]     = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setConfirming(true);
    setPayError(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Stripe calls return_url on redirect-required methods;
        // card payments complete in-page with redirect: 'if_required'
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (error) {
      setPayError(error.message ?? 'Payment failed. Please try again.');
      setConfirming(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess();
    } else {
      setPayError('Payment did not complete. Please try again.');
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      {payError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <XCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{payError}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handlePay}
          disabled={confirming || !stripe}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-teal)] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[var(--color-teal-light)] disabled:opacity-60 transition-colors"
        >
          {confirming ? (
            <>
              <Loader size={14} className="animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <ShieldCheck size={14} />
              Confirm & Pay $99
            </>
          )}
        </button>

        <button
          onClick={onCancel}
          disabled={confirming}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Onboarding fee status badge ────────────────────────────────────────────
function VerificationStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    pending_payment: {
      icon: <Clock size={13} />,
      label: 'Payment required',
      className: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    },
    pending_background: {
      icon: <Loader size={13} className="animate-spin" />,
      label: 'Background check in progress',
      className: 'bg-blue-50 border-blue-200 text-blue-800',
    },
    pending_review: {
      icon: <Clock size={13} />,
      label: 'Under admin review',
      className: 'bg-orange-50 border-orange-200 text-orange-800',
    },
    approved: {
      icon: <CheckCircle size={13} />,
      label: 'Approved',
      className: 'bg-[var(--color-success-pale)] border-[var(--color-success)] text-[var(--color-success)]',
    },
    rejected: {
      icon: <XCircle size={13} />,
      label: 'Rejected',
      className: 'bg-red-50 border-red-200 text-red-700',
    },
  };

  const cfg = configs[status] ?? configs['pending_payment'];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function FinancialTab() {
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['carrier-profile'],
    queryFn: () => api.get('/api/v1/carrier/profile').then(r => r.data?.data),
    retry: false,
  });

  // Stripe Connect
  const [isConnecting, setIsConnecting] = useState(false);
  const stripeStatus    = profile?.stripe_account_status || 'not_connected';

  // Onboarding fee
  const [feeStep, setFeeStep]           = useState<'idle' | 'loading' | 'form' | 'confirming'>('idle');
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const feePaid             = !!profile?.onboarding_fee_paid;
  const verificationStatus  = profile?.verification_status ?? 'incomplete';

  // ── Stripe Connect ───────────────────────────────────────────────────────
  async function handleStripeConnect() {
    try {
      setIsConnecting(true);
      const res = await api.post('/api/v1/stripe/connect/onboard');
      window.open(res.data.url, '_blank', 'width=800,height=600');

      // Ask Stripe directly; the account.updated webhook also updates the profile
      const pollInterval = setInterval(async () => {
        const check = await api.get('/api/v1/stripe/connect/status');
        if (check.data?.status === 'verified') {
          clearInterval(pollInterval);
          refetch();
          toast.success('Stripe account connected!');
          setIsConnecting(false);
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(pollInterval);
        setIsConnecting(false);
        refetch();
      }, 600000);
    } catch {
      toast.error('Failed to connect Stripe account');
      setIsConnecting(false);
    }
  }

  // ── Onboarding fee ───────────────────────────────────────────────────────
  const handleOpenPayment = useCallback(async () => {
    setFeeStep('loading');
    try {
      const res = await verificationApi.onboardingFee();
      setClientSecret(res.data.client_secret);
      setFeeStep('form');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Could not initialise payment. Please try again.';
      toast.error(msg);
      setFeeStep('idle');
    }
  }, []);

  const handlePaySuccess = useCallback(async () => {
    toast.success('Payment successful! Background check initiated.');
    setFeeStep('idle');
    setClientSecret(null);
    // Wait a beat for the webhook to fire, then refetch
    setTimeout(() => refetch(), 1500);
  }, [refetch]);

  const handlePayCancel = useCallback(() => {
    setFeeStep('idle');
    setClientSecret(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader size={18} className="animate-spin text-[var(--color-teal)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Platform Onboarding Fee ─────────────────────────────────────── */}
      <div className={`rounded-xl border p-6 ${feePaid
        ? 'bg-[var(--color-success-pale)] border-[var(--color-success)]'
        : 'bg-white border-[var(--color-cream-dark)]'
      }`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-[var(--color-text)] mb-0.5">
              Platform Onboarding Fee
            </h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              One-time $99 fee covers your background check and unlocks full platform access.
            </p>
          </div>

          <VerificationStatusBadge status={verificationStatus} />
        </div>

        {/* Paid state */}
        {feePaid && (
          <div className="flex items-center gap-2 text-[var(--color-success)]">
            <CheckCircle size={16} />
            <span className="text-sm font-semibold">$99 platform fee paid</span>
          </div>
        )}

        {/* Not yet paid — idle */}
        {!feePaid && feeStep === 'idle' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-[var(--color-cream-pale)] border border-[var(--color-cream-dark)] p-3">
              <ul className="text-xs text-[var(--color-text-muted)] space-y-1.5">
                <li className="flex items-center gap-2">
                  <ShieldCheck size={12} className="text-[var(--color-teal)] shrink-0" />
                  Checkr MVR + criminal background check
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={12} className="text-[var(--color-teal)] shrink-0" />
                  One-time charge — no recurring fee
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={12} className="text-[var(--color-teal)] shrink-0" />
                  Results in 3–5 business days
                </li>
              </ul>
            </div>

            <button
              onClick={handleOpenPayment}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-teal)] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[var(--color-teal-light)] transition-colors"
            >
              <CreditCard size={14} />
              Pay $99 &amp; Unlock Platform
            </button>
          </div>
        )}

        {/* Loading intent */}
        {!feePaid && feeStep === 'loading' && (
          <div className="flex items-center gap-2 text-[var(--color-teal)] py-2">
            <Loader size={14} className="animate-spin" />
            <span className="text-sm">Preparing secure checkout…</span>
          </div>
        )}

        {/* Payment form */}
        {!feePaid && feeStep === 'form' && clientSecret && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[var(--color-cream-pale)] border border-[var(--color-cream-dark)] p-3 flex items-start gap-2">
              <ShieldCheck size={13} className="text-[var(--color-teal)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-text-muted)]">
                You will be charged <strong className="text-[var(--color-text)]">$99.00 USD</strong> once.
                This initiates your Checkr background check — results in 3–5 business days.
                Full platform access is granted upon a clear result.
              </p>
            </div>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: stripeAppearance,
              }}
            >
              <PaymentForm
                onSuccess={handlePaySuccess}
                onCancel={handlePayCancel}
              />
            </Elements>
          </div>
        )}
      </div>

      {/* ── Stripe Connect ──────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[var(--color-teal-pale)] border border-[var(--color-teal)] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-[var(--color-teal)] mb-1">Stripe Connect — Payouts</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Connect your bank account to receive payments from completed shipments.
              Funds are deposited within 1–2 business days.
            </p>

            {stripeStatus === 'not_connected' && (
              <button
                onClick={handleStripeConnect}
                disabled={isConnecting}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-teal)] text-white px-4 py-2.5 text-sm font-medium hover:bg-[var(--color-teal-light)] disabled:opacity-60 transition-colors"
              >
                {isConnecting ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <ExternalLink size={14} />
                    Connect Bank Account
                  </>
                )}
              </button>
            )}

            {stripeStatus === 'pending' && (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Your Stripe account is set up but not finished. If you already completed every step, Stripe may still be reviewing it.
                </p>
                <button
                  onClick={handleStripeConnect}
                  disabled={isConnecting}
                  className="flex items-center gap-2 rounded-lg bg-[var(--color-teal)] text-white px-4 py-2.5 text-sm font-medium hover:bg-[var(--color-teal-light)] disabled:opacity-60 transition-colors"
                >
                  {isConnecting ? <><Loader size={14} className="animate-spin" /> Waiting for Stripe…</> : <><ExternalLink size={14} /> Continue Stripe setup</>}
                </button>
              </div>
            )}

            {stripeStatus === 'verified' && (
              <div className="flex items-center gap-2 text-[var(--color-success)]">
                <CheckCircle size={16} />
                <span className="text-sm font-medium">Connected &amp; verified</span>
              </div>
            )}

            {stripeStatus === 'restricted' && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 flex items-start gap-2">
                <AlertCircle size={14} className="text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-orange-900">Account restricted</p>
                  <p className="text-xs text-orange-800">Stripe needs more details before you can be paid.</p>
                  <button onClick={handleStripeConnect} disabled={isConnecting} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-orange-900 underline disabled:opacity-60">
                    <ExternalLink size={12} /> {isConnecting ? 'Waiting for Stripe…' : 'Continue Stripe setup'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Payout Methods (only when verified) ────────────────────────── */}
      {stripeStatus === 'verified' && (
        <div className="bg-white border border-[var(--color-cream-dark)] rounded-xl p-6">
          <h3 className="font-semibold text-[var(--color-text)] mb-4">Payout Schedule</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[var(--color-cream-dark)]">
              <span className="text-sm text-[var(--color-text-muted)]">Stripe Instant Transfer</span>
              <span className="text-xs font-medium text-[var(--color-text-faint)]">Next business day</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--color-cream-dark)]">
              <span className="text-sm text-[var(--color-text-muted)]">ACH Bank Transfer</span>
              <span className="text-xs font-medium text-[var(--color-text-faint)]">2–3 business days</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tax Reporting ───────────────────────────────────────────────── */}
      <div className="bg-white border border-[var(--color-cream-dark)] rounded-xl p-6">
        <h3 className="font-semibold text-[var(--color-text)] mb-4">Tax Reporting (1099-NEC)</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          If you earn over $600 in a calendar year, Shipmater will issue a 1099-NEC form.
          SSN is collected securely through Stripe during account verification.
        </p>

        {stripeStatus === 'verified' ? (
          <div className="flex items-center gap-2 text-[var(--color-success)]">
            <CheckCircle size={16} />
            <span className="text-sm font-medium">Tax information collected</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <AlertCircle size={16} />
            <span className="text-sm">Complete Stripe Connect to collect tax information</span>
          </div>
        )}
      </div>

      {/* ── Legal footer ─────────────────────────────────────────────────── */}
      <div className="text-xs text-[var(--color-text-faint)] space-y-1">
        <p>💡 By using Shipmater, you agree to our payment processing terms through Stripe Connect.</p>
        <p>Platform fees are deducted automatically before your payout.</p>
      </div>

    </div>
  );
}
