'use client';

import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { ShipmentTable } from '@/components/shipments/ShipmentTable';
import { OfficerSearch } from '@/components/lawenforcement/OfficerSearch';
import type { Shipment } from '@/types/shipment';

/** Law enforcement: loads by number, reference, plate or VIN; in progress or delivered in the last 72 hours */
export function OfficerLoads({ tracking = false }: { tracking?: boolean }) {
  const router = useRouter();
  return (
    <OfficerSearch<Shipment> title={tracking ? 'Live tracking' : 'Loads'} placeholder="Load number, reference, plate or VIN"
      endpoint="/api/v1/admin/shipments" shortNumbers params={tracking ? { page: 'tracking' } : undefined} icon={Package}
      empty={tracking ? 'No load in progress matches' : 'No load in the last 72 hours matches'}>
      {(rows) => <ShipmentTable shipments={rows} onView={(id) => router.push(`/admin/shipments/${id}${tracking ? '?view=tracking' : ''}`)} />}
    </OfficerSearch>
  );
}

