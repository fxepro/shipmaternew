'use client';

import type { ReactNode } from 'react';
import { Pencil, X } from 'lucide-react';

/** One row: field name on the left, its value on the right. Empty values show a dash. */
export type DataRow = [label: string, value: ReactNode];

const isEmpty = (v: ReactNode) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

export function DataRows({ rows }: { rows: DataRow[] }) {
  return (
    <dl className="divide-y divide-[var(--color-cream-dark)]">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[minmax(120px,38%)_1fr] gap-3 px-4 py-2">
          <dt className="text-xs font-medium text-[var(--color-text-faint)] pt-0.5">{label}</dt>
          <dd className="min-w-0 break-words text-sm text-[var(--color-text)]">{isEmpty(value) ? <span className="text-[var(--color-text-faint)]">—</span> : value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A titled block of label/value rows (or any content). One data set per card. */
export function DataCard({ title, subtitle, action, rows, children }: {
  title: string; subtitle?: string; action?: ReactNode; rows?: DataRow[]; children?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]/50 px-4 py-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
          {subtitle && <p className="text-xs text-[var(--color-text-faint)]">{subtitle}</p>}
        </div>
        {action}
      </header>
      {rows && <DataRows rows={rows} />}
      {children}
    </section>
  );
}

/** Section heading with Edit / Close editing. editable=false hides the button. */
export function SectionHeader({ title, description, editable, editing, onToggle }: {
  title: string; description?: string; editable?: boolean; editing?: boolean; onToggle?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">{description}</p>}
      </div>
      {editable && (
        <button onClick={onToggle}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-teal)]">
          {editing ? <><X size={14} /> Done</> : <><Pencil size={14} /> Edit</>}
        </button>
      )}
    </div>
  );
}

/** A small status pill used inside values */
export function Pill({ tone = 'neutral', children }: { tone?: 'good' | 'warn' | 'bad' | 'neutral'; children: ReactNode }) {
  const cls = {
    good: 'bg-emerald-50 text-emerald-700', warn: 'bg-amber-50 text-amber-700',
    bad: 'bg-red-50 text-red-700', neutral: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]',
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

export const fmtDate = (d?: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null);
export const fmtMoney = (n?: number | string | null) => (n ? `$${Number(n).toLocaleString()}` : null);
export const expiryPill = (d?: string | null) => {
  if (!d) return null;
  const past = new Date(`${d.slice(0, 10)}T23:59:59`) < new Date();
  return <span className="inline-flex items-center gap-2">{fmtDate(d)} {past && <Pill tone="bad">Expired</Pill>}</span>;
};
