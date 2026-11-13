'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Metric {
  key: string; label: string; description: string; unit: string; value: number | null; display: string | null;
  sample: number; counts: string; basis: string | null; computed_at: string | null;
}

/** Metric tiles: the number, what it measures, and how many loads it is based on. Same values inside and on the profile. */
export function MetricTiles({ metrics, detail = false }: { metrics: Metric[]; detail?: boolean }) {
  if (!metrics.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {metrics.map((m) => (
        <div key={m.key} className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-4 py-3">
          <p className={`text-2xl font-bold ${m.display ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}`}>{m.display ?? '—'}</p>
          <p className="text-sm font-semibold text-[var(--color-text)]">{m.label}</p>
          <p className="text-xs text-[var(--color-text-faint)]">{m.display ? m.basis : 'Not enough loads yet'}</p>
          {detail && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{m.description}</p>}
        </div>
      ))}
    </div>
  );
}

/** Company page → Performance: the company's own metrics, calculated daily from its loads */
export function PerformancePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['org-performance'],
    queryFn: () => api.get('/api/v1/org/performance').then((r) => r.data.data as Metric[]),
  });
  if (isLoading || !data) return <div className="skeleton h-40 rounded-xl" />;
  const at = data.find((m) => m.computed_at)?.computed_at;
  return (
    <div className="space-y-2">
      <MetricTiles metrics={data} detail />
      {at && <p className="text-xs text-[var(--color-text-faint)]">Calculated {new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
    </div>
  );
}
