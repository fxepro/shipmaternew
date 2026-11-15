'use client';

import { api } from '@/lib/api';

/** Small pieces the law enforcement pages share */
export function errorMessage(e: unknown): string {
  const data = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  return Object.values(data?.errors ?? {})[0]?.[0] ?? data?.message ?? 'Something went wrong';
}

export async function openFile(url: string) {
  const r = await api.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(r.data as Blob);
  window.open(href, '_blank');
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

export const when = (s?: string | null) => (s ? new Date(s).toLocaleString() : '—');

export const BASIS_LABEL: Record<string, string> = {
  subpoena: 'Subpoena', court_order: 'Court order', warrant: 'Warrant', emergency: 'Emergency',
};

export const AGENCY_KIND: Record<string, string> = {
  state_police: 'State police', highway_patrol: 'Highway patrol', sheriff: 'Sheriff', police: 'Police department',
  federal: 'Federal', port: 'Port of entry', dot_enforcement: 'DOT enforcement', other: 'Other',
};

export const STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-700', in_review: 'bg-amber-50 text-amber-700',
  released: 'bg-emerald-50 text-emerald-700', declined: 'bg-red-50 text-red-700',
  approved: 'bg-emerald-50 text-emerald-700', rejected: 'bg-red-50 text-red-700',
  running: 'bg-blue-50 text-blue-700', ready: 'bg-emerald-50 text-emerald-700',
  not_found: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]', failed: 'bg-red-50 text-red-700',
};

export function Pill({ value }: { value: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[value] ?? 'bg-[var(--color-cream)] text-[var(--color-text-muted)]'}`}>{value.replace('_', ' ')}</span>;
}

/** The same table look as the admin lists */
export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string | false }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-slate)]">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-sage-light)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-[var(--color-white)]">
          {empty ? <tr><td colSpan={head.length} className="px-4 py-6 text-center text-[var(--color-text-faint)]">{empty}</td></tr> : children}
        </tbody>
      </table>
    </div>
  );
}

export const td = 'px-4 py-3 align-top';
export const tr = 'border-b border-[var(--color-cream-dark)] last:border-b-0';
