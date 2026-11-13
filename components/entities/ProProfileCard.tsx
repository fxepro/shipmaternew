'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Copy, ExternalLink, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { DataCard, fmtDate } from '@/components/profile/DataCard';
import { ChipPicker, useCatalog, nameOf } from './catalog';

type Visibility = 'private' | 'platform' | 'public';
interface Experience {
  id: number; title: string; company_name: string; org_id: number | null; employment_type: string | null; employment_type_label: string | null;
  location: string | null; start_date: string; end_date: string | null; current: boolean; description: string | null; equipment: string[]; verified: boolean;
}
interface Pro {
  headline: string | null; roles: string[]; cdl_class: string | null; cdl_state: string | null; endorsements: string[];
  years_experience: number | null; equipment_experience: string[]; haul_types: string[]; team_ok: boolean;
  home_city: string | null; home_state: string | null; open_to_work: boolean; available_from: string | null; bio: string | null;
  visibility: Visibility; slug: string | null; experiences: Experience[];
}

const ABOUT_MAX_WORDS = 1000;
const words = (s: string | null) => (s ?? '').trim().split(/\s+/).filter(Boolean).length;
const VISIBILITY: Record<Visibility, { label: string; hint: string }> = {
  private:  { label: 'Only me', hint: 'Nobody else can open it.' },
  platform: { label: 'Companies on Shipmater', hint: 'Only people signed in to Shipmater.' },
  public:   { label: 'Anyone with the link', hint: 'Contact details show only to people signed in.' },
};
const EMP_TYPES: [string, string][] = [
  ['company_driver', 'Company driver'], ['owner_operator', 'Owner-operator'], ['lease_operator', 'Lease operator'],
  ['contract', 'Contract'], ['office', 'Office / staff'], ['training', 'Training'],
];
const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-base focus:outline-none focus:border-[var(--color-teal)]';
const label = 'mb-1 block text-xs font-medium text-[var(--color-text-muted)]';
const monthLabel = (ym: string | null) => ym ? new Date(ym + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
const errText = (e: any, f: string): string => (Object.values(e?.response?.data?.errors ?? {}) as string[][])[0]?.[0] ?? e?.response?.data?.message ?? f;

/**
 * A person's professional profile: their resume on Shipmater. It belongs to the person and goes with them between companies.
 * CDL class and endorsements are shown from Driving credentials (one place to enter them), not edited here.
 * The public page is /p/{slug}; who can open it is set by visibility.
 */
/** driving: the CDL, equipment and haul-type fields, for people at a carrier. Off for shippers, brokers, factors and receivers. */
export function ProProfileCard({ driving = true }: { driving?: boolean }) {
  const catalog = useCatalog();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['pro-profile'], queryFn: () => api.get('/api/v1/me/pro-profile').then((r) => r.data.data as Pro) });
  const [p, setP] = useState<Pro | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setP(data); }, [data]);
  if (!p || !data) return <div className="skeleton h-40 rounded-xl" />;

  const set = <K extends keyof Pro>(k: K, v: Pro[K]) => setP({ ...p, [k]: v });
  const names = (items: { key: string; name: string }[], keys: string[]) => keys.map((k) => nameOf(items, k)).join(', ') || null;
  const link = data.slug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${data.slug}` : null;

  const save = async (patch?: Partial<Pro>) => {
    setSaving(true);
    try {
      const { endorsements, cdl_class, cdl_state, experiences, slug, ...rest } = { ...p, ...patch };
      const r = await api.put('/api/v1/me/pro-profile', rest);
      qc.setQueryData(['pro-profile'], r.data.data);
      setP(r.data.data);
      setEditing(false);
      toast.success('Professional profile saved');
    } catch (e) {
      toast.error(errText(e, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast.success('Link copied'); } catch { toast.error('Could not copy. Select the link and copy it.'); }
  };

  const shareCard = (
    <DataCard title="Your profile link">
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-cream)] px-3 py-2 text-sm text-[var(--color-text)]">{link ?? '…'}</code>
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-teal)] px-3 py-2 text-sm font-semibold text-[var(--color-teal)] hover:bg-[var(--color-teal-pale)]"><Copy size={14} /> Copy</button>
          {data.slug && <a href={`/p/${data.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] px-3 py-2 text-sm font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"><ExternalLink size={14} /> View</a>}
        </div>
        <div>
          <span className={label}>Who can open it</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VISIBILITY) as Visibility[]).map((v) => (
              <button key={v} onClick={() => v !== data.visibility && save({ visibility: v })} disabled={saving}
                className={`rounded-lg border px-3 py-1.5 text-sm ${data.visibility === v ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)] font-semibold text-[var(--color-teal)]' : 'border-[var(--color-cream-dark)] text-[var(--color-text-muted)] hover:border-[var(--color-teal)]'}`}>
                {VISIBILITY[v].label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[13px] text-[var(--color-text-faint)]">{VISIBILITY[data.visibility].hint}</p>
        </div>
      </div>
    </DataCard>
  );

  if (!editing) {
    return (
      <div className="space-y-4">
        {shareCard}
        <DataCard title="Professional profile"
          action={<button onClick={() => setEditing(true)} className="text-base font-medium text-[var(--color-teal)] hover:underline">Edit</button>}
          rows={[
            ['Headline', data.headline],
            ...(driving ? [
              ['What you do', names(catalog.pro_roles, data.roles)],
              ['CDL', data.cdl_class ? `Class ${data.cdl_class}${data.cdl_state ? ` · ${data.cdl_state}` : ''}` : null],
              ['Endorsements', names(catalog.endorsements, data.endorsements)],
            ] as [string, string | null][] : []),
            ['Years of experience', data.years_experience != null ? String(data.years_experience) : null],
            ...(driving ? [
              ['Equipment run', names(catalog.equipment, data.equipment_experience)],
              ['Haul types', names(catalog.haul_types, data.haul_types)],
              ['Team driving', data.team_ok ? 'Open to it' : 'No'],
            ] as [string, string | null][] : []),
            ['Home base', [data.home_city, data.home_state].filter(Boolean).join(', ') || null],
            ['Open to work', data.open_to_work ? `Yes${data.available_from ? `, from ${fmtDate(data.available_from)}` : ''}` : 'No'],
          ]} />
        <DataCard title="About"
          action={<button onClick={() => setEditing(true)} className="text-base font-medium text-[var(--color-teal)] hover:underline">Edit</button>}>
          <div className="px-4 py-3 text-base text-[var(--color-text)] whitespace-pre-line">
            {data.bio || <span className="text-[var(--color-text-faint)]">—</span>}
          </div>
        </DataCard>
        <WorkHistory driving={driving} items={data.experiences} catalog={catalog} onChange={() => qc.invalidateQueries({ queryKey: ['pro-profile'] })} />
      </div>
    );
  }

  const aboutWords = words(p.bio);
  return (
    <div className="space-y-4">
      <DataCard title="Professional profile">
        <div className="space-y-4 px-4 py-4">
          <label className="block"><span className={label}>Headline</span>
            <input value={p.headline ?? ''} onChange={(e) => set('headline', e.target.value)} placeholder={driving ? 'e.g. Class A reefer driver, 12 years OTR' : 'e.g. Logistics manager, 8 years in food distribution'} maxLength={160} className={inputCls} />
          </label>
          {driving && <div><span className={label}>What you do</span><ChipPicker items={catalog.pro_roles} value={p.roles} onChange={(v) => set('roles', v)} /></div>}
          <div className="grid grid-cols-2 gap-3">
            <label><span className={label}>Years of experience</span>
              <input type="number" min={0} max={70} value={p.years_experience ?? ''} onChange={(e) => set('years_experience', e.target.value === '' ? null : Number(e.target.value))} className={inputCls} />
            </label>
            <label><span className={label}>Home base (city, state)</span>
              <input value={[p.home_city, p.home_state].filter(Boolean).join(', ')} placeholder="Denver, CO"
                onChange={(e) => { const [c, s] = e.target.value.split(',').map((x) => x.trim()); setP({ ...p, home_city: c || null, home_state: s || null }); }} className={inputCls} />
            </label>
          </div>
          {driving && <div><span className={label}>Equipment you have run</span><ChipPicker items={catalog.equipment} value={p.equipment_experience} onChange={(v) => set('equipment_experience', v)} /></div>}
          {driving && <div><span className={label}>Haul types</span><ChipPicker items={catalog.haul_types} value={p.haul_types} onChange={(v) => set('haul_types', v)} /></div>}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-base text-[var(--color-text)]">
            {driving && <label className="flex items-center gap-2"><input type="checkbox" checked={p.team_ok} onChange={(e) => set('team_ok', e.target.checked)} className="h-4 w-4 accent-[var(--color-teal)]" /> Open to team driving</label>}
            <label className="flex items-center gap-2"><input type="checkbox" checked={p.open_to_work} onChange={(e) => set('open_to_work', e.target.checked)} className="h-4 w-4 accent-[var(--color-teal)]" /> Open to work</label>
            {p.open_to_work && (
              <label className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">Available from
                <input type="date" value={p.available_from ?? ''} onChange={(e) => set('available_from', e.target.value || null)} className="rounded-lg border border-[var(--color-cream-dark)] px-2 py-1 text-base" />
              </label>
            )}
          </div>
          <label className="block"><span className={label}>About you</span>
            <textarea value={p.bio ?? ''} onChange={(e) => set('bio', e.target.value)} rows={10} className={inputCls}
              placeholder={driving ? "Freight you know, lanes you run, your safety record, what you're looking for." : undefined} />
            <span className={`mt-1 block text-right text-xs ${aboutWords > ABOUT_MAX_WORDS ? 'font-semibold text-[var(--color-danger)]' : 'text-[var(--color-text-faint)]'}`}>
              {aboutWords.toLocaleString()} / {ABOUT_MAX_WORDS.toLocaleString()} words
            </span>
          </label>
          <div className="flex gap-2">
            <button onClick={() => save()} disabled={saving || aboutWords > ABOUT_MAX_WORDS} className="btn btn-navy disabled:opacity-50">Save</button>
            <button onClick={() => { setP(data); setEditing(false); }} className="btn border border-[var(--color-cream-dark)]">Cancel</button>
          </div>
        </div>
      </DataCard>
    </div>
  );
}

const EMPTY_JOB = { title: '', company_name: '', org_id: '', employment_type: '', location: '', start_date: '', end_date: '', current: true, description: '', equipment: [] as string[] };

/** Work history, newest first. A job at a Shipmater company you belong to shows as verified. */
function WorkHistory({ items, catalog, onChange, driving }: { items: Experience[]; catalog: ReturnType<typeof useCatalog>; onChange: () => void; driving: boolean }) {
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [f, setF] = useState(EMPTY_JOB);
  const [busy, setBusy] = useState(false);
  const { data: companies = [] } = useQuery({
    queryKey: ['my-experience-companies'],
    queryFn: () => api.get('/api/v1/me/experiences/companies').then((r) => r.data.data as { id: number; name: string }[]),
    enabled: editing !== null,
  });

  const open = (e?: Experience) => {
    setEditing(e ? e.id : 'new');
    setF(e ? {
      title: e.title, company_name: e.company_name, org_id: e.org_id ? String(e.org_id) : '', employment_type: e.employment_type ?? '',
      location: e.location ?? '', start_date: e.start_date, end_date: e.end_date ?? '', current: e.current, description: e.description ?? '', equipment: e.equipment,
    } : EMPTY_JOB);
  };

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        title: f.title, company_name: f.company_name, org_id: f.org_id ? Number(f.org_id) : null, employment_type: f.employment_type || null,
        location: f.location || null, start_date: f.start_date ? `${f.start_date}-01` : null,
        end_date: f.current || !f.end_date ? null : `${f.end_date}-01`, description: f.description || null, equipment: f.equipment,
      };
      if (editing === 'new') await api.post('/api/v1/me/experiences', body);
      else await api.put(`/api/v1/me/experiences/${editing}`, body);
      toast.success('Work history saved');
      setEditing(null);
      onChange();
    } catch (e) {
      toast.error(errText(e, 'Could not save'));
    } finally { setBusy(false); }
  };

  const remove = async (e: Experience) => {
    if (!confirm(`Remove ${e.title} at ${e.company_name}?`)) return;
    try { await api.delete(`/api/v1/me/experiences/${e.id}`); toast.success('Removed'); onChange(); } catch (err) { toast.error(errText(err, 'Could not remove')); }
  };

  const pickCompany = (id: string) => {
    const c = companies.find((x) => String(x.id) === id);
    setF({ ...f, org_id: id, company_name: c ? c.name : f.company_name });
  };

  return (
    <DataCard title="Work history"
      action={editing === null && <button onClick={() => open()} className="inline-flex items-center gap-1 text-base font-medium text-[var(--color-teal)] hover:underline"><Plus size={14} /> Add job</button>}>
      {items.length === 0 && editing === null && <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">No jobs yet.</p>}
      {items.length > 0 && (
        <ul className="divide-y divide-[var(--color-cream-dark)]">
          {items.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-[var(--color-text)]">{e.title}</p>
                  <p className="text-sm text-[var(--color-text)]">
                    {e.company_name}
                    {e.verified && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-teal-pale)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-teal)]"><BadgeCheck size={11} /> On Shipmater</span>}
                  </p>
                  <p className="text-[13px] text-[var(--color-text-faint)]">
                    {[`${monthLabel(e.start_date)} – ${e.current ? 'Present' : monthLabel(e.end_date)}`, e.employment_type_label, e.location].filter(Boolean).join(' · ')}
                  </p>
                  {e.equipment.length > 0 && <p className="text-[13px] text-[var(--color-text-muted)]">{e.equipment.map((k) => nameOf(catalog.equipment, k)).join(', ')}</p>}
                  {e.description && <p className="mt-1 whitespace-pre-line text-sm text-[var(--color-text-muted)]">{e.description}</p>}
                </div>
                {editing === null && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => open(e)} title="Edit" className="text-[var(--color-text-faint)] hover:text-[var(--color-teal)]"><Pencil size={14} /></button>
                    <button onClick={() => remove(e)} title="Remove" className="text-[var(--color-text-faint)] hover:text-[var(--color-danger)]"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing !== null && (
        <div className="space-y-3 border-t border-[var(--color-cream-dark)] px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-[var(--color-text)]">{editing === 'new' ? 'Add a job' : 'Edit job'}</p>
            <button onClick={() => setEditing(null)} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label><span className={label}>Job title *</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Class A OTR driver" maxLength={120} className={inputCls} /></label>
            <label><span className={label}>Type</span>
              <select value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value })} className={inputCls}>
                <option value="">—</option>{EMP_TYPES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </label>
            {companies.length > 0 && (
              <label><span className={label}>A company on Shipmater</span>
                <select value={f.org_id} onChange={(e) => pickCompany(e.target.value)} className={inputCls}>
                  <option value="">Not on Shipmater</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            <label><span className={label}>Company *</span><input value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value, org_id: '' })} maxLength={160} className={inputCls} /></label>
            <label><span className={label}>Location</span><input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="City, state" className={inputCls} /></label>
            <label><span className={label}>Start *</span><input type="month" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} className={inputCls} /></label>
            <div>
              <label><span className={label}>End</span><input type="month" value={f.end_date} disabled={f.current} onChange={(e) => setF({ ...f, end_date: e.target.value })} className={`${inputCls} disabled:opacity-50`} /></label>
              <label className="mt-1.5 flex items-center gap-2 text-sm text-[var(--color-text)]"><input type="checkbox" checked={f.current} onChange={(e) => setF({ ...f, current: e.target.checked })} className="h-4 w-4 accent-[var(--color-teal)]" /> I work here now</label>
            </div>
          </div>
          {driving && <div><span className={label}>Equipment run</span><ChipPicker items={catalog.equipment} value={f.equipment} onChange={(v) => setF({ ...f, equipment: v })} /></div>}
          <label className="block"><span className={label}>What you did</span>
            <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={4} maxLength={3000} className={inputCls}
              placeholder={driving ? "Freight, lanes, miles, safety record, anything you're proud of." : undefined} />
          </label>
          <button onClick={save} disabled={busy || !f.title || !f.company_name || !f.start_date} className="btn btn-navy disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
    </DataCard>
  );
}
