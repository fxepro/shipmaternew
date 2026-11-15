'use client';

// Admin Operations: the shipper page, showing every company's records (lib/portal.ts keeps links under /admin/ops).
// Law enforcement: a search for loads in progress (Tier 2), each opened with a reason.
import ShipperTracking from '@/app/(dashboard)/shipper/tracking/page';
import { OfficerLoads } from '@/components/lawenforcement/OfficerLoads';
import { useCurrentUser } from '@/components/layout/PermissionsContext';

export default function AdminTrackingPage() {
  const officer = useCurrentUser()?.role === 'agency';
  return officer ? <OfficerLoads tracking /> : <ShipperTracking />;
}
