'use client';

/**
 * Shipper — Receivers (and brokers)
 *
 * The companies this shipper delivers to, kept from the Shipmater directory. Add one by searching the directory,
 * or list a new one with its locations and contacts. Every load stop can then point at their locations.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, MapPin, Users, ArrowRight } from 'lucide-react';
import { partnerApi } from '@/lib/api';
import type { DirOrgSummary } from '@/types/directory';
import { EmptyState } from '@/components/shared/EmptyState';
import { AddOrgDialog } from '@/components/orgs/AddOrgDialog';
import { OrgTypeBadge } from '@/components/orgs/OrgProfile';
import { useCan } from '@/components/layout/PermissionsContext';

type Tab = 'receiver' | 'broker';

export default function ShipperReceiversPage() {
  const [tab, setTab] = useState<Tab>('receiver');
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();
  const can = useCan();

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['partners', tab],
    queryFn: () => partnerApi.list(tab).then(r => r.data.data as DirOrgSummary[]),
  });

  const tabCls = (t: Tab) => t === tab
    ? 'border-b-2 border-[var(--color-teal)] text-[var(--color-teal)] font-medium'
    : 'border-b-2 border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Receivers</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">The companies you deliver to, their locations and the people to reach there.</p>
        </div>
        {can.do('locations.manage') && (
          <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Add {tab === 'broker' ? 'broker' : 'receiver'}</button>
        )}
      </div>

      <div className="flex gap-6 border-b border-[var(--color-cream-dark)]">
        <button className={`pb-3 text-sm ${tabCls('receiver')}`} onClick={() => setTab('receiver')}>Receivers</button>
        <button className={`pb-3 text-sm ${tabCls('broker')}`} onClick={() => setTab('broker')}>Brokers</button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-36 rounded-2xl bg-[var(--color-cream)] animate-pulse" />)}</div>
      ) : orgs.length === 0 ? (
        <EmptyState icon={Building2}
          title={tab === 'broker' ? 'No brokers yet' : 'No receivers yet'}
          description={tab === 'broker' ? 'Add the brokers you work with.' : 'Add the companies you deliver to. Search the directory first: other shippers may have added them already.'} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map(o => (
            <Link key={o.id} href={`/shipper/receivers/${o.id}`}
              className="flex flex-col rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-5 transition-all hover:border-[var(--color-teal)] hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--color-text)]">{o.name}</p>
                <ArrowRight size={14} className="mt-0.5 shrink-0 text-[var(--color-text-faint)]" />
              </div>
              <div className="mt-2"><OrgTypeBadge type={o.type} listed={o.listed} /></div>
              <div className="mt-3 space-y-1 text-xs text-[var(--color-text-muted)]">
                <p className="flex items-center gap-1.5"><MapPin size={11} /> {[o.city, o.state].filter(Boolean).join(', ') || 'No address'} · {o.locations_count} location{o.locations_count === 1 ? '' : 's'}</p>
                {o.contacts_count != null && <p className="flex items-center gap-1.5"><Users size={11} /> {o.contacts_count} contact{o.contacts_count === 1 ? '' : 's'}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {adding && (
        <AddOrgDialog relation={tab} onClose={() => setAdding(false)}
          onAdded={id => { qc.invalidateQueries({ queryKey: ['partners'] }); router.push(`/shipper/receivers/${id}`); }} />
      )}
    </div>
  );
}
