'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge, Loader2, Plus } from 'lucide-react';
import { api, ratesApi } from '@/lib/api';
import { usePortal } from '@/lib/portal';
import { useCan } from '@/components/layout/PermissionsContext';
import { MarketRateRange, money, type RateResult } from '@/components/rates/MarketRate';

interface Check { id: number; origin: string; destination: string; equipment: string; hazmat: boolean; temp_controlled: boolean; miles: number; total: RateResult['total']; created_at: string }

const input = 'w-full rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-2 text-sm outline-none focus:border-[var(--color-teal)]';

/** Rate check: market rate guidance for a lane (api/app/Services/Rates/RateEstimator.php) */
export default function RateCheckPage() {
  const to = usePortal();
  const can = useCan();
  const qc = useQueryClient();
  const [f, setF] = useState({ origin_city: '', origin_state: '', destination_city: '', destination_state: '', equipment: 'dry_van', pickup_date: '', hazmat: false, temp_controlled: false, extra_stops: 0 });
  const [error, setError] = useState('');
  const set = (k: keyof typeof f, v: unknown) => { setF((p) => ({ ...p, [k]: v })); setError(''); };

  const { data: equipment } = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api.get('/api/v1/capabilities').then((r) => r.data.data.equipment as { key: string; name: string }[]),
  });
  const { data: history } = useQuery({ queryKey: ['rate-checks'], queryFn: () => ratesApi.history().then((r) => r.data.data as Check[]) });

  const check = useMutation({
    mutationFn: () => ratesApi.check({ ...f, origin_state: f.origin_state.toUpperCase(), destination_state: f.destination_state.toUpperCase(), pickup_date: f.pickup_date || null }).then((r) => r.data.data as RateResult),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate-checks'] }),
  });

  const submit = () => {
    if (!f.origin_city.trim() || !f.destination_city.trim()) return setError('Enter the origin and destination cities.');
    if (!/^[a-z]{2}$/i.test(f.origin_state) || !/^[a-z]{2}$/i.test(f.destination_state)) return setError('Enter two-letter states, e.g. TX.');
    check.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Rate check</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">Market range for a lane before you post a load: road miles, equipment, fuel and extras.</p>
        </div>
        {can.do('loads.post') && (
          <Link href={to('/shipper/jobs/contracted/new')} className="flex items-center gap-1.5 rounded-lg bg-[var(--color-teal)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-teal-light)]">
            <Plus size={14} /> Post a load
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-5">
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">Origin city<input className={input} value={f.origin_city} onChange={(e) => set('origin_city', e.target.value)} placeholder="Dallas" /></label>
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">State<input className={input} maxLength={2} value={f.origin_state} onChange={(e) => set('origin_state', e.target.value)} placeholder="TX" /></label>
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">Destination city<input className={input} value={f.destination_city} onChange={(e) => set('destination_city', e.target.value)} placeholder="Atlanta" /></label>
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">State<input className={input} maxLength={2} value={f.destination_state} onChange={(e) => set('destination_state', e.target.value)} placeholder="GA" /></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">Equipment
              <select className={input} value={f.equipment} onChange={(e) => set('equipment', e.target.value)}>
                {(equipment ?? [{ key: 'dry_van', name: 'Dry van' }]).map((e) => <option key={e.key} value={e.key}>{e.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">Pickup date<input type="date" className={input} value={f.pickup_date} onChange={(e) => set('pickup_date', e.target.value)} /></label>
            <label className="text-xs font-semibold text-[var(--color-text-muted)]">Extra stops<input type="number" min={0} max={20} className={input} value={f.extra_stops} onChange={(e) => set('extra_stops', Math.max(0, parseInt(e.target.value) || 0))} /></label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text)]">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.hazmat} onChange={(e) => set('hazmat', e.target.checked)} /> Hazmat</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.temp_controlled} onChange={(e) => set('temp_controlled', e.target.checked)} /> Temperature controlled</label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="button" onClick={submit} disabled={check.isPending}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-slate)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
            {check.isPending ? <Loader2 size={14} className="animate-spin" /> : <Gauge size={14} />} Check rate
          </button>
        </div>

        <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-5">
          <p className="mb-3 text-sm font-semibold text-[var(--color-text)]">Market range</p>
          {check.isError ? <p className="text-sm text-red-600">The rate check failed. Try again.</p>
            : check.data ? <MarketRateRange result={check.data} />
            : <p className="text-sm text-[var(--color-text-muted)]">Enter a lane and press Check rate.</p>}
        </div>
      </div>

      {!!history?.length && (
        <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
          <p className="border-b border-[var(--color-cream-dark)] px-5 py-3 text-sm font-semibold text-[var(--color-text)]">Recent rate checks</p>
          <div className="divide-y divide-[var(--color-cream-dark)] text-sm">
            {history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                <span className="text-[var(--color-text)]">{h.origin} → {h.destination} <span className="text-xs text-[var(--color-text-faint)]">· {h.equipment.replace(/_/g, ' ')} · {Math.round(h.miles).toLocaleString()} mi{h.hazmat ? ' · hazmat' : ''}{h.temp_controlled ? ' · temp' : ''}</span></span>
                <span className="tabular-nums text-[var(--color-text)]">{h.total ? `${money(h.total.low)} – ${money(h.total.high)}` : '—'} <span className="text-xs text-[var(--color-text-faint)]">{new Date(h.created_at).toLocaleDateString()}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
