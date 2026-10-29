'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, CheckCircle, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from 'sonner';

interface QueueCarrier {
  id:                      number;
  name:                    string;
  email:                   string;
  company_name:            string | null;
  dot_number:              string | null;
  mc_number:               string | null;
  verification_status:     string | null;
  background_check_status: string | null;
  dot_verified:            boolean;
  mc_verified:             boolean;
  identity_verified:       boolean;
  identity_check_status:   string | null;
  age_verified:            boolean;
  onboarding_fee_paid:     boolean;
  verification_notes:      string | null;
  submitted_at:            string | null;
  status_updated_at:       string | null;
  created_at:              string;
}

// Carrier onboarding pipeline, in order
const STATUSES: { value: string; label: string; cls: string }[] = [
  { value: 'pending_review',     label: 'Pending review',          cls: 'bg-amber-50 text-amber-700' },
  { value: 'incomplete',         label: 'Incomplete',              cls: 'badge-muted' },
  { value: 'pending_payment',    label: 'Awaiting onboarding fee', cls: 'badge-muted' },
  { value: 'pending_background', label: 'Background check',        cls: 'badge-info' },
  { value: 'approved',           label: 'Approved',                cls: 'badge-success' },
  { value: 'rejected',           label: 'Rejected',                cls: 'badge-danger' },
];

function StatusBadge({ status }: { status: string | null }) {
  const s = STATUSES.find((x) => x.value === status);
  return <span className={`badge ${s?.cls ?? 'badge-muted'}`}>{s?.label ?? status ?? '—'}</span>;
}

function Check({ ok, pending, label }: { ok: boolean; pending?: boolean; label: string }) {
  const [cls, Icon] = ok
    ? ['bg-emerald-50 border-emerald-200 text-emerald-700', CheckCircle]
    : pending
      ? ['bg-amber-50 border-amber-200 text-amber-700', Clock]
      : ['bg-red-50 border-red-200 text-red-600', XCircle];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon size={9} /> {label}
    </span>
  );
}

export default function AdminCarrierMembersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending_review');

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-carriers', status],
    queryFn: () => api.get('/api/v1/admin/carriers/pending-review', { params: { status } }),
  });

  const background = useMutation({
    mutationFn: ({ id, result }: { id: number; result: string }) =>
      api.post(`/api/v1/admin/carriers/${id}/background`, { result }),
    onSuccess: () => {
      toast.success('Background check recorded');
      qc.invalidateQueries({ queryKey: ['admin-carriers'] });
    },
    onError: () => toast.error('Could not record background check'),
  });

  const review = useMutation({
    mutationFn: ({ id, action, notes }: { id: number; action: 'approve' | 'reject'; notes?: string }) =>
      api.post(`/api/v1/admin/carriers/${id}/review`, { action, notes }),
    onSuccess: (_, { action }) => {
      toast.success(`Carrier ${action === 'approve' ? 'approved' : 'rejected'}`);
      qc.invalidateQueries({ queryKey: ['admin-carriers'] });
    },
    onError: (err: { response?: { data?: { error?: string; message?: string } } }) => {
      toast.error(err?.response?.data?.error ?? err?.response?.data?.message ?? 'Action failed');
    },
  });

  const carriers: QueueCarrier[] = res?.data?.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Carrier Members</h1>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">
          People at carrier companies. Each person needs verified identity and a clear background check before approval.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]"
        >
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          <option value="all">Everyone</option>
        </select>
        <span className="ml-auto text-sm text-[var(--color-text-muted)]">
          {isLoading ? '' : `${carriers.length} ${carriers.length === 1 ? 'person' : 'people'}`}
        </span>
      </div>

      {isLoading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : carriers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={status === 'pending_review' ? 'No one pending review' : 'No one with this status'}
          description={status === 'pending_review' ? 'People at carrier companies who finish onboarding and need approval will appear here.' : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-slate)]">
                {['Person', 'Company', 'DOT / MC', 'Checks', 'Status', 'Submitted', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-sage-light)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carriers.map((c) => {
                const bgPending = c.background_check_status === 'pending' || c.background_check_status === 'in_progress' || c.background_check_status === 'invitation_sent';
                const bgPassed  = c.background_check_status === 'clear' || c.background_check_status === 'passed' || c.background_check_status === 'approved';
                const canApprove = c.identity_verified && bgPassed;
                const reviewable = c.verification_status === 'pending_review';
                const submitted = c.submitted_at ?? c.created_at;
                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/admin/users/${c.id}`)}
                    className="cursor-pointer border-b border-[var(--color-cream-dark)] last:border-b-0 bg-[var(--color-white)] hover:bg-[var(--color-cream)] transition-colors align-top"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-text)]">{c.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.company_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      <p>{c.dot_number ? `DOT ${c.dot_number}` : '—'}</p>
                      {c.mc_number && <p>{c.mc_number}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        <Check ok={c.identity_verified} pending={c.identity_check_status === 'pending'} label="ID" />
                        <Check ok={c.age_verified} label="18+" />
                        <Check ok={c.dot_verified} label="DOT" />
                        {c.mc_verified && <Check ok label="MC" />}
                        <Check ok={bgPassed} pending={bgPending} label="Background" />
                        <Check ok={c.onboarding_fee_paid} label="Fee" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.verification_status} />
                      {c.verification_notes && <p className="mt-1 max-w-[180px] text-xs text-[var(--color-text-faint)]">{c.verification_notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{new Date(submitted).toLocaleDateString()}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {reviewable ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => review.mutate({ id: c.id, action: 'approve' })}
                            disabled={review.isPending || !canApprove}
                            title={canApprove ? 'Approve person' : 'Verified identity and a clear background check are required'}
                            className="flex items-center gap-1 rounded-lg bg-[var(--color-teal)] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:cursor-not-allowed disabled:bg-[var(--color-cream-dark)] disabled:text-[var(--color-text-faint)]"
                          >
                            <ShieldCheck size={12} /> Approve
                          </button>
                          <button
                            onClick={() => {
                              const notes = prompt(`Reason for rejecting ${c.name}? (optional, shown on the record)`);
                              if (notes === null) return;
                              review.mutate({ id: c.id, action: 'reject', notes: notes || undefined });
                            }}
                            disabled={review.isPending}
                            className="flex items-center gap-1 rounded-lg border border-[var(--color-danger)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-danger)] hover:bg-red-50 disabled:opacity-50"
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="block text-right text-sm font-medium text-[var(--color-teal)]">View</span>
                      )}
                      <select
                        value=""
                        onChange={(e) => e.target.value && background.mutate({ id: c.id, result: e.target.value })}
                        aria-label={`Record background check for ${c.name}`}
                        className="mt-2 w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-md px-2 py-1 text-xs text-[var(--color-text-muted)]"
                      >
                        <option value="">Record background…</option>
                        <option value="pending">Pending</option>
                        <option value="clear">Clear</option>
                        <option value="consider">Consider (needs review)</option>
                        <option value="failed">Failed</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
