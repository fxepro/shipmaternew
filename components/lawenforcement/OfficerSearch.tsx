'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, type LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';

/**
 * Law enforcement on the admin list pages (People, Loads, Live tracking): nothing lists until the officer
 * searches, and the API logs each search (App\Support\LawEnforcement).
 */
export function OfficerSearch<T>({ title, placeholder, endpoint, params, icon, empty, children, shortNumbers = false }: {
  title: string;
  placeholder: string;
  endpoint: string;
  params?: Record<string, string>;
  icon: LucideIcon;
  empty: string;
  children: (rows: T[]) => React.ReactNode;
  /** Loads: a load number may be shorter than a search */
  shortNumbers?: boolean;
}) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const ok = (s: string) => s.length >= 3 || (shortNumbers && /^#?\d+$/.test(s));
  const { data, isFetching } = useQuery({
    queryKey: ['officer-search', endpoint, params, q],
    queryFn: () => api.get(endpoint, { params: { ...params, q } }).then((r) => (r.data.data ?? []) as T[]),
    enabled: !!ok(q),
  });

  return (
    <div className="space-y-5">
      <h1 className="page-title">{title}</h1>
      <form onSubmit={(e) => { e.preventDefault(); setQ(text.trim()); }} className="flex max-w-xl gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder={placeholder}
          className="flex-1 bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-base focus:outline-none focus:border-[var(--color-teal)]" />
        <button type="submit" disabled={!ok(text.trim())} className="btn btn-navy flex items-center gap-1.5 disabled:opacity-50"><Search size={14} /> Search</button>
      </form>
      {!ok(q) ? null : isFetching ? <div className="skeleton h-40 rounded-xl" />
        : !data?.length ? <EmptyState icon={icon} title={empty} /> : children(data)}
    </div>
  );
}

/** Before a load opens (Tier 2): the reason and the case or stop number, kept in the access log */
export function ReasonGate({ title, onSubmit }: { title: string; onSubmit: (reason: string, caseNumber: string) => void }) {
  const [reason, setReason] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const ok = reason.trim().length >= 5 && caseNumber.trim().length > 0;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(reason.trim(), caseNumber.trim()); }}
      className="max-w-lg space-y-3 rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-5">
      <p className="card-title">{title}</p>
      <label className="block text-sm text-[var(--color-text-muted)]">Reason
        <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus maxLength={500} placeholder="Roadside inspection, crash, theft report…"
          className="mt-1 w-full rounded-lg border border-[var(--color-cream-dark)] px-3 py-2 text-base focus:border-[var(--color-teal)] focus:outline-none" />
      </label>
      <label className="block text-sm text-[var(--color-text-muted)]">Case or stop number
        <input value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} maxLength={80}
          className="mt-1 w-full rounded-lg border border-[var(--color-cream-dark)] px-3 py-2 text-base focus:border-[var(--color-teal)] focus:outline-none" />
      </label>
      <button type="submit" disabled={!ok} className="btn btn-navy disabled:opacity-50">Open</button>
    </form>
  );
}
