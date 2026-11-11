'use client';

import { usePathname } from 'next/navigation';

/**
 * Shippers and brokers use the same pages, under /shipper and /broker; admins see them under /admin/ops.
 * to('/shipper/jobs') returns the path in the portal the person is in, so links keep them there.
 */
export function usePortal() {
  const path = usePathname() ?? '';
  // Admin Operations shows the shipper pages under /admin/ops with every company's records
  const base = path.startsWith('/broker') ? '/broker' : path.startsWith('/admin/ops') ? '/admin/ops' : '/shipper';
  return (path: string) => path.replace(/^\/shipper(?=\/|\?|$)/, base);
}

/** True on the broker pages */
export function useIsBrokerPortal(): boolean {
  return usePathname()?.startsWith('/broker') ?? false;
}
