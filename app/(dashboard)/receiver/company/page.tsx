'use client';

/**
 * Receiver — Company: your details, your locations (where freight arrives) and the people there,
 * with the load updates each one gets.
 */

import { OrgProfile } from '@/components/orgs/OrgProfile';
import { useCan, useCurrentUser } from '@/components/layout/PermissionsContext';

export default function ReceiverCompanyPage() {
  const user = useCurrentUser();
  const can = useCan();
  const orgId = user?.viewing_as?.id ?? user?.org?.id;
  if (!orgId) return <p className="text-sm text-[var(--color-text-muted)]">Your company isn&apos;t set up yet.</p>;
  return <OrgProfile orgId={orgId} readOnly={!can.do('locations.manage') && !can.do('contacts.manage')} />;
}
