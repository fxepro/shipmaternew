'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { api } from '@/lib/api';
import { ShipmentTable } from '@/components/shipments/ShipmentTable';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Shipment, ShipmentStatus } from '@/types/shipment';

// The same status tabs as the shipper's Shipments page, plus disputes
const FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' }, { label: 'Draft', value: 'draft' }, { label: 'Posted', value: 'pending' },
  { label: 'Booked', value: 'assigned' }, { label: 'In transit', value: 'in_transit' },
  { label: 'Delivered', value: 'delivered' }, { label: 'Disputed', value: 'disputed' },
];
const KINDS = [{ label: 'All loads', value: 'all' }, { label: 'Marketplace', value: 'open' }, { label: 'Contract freight', value: 'contracted' }] as const;

export default function AdminShipmentsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('all');
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-shipments-all'],
    queryFn: () => api.get('/api/v1/admin/shipments'),
  });

  const all: Shipment[] = res?.data?.data ?? [];
  const filtered = all
    .filter((s) => filter === 'all' || s.status === filter)
    .filter((s) => kind === 'all' || (s as Shipment & { job_type?: string }).job_type === kind)
    .filter((s) => !search || s.item_description.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <h1 className="page-title">Loads</h1>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by item name…"
          className="w-64 bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Load type"
          className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]">
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${filter === f.value ? 'bg-[var(--color-slate)] text-white' : 'bg-[var(--color-white)] border border-[var(--color-cream-dark)] text-[var(--color-text-muted)]'}`}>
              {f.label} <span className="opacity-60">{f.value === 'all' ? all.length : all.filter((s) => s.status === f.value).length}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No loads found" />
      ) : (
        <ShipmentTable shipments={filtered} onView={(id) => router.push(`/admin/shipments/${id}`)} />
      )}
    </div>
  );
}
