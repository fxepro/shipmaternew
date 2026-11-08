'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface Match {
  carrier: { id: number; name: string; city: string | null; state: string | null; verification_status: string | null; rating: number | null };
  fit: boolean; score: number; misses: string[]; unknown: string[]; vehicle_ids: number[];
}

/** Carriers whose authority, fleet, specializations and drivers fit this load */
export function MatchesPanel({ jobId }: { jobId: number }) {
  const [all, setAll] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['job-matches', jobId, all],
    queryFn: () => api.get(`/api/v1/shipper/freight-jobs/${jobId}/matches`, { params: all ? { all: 1 } : {} }).then((r) => r.data.data as Match[]),
  });
  const rows = data ?? [];
  const fits = rows.filter((r) => r.fit).length;

  return (
    <section className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-cream-dark)] px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Matching carriers</p>
          <p className="text-xs text-[var(--color-text-faint)]">{isLoading ? 'Checking…' : `${fits} carrier${fits === 1 ? '' : 's'} can haul this load`}</p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-teal)]" />
          Show ones that don&apos;t fit
        </label>
      </header>
      <ul className="divide-y divide-[var(--color-cream-dark)]">
        {!isLoading && rows.length === 0 && <li className="px-4 py-3 text-sm italic text-[var(--color-text-faint)]">No carrier fits these requirements yet.</li>}
        {rows.map((m) => (
          <li key={m.carrier.id} className="flex items-start gap-3 px-4 py-2.5">
            {m.fit ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-text-faint)]" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-text)]">{m.carrier.name}
                <span className="ml-2 text-xs font-normal text-[var(--color-text-faint)]">{[m.carrier.city, m.carrier.state].filter(Boolean).join(', ')}</span>
              </p>
              {m.misses.length > 0 && <p className="text-xs text-[var(--color-text-muted)]">{m.misses.join(' · ')}</p>}
              {m.fit && m.unknown.length > 0 && <p className="text-xs text-amber-700">{m.unknown.join(' · ')}</p>}
            </div>
            {m.fit && <span className="shrink-0 rounded-full bg-[var(--color-cream)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">{m.carrier.verification_status === 'approved' ? 'Verified' : 'Not verified'}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
