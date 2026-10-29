'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { api } from '@/lib/api';
import { ShipmentTable } from '@/components/shipments/ShipmentTable';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Shipment, ShipmentStatus } from '@/types/shipment';

const FILTERS: { label: string; value: ShipmentStatus | 'all' }[] = [
  { label: 'All', value: 'all' }, { label: 'In Transit', value: 'in_transit' },
  { label: 'Disputed', value: 'disputed' }, { label: 'Delivered', value: 'delivered' },
];

export default function AdminShipmentsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<ShipmentStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-shipments-all'],
    queryFn: () => api.get('/api/v1/admin/shipments'),
  });

  const all: Shipment[] = res?.data?.data ?? [];
  const filtered = all
    .filter((s) => filter === 'all' || s.status === filter)
    .filter((s) => !search || s.item_description.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <h1 className="page-title">Shipments</h1>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by item name…"
          className="w-64 bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors"
        />
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${filter === f.value ? 'bg-[var(--color-slate)] text-white' : 'bg-[var(--color-white)] border border-[var(--color-cream-dark)] text-[var(--color-text-muted)]'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No shipments found" />
      ) : (
        <ShipmentTable shipments={filtered} onView={(id) => router.push(`/admin/shipments/${id}`)} />
      )}
    </div>
  );
}
