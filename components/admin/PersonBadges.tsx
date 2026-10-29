import { CheckCircle, Clock, XCircle, AlertTriangle, Minus } from 'lucide-react';

/** Company roles (docs/people-types-and-checks.md) */
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', staff: 'Staff', dispatcher: 'Dispatcher', driver: 'Driver', viewer: 'Viewer',
};

export const ROLES_BY_TYPE: Record<'carrier' | 'shipper', string[]> = {
  carrier: ['owner', 'staff', 'dispatcher', 'driver', 'viewer'],
  shipper: ['owner', 'staff', 'viewer'],
};

/** Person approval statuses, in pipeline order */
export const PERSON_STATUSES: { value: string; label: string; cls: string }[] = [
  { value: 'pending_review',     label: 'Pending review',          cls: 'bg-amber-50 text-amber-700' },
  { value: 'incomplete',         label: 'Incomplete',              cls: 'badge-muted' },
  { value: 'pending_payment',    label: 'Awaiting onboarding fee', cls: 'badge-muted' },
  { value: 'pending_background', label: 'Background check',        cls: 'badge-info' },
  { value: 'approved',           label: 'Approved',                cls: 'badge-success' },
  { value: 'rejected',           label: 'Rejected',                cls: 'badge-danger' },
  { value: 'not_required',       label: 'Not required',            cls: 'badge-muted' },
];

export function PersonStatusBadge({ status }: { status: string | null }) {
  const s = PERSON_STATUSES.find((x) => x.value === status);
  return <span className={`badge ${s?.cls ?? 'badge-muted'}`}>{s?.label ?? status ?? '—'}</span>;
}

/** State of one check: met | pending | missing | expired | failed */
const CHECK_STATES: Record<string, { label: string; cls: string; Icon: typeof CheckCircle }> = {
  met:     { label: 'Done',     cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', Icon: CheckCircle },
  pending: { label: 'Pending',  cls: 'bg-amber-50 border-amber-200 text-amber-700',       Icon: Clock },
  missing: { label: 'Missing',  cls: 'bg-[var(--color-cream)] border-[var(--color-cream-dark)] text-[var(--color-text-muted)]', Icon: Minus },
  expired: { label: 'Expired',  cls: 'bg-red-50 border-red-200 text-red-600',             Icon: AlertTriangle },
  failed:  { label: 'Failed',   cls: 'bg-red-50 border-red-200 text-red-600',             Icon: XCircle },
};

export function CheckChip({ state, label }: { state: string | null; label?: string }) {
  if (!state) return <span className="text-[var(--color-text-faint)]">—</span>;
  const s = CHECK_STATES[state] ?? CHECK_STATES.missing;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      <s.Icon size={10} /> {label ?? s.label}
    </span>
  );
}

/** Background results, shared with companies */
export function backgroundState(status: string | null): string {
  if (!status || status === 'not_started') return 'missing';
  if (['clear', 'approved', 'passed'].includes(status)) return 'met';
  if (status === 'failed') return 'failed';
  return 'pending';
}
