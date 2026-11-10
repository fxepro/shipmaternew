'use client';

import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { shipmentApi } from '@/lib/api';
import { ShipmentCard } from '@/components/shipments/ShipmentCard';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Shipment } from '@/types/shipment';

export default function ReceiverShipmentsPage() {
  const { data: res, isLoading } = useQuery({
    queryKey: ['receiver-shipments'],
    queryFn: () => shipmentApi.list({ role: 'receiver' }),
  });

  const shipments: Shipment[] = res?.data?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="page-title">Inbound</h1>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      ) : shipments.length === 0 ? (
        <EmptyState icon={Package} title="No deliveries" description="Shipments sent to you will appear here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shipments.map((s) => <ShipmentCard key={s.id} shipment={s} />)}
        </div>
      )}
    </div>
  );
}
