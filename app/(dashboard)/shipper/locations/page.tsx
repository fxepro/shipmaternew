'use client';

/**
 * Shipper — Locations: your own company's sites and contacts.
 * A location has no pickup or delivery type; any of them can ship and receive. Receivers' sites are under Receivers.
 */

import { OrgProfile } from '@/components/orgs/OrgProfile';
import { useCan, useCurrentUser } from '@/components/layout/PermissionsContext';

export default function ShipperLocationsPage() {
  const user = useCurrentUser();
  const can = useCan();
  const orgId = user?.viewing_as?.id ?? user?.org?.id;

  if (!orgId) return <p className="text-sm text-[var(--color-text-muted)]">Join or create a company first.</p>;
  return <OrgProfile orgId={orgId} readOnly={!can.do('locations.manage')} sections={['locations', 'contacts']}
    title="Locations" subtitle="Your company's sites and the people to reach there. Public locations can be used by anyone on Shipmater." />;
}
