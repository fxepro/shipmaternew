'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Sparkles, History, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

type OrgType = 'shipper' | 'carrier' | 'factor' | 'broker' | 'receiver';
type Setting = 'required' | 'optional' | 'deferred' | 'off';
interface Check { key: string; label: string; group: string; default: 'required' | 'optional'; setting: Setting; defer_days: number; changed: boolean }
interface Promotion {
  id: number; name: string; types: OrgType[]; settings: Partial<Record<OrgType, Record<string, 'deferred' | 'off'>>>;
  starts_at: string; ends_at: string; catch_up_days: number; created_by: string | null; status: 'scheduled' | 'running' | 'ended'; joined: number;
}
interface Policy {
  type: OrgType; approval_mode: 'manual' | 'auto'; checks: Check[]; relaxed_companies: number;
  active_promotion: { id: number; name: string; ends_at: string; settings: Record<string, 'deferred' | 'off'> } | null;
  promotions: Promotion[];
  log: { id: number; type: string | null; subject: string; from: string | null; to: string | null; by: string | null; at: string }[];
}

const TABS: { key: OrgType; label: string }[] = [
  { key: 'shipper', label: 'Shippers' }, { key: 'carrier', label: 'Carriers' }, { key: 'factor', label: 'Factors' },
  { key: 'broker', label: 'Brokers' }, { key: 'receiver', label: 'Receivers' },
];
const SETTINGS: { value: Setting; label: string; hint: string }[] = [
  { value: 'required', label: 'Required', hint: 'Blocks approval until passed' },
  { value: 'optional', label: 'Optional', hint: 'Shown, never blocks' },
  { value: 'deferred', label: 'Deferred', hint: 'Company gets in now, has N days to pass' },
  { value: 'off',      label: 'Off',      hint: 'Not asked' },
];
const SETTING_CLS: Record<Setting, string> = {
  required: 'bg-[var(--color-slate)] text-white', optional: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]',
  deferred: 'bg-amber-50 text-amber-700', off: 'bg-red-50 text-red-700',
};
const TYPE_LABEL: Record<OrgType, string> = { shipper: 'Shippers', carrier: 'Carriers', factor: 'Factors', broker: 'Brokers', receiver: 'Receivers' };
const fmt = (d: string) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const err = (e: unknown) => {
  const r = (e as { response?: { data?: { message?: string; error?: string } } }).response?.data;
  toast.error(r?.message ?? r?.error ?? 'Could not save');
};

