'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { subscriptionApi } from '@/lib/api';
import { ProfileSection } from '@/components/shared/ProfileSection';

export interface Tier { key: string; label: string; max_annual_value: number | null; monthly_price: number }
interface Subscription {
  tier: string; tier_label: string; monthly_price: number; stated_annual_value: number;
  status: string; active: boolean; current_period_end: string | null; started_at: string | null; tier_review_at: string | null;
}

const money = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const date  = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—');

function errorMessage(e: unknown): string {
  const d = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return d?.error ?? d?.message ?? 'Something went wrong';
}

/**
 * The shipper's subscription (docs/fees-and-billing.md): priced by the yearly load value they
 * state, billed monthly through Stripe Checkout, required to post loads, re-tiered after 12 months.
 */
export function ShipperSubscription() {
  const qc = useQueryClient();
  const confirmed = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['shipper-subscription'],
    queryFn: () => subscriptionApi.get().then((r) => r.data as { data: Subscription | null; tiers: Tier[] }),
  });

  // Returning from Stripe Checkout
  useEffect(() => {
    if (confirmed.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('checkout') === 'cancelled') toast.info('Checkout cancelled. Your subscription wasn’t started.');
    if (params.get('checkout') === 'success' && sessionId) {
      confirmed.current = true;
      subscriptionApi.confirm(sessionId)
        .then(() => { toast.success('Subscription active. You can post loads now.'); qc.invalidateQueries({ queryKey: ['shipper-subscription'] }); })
        .catch((e) => toast.error(errorMessage(e)));
    }
  }, [qc]);

  const subscribe = useMutation({
    mutationFn: (tier: Tier) => subscriptionApi.subscribe(tier.max_annual_value ?? (data?.tiers.at(-2)?.max_annual_value ?? 0) + 1),
    onSuccess: (res) => { window.location.href = res.data.url; },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: () => subscriptionApi.cancel(),
    onSuccess: () => { toast.success('Your subscription will end at the close of this billing month.'); qc.invalidateQueries({ queryKey: ['shipper-subscription'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading || !data) return <div className="h-64 animate-pulse rounded-2xl bg-[var(--color-cream-dark)]" />;

  const sub   = data.data;
  const tiers = data.tiers;
  const current = sub?.active ? sub : null;
  const choice  = tiers.find((t) => t.key === (selected ?? sub?.tier ?? tiers[0]?.key));

  return (
    <div className="space-y-6">
      {current ? (
        <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-teal)] bg-[var(--color-teal-pale)] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-teal)] text-white"><Zap size={18} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-slate)]">{money(current.monthly_price)} a month — {current.tier_label} in loads a year</p>
            <p className="text-xs text-[var(--color-text-faint)]">Next charge on {date(current.current_period_end)}</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Active</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {sub?.status === 'past_due'
            ? 'Your last subscription payment failed. Update your card in Stripe to keep posting loads.'
            : 'You need an active subscription to post loads. Choose the tier that matches how much freight you expect to move through Shipmater in a year.'}
        </div>
      )}

      {!current && (
        <ProfileSection icon={CalendarDays} title="Choose your tier">
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">
            Pick the yearly load value you expect to move through Shipmater. After 12 months we compare it with what you actually moved and adjust your tier for the next year.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tiers.map((t) => (
              <button key={t.key} type="button" onClick={() => setSelected(t.key)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${choice?.key === t.key ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]' : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]/50'}`}>
                <p className="text-lg font-bold text-[var(--color-slate)]">{money(t.monthly_price)}<span className="text-sm font-normal text-[var(--color-text-faint)]">/mo</span></p>
                <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">{t.label} in loads a year</p>
                {choice?.key === t.key && <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)]"><Check size={11} /> Selected</span>}
              </button>
            ))}
          </div>
          <button onClick={() => choice && subscribe.mutate(choice)} disabled={!choice || subscribe.isPending}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-teal)] py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-teal-dark)] disabled:opacity-60">
            {subscribe.isPending && <Loader2 size={14} className="animate-spin" />}
            Subscribe — {choice ? money(choice.monthly_price) : ''} a month
          </button>
          <p className="mt-2 text-xs text-[var(--color-text-faint)]">You’ll enter your card on Stripe’s secure page. Billed monthly; cancel any time.</p>
        </ProfileSection>
      )}

      {current && (
        <>
          <ProfileSection icon={CalendarDays} title="Billing details">
            <div className="space-y-3">
              {[
                ['Tier', `${current.tier_label} in loads a year`],
                ['Amount', `${money(current.monthly_price)} / month`],
                ['Next charge', date(current.current_period_end)],
                ['Member since', date(current.started_at)],
                ['Tier review', date(current.tier_review_at)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-[var(--color-cream-dark)] py-1 last:border-0">
                  <span className="text-sm text-[var(--color-text-faint)]">{label}</span>
                  <span className="text-sm font-medium text-[var(--color-text)]">{value}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-faint)]">On the tier review date we compare the load value you moved with your tier and adjust it for the next 12 months.</p>
          </ProfileSection>
          <ProfileSection icon={CalendarDays} title="Cancel subscription" headVariant="danger" className="border-red-100 bg-red-50/40"
            subtitle={`Stays active until ${date(current.current_period_end)}. You can’t post new loads after that.`}>
            <button onClick={() => { if (confirm('Cancel your Shipmater subscription at the end of this billing month?')) cancel.mutate(); }} disabled={cancel.isPending}
              className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-60">Cancel subscription</button>
          </ProfileSection>
        </>
      )}
    </div>
  );
}
