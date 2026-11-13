'use client';

/**
 * Receiver — Company: business details, locations (where freight arrives) and the people there,
 * compliance (an optional certificate of insurance) and the team. The signed-in person is in Profile.
 */

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { PerformancePanel } from '@/components/entities/PerformancePanel';
import { OrgProfile } from '@/components/orgs/OrgProfile';
import { ComplianceItems, type ComplianceItem } from '@/components/compliance/ComplianceItems';
import { TeamManager } from '@/components/team/TeamManager';
import { CompanyHeader } from '@/components/account/AccountHeader';
import { AccountTabs } from '@/components/account/AccountTabs';
import { useCan, useCurrentUser } from '@/components/layout/PermissionsContext';
import { CompanyProfileCard } from '@/components/entities/CompanyProfileCard';
import { api } from '@/lib/api';

type Tab = 'business' | 'locations' | 'compliance' | 'performance' | 'team';
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'business',   label: 'Business',              icon: Building2   },
  { id: 'locations',  label: 'Locations & contacts',  icon: MapPin      },
  { id: 'compliance', label: 'Compliance',            icon: ShieldCheck },
  { id: 'performance', label: 'Performance',          icon: TrendingUp  },
  { id: 'team',       label: 'Team',                  icon: Users       },
];

function Company() {
  const user = useCurrentUser();
  const can = useCan();
  const qc = useQueryClient();
  const router = useRouter();
  const requested = useSearchParams().get('tab') as Tab | null;
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : 'business';
  const orgId = user?.viewing_as?.id ?? user?.org?.id;
  const { data: compliance } = useQuery({
    queryKey: ['org-compliance'],
    queryFn: () => api.get('/api/v1/org/compliance').then((r) => r.data.data as ComplianceItem[]),
    enabled: !!orgId && tab === 'compliance',
  });
  if (!orgId) return <p className="text-sm text-[var(--color-text-muted)]">Your company isn&apos;t set up yet.</p>;
  const readOnly = !can.do('locations.manage') && !can.do('contacts.manage');
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="page-title">Company</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">Your company: its details, where freight arrives, compliance and your team</p>
      </div>
      <CompanyHeader type="receiver" />
      <AccountTabs tabs={TABS} active={tab} onSelect={(id) => router.replace(`/receiver/company?tab=${id}`)} />

      {tab === 'business'  && <CompanyProfileCard />}
      {tab === 'business'  && <OrgProfile orgId={orgId} hideHeader sections={['details']} readOnly={!can.do('company.profile')} />}
      {tab === 'locations' && <OrgProfile orgId={orgId} hideHeader sections={['locations', 'contacts']} readOnly={readOnly} />}
      {tab === 'compliance' && (compliance
        ? <ComplianceItems items={compliance}
            uploadUrl={can.do('company.profile') ? (key) => `/api/v1/org/compliance/${key}` : undefined}
            onChange={(items) => qc.setQueryData(['org-compliance'], items)} />
        : <div className="skeleton h-32 rounded-xl" />)}
      {tab === 'performance' && <PerformancePanel />}
      {tab === 'team' && <TeamManager type="receiver" />}
    </div>
  );
}

export default function ReceiverCompanyPage() {
  return <Suspense><Company /></Suspense>;
}
