'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useCan } from '@/components/layout/PermissionsContext';

const words = (t: string) => t.trim() ? t.trim().split(/\s+/).length : 0;

/** Company page, Business: the company's profile link (/c/…) and its About, up to 1,000 words */
export function CompanyProfileCard() {
  const qc = useQueryClient();
  const can = useCan();
  const { data } = useQuery({
    queryKey: ['company-public-profile'],
    queryFn: () => api.get('/api/v1/org/public-profile').then((r) => r.data.data as { slug: string; about: string | null }),
  });
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setAbout(data?.about ?? ''); }, [data?.about]);

  if (!data) return <div className="skeleton h-24 rounded-xl" />;
  const url = typeof window !== 'undefined' ? `${window.location.origin}/c/${data.slug}` : `/c/${data.slug}`;
  const count = words(about);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copied'); } catch { toast.error('Could not copy the link'); }
  };
  const save = async () => {
    setSaving(true);
    try {
      await api.put('/api/v1/org/public-profile', { about });
      await qc.invalidateQueries({ queryKey: ['company-public-profile'] });
      setEditing(false); toast.success('Saved');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]/50 px-4 py-2">
        <p className="card-title">Company profile</p>
        {can.do('company.profile') && !editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-teal)]"><Pencil size={12} /> Edit About</button>
        )}
      </header>
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-[var(--color-cream)] px-2.5 py-1 text-sm text-[var(--color-text)]">{url.replace(/^https?:\/\//, '')}</code>
          <button onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-cream-dark)] px-2.5 py-1 text-[13px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"><Copy size={12} /> Copy</button>
          <a href={`/c/${data.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-cream-dark)] px-2.5 py-1 text-[13px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"><ExternalLink size={12} /> View</a>
        </div>
        {editing ? (
          <div>
            <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={8}
              className="w-full rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-2 text-base focus:border-[var(--color-teal)] focus:outline-none" />
            <div className="mt-2 flex items-center gap-3">
              <button onClick={save} disabled={saving || count > 1000} className="rounded-lg bg-[var(--color-teal)] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => { setEditing(false); setAbout(data.about ?? ''); }} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Cancel</button>
              <span className={`ml-auto text-xs ${count > 1000 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-faint)]'}`}>{count} / 1,000 words</span>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-line text-base text-[var(--color-text)]">{data.about || <span className="text-[var(--color-text-faint)]">No About yet.</span>}</p>
        )}
      </div>
    </section>
  );
}
