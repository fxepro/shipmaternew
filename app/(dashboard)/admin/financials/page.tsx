'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, Download, TrendingUp, Wallet } from 'lucide-react';
import { adminFinanceApi } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { money, day } from '@/components/payments/LoadPaymentsView';

interface Ledger {
  from: string; to: string; revenue: number; volume: number;
  totals: Record<string, { amount: number; volume: number; count: number }>;
  months: { month: string; revenue: number; volume: number; by_kind: Record<string, number> }[];
  entries: { id: number; kind: string; amount: number; volume: number; company: string | null; description: string | null; reference: string | null; occurred_at: string }[];
}

const KINDS: Record<string, string> = {
  load_fee: 'Load fees', factored_fee: 'Factored-load fees', subscription: 'Shipper subscriptions', onboarding: 'Carrier onboarding',
  refund: 'Refunds', load_volume: 'Factored volume (no fee)',
};
const th = 'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]';
const td = 'px-4 py-3';

/** Shipmater's revenue by month and source, with the load volume it came from (docs/fees-and-billing.md) */
export default function AdminLedgerPage() {
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [kind, setKind] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ledger', from, to, kind],
    queryFn: () => adminFinanceApi.ledger({ from, to, ...(kind && { kind }) }).then((r) => r.data.data as Ledger),
  });

  const maxRevenue = Math.max(1, ...(data?.months ?? []).map((m) => m.revenue));

  function exportCsv() {
    if (!data) return;
    const rows = [['Date', 'Kind', 'Company', 'Description', 'Revenue', 'Volume', 'Reference'],
      ...data.entries.map((e) => [e.occurred_at.slice(0, 10), KINDS[e.kind] ?? e.kind, e.company ?? '', e.description ?? '', e.amount.toFixed(2), e.volume.toFixed(2), e.reference ?? ''])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `shipmater-ledger-${from}-to-${to}.csv`;
    a.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Ledger</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Everything Shipmater earns: load fees, factored-load fees, subscriptions and onboarding, with the load volume behind it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[var(--color-cream-dark)] px-2 py-1.5 text-sm" />
          <span className="text-xs text-[var(--color-text-faint)]">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[var(--color-cream-dark)] px-2 py-1.5 text-sm" />
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-[var(--color-cream-dark)] px-2 py-1.5 text-sm">
            <option value="">All sources</option>
            {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={exportCsv} disabled={!data?.entries.length} className="btn btn-navy flex items-center gap-1.5 text-xs disabled:opacity-50"><Download size={13} /> CSV</button>
        </div>
      </div>

      {isLoading || !data ? <div className="skeleton h-64 rounded-xl" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card icon={Wallet} label="Shipmater revenue" value={money(data.revenue)} />
            <Card icon={CircleDollarSign} label="Load volume" value={money(data.volume)} hint="All load payments processed" />
            <Card icon={TrendingUp} label="Take rate" value={data.volume ? `${((data.revenue / data.volume) * 100).toFixed(1)}%` : '—'} hint="Revenue ÷ volume" />
            <Card icon={Wallet} label="Subscriptions" value={money(data.totals.subscription?.amount ?? 0)} hint={`${data.totals.subscription?.count ?? 0} invoices`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card">
              <div className="card-head card-head-tint px-5 py-3"><p className="card-title">By source</p></div>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(KINDS).map(([k, label]) => (
                    <tr key={k} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                      <td className={td}>{label}</td>
                      <td className={`${td} text-right text-xs text-[var(--color-text-faint)]`}>{data.totals[k]?.count ?? 0}</td>
                      <td className={`${td} text-right font-medium`}>{money(data.totals[k]?.amount ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card">
              <div className="card-head card-head-tint px-5 py-3"><p className="card-title">By month</p></div>
              <div className="card-body space-y-2">
                {data.months.length === 0 && <p className="text-sm text-[var(--color-text-faint)]">No revenue in this period.</p>}
                {data.months.map((m) => (
                  <div key={m.month} className="grid grid-cols-[64px_1fr_96px] items-center gap-3 text-sm">
                    <span className="text-[var(--color-text-muted)]">{m.month}</span>
                    <div className="h-2.5 rounded-full bg-[var(--color-cream)]"><div className="h-2.5 rounded-full bg-[var(--color-teal)]" style={{ width: `${(m.revenue / maxRevenue) * 100}%` }} /></div>
                    <span className="text-right font-medium">{money(m.revenue)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {data.entries.length === 0 ? <EmptyState icon={Wallet} title="No ledger entries" description="Entries appear as loads are paid, fees collected and subscriptions billed." /> : (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]">{['Date', 'Source', 'Company', 'Description', 'Revenue', 'Volume'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                      <td className={td}>{day(e.occurred_at)}</td>
                      <td className={td}>{KINDS[e.kind] ?? e.kind}</td>
                      <td className={td}>{e.company ?? '—'}</td>
                      <td className={`${td} text-[var(--color-text-muted)]`}>{e.description ?? '—'}</td>
                      <td className={`${td} font-medium ${e.amount < 0 ? 'text-red-700' : ''}`}>{money(e.amount)}</td>
                      <td className={`${td} text-[var(--color-text-muted)]`}>{e.volume ? money(e.volume) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-faint)]"><Icon size={14} /> {label}</div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}
