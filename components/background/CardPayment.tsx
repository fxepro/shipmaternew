'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK ?? '');

// Match the site's own look: Source Sans 3 at 14px, the site's blue, text and border colours
const stripeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#0096C7', colorBackground: '#ffffff', colorText: '#0F2433', colorTextSecondary: '#5A7184',
    colorTextPlaceholder: '#8FA3B3', colorDanger: '#b91c1c',
    fontFamily: '"Source Sans 3", system-ui, sans-serif', fontSizeBase: '14px', fontSizeSm: '12px',
    spacingUnit: '3px', borderRadius: '8px',
  },
  rules: {
    '.Input': { border: '1px solid #E2ECF0', boxShadow: 'none', padding: '8px 10px' },
    '.Input:focus': { border: '1px solid #0096C7', boxShadow: 'none' },
    '.Tab': { border: '1px solid #E2ECF0', boxShadow: 'none', padding: '8px 10px' },
    '.Tab--selected': { border: '1px solid #0096C7', boxShadow: 'none' },
    '.Label': { fontSize: '12px', color: '#5A7184' },
  },
};
const stripeFonts = [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600&display=swap' }];

function PayForm({ amount, onSuccess, onCancel }: { amount: number; onSuccess: () => void; onCancel: () => void }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [confirming, setConfirming] = useState(false);
  const [payError, setPayError]     = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setConfirming(true);
    setPayError(null);
    // Cards complete in-page; return_url only applies to methods that need a redirect
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.href }, redirect: 'if_required' });
    if (error) { setPayError(error.message ?? 'Payment failed. Please try again.'); setConfirming(false); return; }
    if (paymentIntent?.status === 'succeeded') onSuccess();
    else { setPayError('Payment did not complete. Please try again.'); setConfirming(false); }
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {payError && <p className="text-xs text-red-700">{payError}</p>}
      <div className="flex items-center justify-end gap-3">
        <button onClick={onCancel} disabled={confirming} className="text-xs text-[var(--color-text-muted)]">Cancel</button>
        <button onClick={handlePay} disabled={confirming || !stripe} className="flex items-center gap-1.5 rounded-lg bg-[var(--color-teal)] px-3 py-1 text-xs font-medium text-white disabled:opacity-60">
          {confirming && <Loader2 size={13} className="animate-spin" />} Pay ${amount}
        </button>
      </div>
    </div>
  );
}

/** Stripe card form for a PaymentIntent the API created, styled like the rest of the site */
export function CardPayment({ clientSecret, amount, onSuccess, onCancel }: { clientSecret: string; amount: number; onSuccess: () => void; onCancel: () => void }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance, fonts: stripeFonts }}>
      <PayForm amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}
