'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Truck, Package, FileText, MapPin, ArrowRight,
  Clock, CheckCircle2, Navigation2, Globe,
} from 'lucide-react';
import { freightJobApi } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { useCurrentUser } from '@/components/layout/PermissionsContext';

// ── Types ──────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'booked' | 'in_progress' | 'completed';

// ── Status / badge helpers ─────────────────────────────────────────────────────

function jobStatusLabel(job: any): string {
  if (job.status === 'posted') return job.carrier_id ? 'Booked' : 'Posted';
  if (job.status === 'in_progress') return 'In transit';
  if (job.status === 'completed')   return 'Delivered';
  if (job.status === 'draft')       return 'Draft';
  return job.status;
}

function jobStatusCls(job: any): string {
  if (job.status === 'posted' && !job.carrier_id)  return 'bg-[var(--color-teal-pale)] text-[var(--color-teal)]';
  if (job.status === 'posted' && job.carrier_id)   return 'bg-blue-50 text-blue-700';
  if (job.status === 'in_progress')                return 'bg-amber-50 text-amber-700';
  if (job.status === 'completed')                  return 'bg-emerald-50 text-emerald-700';
  return 'bg-[var(--color-cream)] text-[var(--color-text-muted)]';
}

function StatusIcon({ job }: { job: any }) {
  if (job.status === 'posted' && !job.carrier_id)  return <Globe       size={10} />;
  if (job.status === 'posted' && job.carrier_id)   return <Truck       size={10} />;
  if (job.status === 'in_progress')                return <Navigation2 size={10} />;
  if (job.status === 'completed')                  return <CheckCircle2 size={10} />;
  return <Clock size={10} />;
}

// ── Job Card ──────────────────────────────────────────────────────────────────

function JobCard({ job }: { job: any }) {
  // Won on the Marketplace, or tendered under a contract
  const isOpen      = !job.contract_id;
  const stops       = job.stops ?? [];
  const pickup      = stops.find((s: any) => s.stop_type === 'pickup');
  const dropoff     = stops.find((s: any) => s.stop_type === 'dropoff');
  const stopCount   = stops.length;

  return (
    <Link
      href={`/carrier/my-jobs/${job.id}`}
      className="block rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-5 py-4 hover:border-[var(--color-teal)] hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">

        {/* Left — info */}
        <div className="min-w-0 flex-1 space-y-2">

          {/* Title + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[var(--color-text)] truncate">
              {job.title || `Load #${job.id}`}
            </p>

            {/* Type badge */}
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isOpen
                ? 'bg-[var(--color-teal-pale)] text-[var(--color-teal)]'
                : 'bg-purple-50 text-purple-700'
            }`}>
              {isOpen ? <Globe size={9} /> : <FileText size={9} />}
              {isOpen ? 'Marketplace' : 'Contract freight'}
            </span>

            {/* Status badge */}
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${jobStatusCls(job)}`}>
              <StatusIcon job={job} />
              {jobStatusLabel(job)}
            </span>
          </div>

          {/* Route summary */}
          {(pickup || dropoff) && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <MapPin size={11} className="shrink-0 text-[var(--color-teal)]" />
              {pickup && <span>{pickup.city}, {pickup.state}</span>}
              {pickup && dropoff && <ArrowRight size={10} className="shrink-0 text-[var(--color-text-faint)]" />}
              {dropoff && <span>{dropoff.city}, {dropoff.state}</span>}
              <span className="text-[var(--color-text-faint)]">· {stopCount} stop{stopCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Ref + shipper */}
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-faint)]">
            {job.reference_number && (
              <span className="font-mono">{job.reference_number}</span>
            )}
            {job.shipper?.name && (
              <span className="flex items-center gap-1">
                <Package size={10} /> {job.shipper.name}
              </span>
            )}
            {job.route_distance_miles && (
              <span>{parseFloat(job.route_distance_miles).toFixed(0)} mi</span>
            )}
          </div>
        </div>

        {/* Right — chevron */}
        <ArrowRight size={15} className="shrink-0 mt-1 text-[var(--color-text-faint)]" />
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',          label: 'All'        },
  { key: 'booked',       label: 'Booked'     },
  { key: 'in_progress',  label: 'In transit' },
  { key: 'completed',    label: 'Delivered'  },
];

export default function CarrierMyJobsPage() {
  const [tab, setTab] = useState<FilterTab>('all');
  // A driver sees the loads they are on as their trips
  const driver = useCurrentUser()?.org_role === 'driver';

  const { data: res, isLoading } = useQuery({
    queryKey: ['carrier-freight-jobs', tab],
    // Only loads this carrier is booked on; open loads are on the Marketplace
    queryFn: () => freightJobApi.carrierList(
      tab === 'all'    ? { type: 'assigned' } :
      tab === 'booked' ? { type: 'assigned', status: 'posted' } :
                         { type: 'assigned', status: tab }
    ),
  });

  const jobs: any[] = res?.data?.data ?? [];

  const tabCls = (k: FilterTab) =>
    k === tab
      ? 'bg-[var(--color-teal)] text-white'
      : 'bg-[var(--color-cream)] text-[var(--color-text-muted)] hover:bg-[var(--color-cream-dark)] border border-[var(--color-cream-dark)]';

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">
            {driver ? 'Trips' : 'Loads'}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">
            Loads you are booked on, from Marketplace offers and contract freight
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${tabCls(t.key)}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-[88px] rounded-2xl bg-[var(--color-cream)] animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={
            tab === 'booked'      ? 'No booked loads' :
            tab === 'in_progress' ? 'No loads in transit' :
            tab === 'completed'   ? 'No delivered loads' :
                                    'No loads yet'
          }
          description={
            tab === 'all'
              ? 'Loads you win on the Marketplace and contract freight tendered to you will appear here.'
              : 'Loads will appear here once they are active.'
          }
        />
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