function Panel({ title, icon: Icon, action, children }: { title: string; icon?: React.ElementType; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]/40 px-4 py-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-slate)]">{Icon && <Icon size={14} />}{title}</p>
        {action}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function Compliance() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const requested = params.get('type') as OrgType | null;
  const type: OrgType = TABS.some((t) => t.key === requested) ? (requested as OrgType) : 'shipper';
  const [promoOpen, setPromoOpen] = useState(false);

  const key = ['verification-policy', type];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get('/api/v1/admin/verification-policy', { params: { type } }).then((r) => r.data.data as Policy),
  });
  const put = (p: Promise<{ data: { data: Policy } }>, msg: string) => p.then((r) => { qc.setQueryData(key, r.data.data); toast.success(msg); });

  const setCheck = useMutation({
    mutationFn: ({ check, setting, days }: { check: Check; setting: Setting; days?: number }) =>
      put(api.put(`/api/v1/admin/verification-policy/${type}/checks/${check.key}`, { setting, defer_days: days }), `${check.label}: ${setting}`),
    onError: err,
  });
  const setMode = useMutation({
    mutationFn: (mode: 'manual' | 'auto') => put(api.put(`/api/v1/admin/verification-policy/${type}/approval-mode`, { mode }),
      mode === 'auto' ? 'Approval is automatic' : 'Approval is manual'),
    onError: err,
  });
  const endPromo = useMutation({
    mutationFn: (p: Promotion) => put(api.post(`/api/v1/admin/compliance-promotions/${p.id}/end`, { type }), `${p.name} ended`),
    onError: err,
  });

  const tabCls = (t: OrgType) => t === type
    ? 'border-b-2 border-[var(--color-teal)] text-[var(--color-teal)] font-medium'
    : 'border-b-2 border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]';
  const inputCls = 'bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[var(--color-teal)]';
  const promos = (data?.promotions ?? []).filter((p) => p.types.includes(type));
  const required = data?.checks.filter((c) => c.setting === 'required').length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Compliance</h1>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">
          Which verification checks each type of company must pass. Changes apply at once to every company of that type, and every change is logged.
        </p>
      </div>

      <div className="flex flex-wrap gap-5 border-b border-[var(--color-cream-dark)]">
        {TABS.map((t) => (
          <button key={t.key} className={`pb-3 text-sm ${tabCls(t.key)}`} onClick={() => router.replace(`/admin/compliance?type=${t.key}`)}>{t.label}</button>
        ))}
      </div>

      {isLoading || !data ? <div className="skeleton h-96 rounded-2xl" /> : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* Verification checks */}
          <Panel title={`Verification checks · ${TYPE_LABEL[type]}`} icon={ShieldCheck}
            action={<span className="text-xs text-[var(--color-text-muted)]">{required} required · {data.checks.length} checks</span>}>
            {data.active_promotion && (
              <p className="-mx-4 -mt-3 mb-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                <strong>{data.active_promotion.name}</strong> is running until {fmt(data.active_promotion.ends_at)}. Checks it relaxes show in the Open season column.
              </p>
            )}
            <div className="-mx-4 -my-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-cream-dark)] text-left text-[11px] uppercase tracking-[0.05em] text-[var(--color-text-faint)]">
                    <th className="px-4 py-2 font-medium">Check</th>
                    <th className="px-2 py-2 font-medium">Area</th>
                    <th className="w-48 min-w-[12rem] px-2 py-2 font-medium">Setting</th>
                    <th className="px-2 py-2 font-medium">Days to pass</th>
                    {data.active_promotion && <th className="px-2 py-2 font-medium">Open season</th>}
                    <th className="px-4 py-2 font-medium">Default</th>
                  </tr>
                </thead>
                <tbody>
                  {data.checks.map((c) => {
                    const promo = data.active_promotion?.settings[c.key];
                    return (
                      <tr key={c.key} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                        <td className={`px-4 py-2 font-medium ${c.setting === 'off' ? 'text-[var(--color-text-faint)] line-through' : 'text-[var(--color-text)]'}`}>{c.label}</td>
                        <td className="px-2 py-2 text-[var(--color-text-muted)]">{c.group}</td>
                        <td className="px-2 py-2">
                          <div className="relative w-44">
                            <select value={c.setting} disabled={setCheck.isPending} aria-label={`${c.label} setting`}
                              onChange={(e) => setCheck.mutate({ check: c, setting: e.target.value as Setting, days: c.defer_days })}
                              className={`w-full appearance-none rounded-full border-0 py-1.5 pl-3 pr-9 text-sm font-semibold ${SETTING_CLS[c.setting]}`}>
                              {SETTINGS.map((s) => <option key={s.value} value={s.value} title={s.hint}>{s.label}</option>)}
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-70" />
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          {c.setting === 'deferred' ? (
                            <input type="number" min={1} max={365} defaultValue={c.defer_days} aria-label={`${c.label} days`} className={`w-20 ${inputCls}`}
                              onBlur={(e) => { const d = Number(e.target.value); if (d && d !== c.defer_days) setCheck.mutate({ check: c, setting: 'deferred', days: d }); }} />
                          ) : <span className="text-[var(--color-text-faint)]">—</span>}
                        </td>
                        {data.active_promotion && (
                          <td className="px-2 py-2">{promo ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SETTING_CLS[promo]}`}>{promo === 'off' ? 'Off' : 'Deferred'}</span> : <span className="text-[var(--color-text-faint)]">—</span>}</td>
                        )}
                        <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]">{c.default === 'required' ? 'Required' : 'Optional'}{c.changed && <span className="ml-1 text-amber-700">· changed</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="space-y-5">
            {/* Approval mode */}
            <Panel title="Approval">
              <div className="flex gap-1 rounded-xl border border-[var(--color-cream-dark)] p-1">
                {(['manual', 'auto'] as const).map((m) => (
                  <button key={m} disabled={setMode.isPending} onClick={() => m !== data.approval_mode && setMode.mutate(m)}
                    className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-colors ${data.approval_mode === m ? 'bg-[var(--color-slate)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
                    {m === 'manual' ? 'Manual review' : 'Automatic'}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--color-text-faint)]">
                {data.approval_mode === 'auto'
                  ? `${TYPE_LABEL[type]} are approved as soon as every required check passes.`
                  : `An admin approves each company once every required check passes.`}
              </p>
            </Panel>

            {/* Open season */}
            <Panel title="Open season" icon={Sparkles}
              action={<button onClick={() => setPromoOpen(true)} className="text-xs font-semibold text-[var(--color-teal)] hover:underline">New</button>}>
              {promos.length === 0 ? <p className="text-sm italic text-[var(--color-text-faint)]">No promotions for {TYPE_LABEL[type].toLowerCase()}.</p> : (
                <ul className="space-y-2.5">
                  {promos.map((p) => (
                    <li key={p.id} className="rounded-lg border border-[var(--color-cream-dark)] px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--color-text)]">{p.name}</p>
                        <span className={`rounded-full px-2 py-px text-[10px] font-semibold uppercase ${p.status === 'running' ? 'bg-emerald-50 text-emerald-700' : p.status === 'scheduled' ? 'bg-amber-50 text-amber-700' : 'bg-[var(--color-cream)] text-[var(--color-text-muted)]'}`}>{p.status}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{fmt(p.starts_at)} to {fmt(p.ends_at)}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {Object.keys(p.settings[type] ?? {}).length} checks relaxed · {p.catch_up_days} days to catch up · {p.joined} joined
                      </p>
                      {p.status === 'running' && (
                        <button onClick={() => endPromo.mutate(p)} disabled={endPromo.isPending} className="mt-1 text-xs font-semibold text-red-700 hover:underline">End now</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {data.relaxed_companies > 0 && <p className="mt-2 text-xs text-[var(--color-text-faint)]">{data.relaxed_companies} {TYPE_LABEL[type].toLowerCase()} joined during an open season and are tagged.</p>}
            </Panel>

            {/* Change log */}
            <Panel title="Change log" icon={History}>
              {data.log.length === 0 ? <p className="text-sm italic text-[var(--color-text-faint)]">No changes yet. Everything is at its default.</p> : (
                <ul className="max-h-80 space-y-2 overflow-y-auto text-xs">
                  {data.log.map((l) => {
                    const label = data.checks.find((c) => c.key === l.subject)?.label ?? (l.subject === 'approval_mode' ? 'Approval mode' : l.subject.startsWith('promotion:') ? 'Open season' : l.subject);
                    return (
                      <li key={l.id} className="border-b border-[var(--color-cream-dark)] pb-1.5 last:border-b-0">
                        <p className="text-[var(--color-text)]"><span className="font-semibold">{label}</span>{l.from ? `: ${l.from} → ${l.to}` : `: ${l.to}`}</p>
                        <p className="text-[var(--color-text-faint)]">{l.by ?? 'System'} · {fmt(l.at)}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      {promoOpen && data && <PromotionForm type={type} onClose={() => setPromoOpen(false)} onSaved={(p) => { qc.setQueryData(key, p); setPromoOpen(false); }} />}
    </div>
  );
}

/** New open season: name, dates, types, which checks drop to deferred or off for each type, catch-up days */
function PromotionForm({ type, onClose, onSaved }: { type: OrgType; onClose: () => void; onSaved: (p: Policy) => void }) {
  const [name, setName] = useState('');
  const [starts, setStarts] = useState(new Date().toISOString().slice(0, 16));
  const [ends, setEnds] = useState('');
  const [types, setTypes] = useState<OrgType[]>([type]);
  const [catchUp, setCatchUp] = useState(30);
  const [settings, setSettings] = useState<Partial<Record<OrgType, Record<string, 'deferred' | 'off'>>>>({});
  const [busy, setBusy] = useState(false);

  // The checks for each chosen type
  const catalogs = useQuery({
    queryKey: ['verification-policy-catalogs', types.join(',')],
    queryFn: () => Promise.all(types.map((t) => api.get('/api/v1/admin/verification-policy', { params: { type: t } }).then((r) => [t, r.data.data.checks as Check[]] as const))),
  });
  const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]';

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.post('/api/v1/admin/compliance-promotions', {
        name, starts_at: new Date(starts).toISOString(), ends_at: ends ? new Date(ends).toISOString() : '', types, catch_up_days: catchUp,
        settings: Object.fromEntries(types.map((t) => [t, settings[t] ?? {}])), type,
      });
      toast.success(`${name} saved`);
      onSaved(r.data.data);
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--color-white)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[var(--color-slate)]">New open season</h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">While it runs, the checks you pick drop to Deferred or Off. When it ends, everything goes back, and companies that joined during it get the catch-up days.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs font-medium text-[var(--color-text-muted)]">Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring launch" className={`mt-1 ${inputCls}`} /></label>
          <label className="text-xs font-medium text-[var(--color-text-muted)]">Starts
            <input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} className={`mt-1 ${inputCls}`} /></label>
          <label className="text-xs font-medium text-[var(--color-text-muted)]">Ends
            <input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} className={`mt-1 ${inputCls}`} /></label>
          <label className="text-xs font-medium text-[var(--color-text-muted)]">Days to catch up after it ends
            <input type="number" min={1} max={365} value={catchUp} onChange={(e) => setCatchUp(Number(e.target.value))} className={`mt-1 ${inputCls}`} /></label>
          <div className="text-xs font-medium text-[var(--color-text-muted)]">Company types
            <div className="mt-1 flex flex-wrap gap-1.5">
              {TABS.map((t) => (
                <button key={t.key} type="button" onClick={() => setTypes((s) => s.includes(t.key) ? s.filter((x) => x !== t.key) : [...s, t.key])}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${types.includes(t.key) ? 'bg-[var(--color-slate)] text-white' : 'bg-[var(--color-cream)] text-[var(--color-text-muted)]'}`}>{t.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(catalogs.data ?? []).map(([t, checks]) => (
            <div key={t}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">{TYPE_LABEL[t]}: checks to relax</p>
              <div className="divide-y divide-[var(--color-cream-dark)] rounded-lg border border-[var(--color-cream-dark)]">
                {checks.filter((c) => c.setting === 'required' || c.setting === 'deferred').map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                    <span>{c.label}</span>
                    <select value={settings[t]?.[c.key] ?? ''} aria-label={`${c.label} during open season`}
                      onChange={(e) => setSettings((s) => {
                        const next = { ...(s[t] ?? {}) };
                        if (e.target.value) next[c.key] = e.target.value as 'deferred' | 'off'; else delete next[c.key];
                        return { ...s, [t]: next };
                      })}
                      className="rounded-lg border border-[var(--color-cream-dark)] px-2 py-1 text-xs">
                      <option value="">No change</option>
                      <option value="deferred">Deferred</option>
                      <option value="off">Off</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn border border-[var(--color-cream-dark)]">Cancel</button>
          <button onClick={save} disabled={busy || !name.trim() || !ends || types.length === 0} className="btn btn-navy disabled:opacity-50">Save</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCompliancePage() {
  return (
    <Suspense>
      <Compliance />
    </Suspense>
  );
}
