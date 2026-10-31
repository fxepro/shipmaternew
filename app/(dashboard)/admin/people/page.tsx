'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Users, Truck, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserStatusBadge } from '@/components/admin/UserStatusBadge';
import {
  CheckChip, PersonStatusBadge, PERSON_STATUSES, ROLE_LABELS, ROLES_BY_TYPE, backgroundState,
} from '@/components/admin/PersonBadges';

interface PersonRow {
  id: number;
  name: string;
  email: string;
  company: { id: number; name: string } | null;
  company_type: 'carrier' | 'shipper' | 'factor' | null;
  role: string | null;
  account_status: string;
  approval_required: boolean;
  identity: string | null;
  background: string | null;
  credentials: { required_met: number; required_total: number; recorded: number; problems: number };
  ready: boolean;
  status: string;
  created_at: string;
}

type CompanyType = 'all' | 'carrier' | 'shipper' | 'factor';

const selectCls =
  'bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]';

function People() {
  const router = useRouter();
  const params = useSearchParams();
  const initialType = params.get('type');
  const [type, setType] = useState<CompanyType>(initialType === 'carrier' || initialType === 'shipper' || initialType === 'factor' ? initialType : 'all');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState(params.get('status') ?? 'all');
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-people', type, role, status],
    queryFn: () => api.get('/api/v1/admin/people', { params: { type, role, status } }),
  });

  const q = search.trim().toLowerCase();
  const people: PersonRow[] = (res?.data?.data ?? []).filter(
    (p: PersonRow) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.company?.name.toLowerCase().includes(q)
  );

  const roleOptions = type === 'all' ? ROLES_BY_TYPE.carrier : ROLES_BY_TYPE[type];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">People</h1>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">
          Everyone at carrier and shipper companies. Carrier owners and drivers need approval; drivers also need a background check and current credentials.
          Other roles only have their certifications recorded.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or company…"
          className="w-64 bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors"
        />
        <select value={type} onChange={(e) => { setType(e.target.value as CompanyType); setRole('all'); }} aria-label="Filter by company type" className={selectCls}>
          <option value="all">All companies</option>
          <option value="carrier">Carrier people</option>
          <option value="shipper">Shipper people</option>
          <option value="factor">Factor people</option>
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className={selectCls}>
          <option value="all">All roles</option>
          {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className={selectCls}>
          <option value="all">All statuses</option>
          {PERSON_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span className="ml-auto text-sm text-[var(--color-text-muted)]">
          {isLoading ? '' : `${people.length} ${people.length === 1 ? 'person' : 'people'}`}
        </span>
      </div>

      {isLoading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : people.length === 0 ? (
        <EmptyState icon={Users} title="No one matches these filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-slate)]">
                {['Person', 'Company', 'Role', 'Identity', 'Background', 'Credentials', 'Approval', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-sage-light)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/admin/people/${p.id}`)}
                  className="cursor-pointer border-b border-[var(--color-cream-dark)] last:border-b-0 bg-[var(--color-white)] hover:bg-[var(--color-cream)] transition-colors align-top"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-text)]">{p.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{p.email}</p>
                    {p.account_status !== 'active' && <div className="mt-1"><UserStatusBadge status={p.account_status} /></div>}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      {p.company_type === 'carrier' ? <Truck size={13} /> : <Building2 size={13} />}
                      {p.company?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{p.role ? ROLE_LABELS[p.role] ?? p.role : '—'}</td>
                  <td className="px-4 py-3">{p.identity ? <CheckChip state={p.identity} /> : <span className="text-xs text-[var(--color-text-faint)]">Not required</span>}</td>
                  <td className="px-4 py-3">
                    {p.background ? <CheckChip state={backgroundState(p.background)} /> : <span className="text-xs text-[var(--color-text-faint)]">Not required</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                    {p.credentials.required_total > 0 && <p>{p.credentials.required_met} of {p.credentials.required_total} required</p>}
                    {p.credentials.recorded > 0 && <p>{p.credentials.recorded} recorded</p>}
                    {p.credentials.problems > 0 && <p className="font-semibold text-[var(--color-danger)]">{p.credentials.problems} expired or failed</p>}
                    {p.credentials.required_total === 0 && p.credentials.recorded === 0 && <span className="text-[var(--color-text-faint)]">None</span>}
                  </td>
                  <td className="px-4 py-3"><PersonStatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-[var(--color-teal)]">
                    {p.status === 'pending_review' ? 'Review' : 'View'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminPeoplePage() {
  return (
    <Suspense>
      <People />
    </Suspense>
  );
}
