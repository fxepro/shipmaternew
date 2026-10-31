'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, Loader2, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { bidApi } from '@/lib/api';

interface Props {
  bidId:           number;
  carrierName:     string;
  route:           string;
  itemDescription: string;
  onAccepted:      () => void;
  onClose:         () => void;
}

/**
 * Accept a bid. Nothing is charged now: the card on file is held the day before pickup and charged at delivery
 * (docs/fees-and-billing.md). A card or bank account must be on file first.
 */
export function FreightPaymentModal({ bidId, carrierName, route, itemDescription, onAccepted, onClose }: Props) {
  const [step, setStep] = useState<'confirm' | 'saving' | 'success' | 'no_method'>('confirm');

  async function accept() {
    setStep('saving');
    try {
      await bidApi.accept(bidId);
      setStep('success');
      toast.success('Bid accepted. Carrier assigned.');
    } catch (e) {
      const d = (e as { response?: { data?: { code?: string; error?: string; message?: string } } })?.response?.data;
      if (d?.code === 'payment_method_required') { setStep('no_method'); return; }
      toast.error(d?.error ?? d?.message ?? 'Could not accept this bid.');
      setStep('confirm');
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-[var(--color-white)] shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-cream-dark)] px-6 py-5">
            <div>
              <p className="font-semibold text-[var(--color-text)]">Accept bid</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">{carrierName} · {itemDescription}</p>
              <p className="text-xs text-[var(--color-text-faint)]">{route}</p>
            </div>
            <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-faint)] hover:bg-[var(--color-cream)] hover:text-[var(--color-text)]">
              <X size={16} />
            </button>
          </div>

          <div className="px-6 py-5">
            {(step === 'confirm' || step === 'saving') && (
              <div className="space-y-4">
                <div className="rounded-xl bg-[var(--color-cream)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                  <p className="font-medium text-[var(--color-text)]">Nothing is charged now</p>
                  <p className="mt-1">Your card on file is held the day before pickup and charged when the load is delivered. Bank accounts are charged at delivery.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--color-cream-dark)] py-2.5 text-sm font-semibold text-[var(--color-text-muted)]">Cancel</button>
                  <button onClick={accept} disabled={step === 'saving'}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-teal)] py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {step === 'saving' && <Loader2 size={14} className="animate-spin" />} Accept bid
                  </button>
                </div>
              </div>
            )}

            {step === 'no_method' && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <AlertCircle size={32} className="text-amber-500" />
                <p className="text-sm text-[var(--color-text-muted)]">Add a card or bank account before accepting a bid.</p>
                <Link href="/shipper/payments" className="flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-4 py-2 text-sm font-semibold text-white">
                  <CreditCard size={14} /> Go to Payments
                </Link>
              </div>
            )}

            {step === 'success' && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 size={28} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-text)]">Carrier assigned</p>
                  <p className="mt-1 text-sm text-[var(--color-text-faint)]">Track the payment in Payments.</p>
                </div>
                <button onClick={() => { onAccepted(); onClose(); }} className="w-full rounded-xl bg-[var(--color-teal)] py-2.5 text-sm font-semibold text-white">Done</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
