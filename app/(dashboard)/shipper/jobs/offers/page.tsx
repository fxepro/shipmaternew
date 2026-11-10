'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Radio, Search, ArrowUpDown, ArrowUp, ArrowDown,
  DollarSign, Truck, CreditCard, Fuel, CalendarDays,
} from 'lucide-react';
import { freightJobApi } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { OfferDetailPanel } from '@/components/jobs/OfferDetailPanel';
import { VsMarket } from '@/components/rates/MarketRate';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | string | null | undefined) {
  const v = parseFloat(String(n ?? 0)) || 0;
  return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const RATE_LABEL: Record<string, string> = {
  flat:     'Flat',
  per_mile: 'Per mile',
  hourly:   'Hourly',
};

const STATUS_COLOR: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};

type SortKey = 'created_at' | 'amount' | 'carrier_name' | 'status';
type SortDir = 'asc' | 'desc';

const TABS = [
  { label: 'All',      value: ''         },
  { label: 'Pending',  value: 'pending'  },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Declined', value: 'rejected' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShipperOffersPage() {
  const qc = useQueryClient();

  const [tab,     setTab]     = useState<string>('');
  const [search,  setSearch]  = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [active,  setActive]  = useState<any | null>(null);

  // ── Data ─────────────────────────────────────────────────────────────────

  const { data: res, isLoading, isFetching } = useQuery({
    queryKey: ['shipper-all-offers'],
    queryFn:  () => freightJobApi.shipperAllOffers(),
    staleTime: 30_000,
  });

  const allOffers: any[] = res?.data?.data ?? [];

  // ── Counts for tab badges ─────────────────────────────────────────────────

  const counts = useMemo(() => {
    const c: Record<string, number> = { '': allOffers.length, pending: 0, accepted: 0, rejected: 0 };
    for (const o of allOffers) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [allOffers]);

  // ── Filter + sort ─────────────────────────────────────────────────────────

  const visible = useMemo(() => {
    let rows = allOffers;

    if (tab)    rows = rows.filter(o => o.status === tab);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(o =>
        (o.carrier_name ?? '').toLowerCase().includes(q) ||
        (o.job?.title   ?? '').toLowerCase().includes(q)
      );
    }

    rows = [...rows].sort((a, b) => {
      let av: string | number = a[sortKey] ?? '';
      let bv: string | number = b[sortKey] ?? '';
      if (sortKey === 'amount') { av = parseFloat(String(av)); bv = parseFloat(String(bv)); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });

    return rows;
  }, [allOffers, tab, search, sortKey, sortDir]);

  // ── Sort toggle ────────────────────────────────────────────────────────────

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="text-[var(--color-teal)]" />
      : <ArrowDown size={12} className="text-[var(--color-teal)]" />;
  }

  function SortTh({ col, children, className = '' }: { col: SortKey; children: React.ReactNode; className?: string }) {
    return (
      <th
        onClick={() => toggleSort(col)}
        className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)] hover:text-[var(--color-teal)] ${className}`}>
        <span className="flex items-center gap-1.5">{children}<SortIcon col={col} /></span>
      </th>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {active && (
        <OfferDetailPanel
          offer={active}
          onClose={() => setActive(null)}
          onUpdated={() => {
            qc.invalidateQueries({ queryKey: ['shipper-all-offers'] });
            qc.invalidateQueries({ queryKey: ['shipper-jobs'] });
          }}
        />
      )}

      <div className="space-y-6">

        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">
              Carrier Offers
            </h1>
            <p className="text-sm text-[var(--color-text-faint)] mt-0.5">
              All offers on your Marketplace loads
            </p>
          </div>
          {isFetching && !isLoading && (
            <span className="text-xs text-[var(--color-text-faint)] animate-pulse">Refreshing…</span>
          )}
        </div>

        {/* Toolbar: tabs + search */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Status tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-[var(--color-cream)] p-1 border border-[var(--color-cream-dark)]">
            {TABS.map(t => (
              <button key={t.value} onClick={() => setTab(t.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.value
                    ? 'bg-white text-[var(--color-teal)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}>
                {t.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === t.value ? 'bg-[var(--color-teal-pale)] text-[var(--color-teal)]' : 'bg-[var(--color-cream-dark)] text-[var(--color-text-faint)]'
                }`}>
                  {counts[t.value] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            <input
              type="text"
              placeholder="Search carrier or job…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] py-2 pl-8 pr-3.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20"
            />
          </div>

        </div>

        {/* Table */}
        {isLoading ? (
          <div className="rounded-2xl border border-[var(--color-cream-dark)] overflow-hidden">
            <div className="h-10 bg-[var(--color-cream)] border-b border-[var(--color-cream-dark)]" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-[var(--color-cream-dark)] last:border-0 animate-pulse">
                <div className="h-4 w-40 rounded bg-[var(--color-cream-dark)]" />
                <div className="h-4 w-28 rounded bg-[var(--color-cream-dark)]" />
                <div className="h-4 w-16 rounded bg-[var(--color-cream-dark)]" />
                <div className="h-4 w-20 rounded bg-[var(--color-cream-dark)]" />
                <div className="h-4 w-16 rounded bg-[var(--color-cream-dark)] ml-auto" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Radio}
            title={search ? 'No matching offers' : 'No offers yet'}
            description={
              search
                ? 'Try a different search term.'
                : 'When carriers submit offers on your open-market jobs, they will appear here.'
            }
          />
        ) : (
          <div className="rounded-2xl border border-[var(--color-cream-dark)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]">
                  <tr>
                    <SortTh col="carrier_name">Carrier</SortTh>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">
                      Job
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">
                      <span className="flex items-center gap-1.5">
                        <DollarSign size={11} /> Rate type
                      </span>
                    </th>
                    <SortTh col="amount">
                      <DollarSign size={11} />Amount
                    </SortTh>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">
                      <span className="flex items-center gap-1.5">
                        <Fuel size={11} /> Fuel
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">
                      <span className="flex items-center gap-1.5">
                        <Truck size={11} /> Equipment
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">
                      <span className="flex items-center gap-1.5">
                        <CreditCard size={11} /> Payment
                      </span>
                    </th>
                    <SortTh col="status">Status</SortTh>
                    <SortTh col="created_at">
                      <CalendarDays size={11} />Date
                    </SortTh>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((offer, idx) => (
                    <tr
                      key={offer.id}
                      onClick={() => setActive(offer)}
                      className={`cursor-pointer transition-colors hover:bg-[var(--color-cream)] ${
                        idx !== visible.length - 1 ? 'border-b border-[var(--color-cream-dark)]' : ''
                      }`}
                    >
                      {/* Carrier */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-teal)] text-[10px] font-bold text-white">
                            {(offer.carrier_name || 'C').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-[var(--color-text)]">
                            {offer.carrier_name || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Job */}
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <p className="truncate text-sm font-medium text-[var(--color-text)]">
                          {offer.job?.title ?? `Job #${offer.freight_job_id}`}
                        </p>
                        {offer.job?.route_distance_miles && (
                          <p className="text-[11px] text-[var(--color-text-faint)]">
                            {parseFloat(offer.job.route_distance_miles).toFixed(0)} mi
                            {offer.job.stops_count > 0 && ` · ${offer.job.stops_count} stops`}
                          </p>
                        )}
                      </td>

                      {/* Rate type */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center rounded-lg bg-[var(--color-teal-pale)] px-2 py-0.5 text-xs font-semibold text-[var(--color-teal)]">
                          {RATE_LABEL[offer.rate_type] ?? offer.rate_type}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 text-sm font-bold text-[var(--color-text)]">
                        {fmt(offer.amount)}
                        <p><VsMarket offerCents={Math.round((parseFloat(String(offer.amount)) || 0) * 100)} market={offer.job?.market_rate} /></p>
                        {(offer.rate_type === 'per_mile' || offer.rate_type === 'hourly') && offer.rate_value && (
                          <p className="text-[11px] font-normal text-[var(--color-text-faint)]">
                            {fmt(offer.rate_value)}/{offer.rate_type === 'per_mile' ? 'mi' : 'hr'}
                          </p>
                        )}
                      </td>

                      {/* Fuel surcharge */}
                      <td className="px-4 py-3.5 text-sm text-[var(--color-text-muted)]">
                        {offer.fuel_surcharge != null ? fmt(offer.fuel_surcharge) : <span className="text-[var(--color-text-faint)]">—</span>}
                      </td>

                      {/* Equipment */}
                      <td className="px-4 py-3.5 text-sm text-[var(--color-text-muted)]">
                        {offer.equipment_type || <span className="text-[var(--color-text-faint)]">—</span>}
                      </td>

                      {/* Payment terms */}
                      <td className="px-4 py-3.5 text-sm text-[var(--color-text-muted)]">
                        {offer.payment_terms || <span className="text-[var(--color-text-faint)]">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_COLOR[offer.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {offer.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-xs text-[var(--color-text-faint)] whitespace-nowrap">
                        {fmtDate(offer.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer row count */}
            <div className="border-t border-[var(--color-cream-dark)] bg-[var(--color-cream)] px-4 py-2.5">
              <p className="text-xs text-[var(--color-text-faint)]">
                {visible.length} offer{visible.length !== 1 ? 's' : ''}
                {search && ` matching "${search}"`}
              </p>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
