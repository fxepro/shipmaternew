export interface SubscriptionRow {
  org_id: number;
  company: string;
  owner: { id: number; name: string; email: string } | null;
  subscribed: boolean;
  status: string;
  cancel_at_period_end: boolean;
  tier: string | null;
  tier_label: string | null;
  monthly_price: number | null;
  started_at: string | null;
  current_period_end: string | null;
  tier_review_at: string | null;
  paid_total: number;
  last_paid_at: string | null;
}

export const SUBSCRIPTION_FILTERS = [
  { value: 'all',            label: 'All shipper companies' },
  { value: 'active',         label: 'Active' },
  { value: 'cancelling',     label: 'Cancelling at month end' },
  { value: 'pending',        label: 'Payment processing' },
  { value: 'past_due',       label: 'Past due' },
  { value: 'canceled',       label: 'Canceled' },
  { value: 'not_subscribed', label: 'Not subscribed' },
];

const STYLES: Record<string, { label: string; cls: string }> = {
  active:         { label: 'Active',             cls: 'badge-success' },
  trialing:       { label: 'Trial',              cls: 'badge-success' },
  pending:        { label: 'Payment processing', cls: 'bg-amber-50 text-amber-700' },
  past_due:       { label: 'Past due',           cls: 'badge-danger' },
  canceled:       { label: 'Canceled',           cls: 'badge-muted' },
  not_subscribed: { label: 'Not subscribed',     cls: 'badge-muted' },
};

export function SubscriptionStatusBadge({ status, cancelling }: { status: string; cancelling?: boolean }) {
  if (status === 'active' && cancelling) return <span className="badge bg-amber-50 text-amber-700">Cancelling</span>;
  const s = STYLES[status];
  return <span className={`badge ${s?.cls ?? 'badge-muted'}`}>{s?.label ?? status.replace(/_/g, ' ')}</span>;
}
