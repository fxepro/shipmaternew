'use client';

/**
 * Receiver — Company: your details, your locations (where freight arrives) and the people there,
 * with the load updates each one gets. Below: compliance (an optional certificate of insurance).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { OrgProfile } from '@/components/orgs/OrgProfile';
import { ComplianceItems, type ComplianceItem } from '@/components/compliance/ComplianceItems';
import { useCan, useCurrentUser } from '@/components/layout/PermissionsContext';
import { api } from '@/lib/api';

export default function ReceiverCompanyPage() {
  const user = useCurrentUser();
  const can = useCan();
  const qc = useQueryClient();
  const orgId = user?.viewing_as?.id ?? user?.org?.id;
  const { data: compliance } = useQuery({
    queryKey: ['org-compliance'],
    queryFn: () => api.get('/api/v1/org/compliance').then((r) => r.data.data as ComplianceItem[]),
    enabled: !!orgId,
  });
  if (!orgId) return <p className="text-sm text-[var(--color-text-muted)]">Your company isn&apos;t set up yet.</p>;
  return (
    <div className="space-y-6">
      <OrgProfile orgId={orgId} readOnly={!can.do('locations.manage') && !can.do('contacts.manage')} />
      {compliance && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--color-slate)]">Compliance</h2>
          <ComplianceItems items={compliance}
            uploadUrl={can.do('company.profile') ? (key) => `/api/v1/org/compliance/${key}` : undefined}
            onChange={(items) => qc.setQueryData(['org-compliance'], items)} />
        </div>
      )}
    </div>
  );
}
