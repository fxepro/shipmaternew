'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PaymentMethods } from '@/components/payments/PaymentMethods';
import { useCan } from '@/components/layout/PermissionsContext';
import { Table, td, tr } from '@/components/lawenforcement/shared';

interface Month { month: string; label: string; reports: number; total: number }

/** Business reports are billed monthly to the agency's default payment method */
export default function AgencyBillingPage() {
  const can = useCan();
  const { data, isLoading } = useQuery({
    queryKey: ['agency-billing'],
    queryFn: () => api.get('/api/v1/agency/billing').then((r) => r.data.data as { months: Month[]; this_month: Month; price: number }),
  });

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="page-title">Billing</h1>

      {isLoading || !data ? <div className="skeleton h-32 rounded-xl" /> : (<>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[['This month', data.this_month.label], ['Reports', String(data.this_month.reports)], ['Amount due', `$${data.this_month.total.toFixed(2)}`]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{l}</p>
              <p className="mt-1 text-xl font-semibold">{v}</p>
            </div>
          ))}
        </div>
        <Table head={['Month', 'Reports', `Total ($${data.price} each)`]} empty={data.months.length === 0 && 'No statements yet'}>
          {data.months.map((m) => (
            <tr key={m.month} className={tr}>
              <td className={td}>{m.label}</td>
              <td className={td}>{m.reports}</td>
              <td className={td}>${m.total.toFixed(2)}</td>
            </tr>
          ))}
        </Table>
      </>)}

      {can.level('le.billing') === 'full' &&<PaymentMethods purpose="agency" />}
    </div>
  );
}
