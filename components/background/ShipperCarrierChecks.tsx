'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { backgroundApi, type BackgroundSummary, type CheckLevel } from '@/lib/api';
import { CardPayment } from './CardPayment';
import { FORM_STATUS } from './BackgroundCheckPanel';

interface ShipperView {
  carrier_level: CheckLevel | null;
  people: BackgroundSummary[];
  order: { people: number; amount: number };
}

const LEVEL_LABEL = { basic: 'Basic check', complete: 'Complete check' } as const;
const ROLE = (r: string | null) => (r === 'owner' ? 'Owner' : r === 'driver' ? 'Driver' : 'Member');

/**
 * Background check levels for a carrier, for a shipper with an active contract with it, and the option to pay
 * for the complete check for everyone who doesn't have it yet. Shows only outcomes, never reports.
 * Renders nothing when there is no contract (the API refuses).
 */
export function ShipperCarrierChecks({ carrierId }: { carrierId: number }) {
  const qc = useQueryClient();
  const key = ['shipper-carrier-background', carrierId];
  const { data, isError } = useQuery({
    queryKey: key, retry: false,
    queryFn: () => backgroundApi.shipperGet(carrierId).then((r) => r.data.data as ShipperView),
  });
  const [paying, setPaying] = useState<{ clientSecret: string; amount: number } | null>(null);
  const [busy, setBusy] = useState(false);

  if (isError) {
    return (
      <div className="p-6 border-b border-[var(--color-cream-dark)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Background checks</p>
        <p className="text-xs text-[var(--color-text-muted)]">Background check results are shared once you have an active contract with this carrier.</p>
      </div>
    );
  }
  if (!data) return null;

  async function order() {
    setBusy(true);
    try {
      const res = await backgroundApi.shipperOrder(carrierId);
      setPaying({ clientSecret: res.data.client_secret, amount: res.data.amount });
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not start the payment.');
    } finally { setBusy(false); }
  }

  return (
    <div className="p-6 border-b border-[var(--color-cream-dark)]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">Background checks</p>
        {data.carrier_level && (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${data.carrier_level === 'complete' ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--color-teal-pale)] text-[var(--color-teal)]'}`}>
            <ShieldCheck size={11} /> {LEVEL_LABEL[data.carrier_level]}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] divide-y divide-[var(--color-cream-dark)]">
        {data.people.map((p) => {
          const inProgress = p.complete && ['paid', 'invitation_sent', 'pending'].includes(p.complete.status);
          return (
            <div key={p.user_id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text)]">{p.name}</p>
                <p className="text-xs text-[var(--color-text-faint)]">{ROLE(p.role)}</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                {p.level ? LEVEL_LABEL[p.level] : 'Not yet checked'}
                {inProgress && ` · Complete check ${FORM_STATUS[p.complete!.status].toLowerCase()}`}
                {p.level === 'complete' && p.complete_expires_at && ` · until ${p.complete_expires_at}`}
              </span>
            </div>
          );
        })}

        {data.order.people > 0 && !paying && (
          <div className="flex items-center gap-3 px-4 py-3">
            <p className="flex-1 text-xs text-[var(--color-text-muted)]">
              Add county records, driving records and the Clearinghouse query for {data.order.people === 1 ? 'the 1 person' : `the ${data.order.people} people`} without a complete check. Each person gives consent on the screening company's form; you see the outcome, never the report.
            </p>
            <button onClick={order} disabled={busy}
              className="shrink-0 rounded-lg border border-[var(--color-teal)] px-3 py-1 text-xs font-medium text-[var(--color-teal)] hover:bg-[var(--color-teal-pale)] disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : `Order complete check — $${data.order.amount}`}
            </button>
          </div>
        )}
        {paying && (
          <CardPayment clientSecret={paying.clientSecret} amount={paying.amount} onCancel={() => setPaying(null)}
            onSuccess={() => { toast.success('Payment received. The carrier has been asked to complete the checks.'); setPaying(null); setTimeout(() => qc.invalidateQueries({ queryKey: key }), 1500); }} />
        )}
      </div>
    </div>
  );
}
