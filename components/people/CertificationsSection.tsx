'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, AlertCircle, FileText, Loader2, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, myChecksApi } from '@/lib/api';

interface Cred {
  id: number; type: string; type_label: string; name: string | null; issuer: string | null; number: string | null;
  issued_at: string | null; expires_at: string | null; has_document: boolean; state: string; verified_at: string | null;
  verification_method: string | null; source: string;
  ai: { status: 'reading' | 'verified' | 'review' | 'unreadable' | 'error'; reason: string | null; name_score: number | null } | null;
}
interface Checks { credentials: Cred[]; cert_types: { value: string; label: string }[]; document_ai: boolean }

type ApiError = { response?: { data?: { message?: string; error?: string; errors?: Record<string, string[]> } } };
const errorText = (e: ApiError, fallback: string) =>
  Object.values(e?.response?.data?.errors ?? {})[0]?.[0] ?? e?.response?.data?.error ?? e?.response?.data?.message ?? fallback;

const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-base focus:outline-none focus:border-[var(--color-teal)]';
const labelCls = 'block text-[13px] font-medium text-[var(--color-text-muted)] mb-1';
const EMPTY = { type: '', name: '', issuer: '', number: '', issued_at: '', expires_at: '' };
const fmt = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;

/** Where a certificate stands: verified (by document AI or Shipmater), being read, or waiting for review with the reason */
function Status({ c }: { c: Cred }) {
  if (c.state === 'met') {
    return <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-success)]"><CheckCircle size={13} />
      {c.verification_method === 'document_ai' ? 'Verified automatically' : 'Verified'}</span>;
  }
  if (c.state === 'expired') return <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-danger)]"><AlertCircle size={13} /> Expired</span>;
  if (c.ai?.status === 'reading') return <span className="inline-flex items-center gap-1 text-[13px] text-[var(--color-teal)]"><Loader2 size={13} className="animate-spin" /> Reading the document…</span>;
  return <span className="inline-flex items-center gap-1 text-[13px] text-[var(--color-warning)]"><Clock size={13} /> {c.has_document ? 'Awaiting review' : 'Upload the document'}</span>;
}

/**
 * Profile → Certifications. The person adds a certificate and uploads it; document AI reads it, fills in what was left
 * blank, and verifies it when the name matches, it hasn't expired and the number agrees. Otherwise Shipmater reviews it.
 * Verified, current certificates appear on the public profile (name, issuer and dates; never the document or number).
 */
