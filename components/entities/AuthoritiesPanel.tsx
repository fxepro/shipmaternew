'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DataCard, Pill, fmtDate, fmtMoney, expiryPill } from '@/components/profile/DataCard';

export interface Authority {
  id: number; kind: 'carrier' | 'broker' | 'forwarder'; country: string; dot_number: string | null; mc_number: string | null;
  authority_number: string | null; authority_type: string | null; status: 'pending' | 'active' | 'inactive' | 'revoked';
  hazmat_authorized: boolean; is_primary: boolean; source: string; verified_at: string | null; good_standing: boolean;
  auto_insurer_name: string | null; auto_policy_number?: string | null; auto_coverage_amount: number | null; auto_expiry_date: string | null;
  cargo_insurer_name: string | null; cargo_policy_number?: string | null; cargo_coverage_amount: number | null; cargo_expiry_date: string | null;
  bond_number: string | null; vehicles: number;
}

/** "Operating authority" is the permission to run a freight business. Its kinds: */
export const AUTHORITY_KIND: Record<Authority['kind'], string> = {
  carrier: 'Motor carrier authority (USDOT / MC)', broker: 'Broker authority (MC)', forwarder: 'Freight forwarder authority',
};
const STATUS_TONE = { active: 'good', pending: 'warn', inactive: 'neutral', revoked: 'bad' } as const;

/**
 * The operating authorities a company holds, one card each, field name left and value right.
 * A company can hold more than one kind (motor carrier and broker).
 * mode "own": the company adds its own (they stay pending until checked). mode "admin": admins also set the status.
 */
export function AuthoritiesPanel({ items, mode, orgId, onChange }: {
  items: Authority[]; mode: 'own' | 'admin'; orgId?: number; onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ kind: 'broker', dot_number: '', mc_number: '' });
  const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-1.5 text-base focus:outline-none focus:border-[var(--color-teal)]';
  const err = (e: any, m: string) => toast.error(e?.response?.data?.message ?? m);

  const add = async () => {
    try {
      await api.post(mode === 'admin' ? `/api/v1/admin/companies/${orgId}/authorities` : '/api/v1/org/authorities', form);
      toast.success('Authority added');
      setAdding(false);
      setForm({ kind: 'broker', dot_number: '', mc_number: '' });
      onChange();
    } catch (e) { err(e, 'Could not add the authority'); }
  };
  const update = async (a: Authority, data: Record<string, unknown>) => {
    try {
      await api.put(mode === 'admin' ? `/api/v1/admin/authorities/${a.id}` : `/api/v1/org/authorities/${a.id}`, data);
      onChange();
    } catch (e) { err(e, 'Could not update'); }
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm italic text-[var(--color-text-faint)]">No operating authority on file.</p>}
      {items.map((a) => (
        <DataCard key={a.id} title={AUTHORITY_KIND[a.kind]} subtitle={a.is_primary && items.filter((i) => i.kind === a.kind).length > 1 ? 'Primary' : undefined}
          action={mode === 'admin' ? (
            <select value={a.status} onChange={(e) => update(a, { status: e.target.value })} aria-label="Authority status"
              className="rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-2 py-1 text-[13px]">
              {['pending', 'active', 'inactive', 'revoked'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : undefined}
          rows={[
            ['Status', <span key="s" className="inline-flex flex-wrap gap-1.5"><Pill tone={STATUS_TONE[a.status]}>{a.status}</Pill>
              {a.status === 'active' && !a.good_standing && <Pill tone="bad">Insurance lapsed</Pill>}</span>],
            ...(a.kind !== 'broker' ? [['USDOT number', a.dot_number] as [string, string | null]] : []),
            ['MC number', a.mc_number],
            ...(a.authority_number ? [['Authority number', `${a.authority_number} (${a.country})`] as [string, string]] : []),
            ['Checked', a.verified_at ? `${fmtDate(a.verified_at)} · ${a.source === 'fmcsa' ? 'FMCSA' : a.source}` : (a.source === 'fmcsa' ? 'FMCSA lookup' : null)],
            ...(a.kind === 'carrier' ? [
              ['Hazardous materials', <label key="hz" className="inline-flex items-center gap-2">
                <input type="checkbox" checked={a.hazmat_authorized} onChange={() => update(a, { hazmat_authorized: !a.hazmat_authorized })} className="h-3.5 w-3.5 accent-[var(--color-teal)]" />
                {a.hazmat_authorized ? 'Authorized' : 'Not authorized'}</label>] as [string, React.ReactNode],
              ['Auto liability insurer', a.auto_insurer_name] as [string, string | null],
              ['Auto liability coverage', fmtMoney(a.auto_coverage_amount)] as [string, string | null],
              ['Auto liability expires', expiryPill(a.auto_expiry_date)] as [string, React.ReactNode],
              ['Cargo insurer', a.cargo_insurer_name] as [string, string | null],
              ['Cargo coverage', fmtMoney(a.cargo_coverage_amount)] as [string, string | null],
              ['Cargo expires', expiryPill(a.cargo_expiry_date)] as [string, React.ReactNode],
              ['Vehicles under it', String(a.vehicles)] as [string, string],
            ] : []),
            ...(a.bond_number ? [['Surety bond', a.bond_number] as [string, string]] : []),
          ]} />
      ))}

      {adding ? (
        <div className="space-y-2 rounded-xl border-2 border-[var(--color-teal)] px-4 py-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="Kind" className={inputCls}>
              <option value="broker">Broker authority</option>
              <option value="carrier">Motor carrier authority</option>
              <option value="forwarder">Freight forwarder authority</option>
            </select>
            {form.kind !== 'broker' && <input value={form.dot_number} onChange={(e) => setForm({ ...form, dot_number: e.target.value })} placeholder="USDOT #" className={inputCls} />}
            <input value={form.mc_number} onChange={(e) => setForm({ ...form, mc_number: e.target.value })} placeholder="MC #" className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn btn-navy">Add authority</button>
            <button onClick={() => setAdding(false)} className="btn border border-[var(--color-cream-dark)]">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-base font-medium text-[var(--color-teal)] hover:underline">
          <Plus size={14} /> Add another authority (e.g. broker)
        </button>
      )}
    </div>
  );
}
