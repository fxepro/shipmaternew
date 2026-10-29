'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StatCard } from '@/components/shared/StatCard';

interface Stat {
  label: string;
  value: string | number;
  currency?: boolean;
  accentColor?: string;
}

export default function AdminDashboard() {
  const { data: metricsRes } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => api.get('/api/v1/admin/metrics'),
  });

  const metrics = metricsRes?.data?.data;

  // Each category renders as its own row; add new categories here as the dashboard grows.
  const categories: { title: string; stats: Stat[] }[] = [
    {
      title: 'Platform',
      stats: [
        { label: 'Total Shipments', value: metrics?.total ?? '—' },
        { label: 'Total Carriers',  value: metrics?.total_carriers ?? '—', accentColor: 'var(--color-teal)' },
        { label: 'Total Shippers',  value: metrics?.total_shippers ?? '—', accentColor: 'var(--color-slate)' },
        { label: 'Total Revenue',   value: metrics?.revenue ?? '—', currency: metrics?.revenue != null, accentColor: 'var(--color-sage)' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="page-title">Admin Console</h1>

      {categories.map(({ title, stats }) => (
        <section key={title} className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{title}</p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
