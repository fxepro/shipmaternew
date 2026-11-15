'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Table, td, tr, when } from '@/components/lawenforcement/shared';

interface Entry {
  id: number; action: string; page: string | null; subject_type: string | null; subject_id: number | null; subject_label: string | null;
  query: string | null; reason: string | null; case_number: string | null; results: number | null; created_at: string; officer: string;
}

const LINK: Record<string, (id: number) => string> = {
  company: (id) => `/admin/companies/${id}`, person: (id) => `/admin/people/${id}`, load: (id) => `/admin/shipments/${id}`,
  report: () => '/agency/reports',
};

/** Every search and view, kept so it can be shown if a search is ever questioned */
export default function AgencyHistoryPage() {
  const [scope, setScope] = useState<'mine' | 'agency'>('mine');
  const { data, isLoading } = useQuery({
    queryKey: ['agency-history', scope],
    queryFn: () => api.get('/api/v1/agency/history', { params: { scope } }).then((r) => r.data as { data: Entry[]; can_see_agency: boolean }),
  });
  const rows = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">History</h1>
        {data?.can_see_agency && (
          <div className="flex gap-2">
            {(['mine', 'agency'] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${scope === s ? 'bg-[var(--color-slate)] text-white' : 'border border-[var(--color-cream-dark)] bg-[var(--color-white)] text-[var(--color-text-muted)]'}`}>
                {s === 'mine' ? 'Mine' : 'Whole agency'}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? <div className="skeleton h-64 rounded-xl" /> : (
        <Table head={['When', ...(scope === 'agency' ? ['Officer'] : []), 'What', 'Page', 'Search or record', 'Reason', 'Case', 'Results']}
          empty={rows.length === 0 && 'Nothing yet'}>
          {rows.map((r) => {
            const href = r.subject_type && r.subject_id && LINK[r.subject_type] ? LINK[r.subject_type](r.subject_id) : null;
            return (
              <tr key={r.id} className={tr}>
                <td className={`${td} whitespace-nowrap text-xs text-[var(--color-text-muted)]`}>{when(r.created_at)}</td>
                {scope === 'agency' && <td className={td}>{r.officer}</td>}
                <td className={`${td} capitalize`}>{r.action}</td>
                <td className={`${td} capitalize text-[var(--color-text-muted)]`}>{r.page ?? '—'}</td>
                <td className={td}>
                  {href && r.subject_type !== 'load' ? <Link href={href} className="text-[var(--color-teal)] hover:underline">{r.subject_label ?? r.query}</Link>
                    : (r.subject_label ?? r.query ?? '—')}
                </td>
                <td className={`${td} text-[var(--color-text-muted)]`}>{r.reason ?? '—'}</td>
                <td className={td}>{r.case_number ?? '—'}</td>
                <td className={td}>{r.results ?? '—'}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
