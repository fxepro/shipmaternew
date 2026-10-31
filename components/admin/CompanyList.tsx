'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, Truck, Landmark } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { CompanyStatusBadge, BackgroundBadge, COMPANY_STATUSES } from '@/components/admin/CompanyBadges';

interface CompanyRow {
  id: number;
  name: string;
  type: 'carrier' | 'shipper' | 'factor';
  members: number;
  owner: { id: number; name: string; email: string } | null;
  dot_number: string | null;
  mc_number: string | null;
  ein: string | null;
  verification_status: string;
  background_check_status: string;
  created_at: string;
}

type CompanyType = 'all' | 'carrier' | 'shipper' | 'factor';

const TYPE_LABEL = { carrier: 'Carrier', shipper: 'Shipper', factor: 'Factor' } as const;
const TYPE_ICON  = { carrier: Truck, shipper: Building2, factor: Landmark } as const;

/** Table of carrier and shipper companies (organizations) with type and status filters. */
export function CompanyList({ initialType = 'all' }: { initialType?: CompanyType }) {
  const router = useRouter();
  const [type, setType] = useState<CompanyType>(initialType);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-companies', type, status],
    queryFn: () => api.get('/api/v1/admin/companies', { params: { type, status } }),
  });

  const q = search.trim().toLowerCase();
  const companies: CompanyRow[] = (res?.data?.data ?? []).filter(
    (c: CompanyRow) => !q || c.name.toLowerCase().includes(q) || c.owner?.name.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Companies</h1>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">
          Carrier and shipper companies. A company needs a clear background check before it can be approved; a carrier also needs its owner approved in People.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company or owner…"
          className="w-64 bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CompanyType)}
          aria-label="Filter by company type"
          className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]"
        >
          <option value="all">All companies</option>
          <option value="carrier">Carriers</option>
          <option value="shipper">Shippers</option>
          <option value="factor">Factors</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]"
        >
          <option value="all">All statuses</option>
          {COMPANY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span className="ml-auto text-sm text-[var(--color-text-muted)]">
          {isLoading ? '' : `${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}`}
        </span>
      </div>

      {isLoading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : companies.length === 0 ? (
        <EmptyState icon={type === 'carrier' ? Truck : Building2} title="No companies match these filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-slate)]">
                {['Company', 'Type', 'Owner', 'DOT / MC / EIN', 'Members', 'Background', 'Status', 'Joined', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-sage-light)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/admin/companies/${c.id}`)}
                  className="cursor-pointer border-b border-[var(--color-cream-dark)] last:border-b-0 bg-[var(--color-white)] hover:bg-[var(--color-cream)] transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">{c.name}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      {(() => { const Icon = TYPE_ICON[c.type] ?? Building2; return <Icon size={13} />; })()}
                      {TYPE_LABEL[c.type] ?? c.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[var(--color-text)]">{c.owner?.name ?? '—'}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{c.owner?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                    {c.type === 'carrier' ? (
                      <>
                        <p>{c.dot_number ? `DOT ${c.dot_number}` : '—'}</p>
                        {c.mc_number && <p>{c.mc_number}</p>}
                      </>
                    ) : (c.ein ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.members}</td>
                  <td className="px-4 py-3">{c.type === 'factor' ? <span className="text-xs text-[var(--color-text-faint)]">Not required</span> : <BackgroundBadge status={c.background_check_status} />}</td>
                  <td className="px-4 py-3">{c.type === 'factor' ? <span className="text-xs text-[var(--color-text-faint)]">Not required</span> : <CompanyStatusBadge status={c.verification_status} />}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-[var(--color-teal)]">View</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
