'use client';

import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, Download, ExternalLink, Loader2, Mail, ShieldCheck, XCircle } from 'lucide-react';
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
 * clearinghouse: the person's Clearinghouse status and action, shown in its row of the table.
 */
export function BackgroundCheckPanel({ userId, onChange, clearinghouse }: { userId?: number; onChange?: () => void; clearinghouse?: ReactNode }) {
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

  async function download(checkId: number, type: 'summary' | 'report') {
    setBusy(`${type}-${checkId}`);
    try {
      const res = await backgroundApi.pdf(checkId, type);
      const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] ?? '')?.[1] ?? `background-check-${type}.pdf`;
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      // A blob error body has to be read as text
      let msg = type === 'report' ? "The full report isn't available yet. Try again later." : 'Could not download the PDF.';
      try { const t = await ((err as { response?: { data?: Blob } }).response?.data?.text?.() ?? ''); msg = JSON.parse(t).message || msg; } catch { /* keep the default */ }
      toast.error(msg);
    } finally { setBusy(null); }
  }

  async function email(checkId: number) {
    setBusy(`email-${checkId}`);
    try {
      const res = await backgroundApi.email(checkId);
      toast.success(res.data.message ?? 'Emailed.');
    } catch (err) {
      toast.error(apiError(err, 'Could not send the email.'));
    } finally { setBusy(null); }
  }

  if (isLoading || !data) return <div className="skeleton h-28 rounded-xl" />;

  const p = data.prices ?? { basic: 39, complete: 99, upgrade: 60 };
  const basicOpen = data.basic && ['paid', 'invitation_sent', 'pending', 'clear', 'consider', 'expired'].includes(data.basic.status);
  const completeOpen = data.complete && ['paid', 'invitation_sent', 'pending', 'expired', 'clear', 'consider'].includes(data.complete.status);
  const canPayBasic = !data.level && !basicOpen && !completeOpen;
  const canPayComplete = data.level !== 'complete' && !completeOpen;
  const completePrice = data.next_complete_kind === 'upgrade' ? p.upgrade : p.complete;

  const cols: { level: CheckLevel; title: string; price: string; form: BackgroundForm | null; canPay: boolean; payAmount: number }[] = [
    { level: 'basic', title: 'Basic', price: `$${p.basic}`, form: data.basic, canPay: canPayBasic, payAmount: p.basic },
    { level: 'complete', title: 'Complete', price: data.next_complete_kind === 'upgrade' ? `$${p.complete} ($${p.upgrade} after Basic)` : `$${p.complete}`, form: data.complete, canPay: canPayComplete, payAmount: completePrice },
  ];

  const yes = <CheckCircle size={16} className="mx-auto text-[var(--color-success)]" aria-label="Included" />;
  const no = <span className="block text-center text-[var(--color-text-faint)]" aria-label="Not included">—</span>;
  const btn = 'inline-flex items-center gap-1 rounded-lg border border-[var(--color-cream-dark)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] disabled:opacity-50';
  const th = 'px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)]';
  const td = 'px-4 py-2.5 align-top';

  /** Status, payment, form and downloads for one level */
  const cell = (c: typeof cols[number]) => {
    const f = c.form;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-1.5 text-sm">
          <StatusIcon form={f} />
          <span className="text-[var(--color-text)]">{f && f.status !== 'paid' ? FORM_STATUS[f.status] : f ? 'Paid, not started' : 'Not ordered'}</span>
        </div>
        {f?.completed_at && <p className="text-center text-xs text-[var(--color-text-faint)]">Completed {f.completed_at}</p>}
        {f?.paid_by === 'shipper' && f.payer && <p className="text-center text-xs text-[var(--color-teal)]">Paid for by {f.payer}</p>}
        <div className="flex flex-wrap justify-center gap-1.5">
          {c.canPay && paying?.level !== c.level && (
            <button onClick={() => pay(c.level)} disabled={!!busy || !!paying}
              className="rounded-lg border border-[var(--color-teal)] px-3 py-1 text-xs font-semibold text-[var(--color-teal)] hover:bg-[var(--color-teal-pale)] disabled:opacity-50">
              {busy === c.level ? <Loader2 size={13} className="animate-spin" /> : `Pay $${c.payAmount}`}
            </button>
          )}
          {f?.invitation_url && (
            <a href={f.invitation_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-teal)] px-3 py-1 text-xs font-semibold text-white"><ExternalLink size={12} /> Open the form</a>
          )}
          {f?.check_id && (
            <button onClick={() => start(f.check_id!)} disabled={!!busy}
              className="rounded-lg border border-[var(--color-teal)] px-3 py-1 text-xs font-semibold text-[var(--color-teal)] hover:bg-[var(--color-teal-pale)] disabled:opacity-50">
              {busy === `start-${f.check_id}` ? <Loader2 size={13} className="animate-spin" /> : 'Start check'}
            </button>
          )}
          {f?.downloads?.summary && (
            <button onClick={() => download(f.id, 'summary')} disabled={!!busy} className={btn}>
              {busy === `summary-${f.id}` ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Summary PDF
            </button>
          )}
          {f?.downloads?.report && (
            <button onClick={() => download(f.id, 'report')} disabled={!!busy} className={btn}>
              {busy === `report-${f.id}` ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Full report PDF
            </button>
          )}
          {f?.downloads && (
            <button onClick={() => email(f.id)} disabled={!!busy} className={btn}>
              {busy === `email-${f.id}` ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} Email me
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">Background check</p>
        {data.level && (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text)]">
            <ShieldCheck size={14} className="text-[var(--color-success)]" /> {data.level === 'complete' ? 'Complete' : 'Basic'} level
            {data.complete_expires_at && <span className="text-xs text-[var(--color-text-faint)]">· valid until {data.complete_expires_at}</span>}
          </span>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead className="bg-[var(--color-cream)]">
            <tr>
              <th className={`${th} text-left`}>What is checked</th>
              {cols.map((c) => (
                <th key={c.level} className={`${th} w-[30%] text-center`}>
                  <span className="block text-sm normal-case tracking-normal text-[var(--color-text)]">{c.title}</span>
                  <span className="block normal-case tracking-normal font-medium">{c.price}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-cream-dark)]">
            {CHECKED.map((r) => (
              <tr key={r.label}>
                <td className={td}>
                  <p className="text-[var(--color-text)]">{r.label}</p>
                  {r.detail && <p className="text-xs text-[var(--color-text-faint)]">{r.detail}</p>}
                  {r.key === 'clearinghouse' && clearinghouse}
                </td>
                <td className={td}>{r.basic ? yes : no}</td>
                <td className={td}>{yes}</td>
              </tr>
            ))}
            <tr className="bg-[var(--color-cream)]/40">
              <td className={`${td} font-medium text-[var(--color-text)]`}>Your check</td>
              {cols.map((c) => <td key={c.level} className={td}>{cell(c)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {(data.basic?.invitation_url || data.complete?.invitation_url) && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">Give consent and enter your SSN on the screening company&apos;s secure form. Shipmater never sees or stores your SSN.</p>
      )}
      {paying && (
        <div className="mt-3 rounded-xl border border-[var(--color-cream-dark)]">
          <CardPayment clientSecret={paying.clientSecret} amount={paying.amount} onCancel={() => setPaying(null)}
            onSuccess={() => { toast.success('Payment received. Your background check has started.'); setPaying(null); setTimeout(refresh, 1500); }} />
        </div>
      )}
    </div>
  );
}

/** What each level covers. The Complete check includes everything in Basic. */
const CHECKED: { key: string; label: string; detail: string; basic: boolean }[] = [
  { key: 'criminal', label: 'Criminal record search', detail: 'National and federal criminal records', basic: true },
  { key: 'sex_offender', label: 'Sex offender registry', detail: 'National sex offender registry', basic: true },
  { key: 'watchlists', label: 'OFAC and watchlists', detail: 'Sanctions, terrorist and global watchlists', basic: true },
  { key: 'identity', label: 'Identity and carrier verification', detail: 'Photo ID with a selfie, and your FMCSA operating authority', basic: true },
  { key: 'county', label: 'County criminal records', detail: 'Court records in the counties where you have lived', basic: false },
  { key: 'mvr', label: 'Motor vehicle record (MVR)', detail: 'Driving history, violations, suspensions, DUI', basic: false },
  { key: 'clearinghouse', label: 'FMCSA Drug & Alcohol Clearinghouse', detail: '', basic: false },
];