export function CertificationsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['my-checks'],
    queryFn: () => myChecksApi.get().then((r) => r.data.data as Checks),
    // Poll while a document is being read
    refetchInterval: (q) => (q.state.data as Checks | undefined)?.credentials.some((c) => c.ai?.status === 'reading') ? 3000 : false,
  });
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['my-checks'] });

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (file) fd.append('document', file);
      return myChecksApi.saveCredential(fd, editing === 'new' ? undefined : (editing ?? undefined));
    },
    onSuccess: () => {
      toast.success(file && data?.document_ai ? 'Saved. Reading the document now.' : 'Saved. Shipmater will verify it.');
      setEditing(null); setForm(EMPTY); setFile(null); refresh();
    },
    onError: (e: ApiError) => toast.error(errorText(e, 'Could not save')),
  });
  const remove = useMutation({
    mutationFn: (id: number) => myChecksApi.deleteCredential(id),
    onSuccess: () => { toast.success('Removed'); refresh(); },
    onError: (e: ApiError) => toast.error(errorText(e, 'Could not remove')),
  });

  async function view(id: number) {
    try {
      const r = await api.get(`/api/v1/me/credentials/${id}/file`, { responseType: 'blob' });
      window.open(URL.createObjectURL(r.data), '_blank', 'noopener');
    } catch { toast.error('Could not open the document'); }
  }

  if (isLoading || !data) return <div className="skeleton h-28 rounded-xl" />;
  const types = data.cert_types;
  const certs = data.credentials.filter((c) => types.some((t) => t.value === c.type));
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  function edit(c: Cred) {
    setEditing(c.id); setFile(null);
    setForm({ type: c.type, name: c.name ?? '', issuer: c.issuer ?? '', number: c.number ?? '', issued_at: c.issued_at ?? '', expires_at: c.expires_at ?? '' });
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]/50 px-4 py-2">
          <div>
            <p className="card-title">Your certifications</p>
          </div>
          {editing === null && (
            <button onClick={() => { setEditing('new'); setForm(EMPTY); setFile(null); }}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] px-3 py-1.5 text-[13px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]">
              <Plus size={12} /> Add
            </button>
          )}
        </header>

        {certs.length === 0 && editing === null && <p className="px-4 py-4 text-sm text-[var(--color-text-muted)]">No certifications yet. Add a TWIC card, hazmat training, a dispatcher or safety course certificate.</p>}

        {certs.length > 0 && (
          <ul className="divide-y divide-[var(--color-cream-dark)]">
            {certs.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-medium text-[var(--color-text)]">{c.name || c.type_label}</p>
                    <p className="text-[13px] text-[var(--color-text-faint)]">
                      {[c.name && c.name !== c.type_label ? c.type_label : null, c.issuer, c.issued_at && `Issued ${fmt(c.issued_at)}`, c.expires_at && `Expires ${fmt(c.expires_at)}`].filter(Boolean).join(' · ') || 'No details yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Status c={c} />
                    {c.has_document && <button onClick={() => view(c.id)} title="View document" className="text-[var(--color-text-faint)] hover:text-[var(--color-teal)]"><FileText size={14} /></button>}
                    {c.source === 'self' && <button onClick={() => edit(c)} title="Edit" className="text-[var(--color-text-faint)] hover:text-[var(--color-teal)]"><Pencil size={14} /></button>}
                    {!c.verified_at && c.source === 'self' && (
                      <button onClick={() => { if (confirm(`Remove ${c.name || c.type_label}?`)) remove.mutate(c.id); }} title="Remove"
                        className="text-[var(--color-text-faint)] hover:text-[var(--color-danger)]"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                {c.state !== 'met' && c.ai && ['review', 'unreadable', 'error'].includes(c.ai.status) && c.ai.reason && (
                  <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-[var(--color-cream)] px-3 py-2 text-[13px] text-[var(--color-text-muted)]">
                    <Sparkles size={13} className="mt-0.5 shrink-0 text-[var(--color-teal)]" />
                    <span>{c.ai.reason} {c.ai.status === 'review' ? 'Shipmater will review it, or correct the details and upload again.' : ''}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {editing !== null && (
          <div className="border-t border-[var(--color-cream-dark)] px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-semibold text-[var(--color-text)]">{editing === 'new' ? 'Add a certification' : 'Edit certification'}</p>
              <button onClick={() => setEditing(null)} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"><X size={16} /></button>
            </div>
            <label className="mb-3 block rounded-lg border border-dashed border-[var(--color-teal)] bg-[var(--color-teal-pale)]/40 px-4 py-3">
              <span className="block text-[13px] font-semibold text-[var(--color-text)]">Certificate (PDF or photo){editing === 'new' && ' *'}</span>
              <span className="block text-[13px] text-[var(--color-text-muted)] mb-2">
                {data.document_ai ? 'It is read automatically: leave the details below blank and they are filled in from the document.' : 'Shipmater reviews each certificate.'}
              </span>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label><span className={labelCls}>Type *</span>
                <select value={form.type} onChange={set('type')} className={inputCls} disabled={editing !== 'new'}>
                  <option value="">Choose…</option>
                  {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label><span className={labelCls}>Name</span><input value={form.name} onChange={set('name')} placeholder="e.g. Smith System driver training" className={inputCls} /></label>
              <label><span className={labelCls}>Issued by</span><input value={form.issuer} onChange={set('issuer')} className={inputCls} /></label>
              <label><span className={labelCls}>Certificate number</span><input value={form.number} onChange={set('number')} className={inputCls} /></label>
              <label><span className={labelCls}>Issued</span><input type="date" value={form.issued_at} onChange={set('issued_at')} className={inputCls} /></label>
              <label><span className={labelCls}>Expires</span><input type="date" value={form.expires_at} onChange={set('expires_at')} className={inputCls} /></label>
            </div>
            <button onClick={() => save.mutate()} disabled={!form.type || (editing === 'new' && !file) || save.isPending}
              className="mt-3 rounded-lg bg-[var(--color-teal)] px-4 py-2 text-base font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-50">
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
