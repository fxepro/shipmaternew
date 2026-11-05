'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList, Plus, ArrowRight, Route, Package,
  CheckCircle2, Clock, Truck, AlertCircle, Users,
} from 'lucide-react';
import Link from 'next/link';
import { freightJobApi } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { useCan } from '@/components/layout/PermissionsContext';

type Status = 'all' | 'draft' | 'posted' | 'in_progress' | 'completed';

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  draft:       { label: 'Draft',       cls: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]', icon: Clock        },
  posted:      { label: 'Live',        cls: 'bg-blue-50 text-blue-700',                               icon: Truck        },
  in_progress: { label: 'In Progress', cls: 'bg-amber-50 text-amber-700',                             icon: Route        },
  completed:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700',                         icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-50 text-red-600',                                 icon: AlertCircle  },
  disputed:    { label: 'Disputed',    cls: 'bg-red-50 text-red-600',                                 icon: AlertCircle  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['draft'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

const FILTERS: { key: Status; label: string }[] = [
  { key: 'all',         label: 'All'         },
  { key: 'draft',       label: 'Draft'       },
  { key: 'posted',      label: 'Live'        },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed',   label: 'Completed'   },
];

export default function MyJobsPage() {
  const can = useCan();
  const [filter, setFilter] = useState<Status>('all');

  const { data: res, isLoading } = useQuery({
    queryKey: ['shipper-open-jobs', filter],
    queryFn:  () => freightJobApi.shipperList({ type: 'open', ...(filter !== 'all' && { status: filter }) }),
  });

  const jobs: any[] = res?.data?.data ?? [];

  const counts = {
    all:         jobs.length,
    draft:       jobs.filter(j => j.status === 'draft').length,
    posted:      jobs.filter(j => j.status === 'posted').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    completed:   jobs.filter(j => j.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">
            My Jobs
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">
            Open-market jobs — carriers bid, you choose
          </p>
        </div>
        {can.do('loads.post') && <Link
          href="/shipper/jobs/contracted/new"
          className="flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] shadow-sm transition-colors"
        >
          <Plus size={15} /> New job
        </Link>}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-1 w-fit">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === key
                ? 'bg-[var(--color-slate)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 text-[10px] font-bold ${
                filter === key ? 'bg-white/20' : 'bg-[var(--color-cream)] text-[var(--color-text-faint)]'
              }`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-[var(--color-cream)] animate-pulse" />)}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={filter === 'all' ? 'No open jobs yet' : `No ${filter === 'posted' ? 'live' : filter} jobs`}
          description={filter === 'all' ? 'Post your first open-market job to receive carrier bids.' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {jobs.map(job => {
            const pickups  = (job.stops ?? []).filter((s: any) => s.stop_type === 'pickup').length;
            const dropoffs = (job.stops ?? []).filter((s: any) => s.stop_type === 'dropoff').length;
            const done     = (job.stops ?? []).filter((s: any) => s.status === 'completed').length;
            const total    = (job.stops ?? []).length;

            return (
              <Link
                key={job.id}
                href={`/shipper/jobs/${job.id}`}
                className="block bg-[var(--color-white)] rounded-xl border border-[var(--color-cream-dark)] px-5 py-4 hover:border-[var(--color-teal)] transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[var(--color-text)]">
                        {job.title || `Job #${job.id}`}
                      </p>
                      {job.reference_number && (
                        <span className="text-xs text-[var(--color-text-faint)] font-mono">{job.reference_number}</span>
                      )}
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--color-teal-pale)] text-[var(--color-teal)] px-2 py-0.5 text-[10px] font-bold">
                        <Package size={9} /> Open
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-faint)]">
                      <span className="flex items-center gap-1">
                        <Package size={11} /> {pickups} pickup{pickups !== 1 ? 's' : ''}
                      </span>
                      <ArrowRight size={10} />
                      <span>{dropoffs} dropoff{dropoffs !== 1 ? 's' : ''}</span>
                      {job.route_distance_miles && (
                        <span className="flex items-center gap-1">
                          <Route size={11} /> {parseFloat(job.route_distance_miles).toFixed(0)} mi
                        </span>
                      )}
                      {job.status === 'posted' && (
                        <span className="flex items-center gap-1 text-[var(--color-teal)] font-medium">
                          <Users size={11} /> Awaiting bids
                        </span>
                      )}
                      {job.status === 'in_progress' && total > 0 && (
                        <span className="text-[var(--color-teal)] font-medium">{done}/{total} stops done</span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                </div>

                {job.status === 'in_progress' && total > 0 && (
                  <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--color-cream-dark)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-teal)] transition-all"
                      style={{ width: `${(done / total) * 100}%` }}
                    />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
