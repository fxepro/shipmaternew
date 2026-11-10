'use client';

/**
 * Carrier — My Offers
 *
 * Groups all the carrier's offers by job.
 * Each job is shown as a header card; below it are all offers the carrier
 * has ever submitted on that job (pending, withdrawn, accepted, declined).
 *
 * Filtering by status hides job groups that have no offers matching the tab.
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Radio, Route, MapPin, ChevronRight, Loader2,
  DollarSign, Clock, Fuel, Truck, CreditCard, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { freightJobApi } from '@/lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | string | null | undefined) {
  const v = parseFloat(String(n ?? 0)) || 0;
  return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CLS: Record<string, string> = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  accepted:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:  'bg-red-50 text-red-600 border-red-200',
  withdrawn: 'bg-[var(--color-cream)] text-[var(--color-text-faint)] border-[var(--color-cream-dark)]',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', accepted: 'Accepted', rejected: 'Declined', withdrawn: 'Withdrawn',
};
const RATE_LABEL: Record<string, string> = {
  flat: 'Flat rate', per_mile: 'Per mile', hourly: 'Hourly',
};

type Filter = 'all' | 'pending' | 'accepted' | 'rejected' | 'withdrawn';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'accepted',  label: 'Accepted'  },
  { key: 'rejected',  label: 'Declined'  },
  { key: 'withdrawn', label: 'Withdrawn' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function CarrierOffersPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const qc = useQueryClient();

  const { data: res, isLoading } = useQuery({
    queryKey: ['carrier-my-offers'],
    queryFn:  () => freightJobApi.carrierMyOffers(),
    staleTime: 30_000,
  });

  const withdrawMutation = useMutation({
    mutationFn: ({ jobId, offerId }: { jobId: number; offerId: number }) =>
      freightJobApi.withdrawOffer(jobId, offerId),
    onSuccess: () => {
      toast.success('Offer withdrawn.');
      qc.invalidateQueries({ queryKey: ['carrier-my-offers'] });
    },
    onError: () => toast.error('Failed to withdraw offer.'),
  });

  const allOffers: any[] = res?.data?.data ?? [];

  // ── Counts for tabs ───────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allOffers.length };
    for (const o of allOffers) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [allOffers]);

  // ── Group offers by job ───────────────────────────────────────────────────

  type JobGroup = {
    jobId:     number;
    job:       any;
    offers:    any[];
  };

  const jobGroups: JobGroup[] = useMemo(() => {
    // Apply status filter first
    const filtered = filter === 'all' ? allOffers : allOffers.filter(o => o.status === filter);

    // Group by freight_job_id preserving insertion order (already desc by created_at from API)
    const map = new Map<number, JobGroup>();
    for (const offer of filtered) {
      const jid = offer.freight_job_id;
      if (!map.has(jid)) map.set(jid, { jobId: jid, job: offer.job, offers: [] });
      map.get(jid)!.offers.push(offer);
    }
    return Array.from(map.values());
  }, [allOffers, filter]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="page-title">
          My Offers
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">
          Your offers on Marketplace loads, grouped by load
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 flex-wrap rounded-xl bg-[var(--color-cream)] p-1 border border-[var(--color-cream-dark)] w-fit">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.key
                ? 'bg-white text-[var(--color-teal)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}>
            {f.label}
            {(counts[f.key] ?? 0) > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                filter === f.key
                  ? 'bg-[var(--color-teal-pale)] text-[var(--color-teal)]'
                  : 'bg-[var(--color-cream-dark)] text-[var(--color-text-faint)]'
              }`}>
                {counts[f.key] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-[var(--color-cream-dark)] overflow-hidden animate-pulse">
              <div className="h-20 bg-[var(--color-cream)]" />
              <div className="h-16 bg-white" />
            </div>
          ))}
        </div>

      ) : jobGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-cream-dark)] py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-cream)] mb-3">
            <Radio size={22} className="text-[var(--color-text-faint)]" />
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-muted)]">No offers</p>
          <p className="mt-1 text-xs text-[var(--color-text-faint)]">
            {filter === 'all'
              ? 'Browse the Marketplace and make your first offer.'
              : `No ${STATUS_LABEL[filter as keyof typeof STATUS_LABEL]?.toLowerCase() ?? filter} offers.`}
          </p>
          {filter === 'all' && (
            <Link href="/carrier/my-jobs"
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-[var(--color-teal)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] transition-colors">
              Browse open jobs <ChevronRight size={14} />
            </Link>
          )}
        </div>

      ) : (
        <div className="space-y-5">
          {jobGroups.map(({ jobId, job, offers }) => (
            <div key={jobId}
              className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">

              {/* ── Job header ──────────────────────────────────────── */}
              <div className="flex items-start justify-between gap-4 px-5 py-4 bg-[var(--color-cream)] border-b border-[var(--color-cream-dark)]">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--color-text)] truncate">
                    {job?.title || `Load #${jobId}`}
                  </p>
                  <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-[var(--color-text-faint)]">
                    {job?.route_distance_miles && (
                      <span className="flex items-center gap-1">
                        <Route size={11} className="text-[var(--color-teal)]" />
                        {parseFloat(job.route_distance_miles).toFixed(0)} mi
                      </span>
                    )}
                    {job?.stops_count > 0 && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} />
                        {job.stops_count} stop{job.stops_count !== 1 ? 's' : ''}
                      </span>
                    )}
                    {job?.shipper_name && (
                      <span className="text-[var(--color-text-faint)]">· {job.shipper_name}</span>
                    )}
                  </div>
                </div>

                <Link href={`/carrier/my-jobs/${jobId}`}
                  className="shrink-0 flex items-center gap-1 rounded-lg border border-[var(--color-cream-dark)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-teal)] hover:border-[var(--color-teal)] transition-colors">
                  View job <ChevronRight size={11} />
                </Link>
              </div>

              {/* ── Offers list ──────────────────────────────────────── */}
              <div className="divide-y divide-[var(--color-cream-dark)]">
                {offers.map((offer: any) => {
                  const isPerMile = offer.rate_type === 'per_mile';
                  const isHourly  = offer.rate_type === 'hourly';

                  return (
                    <div key={offer.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">

                        {/* Left — rate + terms */}
                        <div className="flex-1 min-w-0 space-y-2">

                          {/* Rate row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-teal-pale)] px-2.5 py-1 text-xs font-semibold text-[var(--color-teal)]">
                              <DollarSign size={10} />
                              {RATE_LABEL[offer.rate_type] ?? offer.rate_type}
                            </span>
                            <span className="text-lg font-bold text-[var(--color-slate)] tabular-nums">
                              {fmt(offer.amount)}
                            </span>
                            {(isPerMile || isHourly) && offer.rate_value && (
                              <span className="text-xs text-[var(--color-text-faint)]">
                                ({fmt(offer.rate_value)}/{isPerMile ? 'mi' : 'hr'})
                              </span>
                            )}
                          </div>

                          {/* Extra terms */}
                          {(offer.fuel_surcharge != null || offer.detention_rate != null ||
                            offer.equipment_type || offer.payment_terms) && (
                            <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--color-text-faint)]">
                              {offer.fuel_surcharge != null && (
                                <span className="flex items-center gap-1">
                                  <Fuel size={10} /> Fuel {fmt(offer.fuel_surcharge)}
                                </span>
                              )}
                              {offer.detention_rate != null && (
                                <span className="flex items-center gap-1">
                                  <Clock size={10} /> Detention {fmt(offer.detention_rate)}/hr
                                  {offer.free_time_hrs != null && ` · ${offer.free_time_hrs}h free`}
                                </span>
                              )}
                              {offer.equipment_type && (
                                <span className="flex items-center gap-1">
                                  <Truck size={10} /> {offer.equipment_type}
                                </span>
                              )}
                              {offer.payment_terms && (
                                <span className="flex items-center gap-1">
                                  <CreditCard size={10} /> {offer.payment_terms}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Note */}
                          {offer.note && (
                            <p className="flex items-start gap-1.5 text-xs text-[var(--color-text-muted)] italic">
                              <MessageSquare size={10} className="shrink-0 mt-0.5" />
                              &ldquo;{offer.note}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Right — status + actions */}
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLS[offer.status] ?? STATUS_CLS.withdrawn}`}>
                            {STATUS_LABEL[offer.status] ?? offer.status}
                          </span>
                          <p className="text-[11px] text-[var(--color-text-faint)]">
                            {fmtDate(offer.created_at)}
                          </p>
                          {offer.status === 'pending' && (
                            <button
                              onClick={() => withdrawMutation.mutate({ jobId: offer.freight_job_id, offerId: offer.id })}
                              disabled={withdrawMutation.isPending}
                              className="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-faint)] hover:text-red-500 transition-colors disabled:opacity-50">
                              {withdrawMutation.isPending
                                ? <Loader2 size={10} className="animate-spin" />
                                : null}
                              Withdraw
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}
