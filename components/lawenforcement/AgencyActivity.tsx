'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { BASIS_LABEL, Pill, Table, errorMessage, openFile, td, tr, when } from './shared';

interface Entry {
  id: number; action: string; page: string | null; subject_type: string | null; subject_id: number | null; subject_label: string | null;
  query: string | null; reason: string | null; case_number: string | null; results: number | null; ip: string | null; created_at: string;
  officer_id: number; officer: string;
}
interface RecordRequest {
  id: number; case_number: string; legal_basis: string; subject: string; details: string | null; status: string; response_notes: string | null;
  decided_at: string | null; created_at: string; officer: string; has_document: boolean;
}

const ACTIONS = ['all', 'login', 'search', 'view', 'report', 'request'];

function Decide({ r }: { r: RecordRequest }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(r.response_notes ?? '');
  const decide = useMutation({
    mutationFn: (status: string) => api.put(`/api/v1/admin/law-enforcement/requests/${r.id}`, { status, response_notes: notes.trim() || null }),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['admin-agency-activity'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="flex min-w-[260px] flex-col gap-2">
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Answer to the agency" className="profile-input text-xs" />
      <div className="flex gap-1.5">
        {[['in_review', 'In review'], ['released', 'Release'], ['declined', 'Decline']].map(([s, l]) => (
          <button key={s} disabled={decide.isPending || r.status === s} onClick={() => decide.mutate(s)}
            className="rounded-lg border border-[var(--color-cream-dark)] px-2.5 py-1 text-xs font-medium hover:border-[var(--color-teal)] disabled:opacity-40">{l}</button>
        ))}
      </div>
    </div>
  );
}

function Subject({ r }: { r: Entry }) {
  const href = !r.subject_id ? null
    : r.subject_type === 'company' ? `/admin/companies/${r.subject_id}`
    : r.subject_type === 'person' ? `/admin/people/${r.subject_id}`
    : r.subject_type === 'load' ? `/admin/shipments/${r.subject_id}` : null;
  const label = r.subject_label ?? (r.subject_type === 'load' && r.subject_id ? `Load #${r.subject_id}` : r.query) ?? '—';
  return href ? <Link href={href} className="text-[var(--color-teal)] hover:underline">{label}</Link> : <>{label}</>;
}

/** Everything an agency's officers (or one officer) did: records requests to answer, then every sign-in, search, view and report with its reason */
export function AgencyActivity({ agencyId, officerId }: { agencyId?: number; officerId?: number }) {
  const [action, setAction] = useState('all');
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-agency-activity', agencyId, officerId, action, q],
    queryFn: () => api.get('/api/v1/admin/law-enforcement', { params: { agency: agencyId, officer: officerId, action, q: q.trim() || undefined } })
      .then((r) => r.data.data as { log: Entry[]; requests: RecordRequest[] }),
  });
  const log = data?.log ?? [];
  const requests = data?.requests ?? [];

  if (isLoading) return <div className="skeleton h-64 rounded-xl" />;
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Records requests</p>
        <Table head={['Sent', 'Officer', 'Case', 'Basis', 'Records wanted', 'Status', '', 'Decision']} empty={requests.length === 0 && 'No requests'}>
          {requests.map((r) => (
            <tr key={r.id} className={tr}>
              <td className={`${td} whitespace-nowrap text-xs text-[var(--color-text-muted)]`}>{when(r.created_at)}</td>
              <td className={td}>{r.officer}</td>
              <td className={td}>{r.case_number}</td>
              <td className={td}>{BASIS_LABEL[r.legal_basis] ?? r.legal_basis}</td>
              <td className={td}>
                {r.subject}
                {r.details && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{r.details}</p>}
              </td>
              <td className={td}><Pill value={r.status} /></td>
              <td className={td}>
                {r.has_document && (
                  <button onClick={() => openFile(`/api/v1/admin/law-enforcement/requests/${r.id}/file`).catch(() => toast.error('Could not open the file'))}
                    title="Document" className="text-[var(--color-teal)]"><FileText size={15} /></button>
                )}
              </td>
              <td className={td}><Decide r={r} /></td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Searches and views</p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Officer, case number or record"
              className="w-60 rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-1.5 text-sm focus:border-[var(--color-teal)] focus:outline-none" />
            <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action"
              className="rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-1.5 text-sm capitalize">
              {ACTIONS.map((a) => <option key={a} value={a}>{a === 'all' ? 'Everything' : a}</option>)}
            </select>
          </div>
        </div>
        <Table head={['When', 'Officer', 'What', 'Page', 'Search or record', 'Reason', 'Case', 'Results', 'IP']} empty={log.length === 0 && 'Nothing logged'}>
          {log.map((r) => (
            <tr key={r.id} className={tr}>
              <td className={`${td} whitespace-nowrap text-xs text-[var(--color-text-muted)]`}>{when(r.created_at)}</td>
              <td className={td}>{r.officer}</td>
              <td className={`${td} capitalize`}>{r.action}</td>
              <td className={`${td} capitalize text-[var(--color-text-muted)]`}>{r.page ?? '—'}</td>
              <td className={td}><Subject r={r} /></td>
              <td className={`${td} max-w-[260px]`}>{r.reason ?? '—'}</td>
              <td className={td}>{r.case_number ?? '—'}</td>
              <td className={td}>{r.results ?? '—'}</td>
              <td className={`${td} text-xs text-[var(--color-text-faint)]`}>{r.ip ?? '—'}</td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
