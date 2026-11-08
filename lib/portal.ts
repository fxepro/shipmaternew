'use client';

import { usePathname } from 'next/navigation';

/**
 * Shippers and brokers use the same pages, under /shipper and /broker.
 * to('/shipper/jobs') returns the path in the portal the person is in, so links keep them there.
 */
export function usePortal() {
  const base = usePathname()?.startsWith('/broker') ? '/broker' : '/shipper';
  return (path: string) => path.replace(/^\/shipper(?=\/|\?|$)/, base);
}

/** True on the broker pages */
export function useIsBrokerPortal(): boolean {
  return usePathname()?.startsWith('/broker') ?? false;
}
