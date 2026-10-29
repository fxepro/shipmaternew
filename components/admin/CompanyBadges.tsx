export const COMPANY_STATUSES: { value: string; label: string; cls: string }[] = [
  { value: 'incomplete',     label: 'Incomplete',     cls: 'badge-muted' },
  { value: 'pending_review', label: 'Pending review', cls: 'bg-amber-50 text-amber-700' },
  { value: 'approved',       label: 'Approved',       cls: 'badge-success' },
  { value: 'rejected',       label: 'Rejected',       cls: 'badge-danger' },
];

export const BACKGROUND_RESULTS: { value: string; label: string; cls: string }[] = [
  { value: 'not_started', label: 'Not started', cls: 'badge-muted' },
  { value: 'pending',     label: 'Pending',     cls: 'bg-amber-50 text-amber-700' },
  { value: 'clear',       label: 'Clear',       cls: 'badge-success' },
  { value: 'consider',    label: 'Consider',    cls: 'bg-amber-50 text-amber-700' },
  { value: 'failed',      label: 'Failed',      cls: 'badge-danger' },
];

/** Background results that count as passed (mirrors AdminCompanyController::BACKGROUND_PASSED) */
export const BACKGROUND_PASSED = ['clear', 'approved', 'passed'];

export function CompanyStatusBadge({ status }: { status: string | null }) {
  const s = COMPANY_STATUSES.find((x) => x.value === status);
  return <span className={`badge ${s?.cls ?? 'badge-muted'}`}>{s?.label ?? status ?? '—'}</span>;
}

export function BackgroundBadge({ status }: { status: string | null }) {
  const s = BACKGROUND_RESULTS.find((x) => x.value === status);
  const passed = status && BACKGROUND_PASSED.includes(status);
  return (
    <span className={`badge ${s?.cls ?? (passed ? 'badge-success' : 'badge-muted')}`}>
      {s?.label ?? (status ? status.replace(/_/g, ' ') : '—')}
    </span>
  );
}
