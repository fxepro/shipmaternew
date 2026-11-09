'use client';

import { useCurrentUser } from '@/components/layout/PermissionsContext';
import { ROLE_LABELS } from '@/components/admin/PersonBadges';
import { CompanyStatusBadge, COMPANY_STATUSES } from '@/components/admin/CompanyBadges';

const TYPE_LABEL: Record<string, string> = {
  shipper: 'Shipper', broker: 'Broker', carrier: 'Carrier', factor: 'Factor', receiver: 'Receiver',
};

const initialsOf = (name?: string | null) =>
  (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

const memberSince = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : null;

function HeaderCard({ initials, logo, title, lines, aside }: {
  initials: string; logo?: string | null; title: string; lines: (string | null)[]; aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-6">
      {logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logo} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
        : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-slate)] text-lg font-bold text-white">{initials}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[20px] font-semibold text-[var(--color-text)]">{title}</p>
        {lines.filter(Boolean).map((l, i) => (
          <p key={i} className={i === 0 ? 'text-sm text-[var(--color-text-muted)]' : 'mt-1 text-xs text-[var(--color-text-faint)]'}>{l}</p>
        ))}
      </div>
      {aside}
    </div>
  );
}

/** Top of Profile: the signed-in person, their role and their company */
export function PersonHeader({ name }: { name?: string | null }) {
  const user = useCurrentUser();
  const role = user?.org_role ? ROLE_LABELS[user.org_role] ?? user.org_role : null;
  const company = user?.org?.name;
  const display = name || user?.name || '';
  return (
    <HeaderCard initials={initialsOf(display)} logo={user?.avatar_url} title={display || '—'}
      lines={[[role, company].filter(Boolean).join(', ') || null, user?.created_at ? `Member since ${memberSince(user.created_at)}` : null]} />
  );
}

/**
 * Top of Company: the business name, type, approval status and member since.
 * name/type override the signed-in company (e.g. the profile's legal name, or "broker" in the broker portal).
 */
export function CompanyHeader({ name, type, aside }: { name?: string | null; type?: string; aside?: React.ReactNode }) {
  const user = useCurrentUser();
  const org = user?.org;
  const display = name || org?.name || '';
  const t = type ?? org?.type ?? '';
  return (
    <HeaderCard initials={initialsOf(display)} logo={org?.logo_url} title={display || 'Company name not set'}
      lines={[TYPE_LABEL[t] ?? t, org?.created_at ? `Member since ${memberSince(org.created_at)}` : null]}
      aside={aside ?? (COMPANY_STATUSES.some((s) => s.value === org?.verification_status) ? <CompanyStatusBadge status={org!.verification_status!} /> : undefined)} />
  );
}
