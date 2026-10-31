'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSignature, Package, Upload, Loader2, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, factoringApi } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';

export type FactoringView = 'carrier' | 'factor' | 'shipper' | 'admin';

interface Party { id: number; name: string | null; email?: string | null; phone?: string | null; stripe_connected?: boolean }
interface Noa {
  id: number; status: string; in_force: boolean; effective_date: string; carrier: Party; factor: Party; notes: string | null;
  has_release_document: boolean; decided_at: string | null; decline_reason: string | null; release_requested_at: string | null;
  released_at: string | null; open_loads: number | null; created_at: string;
}
interface LoadRef { type: string; id: number; title: string; route?: string | null; amount?: number | null; status?: string; payment_status?: string | null; shipper?: string | null }
interface FactoredLoad {
  id: number; status: string; noa_id: number; carrier: Party; factor: Party; load: LoadRef; amount: number | null;
  decided_at: string | null; decline_reason: string | null; funded_at: string | null; shipper_acknowledged_at: string | null; created_at: string;
}
interface Factor { id: number; name: string; city: string | null; state: string | null; verified: boolean; stripe_connected: boolean }

const NOA_STATUS: Record<string, { label: string; cls: string }> = {
  pending_factor: { label: 'Waiting for factor', cls: 'bg-amber-50 text-amber-700' },
  active:         { label: 'Active',             cls: 'bg-emerald-50 text-emerald-700' },
  declined:       { label: 'Declined',           cls: 'bg-red-50 text-red-700' },
  released:       { label: 'Released',           cls: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]' },
};
const LOAD_STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: 'Waiting for factor', cls: 'bg-amber-50 text-amber-700' },
  accepted:  { label: 'Accepted',           cls: 'bg-blue-50 text-blue-700' },
  funded:    { label: 'Funded',             cls: 'bg-emerald-50 text-emerald-700' },
  declined:  { label: 'Declined',           cls: 'bg-red-50 text-red-700' },
};

const money = (n: number | null | undefined) => (n == null ? '—' : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
// Date-only values (YYYY-MM-DD) are calendar days, not UTC midnight
const day   = (s: string | null | undefined) => (s ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s).toLocaleDateString() : '—');
const th    = 'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]';
const td    = 'px-4 py-3 align-top';
const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]';
const btnSm = 'rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50';

