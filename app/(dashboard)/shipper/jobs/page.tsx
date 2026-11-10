'use client';

import { usePortal } from '@/lib/portal';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** My Jobs was merged into Shipments (every load, draft to delivered); old links land there */
export default function MyJobsRedirect() {
  const to = usePortal();
  const router = useRouter();
  useEffect(() => { router.replace(to('/shipper/shipments')); }, [router, to]);
  return null;
}
