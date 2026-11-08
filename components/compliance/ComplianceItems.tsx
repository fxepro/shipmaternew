'use client';

import { useState } from 'react';
import { CheckCircle2, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export type ComplianceState = 'passed' | 'pending' | 'missing' | 'failed' | 'expired';
export interface ComplianceItem {
  section: string; key: string; label: string; required: boolean; value: string | null; value_raw?: string | null;
  verified: boolean | null; expires: string | null; file: string | null; state: ComplianceState; detail: string | null;
  /** Set when the item is uploaded as a file: what else to ask for */
  upload: { value_label: string | null; expires: boolean } | null;
}

const STATE: Record<ComplianceState, [string, string]> = {
  passed:  ['bg-emerald-50 text-emerald-700', 'Passed'],
  pending: ['bg-amber-50 text-amber-700', 'Pending'],
  missing: ['bg-[var(--color-cream)] text-[var(--color-text-muted)]', 'Missing'],
  failed:  ['bg-red-50 text-red-700', 'Failed'],
  expired: ['bg-red-50 text-red-700', 'Expired'],
};

/**
 * The compliance items that apply to one company, by section.
 * uploadUrl: where a file is sent (company's own endpoint, or the admin one). Omit for read-only.
 * verifyUrl: admins only, to mark an uploaded file verified or not.
 */
export function ComplianceItems({ items, uploadUrl, verifyUrl, onChange }: {
  items: ComplianceItem[];
  uploadUrl?: (key: string) => string;
  verifyUrl?: (key: string) => string;
  onChange: (items: ComplianceItem[]) => void;
}) {
  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-4 py-3">
        <p className="text-sm italic text-[var(--color-text-faint)]">No compliance required for this type of company.</p>
      </section>
    );
  }
  const sections = Array.from(new Set(items.map((i) => i.section)));
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {sections.map((s) => (
        <section key={s} className="overflow-hidden rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <header className="border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]/40 px-4 py-2">
            <p className="text-sm font-semibold text-[var(--color-slate)]">{s}</p>
          </header>
          <div className="space-y-3 px-4 py-3">
            {items.filter((i) => i.section === s).map((i) => (
              <Item key={i.key} item={i} uploadUrl={uploadUrl} verifyUrl={verifyUrl} onChange={onChange} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Item({ item: i, uploadUrl, verifyUrl, onChange }: {
  item: ComplianceItem; uploadUrl?: (key: string) => string; verifyUrl?: (key: string) => string; onChange: (items: ComplianceItem[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [value, setValue] = useState(i.value_raw ?? '');
  const [expires, setExpires] = useState(i.expires ?? '');
  const [busy, setBusy] = useState(false);
  const [cls, word] = STATE[i.state];
  const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-teal)]';

  const fail = (e: unknown) => {
    const r = (e as { response?: { data?: { message?: string; error?: string } } }).response?.data;
    toast.error(r?.message ?? r?.error ?? 'Something went wrong');
  };

  const upload = async () => {
    if (!file || !uploadUrl) return;
    const fd = new FormData();
    fd.append('document', file);
    if (i.upload?.value_label && value.trim()) fd.append('value', value.trim());
    if (i.upload?.expires && expires) fd.append('expires', expires);
    setBusy(true);
    try {
      const r = await api.post(uploadUrl(i.key), fd);
      onChange(r.data.data);
      toast.success(`${i.label} uploaded`);
      setOpen(false); setFile(null);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const verify = async (verified: boolean) => {
    if (!verifyUrl) return;
    setBusy(true);
    try {
      const r = await api.post(verifyUrl(i.key), { verified });
      onChange(r.data.data);
      toast.success(verified ? `${i.label} verified` : `${i.label} marked not verified`);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--color-text-faint)]">
        {i.label}
        <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${i.required ? 'bg-[var(--color-slate)] text-white' : 'bg-[var(--color-cream)] text-[var(--color-text-muted)]'}`}>
          {i.required ? 'Required' : 'Optional'}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">
        <span className={i.value ? 'font-medium text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}>{i.value ?? '—'}</span>
        {i.file && <a href={i.file} target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--color-teal)] hover:underline">View file</a>}
        <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
          {i.state === 'passed' && i.verified ? <span className="inline-flex items-center gap-0.5"><CheckCircle2 size={10} />Verified</span> : word}
        </span>
        {i.detail && <span className="text-xs text-[var(--color-text-faint)]">{i.detail}</span>}
        {i.upload && uploadUrl && !open && (
          <button type="button" onClick={() => setOpen(true)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--color-teal)] hover:underline">
            <Upload size={12} />{i.file ? 'Replace' : 'Upload'}
          </button>
        )}
        {i.upload && verifyUrl && i.file && (
          i.verified
            ? <button type="button" disabled={busy} onClick={() => verify(false)} className="text-xs font-medium text-[var(--color-text-muted)] hover:underline disabled:opacity-50">Unverify</button>
            : <button type="button" disabled={busy} onClick={() => verify(true)} className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-50">Verify</button>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-cream)]/40 p-2.5">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-xs" aria-label={`${i.label} file`} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {i.upload?.value_label && <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={i.upload.value_label} className={inputCls} />}
            {i.upload?.expires && <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} aria-label="Expires" className={inputCls} />}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={upload} disabled={!file || busy} className="btn btn-navy inline-flex items-center gap-1.5 disabled:opacity-50">
              {busy && <Loader2 size={13} className="animate-spin" />}Save
            </button>
            <button type="button" onClick={() => { setOpen(false); setFile(null); }} className="btn border border-[var(--color-cream-dark)]">Cancel</button>
          </div>
          <p className="text-[11px] text-[var(--color-text-faint)]">PDF or image, up to 10 MB. Shipmater checks it before it counts as verified.</p>
        </div>
      )}
    </div>
  );
}
