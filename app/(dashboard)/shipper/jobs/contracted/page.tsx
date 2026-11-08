'use client';

import { usePortal } from '@/lib/portal';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList, Plus, ArrowRight, CheckCircle2, Clock, Truck, AlertCircle, Route,
} from 'lucide-react';
import Link from 'next/link';
import { freightJobApi } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useCan } from '@/components/layout/PermissionsContext';

type Status = 'all' | 'draft' | 'posted' | 'in_progress' | 'completed';

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  draft:       { label: 'Draft',       cls: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]', icon: Clock },
  posted:      { label: 'Dispatched',  cls: 'bg-blue-50 text-blue-700', icon: Truck },
  in_progress: { label: 'In Progress', cls: 'bg-amber-50 text-amber-700', icon: Route },
  completed:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-50 text-red-600', icon: AlertCircle },
  disputed:    { label: 'Disputed',    cls: 'bg-red-50 text-red-600', icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

function carrierLine(job: any): string {
  const user =
    (job.carrier && typeof job.carrier === 'object' ? job.carrier : null) ??
    (job.contract?.carrier && typeof job.contract.carrier === 'object' ? job.contract.carrier : null);
  const name =
    (typeof job.contract?.carrier === 'string' ? job.contract.carrier : null) ??
    user?.name ??
    '';
  const company =
    job.contract?.carrier_company ??
    user?.carrier_profile?.company_name ??
    user?.carrierProfile?.company_name ??
    '';
  return [name, company].filter(Boolean).join(' · ') || '—';
}

function routeLine(job: any): string {
  const stops = [...(job.stops ?? [])].sort(
    (a: any, b: any) => (a.optimized_sequence ?? a.sequence) - (b.optimized_sequence ?? b.sequence),
  );
  const pickups = stops.filter((s: any) => s.stop_type === 'pickup');
  const drops = stops.filter((s: any) => s.stop_type === 'dropoff');
  const from = pickups[0]?.city || pickups[0]?.name || '—';
  const to = drops[drops.length - 1]?.city || drops[drops.length - 1]?.name
    || pickups[pickups.length - 1]?.city || '—';
  return `${from} → ${to}`;
}

function jobRate(job: any): string {
  if (job.cost_breakdown?.total != null) return formatCurrency(job.cost_breakdown.total);
  if (job.payment_amount_cents != null) return formatCurrency(job.payment_amount_cents / 100);
  if (job.contract?.rate != null) {
    const r = Number(job.contract.rate);
    const type = String(job.contract.rate_type ?? '');
    if (type.toLowerCase().includes('mile')) return `${formatCurrency(r)}/mi`;
    return formatCurrency(r);
  }
  return '—';
}

export default function ContractedJobsPage() {
  const to = usePortal();
  const can = useCan();
  const router = useRouter();
  const [filter, setFilter] = useState<Status>('all');

  const { data: res, isLoading } = useQuery({
    queryKey: ['shipper-freight-jobs', 'contracted', filter],
    queryFn: () => freightJobApi.shipperList({
      type: 'contracted',
      ...(filter !== 'all' && { status: filter }),
    }),
  });

  const jobs: any[] = res?.data?.data ?? [];

  const FILTERS: { key: Status; label: string }[] = [
    { key: 'all',         label: 'All' },
    { key: 'draft',       label: 'Draft' },
    { key: 'posted',      label: 'Dispatched' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed',   label: 'Completed' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">
            Contracted Jobs
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">
            Jobs dispatched under carrier contracts
          </p>
        </div>
        {can.do('loads.post') && <Link
          href={to('/shipper/jobs/contracted/new')}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-teal)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-teal-light)] transition-colors shadow-sm"
        >
          <Plus size={14} /> New job
        </Link>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-[var(--color-slate)] text-white'
                : 'bg-[var(--color-white)] border border-[var(--color-cream-dark)] text-[var(--color-text-muted)] hover:border-[var(--color-teal-light)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No contracted jobs"
          description="Dispatch your first job from an active contract."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
          <table className="data-table">
            <thead>
              <tr>
                {['Job', 'Route', 'Carrier', 'Status', 'Date', 'Rate', ''].map(h => (
                  <th key={h || 'actions'}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr
                  key={job.id}
                  className="cursor-pointer"
                  onClick={() => router.push(to(`/shipper/jobs/contracted/${job.id}`))}
                >
                  <td className="font-medium">
                    <div>{job.title || `Job #${job.id}`}</div>
                    {job.reference_number && (
                      <div className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>
                        {job.reference_number}
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    <span className="inline-flex items-center gap-1">
                      {routeLine(job).split(' → ')[0]}
                      <ArrowRight size={11} style={{ color: 'var(--text-faint)' }} />
                      {routeLine(job).split(' → ')[1]}
                    </span>
                    {job.route_distance_miles != null && (
                      <div className="text-xs" style={{ color: 'var(--text-faint)' }}>
                        {Number(job.route_distance_miles).toFixed(0)} mi
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{carrierLine(job)}</td>
                  <td><StatusBadge status={job.status} /></td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {job.posted_at || job.created_at
                      ? formatDate(job.posted_at ?? job.created_at)
                      : '—'}
                  </td>
                  <td className="font-medium">{jobRate(job)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        router.push(to(`/shipper/jobs/contracted/${job.id}`));
                      }}
                      className="link text-xs"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
