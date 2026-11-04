'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, ExternalLink, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { backgroundApi, type BackgroundForm, type BackgroundSummary, type CheckLevel } from '@/lib/api';
import { CardPayment } from './CardPayment';

export const FORM_STATUS: Record<BackgroundForm['status'], string> = {
  paid: 'Paid, not started', invitation_sent: 'Waiting for you to complete the secure form', pending: 'In progress',
  clear: 'Passed', consider: 'Under review', suspended: 'Not passed', expired: 'Form expired',
};

const apiError = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
  ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

function StatusIcon({ form }: { form: BackgroundForm | null }) {
  if (form?.status === 'clear') return <CheckCircle size={15} className="text-[var(--color-success)] shrink-0" />;
  if (form?.status === 'suspended') return <XCircle size={15} className="text-red-600 shrink-0" />;
  return <Clock size={15} className={`${form ? 'text-[var(--color-teal)]' : 'text-[var(--color-warning)]'} shrink-0`} />;
}

/**
 * Background check for one person (a carrier owner, or a driver), at two levels:
 * Basic ($39) and Complete ($99, or the difference once Basic has passed). Paying starts the check.
 * userId is set when an owner opens a driver's checks; otherwise it is the signed-in person.
 */
export function BackgroundCheckPanel({ userId, onChange }: { userId?: number; onChange?: () => void }) {
  const qc = useQueryClient();
  const key = ['background', userId ?? 'me'];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => backgroundApi.get(userId).then((r) => r.data.data as BackgroundSummary) });
  const [paying, setPaying] = useState<{ level: CheckLevel; clientSecret: string; amount: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => { qc.invalidateQueries({ queryKey: key }); onChange?.(); };

  async function pay(level: CheckLevel) {
    setBusy(level);
    try {
      const res = await backgroundApi.pay(level, userId);
      setPaying({ level, clientSecret: res.data.client_secret, amount: res.data.amount });
    } catch (err) {
      toast.error(apiError(err, 'Could not start the payment. Please try again.'));
    } finally { setBusy(null); }
  }

  async function start(checkId: number) {
    setBusy(`start-${checkId}`);
    try {
      const res = await backgroundApi.start(checkId);
      toast.success('Background check started. Complete the secure form.');
      if (res.data.invitation_url) window.open(res.data.invitation_url, '_blank', 'noopener');
      refresh();
    } catch (err) {
      toast.error(apiError(err, 'Could not start the background check.'));
    } finally { setBusy(null); }
  }

  if (isLoading || !data) return <div className="skeleton h-28 rounded-xl" />;

  const p = data.prices ?? { basic: 39, complete: 99, upgrade: 60 };
  const basicOpen = data.basic && ['paid', 'invitation_sent', 'pending', 'clear', 'consider', 'expired'].includes(data.basic.status);
  const completeOpen = data.complete && ['paid', 'invitation_sent', 'pending', 'expired'].includes(data.complete.status);
  const canPayBasic = !data.level && !basicOpen && !completeOpen;
  const canPayComplete = data.level !== 'complete' && !completeOpen && !(data.complete?.status === 'consider');
  const completePrice = data.next_complete_kind === 'upgrade' ? p.upgrade : p.complete;

  const rows: { level: CheckLevel; title: string; detail: string; form: BackgroundForm | null; canPay: boolean; price: number }[] = [
    { level: 'basic', title: `Basic check — $${p.basic}`, detail: 'Criminal record search, sex offender registry and watchlists, with your identity check and carrier verification', form: data.basic, canPay: canPayBasic, price: p.basic },
    { level: 'complete', title: `Complete check — $${p.complete}`, detail: `Everything in Basic, plus county criminal records, driving record and the Clearinghouse query${data.next_complete_kind === 'upgrade' ? ` ($${p.upgrade} once Basic has passed)` : ''}`, form: data.complete, canPay: canPayComplete, price: completePrice },
  ];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Background check</p>
      <div className="rounded-xl border border-[var(--color-cream-dark)] divide-y divide-[var(--color-cream-dark)]">
        {rows.map((r) => (
          <div key={r.level}>
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5"><StatusIcon form={r.form} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text)]">{r.title}</p>
                <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{r.detail}</p>
                {r.form?.paid_by === 'shipper' && r.form.payer && <p className="text-xs text-[var(--color-teal)] mt-0.5">Paid for by {r.form.payer}</p>}
              </div>
              {r.form && r.form.status !== 'paid' && (
                <span className="text-xs text-[var(--color-text-faint)] shrink-0">{FORM_STATUS[r.form.status]}</span>
              )}
              {r.canPay && paying?.level !== r.level && (
                <button onClick={() => pay(r.level)} disabled={!!busy || !!paying}
                  className="shrink-0 rounded-lg border border-[var(--color-teal)] px-3 py-1 text-xs font-medium text-[var(--color-teal)] hover:bg-[var(--color-teal-pale)] disabled:opacity-50">
                  {busy === r.level ? <Loader2 size={13} className="animate-spin" /> : `Pay $${r.price}`}
                </button>
              )}
            </div>
            {r.form?.invitation_url && (
              <div className="flex items-center gap-3 px-4 pb-3 -mt-1">
                <span className="w-[15px] shrink-0" />
                <p className="flex-1 text-xs text-[var(--color-text-muted)]">Give consent and enter your SSN on the screening company's secure form. Shipmater never sees or stores your SSN.</p>
                <a href={r.form.invitation_url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-[var(--color-teal)] px-3 py-1 text-xs font-medium text-white"><ExternalLink size={12} /> Open the form</a>
              </div>
            )}
            {r.form?.check_id && (
              <div className="flex items-center gap-3 px-4 pb-3 -mt-1">
                <span className="w-[15px] shrink-0" />
                <p className="flex-1 text-xs text-[var(--color-text-muted)]">{r.form.status === 'expired' ? 'The secure form expired before it was completed.' : 'Paid. Add any missing personal details, then start the check.'}</p>
                <button onClick={() => start(r.form!.check_id!)} disabled={!!busy}
                  className="shrink-0 rounded-lg border border-[var(--color-teal)] px-3 py-1 text-xs font-medium text-[var(--color-teal)] hover:bg-[var(--color-teal-pale)] disabled:opacity-50">
                  {busy === `start-${r.form.check_id}` ? <Loader2 size={13} className="animate-spin" /> : 'Start check'}
                </button>
              </div>
            )}
            {paying?.level === r.level && (
              <CardPayment clientSecret={paying.clientSecret} amount={paying.amount} onCancel={() => setPaying(null)}
                onSuccess={() => { toast.success('Payment received. Your background check has started.'); setPaying(null); setTimeout(refresh, 1500); }} />
            )}
          </div>
        ))}
        {data.level && (
          <div className="flex items-center gap-3 px-4 py-3">
            <ShieldCheck size={15} className="text-[var(--color-success)] shrink-0" />
            <span className="text-sm flex-1 text-[var(--color-text)]">{data.level === 'complete' ? 'Complete check' : 'Basic check'} level</span>
            {data.complete_expires_at && <span className="text-xs text-[var(--color-text-faint)]">Valid until {data.complete_expires_at}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
