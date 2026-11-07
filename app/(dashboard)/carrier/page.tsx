'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Briefcase, CheckCircle, Clock, Loader, ShieldCheck, XCircle, CreditCard, ArrowRight } from 'lucide-react';
import { freightJobApi, shipmentApi, carrierApi, api } from '@/lib/api';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency } from '@/lib/utils';
import { useCan } from '@/components/layout/PermissionsContext';

function SkeletonCard() {
  return <div className="skeleton h-[104px] rounded-xl" />;
}

// ── Approval pipeline step config ─────────────────────────────────────────
const PIPELINE_STEPS = [
  { key: 'payment',    label: 'Pay $39 check' },
  { key: 'background', label: 'Background check' },
  { key: 'review',     label: 'Approval' },
];

function getStepState(verificationStatus: string, stepKey: string): 'done' | 'active' | 'pending' {
  const order: Record<string, number> = {
    incomplete:         0,
    pending_payment:    0,
    pending_background: 1,
    pending_review:     2,
    approved:           3,
    rejected:           3,
  };
  const stepOrder: Record<string, number> = {
    payment: 0, background: 1, review: 2,
  };

  const current = order[verificationStatus] ?? 0;
  const step    = stepOrder[stepKey] ?? 0;

  if (current > step) return 'done';
  if (current === step) return 'active';
  return 'pending';
}

