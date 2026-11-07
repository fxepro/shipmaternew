'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Bids are offers on freight jobs now: send people to the offers page. */
export default function ShipperBidsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/shipper/jobs/offers'); }, [router]);
  return null;
}
