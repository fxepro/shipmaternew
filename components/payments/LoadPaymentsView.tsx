'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CircleDollarSign, Clock, Receipt, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { paymentsApi } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { PaymentMethods } from '@/components/payments/PaymentMethods';

export type PaymentsView = 'shipper' | 'carrier' | 'factor' | 'admin';

interface Payment {
  id: number; load: { type: string; id: number; title: string; route: string | null; status: string | null; href: string | null };
  shipper: string | null; carrier: string | null; payee: { type: 'carrier' | 'factor'; name: string | null };
  amount: number; fee: number; fee_rate: number; net: number; early: boolean; flow: string; method: string | null; method_label: string | null;
  pickup_date: string | null; status: string; held_at: string | null; capture_before: string | null; paid_at: string | null;
  failure_reason: string | null; refunded: number; created_at: string;
}
interface Summary {
  paid_cents: number; upcoming_cents: number; held_cents: number; processing_cents: number; attention: number;
  net_paid_cents?: number; load_fees_cents?: number; factored_cents?: number; factored_fees_cents?: number; fees_owed_cents?: number;
  stripe_connected?: boolean; has_payment_method?: boolean; flow?: string; revenue_cents?: number; volume_cents?: number;
}
interface FeeRow { id: number; carrier: string | null; factor: string | null; load: { title: string } | null; load_amount: number; amount: number; rate: number; status: string; failure_reason: string | null; paid_at: string | null; created_at: string }

export const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  scheduled:   { label: 'Scheduled',          cls: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]' },
  held:        { label: 'Card held',          cls: 'bg-blue-50 text-blue-700' },
  hold_failed: { label: 'Not secured',        cls: 'bg-amber-50 text-amber-800' },
  processing:  { label: 'Bank processing',    cls: 'bg-blue-50 text-blue-700' },
  paid:        { label: 'Paid',               cls: 'bg-emerald-50 text-emerald-700' },
  failed:      { label: 'Failed',             cls: 'bg-red-50 text-red-700' },
  canceled:    { label: 'Canceled',           cls: 'bg-[var(--color-cream)] text-[var(--color-text-faint)]' },
  refunded:    { label: 'Refunded',           cls: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]' },
  pending:     { label: 'Pending',            cls: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]' },
};

export const money = (n: number | null | undefined) => (n == null ? '—' : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const cents = (n: number | undefined) => money((n ?? 0) / 100);
// Date-only values (YYYY-MM-DD) are calendar days, not UTC midnight
export const day = (s: string | null | undefined) => (s ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s).toLocaleDateString() : '—');
const th = 'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]';
const td = 'px-4 py-3 align-top';
const btnSm = 'rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50';

