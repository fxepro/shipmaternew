'use client';

/**
 * Carrier — Available loads
 *
 * The open market: posted loads with no carrier yet. Each card opens the load, where the carrier
 * reviews the stops and sends an offer. Loads under a contract go straight to the contracted
 * carrier and show up in My Jobs instead.
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, MapPin, ArrowRight, Calendar, Package, Weight, Radio } from 'lucide-react';
import { freightJobApi } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';

function money(cents: number | null | undefined) {
  if (!cents) return null;
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function day(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function LoadCard({ job }: { job: any }) {
  const stops    = [...(job.stops ?? [])].sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const pickups  = stops.filter((s: any) => s.stop_type === 'pickup');
  const dropoffs = stops.filter((s: any) => s.stop_type === 'dropoff');
  const first    = pickups[0];
  const last     = dropoffs[dropoffs.length - 1];
  const budget   = money(job.payment_amount_cents);

  return (
    <Link
      href={`/carrier/my-jobs/${job.id}`}
      className="flex flex-col rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-5 hover:border-[var(--color-teal)] hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--color-text)] line-clamp-2">{job.title || `Load #${job.id}`}</p>
        {budget && <span className="shrink-0 text-sm font-semibold text-[var(--color-teal)]">{budget}</span>}
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-[var(--color-text-muted)]">
        {first && (
          <div className="flex items-center gap-1.5">
            <MapPin size={11} className="shrink-0 text-[var(--color-teal)]" />
            <span className="truncate">{first.city}, {first.state}</span>
            {last && <ArrowRight size={10} className="shrink-0 text-[var(--color-text-faint)]" />}
            {last && <span className="truncate">{last.city}, {last.state}</span>}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Package size={11} className="shrink-0" />
          {pickups.length} pickup{pickups.length !== 1 ? 's' : ''} · {dropoffs.length} drop-off{dropoffs.length !== 1 ? 's' : ''}
          {job.route_distance_miles && <span className="text-[var(--color-text-faint)]">· {parseFloat(job.route_distance_miles).toFixed(0)} mi</span>}
        </div>
        {first?.scheduled_date && (
          <div className="flex items-center gap-1.5">
            <Calendar size={11} className="shrink-0" /> Pickup {day(first.scheduled_date)}
          </div>
        )}
        {job.total_weight_lbs && (
          <div className="flex items-center gap-1.5">
            <Weight size={11} className="shrink-0" /> {Number(job.total_weight_lbs).toLocaleString()} lbs
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-faint)] truncate">{job.shipper?.name ?? ''}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-teal)]">
          <Radio size={11} /> Send offer
        </span>
      </div>
    </Link>
  );
}

export default function CarrierAvailablePage() {
  const { data: res, isLoading } = useQuery({
    queryKey: ['carrier-freight-jobs', 'open_market'],
    queryFn: () => freightJobApi.carrierList({ type: 'open_market' }),
  });
  const jobs: any[] = res?.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Available Loads</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">Loads shippers have posted to the open market. Open one to send an offer.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-48 rounded-2xl bg-[var(--color-cream)] animate-pulse" />)}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={Briefcase} title="No open loads" description="New loads will appear here as shippers post them." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map(job => <LoadCard key={job.id} job={job} />)}
        </div>
      )}
    </div>
  );
}
