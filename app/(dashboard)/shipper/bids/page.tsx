'use client';

import { usePortal } from '@/lib/portal';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Bids are offers on freight jobs now: send people to the offers page. */
export default function ShipperBidsRedirect() {
  const to = usePortal();
  const router = useRouter();
  useEffect(() => { router.replace(to('/shipper/jobs/offers')); }, [router]);
  return null;
}
