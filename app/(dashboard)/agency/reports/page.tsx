'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Pill, Table, errorMessage, td, tr, when } from '@/components/lawenforcement/shared';

interface Section { key: string; label: string; status: string; at: string | null; rows: { label: string; value: string; flag: boolean }[] }
interface Report {
  id: number; query_type: string; query: string; state: string | null; case_number: string | null; company_name: string | null;
  status: string; price: number; charge_status: string; sections: Section[]; run_by: string; created_at: string; completed_at: string | null;
}

const TYPES: [string, string][] = [['usdot', 'USDOT'], ['mc', 'MC'], ['ein', 'EIN'], ['name', 'Business name']];

async function downloadPdf(id: number) {
  const r = await api.get(`/api/v1/agency/reports/${id}/pdf`, { responseType: 'blob', headers: { Accept: 'application/pdf' } });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.data as Blob);
  a.download = `business-report-${id}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

function ReportView({ id }: { id: number }) {
  const { data: r } = useQuery({
    queryKey: ['agency-report', id],
    queryFn: () => api.get(`/api/v1/agency/reports/${id}`).then((x) => x.data.data as Report),
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 2500 : false),
  });
  if (!r) return <div className="skeleton h-64 rounded-xl" />;
  return (
    <section className="card">
      <div className="card-head card-head-tint flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <p className="card-title">{r.company_name ?? r.query}</p>
          <Pill value={r.status} />
        </div>
        {r.status === 'ready' && (
          <button onClick={() => downloadPdf(r.id).catch(() => toast.error('Could not download'))} className="btn btn-navy flex items-center gap-1.5 text-[13px]">
            <Download size={13} /> PDF
          </button>
        )}
      </div>
      <div className="card-body space-y-5">
        {r.status === 'not_found' && <p className="text-sm text-[var(--color-text-muted)]">No business found. You are not charged.</p>}
        {r.sections.map((s) => (
          <div key={s.key}>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{s.label}</p>
              {s.status === 'pending' && <Loader2 size={12} className="animate-spin text-[var(--color-teal)]" />}
            </div>
            {s.rows.length === 0 ? (
              <p className="text-sm text-[var(--color-text-faint)]">{s.status === 'pending' ? 'Running…' : 'Nothing found'}</p>
            ) : (
              <dl className="divide-y divide-[var(--color-cream-dark)] rounded-lg border border-[var(--color-cream-dark)]">
                {s.rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-4 py-2 text-sm">
                    <dt className="text-[var(--color-text-muted)]">{row.label}</dt>
                    <dd className={`flex items-center gap-1.5 ${row.flag ? 'font-medium text-[var(--color-danger)]' : ''}`}>
                      {row.flag && <AlertTriangle size={13} />}{row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Business reports on companies not on Shipmater: FMCSA, state registration and sanctions, billed per report */
export default function AgencyReportsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ query_type: 'usdot', query: '', state: '', case_number: '' });
  const [open, setOpen] = useState<number | null>(null);
  const [onShipmater, setOnShipmater] = useState<{ id: number; name: string } | null>(null);
  const { data } = useQuery({ queryKey: ['agency-reports'], queryFn: () => api.get('/api/v1/agency/reports').then((r) => r.data.data as Report[]) });

  const run = useMutation({
    mutationFn: () => api.post('/api/v1/agency/reports', {
      query_type: form.query_type, query: form.query.trim(), state: form.state.trim().toUpperCase() || null, case_number: form.case_number.trim() || null,
    }),
    onSuccess: (r) => {
      const d = r.data.data;
      if (d.on_shipmater) { setOnShipmater(d.on_shipmater); setOpen(null); return; }
      setOnShipmater(null); setOpen(d.id);
      qc.invalidateQueries({ queryKey: ['agency-reports'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const set = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));
  const rows = data ?? [];
  const price = rows[0]?.price ?? 10;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Business reports</h1>

      <form onSubmit={(e) => { e.preventDefault(); run.mutate(); }} className="card">
        <div className="card-body flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">Search by</span>
            <select value={form.query_type} onChange={(e) => set('query_type', e.target.value)} className="profile-select">
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">{TYPES.find(([v]) => v === form.query_type)?.[1]}</span>
            <input value={form.query} onChange={(e) => set('query', e.target.value)} required minLength={3} className="profile-input" />
          </label>
          {form.query_type === 'name' && (
            <label className="block w-24">
              <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">State</span>
              <input value={form.state} onChange={(e) => set('state', e.target.value)} required maxLength={2} placeholder="OH" className="profile-input uppercase" />
            </label>
          )}
          <label className="block w-44">
            <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">Case number</span>
            <input value={form.case_number} onChange={(e) => set('case_number', e.target.value)} className="profile-input" />
          </label>
          <button type="submit" disabled={run.isPending} className="btn btn-navy flex items-center gap-2 disabled:opacity-60">
            {run.isPending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Run report · ${price}
          </button>
        </div>
      </form>

      {onShipmater && (
        <p className="rounded-xl border border-[var(--color-teal)] bg-[var(--color-teal-pale)] px-5 py-3 text-sm">
          <strong>{onShipmater.name}</strong> is on Shipmater. <Link href={`/admin/companies/${onShipmater.id}`} className="font-medium text-[var(--color-teal)] hover:underline">Open it in Companies</Link> (free).
        </p>
      )}

      {open && <ReportView id={open} />}

      <Table head={['Run', 'Search', 'Business', 'Case', 'Run by', 'Status', 'Charge', '']} empty={rows.length === 0 && 'No reports yet'}>
        {rows.map((r) => (
          <tr key={r.id} onClick={() => setOpen(r.id)} className={`${tr} cursor-pointer hover:bg-[var(--color-cream)] ${open === r.id ? 'bg-[var(--color-cream)]' : ''}`}>
            <td className={`${td} whitespace-nowrap text-xs text-[var(--color-text-muted)]`}>{when(r.created_at)}</td>
            <td className={td}>{r.query_type.toUpperCase()} {r.query}{r.state ? ` · ${r.state}` : ''}</td>
            <td className={td}>{r.company_name ?? '—'}</td>
            <td className={td}>{r.case_number ?? '—'}</td>
            <td className={td}>{r.run_by}</td>
            <td className={td}><Pill value={r.status} /></td>
            <td className={`${td} text-xs`}>{r.charge_status === 'not_charged' ? 'Not charged' : `$${r.price}`}</td>
            <td className={td}>
              {r.status === 'ready' && (
                <button onClick={(e) => { e.stopPropagation(); downloadPdf(r.id).catch(() => toast.error('Could not download')); }}
                  title="PDF" className="text-[var(--color-teal)]"><Download size={15} /></button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
