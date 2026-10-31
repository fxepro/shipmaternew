'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CreditCard, Landmark, Loader2, Plus, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { paymentApi } from '@/lib/api';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PK ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK) : null;

interface Method { id: number; type: 'card' | 'bank'; label: string; exp_month: string | null; exp_year: string | null; account_type: string | null; is_default: boolean }

function errorMessage(e: unknown): string {
  const d = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return d?.error ?? d?.message ?? 'Something went wrong';
}

/**
 * A company's saved cards and bank accounts, stored at Stripe. Shippers pay loads with the default one;
 * carriers pay Shipmater's fee on factored loads with it (docs/fees-and-billing.md).
 */
export function PaymentMethods({ purpose }: { purpose: 'shipper' | 'carrier' }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const list = useQuery({ queryKey: ['payment-methods'], queryFn: () => paymentApi.list().then((r) => r.data as { data: Method[]; fake: boolean }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); qc.invalidateQueries({ queryKey: ['payments-summary'] }); };

  const remove = useMutation({ mutationFn: (id: number) => paymentApi.destroy(id), onSuccess: () => { toast.success('Removed'); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });
  const makeDefault = useMutation({ mutationFn: (id: number) => paymentApi.setDefault(id), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });

  const methods = list.data?.data ?? [];

  return (
    <section className="card">
      <div className="card-head card-head-tint flex items-center justify-between gap-3 px-5 py-3">
        <p className="card-title">Cards and bank accounts</p>
        {!adding && <button onClick={() => setAdding(true)} className="btn btn-navy flex items-center gap-1.5 text-xs"><Plus size={13} /> Add</button>}
      </div>
      <div className="card-body space-y-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          {purpose === 'shipper'
            ? 'Your default method pays your loads: a card is held the day before pickup and charged at delivery; a bank account is charged at delivery.'
            : 'Shipmater charges its fee on factored loads to your default method when your factor marks a load funded.'}
        </p>

        {list.isLoading && <div className="skeleton h-14 rounded-lg" />}
        {!list.isLoading && methods.length === 0 && !adding && (
          <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {purpose === 'shipper' ? 'No payment method yet. Add one before accepting bids or offers.' : 'No payment method yet. Add one so factored-load fees can be paid.'}
          </p>
        )}

        {methods.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-cream-dark)] px-4 py-3">
            <div className="flex items-center gap-3">
              {m.type === 'card' ? <CreditCard size={18} className="text-[var(--color-teal)]" /> : <Landmark size={18} className="text-[var(--color-teal)]" />}
              <div>
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-[var(--color-text-faint)]">
                  {m.type === 'card' ? `Expires ${m.exp_month}/${m.exp_year}` : `${m.account_type ?? 'Bank'} account · charged at delivery`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {m.is_default
                ? <span className="rounded-full bg-[var(--color-teal-pale)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-teal)]">Default</span>
                : <button onClick={() => makeDefault.mutate(m.id)} className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"><Star size={12} /> Make default</button>}
              <button onClick={() => { if (confirm(`Remove ${m.label}?`)) remove.mutate(m.id); }} className="text-[var(--color-text-faint)] hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}

        {adding && (list.data?.fake
          ? <FakeAdd onDone={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />
          : <StripeAdd onDone={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />)}
      </div>
    </section>
  );
}

// ── Real: Stripe Elements in setup mode (card or US bank account) ───────────

function StripeAdd({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const setup = useQuery({ queryKey: ['setup-intent'], queryFn: () => paymentApi.setupIntent().then((r) => r.data.client_secret as string), staleTime: 0, gcTime: 0 });

  if (!stripePromise) return <p className="text-sm text-red-700">Stripe is not configured (NEXT_PUBLIC_STRIPE_PK).</p>;
  if (setup.isLoading) return <div className="skeleton h-40 rounded-lg" />;
  if (!setup.data) return <p className="text-sm text-red-700">Could not start. {errorMessage(setup.error)}</p>;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: setup.data, appearance: { theme: 'stripe', variables: { colorPrimary: '#2A8C8A', borderRadius: '10px' } } }}>
      <StripeAddForm onDone={onDone} onCancel={onCancel} />
    </Elements>
  );
}

function StripeAddForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!stripe || !elements) return;
    setSaving(true);
    const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    if (error) { toast.error(error.message ?? 'Could not save'); setSaving(false); return; }
    const pm = typeof setupIntent?.payment_method === 'string' ? setupIntent.payment_method : setupIntent?.payment_method?.id;
    try {
      if (pm) await paymentApi.save(pm);
      toast.success(setupIntent?.status === 'processing' ? 'Bank account saved. Verification may take a day or two.' : 'Saved');
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-cream-dark)] p-4">
      <PaymentElement />
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border border-[var(--color-cream-dark)] px-3 py-1.5 text-xs font-semibold">Cancel</button>
        <button onClick={submit} disabled={!stripe || saving} className="btn btn-navy flex items-center gap-1.5 text-xs disabled:opacity-50">
          {saving && <Loader2 size={12} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

// ── Local test mode (PAYMENTS_DRIVER=fake): no Stripe ──────────────────────

function FakeAdd({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [type, setType] = useState<'card' | 'bank'>('card');
  const [last4, setLast4] = useState('4242');
  const save = useMutation({
    mutationFn: () => paymentApi.save(`pm_fake_${type}_${last4}`),
    onSuccess: () => { toast.success('Saved (test mode)'); onDone(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-[var(--color-cream-dark)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-700">Test mode: no Stripe. Ending 0002 declines.</p>
        <button onClick={onCancel}><X size={14} /></button>
      </div>
      <div className="flex gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as 'card' | 'bank')} className="rounded-lg border border-[var(--color-cream-dark)] px-2 py-1.5 text-sm">
          <option value="card">Card</option>
          <option value="bank">Bank account</option>
        </select>
        <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Last 4" className="w-24 rounded-lg border border-[var(--color-cream-dark)] px-2 py-1.5 text-sm" />
        <button onClick={() => save.mutate()} disabled={last4.length !== 4 || save.isPending} className="btn btn-navy text-xs disabled:opacity-50">Save</button>
      </div>
    </div>
  );
}
