'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Circle, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { SubscriptionStatusBadge, type SubscriptionRow } from '@/components/admin/SubscriptionBadges';
import { formatCurrency } from '@/lib/utils';

interface Detail extends SubscriptionRow {
  stated_annual_value: number | null;
  started_by: string | null;
  canceled_at: string | null;
  stripe_linked: boolean;
  sync_error: string | null;
  moved_since_start: number | null;
  payments: { id: number; amount: number; reference: string | null; description: string | null; paid_at: string | null }[];
}

const day = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]/40 px-5 py-3.5">
        <p className="text-sm font-semibold text-[var(--color-slate)]">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">{subtitle}</p>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-faint)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

/** One shipper company's subscription: the cycle from sign-up to renewal or cancellation, with every payment. */
export default function AdminSubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: d, isLoading, isError } = useQuery({
    queryKey: ['admin-subscription', id],
    queryFn: () => api.get(`/api/v1/admin/subscriptions/${id}`).then((r) => r.data.data as Detail),
  });

  const act = useMutation({
    mutationFn: (action: 'cancel' | 'resume') => api.post(`/api/v1/admin/subscriptions/${id}/${action}`),
    onSuccess: (_, action) => {
      toast.success(action === 'cancel' ? 'Subscription will end at the close of this billing month' : 'Cancellation undone');
      qc.invalidateQueries({ queryKey: ['admin-subscription', id] });
      qc.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
    onError: (e: { response?: { data?: { message?: string; error?: string } } }) => toast.error(e.response?.data?.error ?? e.response?.data?.message ?? 'Action failed'),
  });

  const back = (
    <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
      <ArrowLeft size={14} /> Back
    </button>
  );
  if (isLoading) return <div className="space-y-4">{back}<div className="skeleton h-96 rounded-2xl" /></div>;
  if (isError || !d) return <div className="space-y-4">{back}<EmptyState icon={Repeat} title="Subscription not found" /></div>;

  const active = d.status === 'active';
  const review = d.tier_review_at ? new Date(d.tier_review_at) : null;

  // The life of a subscription, in order
  const steps: [string, string | null, boolean][] = [
    ['Subscribed', d.started_at ? `${day(d.started_at)}${d.started_by ? ` by ${d.started_by}` : ''}` : null, !!d.started_at],
    ['First payment', d.payments.length ? day(d.payments[d.payments.length - 1].paid_at) : d.status === 'pending' ? 'Processing' : null, d.payments.length > 0],
    [d.cancel_at_period_end ? 'Ends' : 'Next charge', active ? day(d.current_period_end) : null, false],
    ['Tier review', review ? day(d.tier_review_at) : null, !!review && review < new Date()],
    ...(d.status === 'canceled' ? [['Canceled', day(d.canceled_at), true] as [string, string | null, boolean]] : []),
  ];

  return (
    <div className="space-y-5">
      {back}

      <section className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-slate)] text-white"><Repeat size={22} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{d.company}</h1>
              <SubscriptionStatusBadge status={d.status} cancelling={d.cancel_at_period_end} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)]">
              {d.tier_label && <span>{d.tier_label} in loads a year · <span className="font-medium text-[var(--color-text)]">{formatCurrency(d.monthly_price ?? 0)}/mo</span></span>}
              {d.owner && <span>Owner <Link href={`/admin/people/${d.owner.id}`} className="font-medium text-[var(--color-text)] hover:underline">{d.owner.name}</Link></span>}
              <Link href={`/admin/companies/${d.org_id}`} className="inline-flex items-center gap-1 font-medium text-[var(--color-teal)] hover:underline"><Building2 size={13} /> Company page</Link>
            </div>
          </div>
          {active && (
            d.cancel_at_period_end ? (
              <button onClick={() => act.mutate('resume')} disabled={act.isPending} className="btn btn-navy disabled:opacity-50">Undo cancellation</button>
            ) : (
              <button onClick={() => { if (confirm(`Cancel ${d.company}'s subscription at the end of this billing month (${day(d.current_period_end)})?`)) act.mutate('cancel'); }}
                disabled={act.isPending} className="btn border border-red-200 bg-red-50 text-red-700 disabled:opacity-50">Cancel at month end</button>
            )
          )}
        </div>

        {/* Cycle */}
        <ol className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--color-cream-dark)] pt-4 md:grid-cols-4">
          {steps.map(([label, when, done]) => (
            <li key={label} className="flex items-start gap-2">
              {done ? <CheckCircle2 size={16} className="mt-0.5 text-emerald-600" /> : <Circle size={16} className="mt-0.5 text-[var(--color-text-faint)]" />}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
                <p className="text-sm text-[var(--color-text)]">{when ?? '—'}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {d.sync_error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {d.sync_error} Showing what Shipmater last recorded.
        </div>
      )}
      {d.status === 'not_subscribed' && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> This company hasn&apos;t subscribed, so it can&apos;t post new loads. The owner subscribes on their Subscription tab.
        </div>
      )}
      {d.status === 'past_due' && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> The last payment failed. Stripe retries it; the company can&apos;t post loads until it&apos;s paid.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Billing">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Item label="Tier" value={d.tier_label ?? '—'} />
            <Item label="Monthly" value={d.monthly_price != null ? formatCurrency(d.monthly_price) : '—'} />
            <Item label="Paid to date" value={formatCurrency(d.paid_total)} />
            <Item label="Payments" value={d.payments.length} />
            <Item label="Last paid" value={day(d.last_paid_at)} />
            <Item label="Linked to Stripe" value={d.stripe_linked ? 'Yes' : 'No'} />
          </dl>
        </Panel>
        <Panel title="Tier review" subtitle="After 12 months, the load value moved is compared with the tier">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Item label="Stated yearly value" value={d.stated_annual_value != null ? formatCurrency(d.stated_annual_value) : '—'} />
            <Item label="Moved since subscribing" value={d.moved_since_start != null ? formatCurrency(d.moved_since_start) : '—'} />
            <Item label="Review date" value={day(d.tier_review_at)} />
          </dl>
        </Panel>
        <Panel title="Dates">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Item label="Started" value={day(d.started_at)} />
            <Item label={d.cancel_at_period_end ? 'Ends' : 'Next charge'} value={active ? day(d.current_period_end) : '—'} />
            <Item label="Started by" value={d.started_by ?? '—'} />
            <Item label="Canceled" value={day(d.canceled_at)} />
          </dl>
        </Panel>
      </div>

      <Panel title="Payments" subtitle="Each monthly charge, as recorded in the ledger">
        {d.payments.length === 0 ? (
          <p className="text-sm italic text-[var(--color-text-faint)]">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-cream-dark)]">
                  {['Paid', 'Amount', 'Invoice', 'Description'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-faint)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.payments.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                    <td className="px-3 py-2.5">{day(p.paid_at)}</td>
                    <td className="px-3 py-2.5 font-medium">{formatCurrency(p.amount)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--color-text-muted)]">{p.reference ?? '—'}</td>
                    <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{p.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
