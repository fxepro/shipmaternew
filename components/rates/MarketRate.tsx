'use client';

import { useQuery } from '@tanstack/react-query';
import { Gauge, Loader2 } from 'lucide-react';
import { ratesApi } from '@/lib/api';

/** The estimate from api/app/Services/Rates/RateEstimator.php */
export interface RateResult {
  ok: boolean;
  reason?: string;
  miles?: number;
  equipment?: string;
  total?: { low: number; typical: number; high: number };
  per_mile?: { low: number; typical: number; high: number };
  lines?: { label: string; detail: string; cents: number }[];
  history?: { loads: number; per_mile: number | null };
  source?: string;
  confidence?: 'low' | 'medium';
}

export const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

/** Low, typical and high for a lane, with what it's made of */
export function MarketRateRange({ result, compact = false }: { result: RateResult; compact?: boolean }) {
  if (!result.ok || !result.total || !result.per_mile) {
    return <p className="text-sm text-[var(--color-text-muted)]">{result.reason ?? 'No estimate for this lane.'}</p>;
  }
  const { total, per_mile } = result;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        {(['low', 'typical', 'high'] as const).map((k) => (
          <div key={k} className={`rounded-lg border px-2 py-2 ${k === 'typical' ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]' : 'border-[var(--color-cream-dark)] bg-[var(--color-white)]'}`}>
            <p className="text-xs text-[var(--color-text-faint)]">{k === 'typical' ? 'Typical' : k === 'low' ? 'Low' : 'High'}</p>
            <p className="text-base font-semibold tabular-nums text-[var(--color-text)]">{money(total[k])}</p>
            <p className="text-xs tabular-nums text-[var(--color-text-faint)]">${per_mile[k].toFixed(2)}/mi</p>
          </div>
        ))}
      </div>
      {!compact && result.lines && (
        <div className="divide-y divide-[var(--color-cream-dark)] rounded-lg border border-[var(--color-cream-dark)] text-sm">
          {result.lines.map((l) => (
            <div key={l.label} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-[var(--color-text)]">{l.label} <span className="text-xs text-[var(--color-text-faint)]">{l.detail}</span></span>
              <span className="tabular-nums text-[var(--color-text)]">{money(l.cents)}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-[var(--color-text-faint)]">
        {result.miles?.toLocaleString()} road miles · {result.source}
        {result.confidence === 'low' && ' · a guide only until there are more completed loads on this lane'}
      </p>
    </div>
  );
}

/** The rate step of Post a load: market range for this load and the price it is posted at */
export function PostedRatePicker({ jobId, value, onChange }: { jobId: number; value: string; onChange: (v: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['market-rate', jobId],
    queryFn: () => ratesApi.forJob(jobId).then((r) => r.data.data as RateResult),
  });
  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-cream)] p-4">
      <div className="flex items-center gap-2">
        <Gauge size={15} className="text-[var(--color-teal)]" />
        <p className="text-sm font-semibold text-[var(--color-text)]">Market rate for this load</p>
      </div>
      {isLoading ? <p className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]"><Loader2 size={14} className="animate-spin" /> Working out the lane…</p>
        : data ? <MarketRateRange result={data} compact /> : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">Posted rate (all in)</span>
          <div className="mt-1 flex items-center rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3">
            <span className="text-sm text-[var(--color-text-faint)]">$</span>
            <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Optional"
              className="w-32 bg-transparent px-1 py-2 text-sm tabular-nums outline-none" />
          </div>
        </label>
        {data?.ok && data.total && (
          <button type="button" onClick={() => onChange(String(Math.round(data.total!.typical / 100)))}
            className="rounded-lg border border-[var(--color-teal)] px-3 py-2 text-sm font-medium text-[var(--color-teal)] hover:bg-[var(--color-teal-pale)]">
            Use typical {money(data.total.typical)}
          </button>
        )}
      </div>
      <p className="text-xs text-[var(--color-text-faint)]">Carriers see the posted rate on the Marketplace and can offer more or less. Leave it empty to ask for offers only.</p>
    </div>
  );
}

/** "6% above market" for an offer, against the load's market estimate */
export function VsMarket({ offerCents, market }: { offerCents: number | null | undefined; market?: { total?: { typical: number } } | null }) {
  const typical = market?.total?.typical;
  if (!offerCents || !typical) return null;
  const pct = Math.round(((offerCents - typical) / typical) * 100);
  const cls = Math.abs(pct) <= 5 ? 'text-[var(--color-text-muted)]' : pct > 0 ? 'text-amber-700' : 'text-emerald-700';
  return <span className={`text-xs font-medium ${cls}`}>{pct === 0 ? 'At market' : `${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} market`}</span>;
}