function Badge({ map, status }: { map: Record<string, { label: string; cls: string }>; status: string }) {
  const s = map[status] ?? { label: status, cls: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]' };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

function errorMessage(e: unknown): string {
  const d = (e as { response?: { data?: { error?: string; message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  return d?.error ?? Object.values(d?.errors ?? {})[0]?.[0] ?? d?.message ?? 'Something went wrong';
}

/** Opens a private NOA file (sent with the sign-in token, so it can't be a plain link) */
async function openDocument(noaId: number, release = false) {
  try {
    const res = await api.get(`/api/v1/factoring/noas/${noaId}/document${release ? '?release=1' : ''}`, { responseType: 'blob' });
    window.open(URL.createObjectURL(res.data as Blob), '_blank');
  } catch {
    toast.error('Could not open the document');
  }
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head card-head-tint flex items-center justify-between gap-3 px-5 py-3"><p className="card-title">{title}</p>{action}</div>
      <div className="card-body">{children}</div>
    </section>
  );
}

const INTRO: Record<FactoringView, string> = {
  carrier: 'File your NOA with your factoring company, then choose which loads to factor. Your factor confirms each one. Shippers pay factored loads through Shipmater straight to your factor.',
  factor:  'Confirm the NOAs carriers file with you and accept the loads you fund. Shippers pay accepted loads through Shipmater into your Stripe account. Mark a load funded when you pay the carrier.',
  shipper: 'Loads your carriers have factored. You still pay through Shipmater as usual; the payment goes to the factoring company shown.',
  admin:   'Every NOA and factored load on Shipmater. The carrier and factor confirm everything between them; nothing here needs Shipmater approval.',
};

/** NOAs and factored loads, as each account type sees them (docs/noa-factoring.md) */
export function FactoringCenter({ view }: { view: FactoringView }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'noas' | 'loads'>(view === 'shipper' ? 'loads' : 'noas');

  const noas  = useQuery({ queryKey: ['factoring-noas'],  queryFn: () => factoringApi.noas().then((r) => r.data.data as Noa[]), enabled: view !== 'shipper' });
  const loads = useQuery({ queryKey: ['factoring-loads'], queryFn: () => factoringApi.loads().then((r) => r.data.data as FactoredLoad[]) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['factoring-noas'] }); qc.invalidateQueries({ queryKey: ['factoring-loads'] }); qc.invalidateQueries({ queryKey: ['factoring-eligible'] }); };

  const waitingNoas  = (noas.data ?? []).filter((n) => n.status === 'pending_factor').length;
  const waitingLoads = (loads.data ?? []).filter((l) => l.status === 'requested').length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{view === 'admin' ? 'NOAs / Factoring' : 'Factoring'}</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">{INTRO[view]}</p>
      </div>

      {view !== 'shipper' && (
        <div className="flex gap-1 rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-1.5">
          {([['noas', 'NOAs', FileSignature, view === 'factor' ? waitingNoas : 0], ['loads', 'Loads', Package, view === 'factor' ? waitingLoads : 0]] as const).map(([id, label, Icon, count]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${tab === id ? 'bg-[var(--color-slate)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
              <Icon size={14} />{label}
              {count > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-white">{count}</span>}
            </button>
          ))}
        </div>
      )}

      {tab === 'noas' && view !== 'shipper' && (
        <>
          {view === 'carrier' && <FileNoa noas={noas.data ?? []} onDone={refresh} />}
          <NoaTable view={view} noas={noas.data} loading={noas.isLoading} onDone={refresh} />
        </>
      )}
      {(tab === 'loads' || view === 'shipper') && (
        <>
          {view === 'carrier' && <FactorALoad noas={noas.data ?? []} onDone={refresh} />}
          <LoadTable view={view} loads={loads.data} loading={loads.isLoading} onDone={refresh} />
        </>
      )}
    </div>
  );
}

// ── Carrier: file an NOA ─────────────────────────────────────────────────────

function FileNoa({ noas, onDone }: { noas: Noa[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [factorId, setFactorId] = useState<number | null>(null);
  const [effective, setEffective] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');

  const blocked = noas.some((n) => ['pending_factor', 'active'].includes(n.status));
  const factors = useQuery({
    queryKey: ['factoring-factors', search], enabled: open,
    queryFn: () => factoringApi.factors(search).then((r) => r.data.data as Factor[]),
  });

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('factor_org_id', String(factorId));
      fd.append('effective_date', effective);
      if (file) fd.append('document', file);
      if (notes.trim()) fd.append('notes', notes.trim());
      return factoringApi.fileNoa(fd);
    },
    onSuccess: () => { toast.success('NOA sent to your factor to confirm'); setOpen(false); setFile(null); setFactorId(null); setNotes(''); onDone(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-5 py-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          {blocked ? 'You have an NOA that is active or waiting for your factor. Only one can be in force at a time.' : 'Using a factoring company? Upload the NOA you signed with them.'}
        </p>
        {!blocked && <button onClick={() => setOpen(true)} className="btn btn-navy flex items-center gap-2"><Upload size={14} /> File an NOA</button>}
      </div>
    );
  }

  return (
    <Section title="File an NOA" action={<button onClick={() => setOpen(false)} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"><X size={16} /></button>}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Factoring company</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search factoring companies on Shipmater" className={inputCls} />
        </label>
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {factors.isLoading && <div className="skeleton h-12 rounded-lg" />}
          {factors.data?.length === 0 && <p className="text-sm text-[var(--color-text-faint)]">No factoring company found. Ask your factor to create a free Shipmater account first.</p>}
          {factors.data?.map((f) => (
            <button key={f.id} type="button" onClick={() => setFactorId(f.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm ${factorId === f.id ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]' : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]'}`}>
              <span><span className="font-medium">{f.name}</span>{(f.city || f.state) && <span className="text-[var(--color-text-faint)]"> · {[f.city, f.state].filter(Boolean).join(', ')}</span>}</span>
              <span className="text-xs text-[var(--color-text-faint)]">{f.verified ? 'Verified' : 'Not verified yet'}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Effective date</span>
            <input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Signed NOA (PDF or photo)</span>
            <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Note to the factor (optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className={inputCls} />
        </label>
        <button onClick={() => submit.mutate()} disabled={!factorId || !file || submit.isPending} className="btn btn-navy flex items-center gap-2 disabled:opacity-50">
          {submit.isPending && <Loader2 size={14} className="animate-spin" />} Send to factor
        </button>
      </div>
    </Section>
  );
}

// ── Carrier: factor a load ───────────────────────────────────────────────────

function FactorALoad({ noas, onDone }: { noas: Noa[]; onDone: () => void }) {
  const active = noas.find((n) => n.status === 'active');
  const eligible = useQuery({
    queryKey: ['factoring-eligible'], enabled: !!active,
    queryFn: () => factoringApi.eligibleLoads().then((r) => r.data.data as LoadRef[]),
  });
  const request = useMutation({
    mutationFn: (l: LoadRef) => factoringApi.factorLoad(l.type, l.id),
    onSuccess: () => { toast.success('Sent to your factor to accept'); onDone(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!active) {
    return <p className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-5 py-4 text-sm text-[var(--color-text-muted)]">You can factor loads once your factor confirms an NOA (NOAs tab).</p>;
  }

  return (
    <Section title={`Loads you can factor with ${active.factor.name}`}>
      {!active.in_force && <p className="mb-3 text-sm text-amber-700">Your NOA takes effect on {day(active.effective_date)}. You can factor loads from then.</p>}
      {eligible.isLoading ? <div className="skeleton h-24 rounded-xl" /> : (eligible.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-[var(--color-text-faint)]">No unpaid loads to factor right now.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--color-cream-dark)]">{['Load', 'Shipper', 'Amount', 'Status', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {eligible.data!.map((l) => (
                <tr key={`${l.type}:${l.id}`} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                  <td className={td}><p className="font-medium">{l.title}</p>{l.route && <p className="text-xs text-[var(--color-text-faint)]">{l.route}</p>}</td>
                  <td className={td}>{l.shipper ?? '—'}</td>
                  <td className={td}>{money(l.amount)}</td>
                  <td className={`${td} text-[var(--color-text-muted)]`}>{l.status}</td>
                  <td className={`${td} text-right`}>
                    <button onClick={() => request.mutate(l)} disabled={!active.in_force || request.isPending} className={`${btnSm} bg-[var(--color-slate)] text-white`}>Factor this load</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ── NOA table (carrier, factor, admin) ───────────────────────────────────────

function NoaTable({ view, noas, loading, onDone }: { view: FactoringView; noas?: Noa[]; loading: boolean; onDone: () => void }) {
  const [releaseFor, setReleaseFor] = useState<number | null>(null);
  const [releaseFile, setReleaseFile] = useState<File | null>(null);

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'confirm' | 'decline' }) =>
      factoringApi.decideNoa(id, action, action === 'decline' ? (prompt('Reason for declining (shown to the carrier)') ?? '') : undefined),
    onSuccess: (_, v) => { toast.success(v.action === 'confirm' ? 'NOA confirmed' : 'NOA declined'); onDone(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const release = useMutation({
    mutationFn: (id: number) => { const fd = new FormData(); if (releaseFile) fd.append('document', releaseFile); return factoringApi.release(id, fd); },
    onSuccess: () => { toast.success('NOA released'); setReleaseFor(null); setReleaseFile(null); onDone(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const requestRelease = useMutation({
    mutationFn: (id: number) => factoringApi.requestRelease(id),
    onSuccess: () => { toast.success('Release requested. Your factor will release the NOA.'); onDone(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (loading) return <div className="skeleton h-40 rounded-xl" />;
  if (!noas?.length) return <EmptyState icon={FileSignature} title="No NOAs yet" description={view === 'factor' ? 'NOAs carriers file with you appear here for you to confirm.' : undefined} />;

  const cols = ['Status', view === 'carrier' ? 'Factor' : view === 'factor' ? 'Carrier' : 'Carrier → Factor', 'Effective', 'Open loads', 'Documents', ''];

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]">{cols.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {noas.map((n) => (
            <tr key={n.id} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
              <td className={td}>
                <Badge map={NOA_STATUS} status={n.status} />
                {n.status === 'active' && !n.in_force && <p className="mt-1 text-xs text-[var(--color-text-faint)]">From {day(n.effective_date)}</p>}
                {n.release_requested_at && n.status === 'active' && <p className="mt-1 text-xs text-amber-700">Release requested {day(n.release_requested_at)}</p>}
                {n.decline_reason && <p className="mt-1 text-xs text-red-700">{n.decline_reason}</p>}
              </td>
              <td className={td}>
                {view === 'carrier' ? (
                  <><p className="font-medium">{n.factor.name}</p><p className="text-xs text-[var(--color-text-faint)]">{[n.factor.email, n.factor.phone].filter(Boolean).join(' · ')}</p></>
                ) : view === 'factor' ? <p className="font-medium">{n.carrier.name}</p> : <p><span className="font-medium">{n.carrier.name}</span> → {n.factor.name}</p>}
                {n.notes && <p className="mt-1 text-xs text-[var(--color-text-muted)]">“{n.notes}”</p>}
              </td>
              <td className={td}>{day(n.effective_date)}</td>
              <td className={td}>{n.open_loads ?? 0}</td>
              <td className={td}>
                <button onClick={() => openDocument(n.id)} className="flex items-center gap-1 text-xs font-medium text-[var(--color-teal)] hover:underline"><FileText size={12} /> NOA</button>
                {n.has_release_document && <button onClick={() => openDocument(n.id, true)} className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--color-teal)] hover:underline"><FileText size={12} /> Release letter</button>}
              </td>
              <td className={`${td} text-right`}>
                {view === 'factor' && n.status === 'pending_factor' && (
                  <div className="flex justify-end gap-2">
                    <button onClick={() => decide.mutate({ id: n.id, action: 'confirm' })} disabled={decide.isPending} className={`${btnSm} bg-[var(--color-slate)] text-white`}>Confirm</button>
                    <button onClick={() => decide.mutate({ id: n.id, action: 'decline' })} disabled={decide.isPending} className={`${btnSm} border border-red-200 bg-red-50 text-red-700`}>Decline</button>
                  </div>
                )}
                {view === 'factor' && n.status === 'active' && (releaseFor === n.id ? (
                  <div className="flex flex-col items-end gap-2">
                    <input type="file" accept=".pdf,image/*" onChange={(e) => setReleaseFile(e.target.files?.[0] ?? null)} className="text-xs" />
                    <div className="flex gap-2">
                      <button onClick={() => setReleaseFor(null)} className={`${btnSm} border border-[var(--color-cream-dark)]`}>Cancel</button>
                      <button onClick={() => release.mutate(n.id)} disabled={release.isPending} className={`${btnSm} bg-[var(--color-slate)] text-white`}>Release NOA</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setReleaseFor(n.id)} className={`${btnSm} border border-[var(--color-cream-dark)]`}>Release…</button>
                ))}
                {view === 'carrier' && n.status === 'active' && !n.release_requested_at && (
                  <button onClick={() => { if (confirm(`Ask ${n.factor.name} to release this NOA?`)) requestRelease.mutate(n.id); }} disabled={requestRelease.isPending}
                    className={`${btnSm} border border-[var(--color-cream-dark)]`}>Request release</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Factored loads table (all views) ─────────────────────────────────────────

function LoadTable({ view, loads, loading, onDone }: { view: FactoringView; loads?: FactoredLoad[]; loading: boolean; onDone: () => void }) {
  const decide = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'accept' | 'decline' | 'funded' }) =>
      factoringApi.decideLoad(id, action, action === 'decline' ? (prompt('Reason for declining (shown to the carrier)') ?? '') : undefined),
    onSuccess: (_, v) => { toast.success({ accept: 'Load accepted', decline: 'Load declined', funded: 'Marked funded' }[v.action]); onDone(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const withdraw = useMutation({
    mutationFn: (id: number) => factoringApi.withdrawLoad(id),
    onSuccess: () => { toast.success('Request withdrawn'); onDone(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const ack = useMutation({
    mutationFn: (id: number) => factoringApi.acknowledge(id),
    onSuccess: () => { toast.success('Acknowledged'); onDone(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (loading) return <div className="skeleton h-40 rounded-xl" />;
  if (!loads?.length) {
    return <EmptyState icon={Package} title="No factored loads"
      description={view === 'shipper' ? 'None of your loads are factored. You pay carriers through Shipmater as usual.' : view === 'factor' ? 'Loads carriers ask you to fund appear here.' : undefined} />;
  }

  const cols = ['Load', view === 'shipper' ? 'Pay to' : view === 'factor' ? 'Carrier' : view === 'carrier' ? 'Factor' : 'Carrier → Factor', 'Amount', 'Status', ''];

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]">{cols.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {loads.map((l) => (
            <tr key={l.id} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
              <td className={td}>
                {view === 'carrier' && l.load.type === 'freight_job'
                  ? <Link href={`/carrier/my-jobs/${l.load.id}`} className="font-medium text-[var(--color-teal)] hover:underline">{l.load.title}</Link>
                  : <p className="font-medium">{l.load.title}</p>}
                <p className="text-xs text-[var(--color-text-faint)]">{[l.load.route, l.load.shipper && view !== 'shipper' ? `Shipper: ${l.load.shipper}` : null].filter(Boolean).join(' · ')}</p>
              </td>
              <td className={td}>
                {view === 'shipper' ? (
                  <><p className="font-medium">{l.factor.name}</p><p className="text-xs text-[var(--color-text-faint)]">Factoring for {l.carrier.name}</p></>
                ) : view === 'factor' ? l.carrier.name : view === 'carrier' ? l.factor.name : <>{l.carrier.name} → {l.factor.name}</>}
              </td>
              <td className={td}>{money(l.amount)}</td>
              <td className={td}>
                <Badge map={LOAD_STATUS} status={l.status} />
                {l.funded_at && <p className="mt-1 text-xs text-[var(--color-text-faint)]">Funded {day(l.funded_at)}</p>}
                {l.decline_reason && <p className="mt-1 text-xs text-red-700">{l.decline_reason}</p>}
                {view === 'shipper' && l.shipper_acknowledged_at && <p className="mt-1 text-xs text-[var(--color-text-faint)]">Acknowledged {day(l.shipper_acknowledged_at)}</p>}
              </td>
              <td className={`${td} text-right`}>
                {view === 'factor' && l.status === 'requested' && (
                  <div className="flex justify-end gap-2">
                    <button onClick={() => decide.mutate({ id: l.id, action: 'accept' })} disabled={decide.isPending} className={`${btnSm} bg-[var(--color-slate)] text-white`}>Accept</button>
                    <button onClick={() => decide.mutate({ id: l.id, action: 'decline' })} disabled={decide.isPending} className={`${btnSm} border border-red-200 bg-red-50 text-red-700`}>Decline</button>
                  </div>
                )}
                {view === 'factor' && l.status === 'accepted' && (
                  <button onClick={() => { if (confirm('Mark this load funded? This means you have paid the carrier. Shipmater bills the carrier its fee for this load.')) decide.mutate({ id: l.id, action: 'funded' }); }}
                    disabled={decide.isPending} className={`${btnSm} bg-emerald-600 text-white`}>Mark funded</button>
                )}
                {view === 'carrier' && l.status === 'requested' && (
                  <button onClick={() => withdraw.mutate(l.id)} disabled={withdraw.isPending} className={`${btnSm} border border-[var(--color-cream-dark)]`}>Withdraw</button>
                )}
                {view === 'shipper' && !l.shipper_acknowledged_at && (
                  <button onClick={() => ack.mutate(l.id)} disabled={ack.isPending} className={`${btnSm} bg-[var(--color-slate)] text-white`}>Acknowledge</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
