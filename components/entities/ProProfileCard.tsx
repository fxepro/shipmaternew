'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DataCard, fmtDate } from '@/components/profile/DataCard';
import { ChipPicker, useCatalog, nameOf } from './catalog';

interface Pro {
  headline: string | null; roles: string[]; cdl_class: string | null; cdl_state: string | null; endorsements: string[];
  years_experience: number | null; equipment_experience: string[]; haul_types: string[]; team_ok: boolean;
  home_city: string | null; home_state: string | null; open_to_work: boolean; available_from: string | null; bio: string | null;
  visibility: 'private' | 'platform';
}

/**
 * A person's professional profile. It belongs to the person and goes with them between companies.
 * CDL class and endorsements are shown from Driving credentials (one place to enter them), not edited here.
 */
export function ProProfileCard() {
  const catalog = useCatalog();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['pro-profile'], queryFn: () => api.get('/api/v1/me/pro-profile').then((r) => r.data.data as Pro) });
  const [p, setP] = useState<Pro | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setP(data); }, [data]);
  if (!p || !data) return null;

  const set = <K extends keyof Pro>(k: K, v: Pro[K]) => setP({ ...p, [k]: v });
  const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]';
  const label = 'mb-1 block text-xs font-medium text-[var(--color-text-muted)]';
  const names = (items: { key: string; name: string }[], keys: string[]) => keys.map((k) => nameOf(items, k)).join(', ') || null;

  const save = async () => {
    setSaving(true);
    try {
      const { endorsements, cdl_class, cdl_state, ...rest } = p;
      const r = await api.put('/api/v1/me/pro-profile', rest);
      qc.setQueryData(['pro-profile'], r.data.data);
      setEditing(false);
      toast.success('Professional profile saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <DataCard title="Professional profile" subtitle="Yours, not your company's: it stays with you if you change companies."
        action={<button onClick={() => setEditing(true)} className="text-sm font-medium text-[var(--color-teal)] hover:underline">Edit</button>}
        rows={[
          ['Headline', data.headline],
          ['What you do', names(catalog.pro_roles, data.roles)],
          ['CDL', data.cdl_class ? `Class ${data.cdl_class}${data.cdl_state ? ` · ${data.cdl_state}` : ''}` : null],
          ['Endorsements', names(catalog.endorsements, data.endorsements)],
          ['Years of experience', data.years_experience != null ? String(data.years_experience) : null],
          ['Equipment run', names(catalog.equipment, data.equipment_experience)],
          ['Haul types', names(catalog.haul_types, data.haul_types)],
          ['Team driving', data.team_ok ? 'Open to it' : 'No'],
          ['Home base', [data.home_city, data.home_state].filter(Boolean).join(', ') || null],
          ['Open to work', data.open_to_work ? `Yes${data.available_from ? `, from ${fmtDate(data.available_from)}` : ''}` : 'No'],
          ['Visible to companies', data.visibility === 'platform' ? 'Yes' : 'No'],
          ['About', data.bio],
        ]} />
    );
  }

  return (
    <DataCard title="Professional profile" subtitle="CDL class and endorsements come from Driving credentials.">
      <div className="space-y-4 px-4 py-4">
        <label className="block"><span className={label}>Headline</span>
          <input value={p.headline ?? ''} onChange={(e) => set('headline', e.target.value)} placeholder="e.g. Class A reefer driver, 12 years OTR" maxLength={160} className={inputCls} />
        </label>
        <div><span className={label}>What you do</span><ChipPicker items={catalog.pro_roles} value={p.roles} onChange={(v) => set('roles', v)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <label><span className={label}>Years of experience</span>
            <input type="number" min={0} max={70} value={p.years_experience ?? ''} onChange={(e) => set('years_experience', e.target.value === '' ? null : Number(e.target.value))} className={inputCls} />
          </label>
          <label><span className={label}>Home base (city, state)</span>
            <input value={[p.home_city, p.home_state].filter(Boolean).join(', ')} placeholder="Denver, CO"
              onChange={(e) => { const [c, s] = e.target.value.split(',').map((x) => x.trim()); setP({ ...p, home_city: c || null, home_state: s || null }); }} className={inputCls} />
          </label>
        </div>
        <div><span className={label}>Equipment you have run</span><ChipPicker items={catalog.equipment} value={p.equipment_experience} onChange={(v) => set('equipment_experience', v)} /></div>
        <div><span className={label}>Haul types</span><ChipPicker items={catalog.haul_types} value={p.haul_types} onChange={(v) => set('haul_types', v)} /></div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--color-text)]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={p.team_ok} onChange={(e) => set('team_ok', e.target.checked)} className="h-4 w-4 accent-[var(--color-teal)]" /> Open to team driving</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={p.open_to_work} onChange={(e) => set('open_to_work', e.target.checked)} className="h-4 w-4 accent-[var(--color-teal)]" /> Open to work</label>
          {p.open_to_work && (
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">Available from
              <input type="date" value={p.available_from ?? ''} onChange={(e) => set('available_from', e.target.value || null)} className="rounded-lg border border-[var(--color-cream-dark)] px-2 py-1 text-sm" />
            </label>
          )}
          <label className="flex items-center gap-2"><input type="checkbox" checked={p.visibility === 'platform'} onChange={(e) => set('visibility', e.target.checked ? 'platform' : 'private')} className="h-4 w-4 accent-[var(--color-teal)]" /> Visible to companies on Shipmater</label>
        </div>
        <label className="block"><span className={label}>About you</span>
          <textarea value={p.bio ?? ''} onChange={(e) => set('bio', e.target.value)} rows={3} maxLength={2000} className={inputCls} />
        </label>
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn btn-navy disabled:opacity-50">Save</button>
          <button onClick={() => { setP(data); setEditing(false); }} className="btn border border-[var(--color-cream-dark)]">Cancel</button>
        </div>
      </div>
    </DataCard>
  );
}