export function StatusBadge({ status }: { status: string }) {
  const s = PAYMENT_STATUS[status] ?? { label: status, cls: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]' };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

function errorMessage(e: unknown): string {
  const d = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return d?.error ?? d?.message ?? 'Something went wrong';
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: React.ElementType; label: string; value: string; hint?: string; tone?: 'warn' }) {
  return (
    <div className={`rounded-xl border bg-[var(--color-white)] p-4 ${tone === 'warn' ? 'border-amber-300' : 'border-[var(--color-cream-dark)]'}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-faint)]"><Icon size={14} /> {label}</div>
      <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}

const TITLE: Record<PaymentsView, string> = { shipper: 'Payments', carrier: 'Earnings', factor: 'Payments', admin: 'Payments' };
const INTRO: Record<PaymentsView, string> = {
  shipper: 'Your card is held the day before pickup and charged at delivery (or just before the hold expires). Bank accounts are charged at delivery. Pay early to get the lower carrier fee.',
  carrier: 'Shippers pay you directly into your Stripe account. Shipmater\'s fee comes off each payment. On factored loads the shipper pays your factor, and Shipmater\'s fee is charged to you when the factor funds the load.',
  factor:  'Shipper payments on loads you accepted, paid straight into your Stripe account.',
  admin:   'Every load payment on Shipmater.',
};

/** Load payments as each company sees them (docs/fees-and-billing.md) */
export function LoadPaymentsView({ view }: { view: PaymentsView }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'attention' | 'upcoming' | 'paid'>('all');

  const summary  = useQuery({ queryKey: ['payments-summary'], queryFn: () => paymentsApi.summary().then((r) => r.data.data as Summary) });
  const payments = useQuery({
    queryKey: ['payments', filter],
    queryFn: () => paymentsApi.list(filter === 'all' ? undefined : { status: filter }).then((r) => r.data.data as Payment[]),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['payments-summary'] }); };

  const retry = useMutation({
    mutationFn: (id: number) => paymentsApi.retry(id),
    onSuccess: (r) => { const s = r.data.data.status; s === 'held' || s === 'paid' || s === 'processing' ? toast.success('Payment secured') : toast.error(r.data.data.failure_reason ?? 'Still not secured'); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const payEarly = useMutation({
    mutationFn: (id: number) => paymentsApi.payEarly(id),
    onSuccess: (r) => { const s = r.data.data.status; s === 'paid' || s === 'processing' ? toast.success('Paid early') : toast.error(r.data.data.failure_reason ?? 'Payment failed'); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const s = summary.data;
  const connectHref = view === 'factor' ? '/factor/profile?tab=finance' : '/carrier/profile?tab=financial';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{TITLE[view]}</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">{INTRO[view]}</p>
      </div>

      {(view === 'carrier' || view === 'factor') && s && !s.stripe_connected && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-amber-900">Connect Stripe to get paid</p>
            <p className="text-sm text-amber-800">Shippers can&apos;t pay {view === 'factor' ? 'you for factored loads' : 'your loads'} until your Stripe account is connected.</p>
          </div>
          <Link href={connectHref} className="btn btn-navy flex items-center gap-1.5">Connect Stripe <ArrowRight size={14} /></Link>
        </div>
      )}

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {view === 'shipper' && <>
            <Stat icon={CircleDollarSign} label="Paid" value={cents(s.paid_cents)} />
            <Stat icon={Clock} label="Upcoming" value={cents(s.upcoming_cents)} hint={`${cents(s.held_cents)} held on your card`} />
            <Stat icon={Receipt} label="Bank processing" value={cents(s.processing_cents)} />
            <Stat icon={AlertTriangle} label="Needs attention" value={String(s.attention)} tone={s.attention ? 'warn' : undefined} hint={s.attention ? 'Fix the card, then retry' : undefined} />
          </>}
          {view === 'carrier' && <>
            <Stat icon={Wallet} label="Paid to you" value={cents(s.net_paid_cents)} hint="After Shipmater's fee" />
            <Stat icon={Clock} label="Upcoming" value={cents(s.upcoming_cents)} hint={`${cents(s.held_cents)} secured on shipper cards`} />
            <Stat icon={Receipt} label="Shipmater fees" value={cents((s.load_fees_cents ?? 0) + (s.factored_fees_cents ?? 0))} hint={`${cents(s.factored_fees_cents)} on factored loads`} />
            <Stat icon={AlertTriangle} label="Fees owed" value={cents(s.fees_owed_cents)} tone={s.fees_owed_cents ? 'warn' : undefined} hint={s.fees_owed_cents ? 'Blocks new factoring' : undefined} />
          </>}
          {view === 'factor' && <>
            <Stat icon={Wallet} label="Received" value={cents(s.paid_cents)} />
            <Stat icon={Clock} label="Upcoming" value={cents(s.upcoming_cents)} hint={`${cents(s.held_cents)} secured on shipper cards`} />
            <Stat icon={Receipt} label="Bank processing" value={cents(s.processing_cents)} />
            <Stat icon={AlertTriangle} label="Not secured" value={String(s.attention)} tone={s.attention ? 'warn' : undefined} />
          </>}
          {view === 'admin' && <>
            <Stat icon={CircleDollarSign} label="Payment volume" value={cents(s.volume_cents)} hint={`Routing: ${s.flow === 'platform' ? 'through Shipmater' : 'direct to payee'}`} />
            <Stat icon={Wallet} label="Shipmater revenue" value={cents(s.revenue_cents)} />
            <Stat icon={Clock} label="Upcoming" value={cents(s.upcoming_cents)} hint={`${cents(s.held_cents)} held`} />
            <Stat icon={AlertTriangle} label="Needs attention" value={String(s.attention)} tone={s.attention ? 'warn' : undefined} />
          </>}
        </div>
      )}

      {(view === 'shipper' || view === 'carrier') && <PaymentMethods purpose={view} />}

      <div className="flex flex-wrap gap-1 rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-1.5">
        {([['all', 'All'], ['attention', 'Needs attention'], ['upcoming', 'Upcoming'], ['paid', 'Paid']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${filter === id ? 'bg-[var(--color-slate)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {payments.isLoading ? <div className="skeleton h-48 rounded-xl" /> : !payments.data?.length ? (
        <EmptyState icon={Receipt} title="No payments yet"
          description={view === 'shipper' ? 'A payment appears here when a carrier is assigned to one of your loads.' : view === 'factor' ? 'Payments appear here for loads you accept.' : 'Payments appear here when you are assigned loads.'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]">
                {['Load', view === 'shipper' ? 'Paid to' : view === 'admin' ? 'Shipper → Payee' : 'Shipper', 'Pickup', 'Amount',
                  view === 'shipper' || view === 'factor' ? 'Method' : 'Fee / Net', 'Status', ''].map((h) => <th key={h} className={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {payments.data.map((p) => (
                <tr key={p.id} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                  <td className={td}>
                    {p.load.href ? <Link href={p.load.href} className="font-medium text-[var(--color-teal)] hover:underline">{p.load.title}</Link> : <p className="font-medium">{p.load.title}</p>}
                    <p className="text-xs text-[var(--color-text-faint)]">{[p.load.route, p.early ? 'Paid early' : null].filter(Boolean).join(' · ')}</p>
                  </td>
                  <td className={td}>
                    {view === 'shipper' ? (
                      <><p>{p.payee.name ?? '—'}</p>{p.payee.type === 'factor' && <p className="text-xs text-[var(--color-text-faint)]">Factoring for {p.carrier}</p>}</>
                    ) : view === 'admin' ? (
                      <><p>{p.shipper ?? '—'}</p><p className="text-xs text-[var(--color-text-faint)]">→ {p.payee.name ?? '—'}{p.payee.type === 'factor' ? ' (factor)' : ''}</p></>
                    ) : (
                      <><p>{p.shipper ?? '—'}</p>{view === 'carrier' && p.payee.type === 'factor' && <p className="text-xs text-[var(--color-text-faint)]">Paid to {p.payee.name}</p>}{view === 'factor' && <p className="text-xs text-[var(--color-text-faint)]">Carrier: {p.carrier}</p>}</>
                    )}
                  </td>
                  <td className={td}>{day(p.pickup_date)}</td>
                  <td className={td}>{money(p.amount)}</td>
                  <td className={td}>
                    {view === 'shipper' || view === 'factor' ? (p.method_label ?? <span className="text-[var(--color-text-faint)]">—</span>) : (
                      p.payee.type === 'factor'
                        ? <span className="text-xs text-[var(--color-text-muted)]">Fee charged at funding</span>
                        : <><p>{money(p.fee)} <span className="text-xs text-[var(--color-text-faint)]">({(p.fee_rate * 100).toFixed(1)}%)</span></p><p className="text-xs text-[var(--color-text-muted)]">Net {money(p.net)}</p></>
                    )}
                  </td>
                  <td className={td}>
                    <StatusBadge status={p.status} />
                    {p.status === 'held' && p.capture_before && <p className="mt-1 text-xs text-[var(--color-text-faint)]">Charged by {day(p.capture_before)}</p>}
                    {p.status === 'paid' && p.paid_at && <p className="mt-1 text-xs text-[var(--color-text-faint)]">{day(p.paid_at)}</p>}
                    {p.failure_reason && ['hold_failed', 'failed'].includes(p.status) && <p className="mt-1 max-w-[220px] text-xs text-red-700">{p.failure_reason}</p>}
                  </td>
                  <td className={`${td} text-right`}>
                    {view === 'shipper' && (
                      <div className="flex flex-col items-end gap-1.5">
                        {['hold_failed', 'failed'].includes(p.status) && (
                          <button onClick={() => retry.mutate(p.id)} disabled={retry.isPending} className={`${btnSm} bg-[var(--color-slate)] text-white`}>Retry</button>
                        )}
                        {['scheduled', 'held', 'hold_failed'].includes(p.status) && p.payee.type === 'carrier' && (
                          <button onClick={() => { if (confirm(`Pay ${money(p.amount)} now? The carrier's Shipmater fee drops to the early rate.`)) payEarly.mutate(p.id); }}
                            disabled={payEarly.isPending} className={`${btnSm} border border-[var(--color-cream-dark)]`}>Pay now</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(view === 'carrier' || view === 'admin') && <FactoredFees view={view} />}
    </div>
  );
}

