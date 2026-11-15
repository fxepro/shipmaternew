'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { BASIS_LABEL, Pill, Table, errorMessage, openFile, td, tr, when } from '@/components/lawenforcement/shared';

interface RecordRequest {
  id: number; case_number: string; legal_basis: string; subject: string; details: string | null; status: string;
  response_notes: string | null; decided_at: string | null; created_at: string; officer: string; has_document: boolean;
}

/** Records requests: older loads and full files, sent with a subpoena, court order or warrant */
export default function AgencyRecordsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ case_number: '', legal_basis: 'subpoena', subject: '', details: '' });
  const [file, setFile] = useState<File | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['agency-records'], queryFn: () => api.get('/api/v1/agency/records').then((r) => r.data.data as RecordRequest[]) });

  const send = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append('document', file);
      return api.post('/api/v1/agency/records', fd);
    },
    onSuccess: () => {
      toast.success('Request sent');
      setForm({ case_number: '', legal_basis: 'subpoena', subject: '', details: '' }); setFile(null);
      qc.invalidateQueries({ queryKey: ['agency-records'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="page-title">Records requests</h1>

      <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} className="card">
        <div className="card-head card-head-tint px-5 py-3"><p className="card-title">New request</p></div>
        <div className="card-body grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">Case number</span>
            <input value={form.case_number} onChange={(e) => set('case_number', e.target.value)} required className="profile-input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">Legal basis</span>
            <select value={form.legal_basis} onChange={(e) => set('legal_basis', e.target.value)} className="profile-select">
              {Object.entries(BASIS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">Records wanted</span>
            <input value={form.subject} onChange={(e) => set('subject', e.target.value)} required
              placeholder="e.g. Loads hauled by USDOT 1234567, 1–31 March" className="profile-input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">{form.legal_basis === 'emergency' ? 'The emergency' : 'Details'}</span>
            <textarea value={form.details} onChange={(e) => set('details', e.target.value)} rows={3} maxLength={5000}
              required={form.legal_basis === 'emergency'} className="profile-input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">
              {BASIS_LABEL[form.legal_basis]} document{form.legal_basis === 'emergency' ? ' (optional)' : ''}
            </span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required={form.legal_basis !== 'emergency'} className="text-sm" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={send.isPending} className="btn btn-navy flex items-center gap-2 disabled:opacity-60">
              {send.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send request
            </button>
          </div>
        </div>
      </form>

      {isLoading ? <div className="skeleton h-40 rounded-xl" /> : (
        <Table head={['Sent', 'Case', 'Basis', 'Records wanted', 'Officer', 'Status', 'Answer', '']} empty={rows.length === 0 && 'No requests yet'}>
          {rows.map((r) => (
            <tr key={r.id} className={tr}>
              <td className={`${td} whitespace-nowrap text-xs text-[var(--color-text-muted)]`}>{when(r.created_at)}</td>
              <td className={td}>{r.case_number}</td>
              <td className={td}>{BASIS_LABEL[r.legal_basis] ?? r.legal_basis}</td>
              <td className={td}>{r.subject}</td>
              <td className={td}>{r.officer}</td>
              <td className={td}><Pill value={r.status} /></td>
              <td className={`${td} text-xs text-[var(--color-text-muted)]`}>{r.response_notes ?? '—'}</td>
              <td className={td}>
                {r.has_document && (
                  <button onClick={() => openFile(`/api/v1/agency/records/${r.id}/file`).catch(() => toast.error('Could not open the file'))}
                    title="Document" className="text-[var(--color-teal)]"><FileText size={15} /></button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
