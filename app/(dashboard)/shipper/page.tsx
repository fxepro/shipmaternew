'use client';

import { usePortal } from '@/lib/portal';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Package } from 'lucide-react';
import { shipmentApi } from '@/lib/api';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { ShipmentTable } from '@/components/shipments/ShipmentTable';
import { ShipmentPanel } from '@/components/shipments/ShipmentPanel';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import type { Shipment } from '@/types/shipment';
import { useCan } from '@/components/layout/PermissionsContext';

function SkeletonCard() {
  return <div className="skeleton h-[104px] rounded-xl" />;
}

export default function ShipperDashboard() {
  const to = usePortal();
  const can = useCan();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: shipmentsRes, isLoading } = useQuery({
    queryKey: ['shipper-shipments'],
    queryFn: () => shipmentApi.list(),
  });

  const shipments: Shipment[] = shipmentsRes?.data?.data ?? [];

  const stats = [
    {
      label: 'Active Shipments',
      value: shipments.filter((s) => ['assigned', 'in_transit'].includes(s.status)).length,
    },
    {
      label: 'Pending',
      value: shipments.filter((s) => s.status === 'pending').length,
      accentColor: 'var(--info)',
    },
    {
      label: 'Delivered',
      value: shipments.filter((s) => s.status === 'delivered').length,
      accentColor: 'var(--success)',
    },
    {
      label: 'Total Spent',
      value: shipments
        .reduce((acc, s) => acc + (s.agreed_cost ?? 0), 0)
        .toLocaleString('en-US', { minimumFractionDigits: 0 }),
      currency: true,
      accentColor: 'var(--navy)',
    },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">Dashboard</h1>
          {can.do('loads.post') && <Link href={to('/shipper/shipments/new')} className="btn btn-primary">
            <Plus size={15} /> New Shipment
          </Link>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : stats.map((s) => <StatCard key={s.label} {...s} />)
          }
        </div>

        {/* Recent shipments table */}
        <div className="card">
          <div className="card-head">
            <p className="card-title">Recent Shipments</p>
            <Link href={to('/shipper/shipments')} className="link text-sm">View all</Link>
          </div>
          {isLoading ? (
            <div className="skeleton h-48 m-4 rounded-lg" />
          ) : shipments.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No shipments yet"
              description="Create your first shipment to get started."
              action={{ label: 'New Shipment', onClick: () => {} }}
            />
          ) : (
            <ShipmentTable
              shipments={shipments.slice(0, 5)}
              onView={setSelectedId}
              embedded
            />

          )}
        </div>

        {/* Bottom row: activity */}
        <div className="card card-body">
          <p className="card-title mb-4">Activity</p>
          <ActivityFeed items={[]} />
          {shipments.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
              Activity will appear here as shipments progress.
            </p>
          )}
        </div>
      </div>

      {/* Slide-over detail panel */}
      <ShipmentPanel
        shipmentId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
