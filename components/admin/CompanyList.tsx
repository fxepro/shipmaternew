'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, Truck, Landmark, PackageCheck, Handshake } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { CompanyStatusBadge, COMPANY_STATUSES } from '@/components/admin/CompanyBadges';

type OrgType = 'carrier' | 'shipper' | 'factor' | 'receiver' | 'broker';

interface CompanyRow {
  id: number;
  name: string;
  type: OrgType;
  members: number;
  owner: { id: number; name: string; email: string } | null;
  dot_number: string | null;
  mc_number: string | null;
  ein: string | null;
  verification_status: string;
  city: string | null;
  state: string | null;
  locations: number;
  contacts: number;
  third_party: boolean;
  joined_promotion: string | null;
  created_at: string;
}

type Tab = 'all' | OrgType;

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'shipper', label: 'Shippers' }, { key: 'broker', label: 'Brokers' }, { key: 'carrier', label: 'Carriers' },
  { key: 'factor', label: 'Factors' },
];
// Organizations also has the orgs Shipmater doesn't sell to
const ORG_TABS: { key: Tab; label: string }[] = [...TABS, { key: 'receiver', label: 'Receivers' }];
const TYPE_LABEL: Record<OrgType, string> = { carrier: 'Carrier', shipper: 'Shipper', factor: 'Factor', receiver: 'Receiver', broker: 'Broker' };
const TYPE_ICON: Record<OrgType, React.ElementType> = { carrier: Truck, shipper: Building2, factor: Landmark, receiver: PackageCheck, broker: Handshake };
/** Shipmater reviews shippers, brokers, carriers and factors */
const REVIEWED: OrgType[] = ['carrier', 'shipper', 'broker', 'factor'];

/**
 * scope 'companies': Shipmater's own customers (shippers, carriers, factors that signed up).
 * scope 'orgs': every organization, same table, opened under /admin/orgs.
 */
export function CompanyList({ initialType = 'all', scope = 'companies' }: { initialType?: Tab; scope?: 'companies' | 'orgs' }) {
  const orgs = scope === 'orgs';
  const base = orgs ? '/admin/orgs' : '/admin/companies';
  const router = useRouter();
  const [type, setType] = useState<Tab>(initialType);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-companies', scope, type, status],
    queryFn: () => api.get('/api/v1/admin/companies', { params: { type, status, scope: orgs ? 'all' : 'companies' } }),
  });

  const q = search.trim().toLowerCase();
  const companies: CompanyRow[] = (res?.data?.data ?? []).filter(
    (c: CompanyRow) => !q || c.name.toLowerCase().includes(q) || c.owner?.name.toLowerCase().includes(q) || (c.city ?? '').toLowerCase().includes(q)
  );
  const reviewTab = type === 'carrier' || type === 'shipper';

  const tabCls = (t: Tab) => t === type
    ? 'border-b-2 border-[var(--color-teal)] text-[var(--color-teal)] font-medium'
    : 'border-b-2 border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{orgs ? 'Organizations' : 'Companies'}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">
          {orgs
            ? 'Every organization on Shipmater: our customers and the third parties connected to them, such as receivers.'
            : 'Companies signed up on Shipmater. Each is approved automatically once its required compliance checks pass (Admin Console, Compliance).'}
        </p>
      </div>

      <div className="flex flex-wrap gap-5 border-b border-[var(--color-cream-dark)]">
        {(orgs ? ORG_TABS : TABS).map(t => (
          <button key={t.key} className={`pb-3 text-sm ${tabCls(t.key)}`} onClick={() => { setType(t.key); setStatus('all'); }}>{t.label}</button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, owner or city…"
          className="w-64 bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]"
        >
          <option value="all">All statuses</option>
          {(type === 'all' || reviewTab) && COMPANY_STATUSES.map((s) => <option key={s.value} value={s.value}>Review: {s.label}</option>)}
        </select>
        <span className="ml-auto text-sm text-[var(--color-text-muted)]">
          {isLoading ? '' : orgs ? `${companies.length} organization${companies.length === 1 ? '' : 's'}` : `${companies.length} compan${companies.length === 1 ? 'y' : 'ies'}`}
        </span>
      </div>

      {isLoading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : companies.length === 0 ? (
        <EmptyState icon={Building2} title={orgs ? 'No organizations match these filters' : 'No companies match these filters'} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-slate)]">
                {[orgs ? 'Organization' : 'Company', 'Type', 'Owner', reviewTab ? 'DOT / MC / EIN' : 'Locations', 'Members', 'Status', 'Added', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-sage-light)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const Icon = TYPE_ICON[c.type] ?? Building2;
                const reviewed = REVIEWED.includes(c.type);
                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`${base}/${c.id}`)}
                    className="cursor-pointer border-b border-[var(--color-cream-dark)] last:border-b-0 bg-[var(--color-white)] hover:bg-[var(--color-cream)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-text)]">{c.name}</p>
                      {(c.city || c.state) && <p className="text-xs text-[var(--color-text-muted)]">{[c.city, c.state].filter(Boolean).join(', ')}</p>}
                      {c.joined_promotion && c.verification_status !== 'approved' && <p className="text-xs text-amber-700">Joined in {c.joined_promotion} · not yet verified</p>}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      <span className="inline-flex items-center gap-1.5"><Icon size={13} /> {TYPE_LABEL[c.type] ?? c.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[var(--color-text)]">{c.owner?.name ?? '—'}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{c.owner?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                      {reviewTab ? (c.type === 'carrier' ? (
                        <>
                          <p>{c.dot_number ? `DOT ${c.dot_number}` : '—'}</p>
                          {c.mc_number && <p>{c.mc_number}</p>}
                        </>
                      ) : (c.ein ?? '—')) : `${c.locations} location${c.locations === 1 ? '' : 's'} · ${c.contacts} contact${c.contacts === 1 ? '' : 's'}`}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.members}</td>
                    <td className="px-4 py-3">
                      {reviewed ? <CompanyStatusBadge status={c.verification_status} />
                        : c.third_party ? <span className="badge badge-muted">Third party</span>
                        : <span className="badge badge-success">On Shipmater</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-[var(--color-teal)]">View</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
