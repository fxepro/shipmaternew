'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { DataCard, Pill, fmtDate, fmtMoney, type DataRow } from '@/components/profile/DataCard';

type Insurance = { form: string; insurer: string | null; policy: string | null; coverage: number | null; effective: string | null; cancels: string | null; filed: string | null };
type Basic = { label: string; measure: number | null; alert: boolean; inspections_with_violations: number };
type FmcsaRecordData = {
  insurance: Insurance[];
  boc3: { agent: string | null; attention: string | null; address: string } | null;
  authority: { current: { type: string; status: string | null; reason: string | null; date: string | null }[]; history: { type: string; granted: string | null; action: string | null; action_date: string | null }[] };
  revocations: { type: string | null; action: string | null; served: string | null; effective: string | null }[];
  safety: { inspections: number; driver_inspections: number; driver_oos_rate: number | null; vehicle_inspections: number; vehicle_oos_rate: number | null; basics: Basic[] } | null;
  checked_at: string;
};

const pct = (n: number | null) => (n === null ? null : `${n}%`);

type FmcsaResponse = { data: FmcsaRecordData | null; dot: string | null; mc: string | null; pulled_at: string | null; history: number };

/**
 * FMCSA's public record for a carrier or broker, as saved in Shipmater (api FmcsaOpenData::forOrg, refreshed daily):
 * insurance on file, BOC-3 process agent, authority, revocations and SMS safety measures.
 * orgId: an admin looking at any company; omitted, the signed-in company.
 */
export function FmcsaRecord({ orgId }: { orgId?: number | string } = {}) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const url = orgId ? `/api/v1/admin/companies/${orgId}/fmcsa-record` : '/api/v1/company/fmcsa-record';
  const key = ['fmcsa-record', orgId ?? 'own'];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get(url).then((r) => r.data as FmcsaResponse),
    staleTime: 10 * 60 * 1000,
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await api.get(url, { params: { fresh: 1 } });
      qc.setQueryData(key, r.data);
    } finally { setRefreshing(false); }
  };

  if (isLoading) return <p className="text-sm text-[var(--color-text-faint)]">Loading the FMCSA record…</p>;
  const rec = data?.data;
  if (!rec) return (
    <DataCard title="FMCSA record" rows={[['Status', 'Add a USDOT or MC number to see what FMCSA holds on this company']]} />
  );

  const action = (
    <button onClick={refresh} disabled={refreshing}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-teal)] disabled:opacity-60">
      <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Check again
    </button>
  );
  const source = `FMCSA public data · checked ${fmtDate(data?.pulled_at ?? rec.checked_at)}${data && data.history > 1 ? ` · ${data.history} versions kept` : ''}`;

  const insuranceRows: DataRow[] = rec.insurance.length
    ? rec.insurance.map((i, n) => [`${i.form}${rec.insurance.length > 1 ? ` (${n + 1})` : ''}`, (
        <span key={n} className="block">
          {[fmtMoney(i.coverage), i.insurer].filter(Boolean).join(' · ') || 'On file'}
          <span className="block text-sm text-[var(--color-text-muted)]">
            {[i.policy && `Policy ${i.policy}`, i.effective && `effective ${fmtDate(i.effective)}`].filter(Boolean).join(', ')}
          </span>
          {i.cancels && <span className="mt-1 block"><Pill tone="bad">Cancels {fmtDate(i.cancels)}</Pill></span>}
        </span>
      )])
    : [['Filings', <Pill key="none" tone="bad">No insurance or bond on file</Pill>]];

  const authorityRows: DataRow[] = [
    ...rec.authority.current.map((a): DataRow => [a.type, (
      <span key={a.type}>
        <Pill tone={a.status === 'Active' ? 'good' : 'bad'}>{a.status ?? 'Unknown'}</Pill>
        {(a.reason || a.date) && <span className="ml-2 text-sm text-[var(--color-text-muted)]">{[a.reason, fmtDate(a.date)].filter(Boolean).join(', ')}</span>}
      </span>
    )]),
    ...rec.authority.history.slice(0, 6).map((h, n): DataRow => [`${h.type}${rec.authority.history.length > 1 ? ` (${n + 1})` : ''}`,
      [h.granted && `Granted ${fmtDate(h.granted)}`, h.action && `${h.action}${h.action_date ? ` ${fmtDate(h.action_date)}` : ''}`].filter(Boolean).join(' · ')]),
  ];

  return (
    <div className="space-y-4">
      <DataCard title="Insurance on file" subtitle={source} action={action} rows={insuranceRows} />

      <DataCard title="Process agent (BOC-3)" rows={rec.boc3
        ? [['Agent', rec.boc3.agent], ['Attention', rec.boc3.attention], ['Address', rec.boc3.address]]
        : [['Status', <Pill key="b" tone="bad">No BOC-3 on file</Pill>]]} />

      <DataCard title="Authority" rows={authorityRows.length ? authorityRows : [['Status', 'No authority on record']]} />

      {rec.revocations.length > 0 && (
        <DataCard title="Revocations and suspensions" rows={rec.revocations.slice(0, 6).map((r, n): DataRow => [
          `${r.type ?? 'Authority'} (${n + 1})`,
          [r.action, r.effective ? `effective ${fmtDate(r.effective)}` : r.served ? `served ${fmtDate(r.served)}` : null].filter(Boolean).join(', '),
        ])} />
      )}

      <DataCard title="Safety scores (SMS)" subtitle="FMCSA's monthly measures; a lower measure is better. Percentiles for property carriers aren't public."
        rows={rec.safety
          ? [
              ['Inspections (24 months)', rec.safety.inspections.toLocaleString()],
              ['Driver out-of-service rate', pct(rec.safety.driver_oos_rate) && `${pct(rec.safety.driver_oos_rate)} of ${rec.safety.driver_inspections.toLocaleString()}`],
              ['Vehicle out-of-service rate', pct(rec.safety.vehicle_oos_rate) && `${pct(rec.safety.vehicle_oos_rate)} of ${rec.safety.vehicle_inspections.toLocaleString()}`],
              ...rec.safety.basics.map((b): DataRow => [b.label, (
                <span key={b.label}>
                  {b.measure ?? '—'}
                  <span className="ml-2 text-sm text-[var(--color-text-muted)]">{b.inspections_with_violations.toLocaleString()} inspections with violations</span>
                  {b.alert && <span className="ml-2"><Pill tone="bad">FMCSA alert</Pill></span>}
                </span>
              )]),
            ]
          : [['Status', 'No safety measures — FMCSA lists only active interstate carriers with inspections']]} />
    </div>
  );
}
