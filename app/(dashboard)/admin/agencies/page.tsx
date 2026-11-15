'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Pill, Table, td, tr, when } from '@/components/lawenforcement/shared';

interface OfficerRow {
  id: number; name: string; email: string; role: string; badge_number: string | null; title: string | null; unit: string | null;
  agency_id: number; agency: string; agency_status: string | null; identity: string | null;
  last_login: string | null; searches_30d: number; open_requests: number;
}
interface AgencyOption { id: number; name: string; verification_status: string | null }

/** Agency: law enforcement officers, filtered by agency (agencies are not on Companies) */
function Officers() {
  const router = useRouter();
  const params = useSearchParams();
  const agency = params.get('agency') ?? '';
  const { data, isLoading } = useQuery({
    queryKey: ['admin-agencies', agency],
    queryFn: () => api.get('/api/v1/admin/agencies', { params: { agency: agency || undefined } })
      .then((r) => r.data as { data: OfficerRow[]; agencies: AgencyOption[] }),
  });
  const rows = data?.data ?? [];

  return (
    <div className="space-y-5">
      <h1 className="page-title">Agency</h1>

      <select value={agency} onChange={(e) => router.replace(e.target.value ? `/admin/agencies?agency=${e.target.value}` : '/admin/agencies')} aria-label="Agency"
        className="rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none">
        <option value="">Every agency</option>
        {(data?.agencies ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}{a.verification_status !== 'approved' ? ' (not approved)' : ''}</option>)}
      </select>

      {isLoading ? <div className="skeleton h-64 rounded-xl" /> : (
        <Table head={['Officer', 'Agency', 'Role', 'Badge', 'Rank', 'Identity', 'Last sign-in', 'Searches (30 days)', 'Open requests', '']}
          empty={rows.length === 0 && 'No officers'}>
          {rows.map((o) => (
            <tr key={o.id} onClick={() => router.push(`/admin/agencies/${o.id}`)} className={`${tr} cursor-pointer hover:bg-[var(--color-cream)]`}>
              <td className={td}>
                <p className="font-medium">{o.name}</p>
                <p className="text-xs text-[var(--color-text-faint)]">{o.email}</p>
              </td>
              <td className={td}>
                {o.agency}
                {o.agency_status !== 'approved' && <span className="ml-2"><Pill value={o.agency_status ?? 'pending'} /></span>}
              </td>
              <td className={`${td} capitalize`}>{o.role}</td>
              <td className={td}>{o.badge_number ?? '—'}</td>
              <td className={td}>{o.title ?? '—'}</td>
              <td className={td}>{o.identity ? <Pill value={o.identity} /> : '—'}</td>
              <td className={`${td} whitespace-nowrap text-xs text-[var(--color-text-muted)]`}>{when(o.last_login)}</td>
              <td className={td}>{o.searches_30d}</td>
              <td className={td}>{o.open_requests || '—'}</td>
              <td className={`${td} text-right text-sm font-medium text-[var(--color-teal)]`}>View</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

export default function AdminAgenciesPage() {
  return <Suspense><Officers /></Suspense>;
}
