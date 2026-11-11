'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DataCard, Pill, fmtDate, type DataRow } from '@/components/profile/DataCard';

type Review = {
  id: number; freight_job_id: number | null; job_title: string | null; noa_id: number | null;
  reviewer_org_id: number | null; reviewer_org: string | null; reviewer: string | null; reviewer_role: string;
  reviewee_org_id: number; reviewee_org: string | null; reviewee_role: string;
  overall: number; communication: number; reliability: number; reliability_label: string; average: number;
  comment: string | null; hidden_at: string | null; hidden_by: string | null; hidden_reason: string | null; created_at: string;
};
type Data = {
  summary: { average: number | null; count: number; hidden: number; given: number; overall: number | null; communication: number | null; reliability: number | null; reliability_label: string; stars: Record<string, number> };
  received: Review[]; given: Review[];
};

const ROLE: Record<string, string> = { shipper: 'Shipper', broker: 'Broker', carrier: 'Carrier', receiver: 'Receiver', factor: 'Factor' };

function Stars({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[var(--color-text-faint)]">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={13} className={n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-[var(--color-cream-dark)]'} />)}
      </span>
      <span className="tabular-nums">{value.toFixed(1)}</span>
    </span>
  );
}

const th = 'px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-faint)]';
const td = 'px-3 py-2.5 align-top';

/** Admin → company → Reviews: what the company was told by those it worked with, and what it told them */
export function AdminReviews({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const key = ['admin-company-reviews', orgId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get(`/api/v1/admin/companies/${orgId}/reviews`).then((r) => r.data.data as Data),
  });

  const hide = async (r: Review) => {
    const reason = window.prompt('Why hide this review? Kept on the record.');
    if (!reason?.trim()) return;
    try { await api.post(`/api/v1/admin/reviews/${r.id}/hide`, { reason }); toast.success('Review hidden'); qc.invalidateQueries({ queryKey: key }); }
    catch { toast.error('Could not hide the review'); }
  };
  const show = async (r: Review) => {
    try { await api.delete(`/api/v1/admin/reviews/${r.id}/hide`); toast.success('Review shown again'); qc.invalidateQueries({ queryKey: key }); }
    catch { toast.error('Could not show the review'); }
  };

  if (isLoading || !data) return <div className="skeleton h-48 rounded-xl" />;
  const s = data.summary;
  const total = Object.values(s.stars).reduce((a, b) => a + b, 0);

  const summary: DataRow[] = [
    ['Average', <Stars key="a" value={s.average} />],
    ['Reviews received', `${s.count}${s.hidden ? ` · ${s.hidden} hidden` : ''}`],
    ['Overall', <Stars key="o" value={s.overall} />],
    ['Communication', <Stars key="c" value={s.communication} />],
    [s.reliability_label, <Stars key="r" value={s.reliability} />],
    ['By stars', total ? [5, 4, 3, 2, 1].map((n) => `${n}★ ${s.stars[n] ?? 0}`).join(' · ') : null],
    ['Reviews given', String(s.given)],
  ];

  const where = (r: Review) => r.freight_job_id
    ? <Link href={`/admin/shipments/${r.freight_job_id}`} className="text-[var(--color-teal)] hover:underline">Load #{r.freight_job_id}</Link>
    : r.noa_id ? <Link href="/admin/noas" className="text-[var(--color-teal)] hover:underline">NOA #{r.noa_id}</Link> : '—';
  const company = (id: number | null, name: string | null, role: string, person?: string | null) => (
    <>
      {id ? <Link href={`/admin/companies/${id}`} className="font-medium text-[var(--color-text)] hover:underline">{name ?? `#${id}`}</Link> : <span className="font-medium">{person ?? '—'}</span>}
      <span className="block text-xs text-[var(--color-text-faint)]">{ROLE[role] ?? role}{id && person ? ` · ${person}` : ''}</span>
    </>
  );
  const scores = (r: Review) => (
    <span className="block whitespace-nowrap text-xs text-[var(--color-text-muted)]">
      Comm. {r.communication} · {r.reliability_label} {r.reliability}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="max-w-3xl"><DataCard title="Summary" subtitle="Hidden reviews don't count toward the average" rows={summary} /></div>

      <DataCard title="Received" subtitle={`${data.received.length} from companies it worked with`}>
        {data.received.length === 0 ? <p className="px-4 py-3 text-sm italic text-[var(--color-text-faint)]">No reviews yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--color-cream-dark)]">{['Date', 'From', 'On', 'Overall', 'Comment', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {data.received.map((r) => (
                  <tr key={r.id} className={`border-b border-[var(--color-cream-dark)] last:border-b-0 ${r.hidden_at ? 'opacity-60' : ''}`}>
                    <td className={`${td} whitespace-nowrap text-[var(--color-text-muted)]`}>{fmtDate(r.created_at)}</td>
                    <td className={td}>{company(r.reviewer_org_id, r.reviewer_org, r.reviewer_role, r.reviewer)}</td>
                    <td className={td}>{where(r)}</td>
                    <td className={td}><Stars value={r.overall} />{scores(r)}</td>
                    <td className={`${td} max-w-md`}>
                      {r.comment ?? <span className="text-[var(--color-text-faint)]">—</span>}
                      {r.hidden_at && <span className="mt-1 block"><Pill tone="bad">Hidden</Pill> <span className="text-xs text-[var(--color-text-muted)]">{r.hidden_reason}{r.hidden_by ? ` · ${r.hidden_by}` : ''}, {fmtDate(r.hidden_at)}</span></span>}
                    </td>
                    <td className={`${td} text-right`}>
                      {r.hidden_at
                        ? <button onClick={() => show(r)} className="text-[13px] font-medium text-[var(--color-teal)] hover:underline">Show</button>
                        : <button onClick={() => hide(r)} className="text-[13px] font-medium text-red-700 hover:underline">Hide</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <DataCard title="Given" subtitle={`${data.given.length} to companies it worked with`}>
        {data.given.length === 0 ? <p className="px-4 py-3 text-sm italic text-[var(--color-text-faint)]">No reviews given yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--color-cream-dark)]">{['Date', 'To', 'On', 'Overall', 'Comment'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {data.given.map((r) => (
                  <tr key={r.id} className={`border-b border-[var(--color-cream-dark)] last:border-b-0 ${r.hidden_at ? 'opacity-60' : ''}`}>
                    <td className={`${td} whitespace-nowrap text-[var(--color-text-muted)]`}>{fmtDate(r.created_at)}</td>
                    <td className={td}>{company(r.reviewee_org_id, r.reviewee_org, r.reviewee_role)}</td>
                    <td className={td}>{where(r)}</td>
                    <td className={td}><Stars value={r.overall} />{scores(r)}</td>
                    <td className={`${td} max-w-md`}>{r.comment ?? <span className="text-[var(--color-text-faint)]">—</span>}{r.hidden_at && <span className="ml-2"><Pill tone="bad">Hidden</Pill></span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
