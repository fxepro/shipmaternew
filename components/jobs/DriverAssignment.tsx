'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Driver { id: number; name: string; status: string; cleared: boolean; reason: string | null }
interface Assignment { driver: Driver | null; assigned_at: string | null; can_assign: boolean }

/** Pick the driver for a load. Only drivers Shipmater has approved, with current credentials, can be chosen. */
export function DriverAssignment({ shipmentId, kind = 'shipments' }: { shipmentId: number; kind?: 'shipments' | 'freight-jobs' }) {
  const qc = useQueryClient();

  const { data: current } = useQuery({
    queryKey: ['load-driver', kind, shipmentId],
    queryFn: () => api.get(`/api/v1/${kind}/${shipmentId}/driver`).then((r) => r.data.data as Assignment),
    retry: false,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['carrier-drivers'],
    queryFn: () => api.get('/api/v1/carrier/drivers').then((r) => r.data.data as Driver[]),
    enabled: !!current?.can_assign,
    retry: false,
  });

  const assign = useMutation({
    mutationFn: (driverId: number | null) => api.put(`/api/v1/${kind}/${shipmentId}/driver`, { driver_id: driverId }),
    onSuccess: (_, driverId) => {
      toast.success(driverId ? 'Driver assigned' : 'Driver removed');
      qc.invalidateQueries({ queryKey: ['load-driver', kind, shipmentId] });
    },
    onError: (e: { response?: { data?: { error?: string; message?: string } } }) =>
      toast.error(e?.response?.data?.error ?? e?.response?.data?.message ?? 'Could not assign driver'),
  });

  if (!current) return null;

  return (
    <section className="card">
      <div className="card-head card-head-tint flex items-center gap-2 px-5 py-3">
        <UserCheck size={14} className="text-[var(--color-text-muted)]" />
        <p className="card-title">Driver</p>
      </div>
      <div className="card-body space-y-2">
        {current.can_assign ? (
          <>
            <select
              value={current.driver?.id ?? ''}
              onChange={(e) => assign.mutate(e.target.value ? Number(e.target.value) : null)}
              disabled={assign.isPending}
              aria-label="Assign a driver"
              className="w-full max-w-md rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none"
            >
              <option value="">No driver assigned</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id} disabled={!d.cleared}>
                  {d.name}{d.cleared ? '' : ` — not cleared (${d.reason ?? 'awaiting approval'})`}
                </option>
              ))}
            </select>
            {drivers.length === 0 && (
              <p className="text-xs text-[var(--color-text-faint)]">No drivers on your team yet. Invite them from Team.</p>
            )}
            <p className="text-xs text-[var(--color-text-faint)]">Only drivers approved by Shipmater with a current CDL and medical card can be assigned.</p>
          </>
        ) : (
          <p className="text-sm text-[var(--color-text)]">{current.driver ? current.driver.name : 'No driver assigned yet.'}</p>
        )}
      </div>
    </section>
  );
}
