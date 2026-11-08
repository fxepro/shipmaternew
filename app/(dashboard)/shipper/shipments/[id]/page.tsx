'use client';

import { usePortal } from '@/lib/portal';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

/**
 * /shipper/shipments/[id] — redirects back to the list page.
 * Shipment details are now shown in the slide-over panel on the list page.
 */
export default function ShipmentDetailRedirect() {
  const to = usePortal();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    // Redirect back to the list; the panel will handle display
    router.replace(to('/shipper/shipments'));
  }, [router, params]);

  return null;
}