function ApprovalBanner({ status }: { status: string }) {
  const configs: Record<string, {
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: { label: string; href: string };
    color: string;
    borderColor: string;
  }> = {
    incomplete: {
      icon: <CreditCard size={20} className="text-[var(--color-teal)]" />,
      title: 'Complete your profile to get started',
      description: 'Fill in your personal info and DOT/MC numbers, then pay the $39 background check to unlock the platform.',
      action: { label: 'Go to Profile', href: '/carrier/profile' },
      color: 'bg-[var(--color-teal-pale)]',
      borderColor: 'border-[var(--color-teal)]',
    },
    pending_payment: {
      icon: <CreditCard size={20} className="text-yellow-600" />,
      title: 'Platform fee required',
      description: 'Pay the one-time $39 Basic background check to start it and unlock all platform features.',
      action: { label: 'Pay $39 Now →', href: '/carrier/profile?tab=background' },
      color: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
    },
    pending_background: {
      icon: <Loader size={20} className="text-blue-600 animate-spin" />,
      title: 'Background check in progress',
      description: 'Your background check is underway. This typically takes 3–5 business days. You\'ll be notified when it\'s complete.',
      color: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    pending_review: {
      icon: <Clock size={20} className="text-orange-500" />,
      title: 'Under admin review',
      description: 'Your background check requires a manual review. Our team will complete this within 1–2 business days.',
      color: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
    rejected: {
      icon: <XCircle size={20} className="text-red-600" />,
      title: 'Application not approved',
      description: 'Unfortunately your background check did not meet our requirements. Contact support@shipmater.com if you have questions.',
      color: 'bg-red-50',
      borderColor: 'border-red-200',
    },
  };

  const cfg = configs[status] ?? configs['incomplete'];

  return (
    <div className={`rounded-xl border ${cfg.color} ${cfg.borderColor} p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--color-text)]">{cfg.title}</p>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{cfg.description}</p>
        </div>
        {cfg.action && (
          <Link
            href={cfg.action.href}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[var(--color-teal)] text-white text-sm font-medium px-4 py-2 hover:bg-[var(--color-teal-light)] transition-colors"
          >
            {cfg.action.label}
            <ArrowRight size={13} />
          </Link>
        )}
      </div>

      {/* Pipeline steps */}
      {status !== 'rejected' && (
        <div className="flex items-center gap-0">
          {PIPELINE_STEPS.map((step, i) => {
            const state = getStepState(status, step.key);
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    state === 'done'
                      ? 'bg-[var(--color-success)] border-[var(--color-success)] text-white'
                      : state === 'active'
                        ? 'bg-[var(--color-teal)] border-[var(--color-teal)] text-white'
                        : 'bg-white border-[var(--color-cream-dark)] text-[var(--color-text-faint)]'
                  }`}>
                    {state === 'done' ? <CheckCircle size={14} /> : (
                      state === 'active' ? (
                        step.key === 'background' && status === 'pending_background'
                          ? <Loader size={12} className="animate-spin" />
                          : <ShieldCheck size={12} />
                      ) : (
                        <span>{i + 1}</span>
                      )
                    )}
                  </div>
                  <span className={`mt-1.5 text-xs text-center leading-tight ${
                    state === 'active' ? 'font-semibold text-[var(--color-teal)]' :
                    state === 'done'   ? 'font-medium text-[var(--color-success)]' :
                    'text-[var(--color-text-faint)]'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded transition-all ${
                    getStepState(status, PIPELINE_STEPS[i + 1].key) !== 'pending' ||
                    getStepState(status, step.key) === 'done'
                      ? 'bg-[var(--color-success)]'
                      : 'bg-[var(--color-cream-dark)]'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────
export default function CarrierDashboard() {
  const can = useCan();
  const { data: profileRes, isLoading: profileLoading } = useQuery({
    queryKey: ['carrier-profile'],
    queryFn: () => api.get('/api/v1/carrier/profile').then(r => r.data?.data),
    retry: false,
  });

  const verificationStatus = profileRes?.verification_status ?? 'incomplete';
  const isApproved = verificationStatus === 'approved';

  // Open-market loads for the list, and this carrier's loads on the road for the count
  const { data: jobsRes, isLoading: jobsLoading } = useQuery({
    queryKey: ['carrier-freight-jobs', 'open_market'],
    queryFn: () => freightJobApi.carrierList({ type: 'open_market' }),
    enabled: isApproved && can.see('loads.board'),
    retry: false,
  });
  const { data: activeRes } = useQuery({
    queryKey: ['carrier-shipments', 'in_transit'],
    queryFn: () => shipmentApi.list({ status: 'in_transit' }),
    enabled: isApproved && can.see('loads.view'),
    retry: false,
  });
  const { data: earningsRes } = useQuery({
    queryKey: ['carrier-earnings'],
    queryFn: () => carrierApi.earnings(),
    enabled: isApproved && can.see('money.payments'),
    retry: false,
  });

  const jobs     = jobsRes?.data?.data ?? [];
  const earnings = earningsRes?.data?.data;

  const stats = [
    { label: 'Active Jobs',         value: activeRes?.data?.meta?.total ?? (activeRes?.data?.data ?? []).length },
    { label: 'Earnings This Month', value: earnings?.month_total ?? 0, currency: true, accentColor: 'var(--color-sage)' },
    { label: 'Total Delivered',     value: earnings?.total_deliveries ?? 0, accentColor: 'var(--color-success)' },
    { label: 'Rating',              value: earnings?.rating ? `${earnings.rating.toFixed(1)} ★` : '—', accentColor: 'var(--color-teal)' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">
          Dashboard
        </h1>
        {isApproved && can.see('loads.board') && (
          <Link href="/carrier/jobs" className="rounded-lg bg-[var(--color-teal)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-teal-light)] transition-colors">
            Browse Jobs
          </Link>
        )}
      </div>

      {/* Approval banner — shown until carrier is fully approved */}
      {!profileLoading && !isApproved && verificationStatus !== undefined && (
        <ApprovalBanner status={verificationStatus} />
      )}

      {/* Stats — only when approved */}
      {isApproved && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {jobsLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : stats.map((s) => <StatCard key={s.label} {...s} />)
            }
          </div>

          {/* Open Jobs */}
          <div className="bg-[var(--color-white)] rounded-xl border border-[var(--color-cream-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-cream-dark)]">
              <p className="font-medium text-[var(--color-text)]">Open Jobs Near You</p>
              <Link href="/carrier/jobs" className="text-sm font-medium text-[var(--color-teal)] hover:underline">
                View all
              </Link>
            </div>
            {jobs.length === 0 ? (
              <EmptyState icon={Briefcase} title="No open jobs" description="Check back soon for new freight jobs." />
            ) : (
              <div className="divide-y divide-[var(--color-cream-dark)]">
                {jobs.slice(0, 5).map((job: any) => {
                  const stops = job.stops ?? [];
                  const from  = stops.find((s: any) => s.stop_type === 'pickup');
                  const to    = [...stops].reverse().find((s: any) => s.stop_type === 'dropoff');
                  return (
                  <div key={job.id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{job.title || `Load #${job.id}`}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {from ? `${from.city}, ${from.state}` : '—'} → {to ? `${to.city}, ${to.state}` : '—'}
                        {stops.length > 2 && ` · ${stops.length} stops`}
                        {job.total_weight_lbs ? ` · ${Number(job.total_weight_lbs).toLocaleString()} lbs` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                        {job.payment_amount_cents ? formatCurrency(job.payment_amount_cents / 100) : '—'}
                      </p>
                      <Link
                        href={`/carrier/my-jobs/${job.id}`}
                        className="rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-teal-light)] transition-colors"
                      >
                        Offer
                      </Link>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payout card */}
          <div className="bg-[var(--color-white)] rounded-xl border border-[var(--color-cream-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)] mb-4">
              Payout Summary
            </p>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-[var(--color-text-faint)] uppercase tracking-wide">In Escrow</p>
                <p className="mt-1 text-2xl text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                  {formatCurrency(earnings?.escrow ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-faint)] uppercase tracking-wide">Available</p>
                <p className="mt-1 text-2xl text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
                  {formatCurrency(earnings?.available ?? 0)}
                </p>
              </div>
            </div>
            <Link
              href="/carrier/earnings"
              className="mt-4 block w-full rounded-lg border border-[var(--color-teal)] py-2.5 text-center text-sm font-medium text-[var(--color-teal)] hover:bg-[var(--color-teal-pale)] transition-colors"
            >
              Request Payout
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
