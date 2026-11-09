'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { myChecksApi } from '@/lib/api';
import { useCurrentUser } from '@/components/layout/PermissionsContext';
import { ROLE_LABELS } from '@/components/admin/PersonBadges';
import { DataCard } from '@/components/profile/DataCard';
import { IdentitySection } from '@/components/people/MyVerification';

/**
 * Profile, Personal tab for factor and receiver people: the login (name, email, role)
 * and the person's identity record from /api/v1/me/checks (legal name, date of birth, home address, ID).
 */
export function PersonalDetails() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['my-checks'],
    queryFn: () => myChecksApi.get().then((r) => r.data.data as { identity: Record<string, string | number | boolean | null> | null; company_type: string | null }),
  });
  return (
    <div className="space-y-4">
      <DataCard title="Sign-in" rows={[
        ['Name', user?.name],
        ['Email', user?.email],
        ['Role', user?.org_role ? ROLE_LABELS[user.org_role] ?? user.org_role : null],
        ['Company', user?.org?.name],
      ]} />
      {isLoading
        ? <div className="skeleton h-48 rounded-xl" />
        : <IdentitySection identity={data?.identity ?? null} isCarrier={data?.company_type === 'carrier' || data?.company_type === 'factor'}
            onSaved={() => qc.invalidateQueries({ queryKey: ['my-checks'] })} />}
    </div>
  );
}
