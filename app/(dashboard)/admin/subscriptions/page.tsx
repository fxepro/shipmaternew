'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Repeat } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { SubscriptionStatusBadge, SUBSCRIPTION_FILTERS, type SubscriptionRow } from '@/components/admin/SubscriptionBadges';
import { formatCurrency } from '@/lib/utils';

interface Summary {
  shippers: number; active: number; cancelling: number; pending: number; past_due: number;
  canceled: number; not_subscribed: number; mrr: number; collected: number;
}
interface Tier { key: string; label: string; monthly_price: number }

const day = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '—');
const selectCls = 'bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]';

/** Admin Finance > Subscriptions: every shipper company and its subscription, like the Companies list. */
function Subscriptions() {
  const router = useRouter();
  const initial = useSearchParams().get('status') ?? 'all';
  const [status, setStatus] = useState(SUBSCRIPTION_FILTERS.some((f) => f.value === initial) ? initial : 'all');
  const [tier, setTier] = useState('');
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-subscriptions', status, tier],
    queryFn: () => api.get('/api/v1/admin/subscriptions', { params: { status, tier: tier || undefined } }).then((r) => r.data as { data: SubscriptionRow[]; summary: Summary; tiers: Tier[] }),
  });

  const q = search.trim().toLowerCase();
  const rows = (res?.data ?? []).filter((r) => !q || r.company.toLowerCase().includes(q) || r.owner?.name.toLowerCase().includes(q));
  const s = res?.summary;

  const cards: [string, string | number, string][] = s ? [
    ['Monthly recurring', formatCurrency(s.mrr), 'active'],
    ['Active', s.active, 'active'],
    ['Cancelling', s.cancelling, 'cancelling'],
    ['Payment processing', s.pending, 'pending'],
    ['Past due', s.past_due, 'past_due'],
    ['Not subscribed', s.not_subscribed, 'not_subscribed'],
    ['Collected to date', formatCurrency(s.collected), 'all'],
  ] : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Subscriptions</h1>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">
          Shipper companies need an active subscription to post loads. They subscribe on their Subscription tab and pay with a saved card or bank account.
        </p>
      </div>

      {s && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {cards.map(([label, value, filter]) => (
            <button key={label} onClick={() => setStatus(filter)}
              className={`rounded-2xl border bg-[var(--color-white)] px-4 py-3 text-left transition-colors ${status === filter && filter !== 'all' ? 'border-[var(--color-teal)]' : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]/50'}`}>
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-faint)]">{label}</p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-slate)]">{value}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search company or owner…"
          className="w-64 bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={selectCls}>
          {SUBSCRIPTION_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Filter by tier" className={selectCls}>
          <option value="">All tiers</option>
          {(res?.tiers ?? []).map((t) => <option key={t.key} value={t.key}>{t.label} · {formatCurrency(t.monthly_price)}/mo</option>)}
        </select>
        <span className="ml-auto text-sm text-[var(--color-text-muted)]">
          {isLoading ? '' : `${rows.length} compan${rows.length === 1 ? 'y' : 'ies'}`}
        </span>
      </div>

      {isLoading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Repeat} title="No subscriptions match these filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-slate)]">
                {['Company', 'Owner', 'Tier', 'Monthly', 'Status', 'Started', 'Next charge', 'Paid to date', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-sage-light)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.org_id} onClick={() => router.push(`/admin/subscriptions/${r.org_id}`)}
                  className="cursor-pointer border-b border-[var(--color-cream-dark)] last:border-b-0 bg-[var(--color-white)] hover:bg-[var(--color-cream)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">{r.company}</td>
                  <td className="px-4 py-3">
                    <p className="text-[var(--color-text)]">{r.owner?.name ?? '—'}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{r.owner?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{r.tier_label ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{r.monthly_price != null ? formatCurrency(r.monthly_price) : '—'}</td>
                  <td className="px-4 py-3"><SubscriptionStatusBadge status={r.status} cancelling={r.cancel_at_period_end} /></td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{day(r.started_at)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">
                    {r.status === 'active' ? (r.cancel_at_period_end ? `Ends ${day(r.current_period_end)}` : day(r.current_period_end)) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{formatCurrency(r.paid_total)}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-[var(--color-teal)]">View</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminSubscriptionsPage() {
  return (
    <Suspense>
      <Subscriptions />
    </Suspense>
  );
}
