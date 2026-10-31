'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CreditCard, Link2Off, Receipt } from 'lucide-react';
import { adminFinanceApi } from '@/lib/api';
import { money, day, StatusBadge } from '@/components/payments/LoadPaymentsView';

interface Receivables {
  payments: { id: number; status: string; load: string; shipper: string | null; payee: string | null; amount: number; pickup_date: string | null; reason: string | null; since: string | null }[];
  not_connected: { company: string | null; type: string; loads: number; amount: number }[];
  fees: { id: number; carrier: string | null; factor: string | null; amount: number; reason: string | null; since: string | null }[];
  subscriptions: { id: number; company: string | null; tier: string; monthly_price: number; period_end: string | null }[];
  totals: { payments_cents: number; fees_cents: number; subscriptions: number; not_connected: number };
}

const th = 'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]';
const td = 'px-4 py-3 align-top';

/** Money that is owed or stuck. Oversight only: the carrier, shipper and factor fix these themselves. */
export default function AdminReceivablesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-receivables'], queryFn: () => adminFinanceApi.receivables().then((r) => r.data.data as Receivables) });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Receivables</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">Payments that are not secured or failed, Shipmater fees carriers owe, past-due subscriptions, and companies that can&apos;t be paid until they connect Stripe. Each party is alerted and fixes it themselves.</p>
      </div>

      {isLoading || !data ? <div className="skeleton h-64 rounded-xl" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile icon={AlertTriangle} label="Load payments at risk" value={money(data.totals.payments_cents / 100)} hint={`${data.payments.length} loads`} />
            <Tile icon={Receipt} label="Fees owed by carriers" value={money(data.totals.fees_cents / 100)} hint={`${data.fees.length} factored loads`} />
            <Tile icon={CreditCard} label="Past-due subscriptions" value={String(data.totals.subscriptions)} />
            <Tile icon={Link2Off} label="Loads waiting on Stripe" value={String(data.totals.not_connected)} hint="Payee not connected" />
          </div>

          <Section title="Load payments not secured or failed" empty="Nothing at risk." rows={data.payments.length}>
            <thead><tr className="border-b border-[var(--color-cream-dark)]">{['Load', 'Shipper → Payee', 'Pickup', 'Amount', 'Status', 'Reason'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                  <td className={td}>{p.load}</td>
                  <td className={td}>{p.shipper ?? '—'}<p className="text-xs text-[var(--color-text-faint)]">→ {p.payee ?? '—'}</p></td>
                  <td className={td}>{day(p.pickup_date)}</td>
                  <td className={td}>{money(p.amount)}</td>
                  <td className={td}><StatusBadge status={p.status} /><p className="mt-1 text-xs text-[var(--color-text-faint)]">since {day(p.since)}</p></td>
                  <td className={`${td} max-w-[280px] text-xs text-red-700`}>{p.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </Section>

          <Section title="Can't be paid until Stripe is connected" empty="Every payee with upcoming loads is connected." rows={data.not_connected.length}>
            <thead><tr className="border-b border-[var(--color-cream-dark)]">{['Company', 'Type', 'Loads', 'Amount'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.not_connected.map((n, i) => (
                <tr key={i} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                  <td className={td}>{n.company ?? '—'}</td><td className={`${td} capitalize`}>{n.type}</td><td className={td}>{n.loads}</td><td className={td}>{money(n.amount)}</td>
                </tr>
              ))}
            </tbody>
          </Section>

          <Section title="Shipmater fees owed on factored loads" empty="No unpaid fees." rows={data.fees.length}>
            <thead><tr className="border-b border-[var(--color-cream-dark)]">{['Carrier', 'Factor', 'Fee', 'Reason', 'Since'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.fees.map((f) => (
                <tr key={f.id} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                  <td className={td}>{f.carrier ?? '—'}</td><td className={td}>{f.factor ?? '—'}</td><td className={td}>{money(f.amount)}</td>
                  <td className={`${td} text-xs text-red-700`}>{f.reason ?? '—'}</td><td className={td}>{day(f.since)}</td>
                </tr>
              ))}
            </tbody>
          </Section>

          <Section title="Past-due shipper subscriptions" empty="No past-due subscriptions." rows={data.subscriptions.length}>
            <thead><tr className="border-b border-[var(--color-cream-dark)]">{['Company', 'Tier', 'Monthly', 'Period ended'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                  <td className={td}>{s.company ?? '—'}</td><td className={`${td} capitalize`}>{s.tier}</td><td className={td}>{money(s.monthly_price)}</td><td className={td}>{day(s.period_end)}</td>
                </tr>
              ))}
            </tbody>
          </Section>
        </>
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-faint)]"><Icon size={14} /> {label}</div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}

function Section({ title, empty, rows, children }: { title: string; empty: string; rows: number; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head card-head-tint px-5 py-3"><p className="card-title">{title}</p></div>
      {rows === 0 ? <p className="card-body text-sm text-[var(--color-text-faint)]">{empty}</p> : <div className="overflow-x-auto"><table className="w-full text-sm">{children}</table></div>}
    </section>
  );
}
