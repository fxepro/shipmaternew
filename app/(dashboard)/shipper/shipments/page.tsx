'use client';

import { usePortal } from '@/lib/portal';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { shipmentApi } from '@/lib/api';
import { ShipmentTable } from '@/components/shipments/ShipmentTable';
import { ShipmentPanel } from '@/components/shipments/ShipmentPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Shipment, ShipmentStatus } from '@/types/shipment';
import { useCan } from '@/components/layout/PermissionsContext';

const STATUS_FILTERS: { label: string; value: ShipmentStatus | 'all' }[] = [
  { label: 'All',        value: 'all' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered',  value: 'delivered' },
];

export default function ShipperShipmentsPage() {
  const to = usePortal();
  const can = useCan();
  const [filter, setFilter]           = useState<ShipmentStatus | 'all'>('all');
  const [selectedId, setSelectedId]   = useState<number | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['shipper-shipments'],
    queryFn: () => shipmentApi.list(),
  });

  const all: Shipment[] = res?.data?.data ?? [];
  const filtered = filter === 'all' ? all : all.filter((s) => s.status === filter);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">
              My Shipments
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">All shipments you have dispatched</p>
          </div>
          {can.do('loads.post') && <Link
            href={to('/shipper/shipments/new')}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-teal)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-teal-light)] transition-colors shadow-sm"
          >
            <Plus size={14} /> New Shipment
          </Link>}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'bg-[var(--color-slate)] text-white'
                  : 'bg-[var(--color-white)] border border-[var(--color-cream-dark)] text-[var(--color-text-muted)] hover:border-[var(--color-teal-light)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="skeleton h-64 rounded-xl" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No shipments yet"
            description="Your shipments will appear here once they are created and assigned to a carrier."
          />
        ) : (
          <ShipmentTable shipments={filtered} onView={setSelectedId} />
        )}
      </div>

      {/* Slide-over detail panel */}
      <ShipmentPanel
        shipmentId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
