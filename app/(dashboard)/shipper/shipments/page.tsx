'use client';

import { usePortal } from '@/lib/portal';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { shipmentApi } from '@/lib/api';
import { ShipmentTable } from '@/components/shipments/ShipmentTable';
import { ShipmentPanel } from '@/components/shipments/ShipmentPanel';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Shipment, ShipmentStatus } from '@/types/shipment';
import { useCan } from '@/components/layout/PermissionsContext';

// Every load, from draft to delivered (My Jobs was merged into this page)
const STATUS_FILTERS: { label: string; value: ShipmentStatus | 'all' }[] = [
  { label: 'All',        value: 'all' },
  { label: 'Draft',      value: 'draft' },
  { label: 'Posted',     value: 'pending' },
  { label: 'Booked',     value: 'assigned' },
  { label: 'In transit', value: 'in_transit' },
  { label: 'Delivered',  value: 'delivered' },
];

export default function ShipperShipmentsPage() {
  const to = usePortal();
  const can = useCan();
  const router = useRouter();
  const broker = usePathname().startsWith('/broker');
  const [filter, setFilter]           = useState<ShipmentStatus | 'all'>('all');
  const [selectedId, setSelectedId]   = useState<number | null>(null);

  const { data: res, isLoading } = useQuery({
    queryKey: ['shipper-shipments'],
    queryFn: () => shipmentApi.list({ include_drafts: 1 }),
  });

  const all: Shipment[] = res?.data?.data ?? [];
  const filtered = filter === 'all' ? all : all.filter((s) => s.status === filter);
  const count = (v: ShipmentStatus | 'all') => (v === 'all' ? all.length : all.filter((s) => s.status === v).length);

  // Drafts and posted loads open the load page (finish, post, see offers); booked ones open the tracking panel
  const view = (id: number) => {
    const s = all.find((x) => x.id === id);
    if (s && (s.status === 'draft' || s.status === 'pending')) router.push(to(`/shipper/jobs/${id}`));
    else setSelectedId(id);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">{broker ? 'Loads' : 'Shipments'}</h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">Every load, from draft to delivered</p>
          </div>
          {can.do('loads.post') && <Link
            href={to('/shipper/jobs/contracted/new')}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-teal)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-teal-light)] transition-colors shadow-sm"
          >
            <Plus size={14} /> Post a load
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
              {count(f.value) > 0 && <span className="ml-1.5 text-xs opacity-70">{count(f.value)}</span>}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="skeleton h-64 rounded-xl" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={filter === 'all' ? 'No loads yet' : 'No loads here'}
            description={filter === 'all' ? 'Post a load to the Marketplace or to a contract carrier, and it will show here.' : undefined}
          />
        ) : (
          <ShipmentTable shipments={filtered} onView={view} />
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