/** Shipmater's fee on factored loads, charged to the carrier when the factor marks the load funded */
function FactoredFees({ view }: { view: 'carrier' | 'admin' }) {
  const qc = useQueryClient();
  const fees = useQuery({ queryKey: ['payments-fees'], queryFn: () => paymentsApi.fees().then((r) => r.data.data as FeeRow[]) });
  const retry = useMutation({
    mutationFn: (id: number) => paymentsApi.retryFee(id),
    onSuccess: (r) => { r.data.data.status === 'paid' || r.data.data.status === 'processing' ? toast.success('Fee paid') : toast.error(r.data.data.failure_reason ?? 'Payment failed'); qc.invalidateQueries({ queryKey: ['payments-fees'] }); qc.invalidateQueries({ queryKey: ['payments-summary'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!fees.data?.length) return null;

  return (
    <section className="card">
      <div className="card-head card-head-tint px-5 py-3"><p className="card-title">Shipmater fees on factored loads</p></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[var(--color-cream-dark)]">{['Load', view === 'admin' ? 'Carrier / Factor' : 'Factor', 'Load amount', 'Fee', 'Status', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {fees.data.map((f) => (
              <tr key={f.id} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                <td className={td}>{f.load?.title ?? '—'}</td>
                <td className={td}>{view === 'admin' ? <>{f.carrier}<p className="text-xs text-[var(--color-text-faint)]">{f.factor}</p></> : f.factor}</td>
                <td className={td}>{money(f.load_amount)}</td>
                <td className={td}>{money(f.amount)} <span className="text-xs text-[var(--color-text-faint)]">({(f.rate * 100).toFixed(1)}%)</span></td>
                <td className={td}>
                  <StatusBadge status={f.status} />
                  {f.paid_at && <p className="mt-1 text-xs text-[var(--color-text-faint)]">{day(f.paid_at)}</p>}
                  {f.failure_reason && f.status === 'failed' && <p className="mt-1 max-w-[220px] text-xs text-red-700">{f.failure_reason}</p>}
                </td>
                <td className={`${td} text-right`}>
                  {view === 'carrier' && f.status === 'failed' && (
                    <button onClick={() => retry.mutate(f.id)} disabled={retry.isPending} className={`${btnSm} bg-[var(--color-slate)] text-white`}>Pay now</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
