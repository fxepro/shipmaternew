'use client';

/**
 * OfferDetailPanel — shipper-side overlay for reviewing a single offer.
 *
 * Sections:
 *   1. Offer details (all rate fields the carrier submitted)
 *   2. Accept / Decline actions
 *   3. After Accept: inline "Create Contract" form (pre-filled from offer)
 *      → on save, contract is created and visible in /shipper/contracts
 */

import { usePortal } from '@/lib/portal';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Route, MapPin, DollarSign, Fuel, Clock, Truck, Scale,
  CreditCard, MessageSquare, CheckCircle2, Loader2, FileText,
  Star, BadgeCheck, ChevronRight, ExternalLink,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import Link from 'next/link';
import { freightJobApi, contractApi } from '@/lib/api';
import { useCan } from '@/components/layout/PermissionsContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | string | null | undefined) {
  const v = parseFloat(String(n ?? 0)) || 0;
  return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function oneYearLater() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// Map offer rate_type → contract rate_type string
const RATE_TYPE_MAP: Record<string, string> = {
  flat:     'Flat rate',
  per_mile: 'Per mile',
  hourly:   'Hourly',
};
// Map offer payment_terms → contract payment_terms (contract only allows these 4)
const CONTRACT_PAYMENT_TERMS = ['Net 15', 'Net 30', 'Net 45', 'Quick Pay'];
function mapPaymentTerms(pt: string | null): string {
  if (!pt) return '';
  if (CONTRACT_PAYMENT_TERMS.includes(pt)) return pt;
  if (pt.toLowerCase() === 'quickpay' || pt.toLowerCase() === 'quick pay') return 'Quick Pay';
  return '';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DetailRow({ icon: Icon, label, value, highlight }: {
  icon?: React.ElementType; label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-cream-dark)] last:border-0">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-text-faint)]">
        {Icon && <Icon size={11} />}
        {label}
      </div>
      <p className={`text-sm font-semibold ${highlight ? 'text-[var(--color-teal)]' : 'text-[var(--color-text)]'}`}>
        {value}
      </p>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  offer:     any;
  onClose:   () => void;
  onUpdated: () => void;   // refetch parent table
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OfferDetailPanel({ offer, onClose, onUpdated }: Props) {
  const to = usePortal();
  const job = offer.job;
  const can = useCan();

  // Accept / decline state
  const [stage, setStage] = useState<'view' | 'contract' | 'done'>('view');

  // Contract form state — pre-filled from offer where possible
  const [coverage,      setCoverage]      = useState('');
  const [priority,      setPriority]      = useState('Standard');
  const [paymentTerms,  setPaymentTerms]  = useState(mapPaymentTerms(offer.payment_terms));
  const [validFrom,     setValidFrom]     = useState(today());
  const [validTo,       setValidTo]       = useState(oneYearLater());
  const [notes,         setNotes]         = useState('');
  const [savedContract, setSavedContract] = useState<any>(null);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const acceptMutation = useMutation({
    mutationFn: () => freightJobApi.acceptOffer(offer.freight_job_id, offer.id),
    onSuccess: () => {
      toast.success('Offer accepted — carrier assigned to job.');
      onUpdated();
      setStage('contract');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to accept offer.'),
  });

  const declineMutation = useMutation({
    mutationFn: () => freightJobApi.declineOffer(offer.freight_job_id, offer.id),
    onSuccess: () => {
      toast.success('Offer declined.');
      onUpdated();
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to decline offer.'),
  });

  const contractMutation = useMutation({
    mutationFn: () => {
      const rateForContract =
        offer.rate_type === 'flat'
          ? parseFloat(offer.amount)
          : parseFloat(offer.rate_value ?? offer.amount);

      return contractApi.create({
        carrier_id:     offer.carrier_id,
        rate_type:      RATE_TYPE_MAP[offer.rate_type] ?? 'Flat rate',
        rate:           rateForContract,
        fuel_surcharge: offer.fuel_surcharge  ?? undefined,
        detention_rate: offer.detention_rate  ?? undefined,
        free_time_hrs:  offer.free_time_hrs   ?? undefined,
        equipment_type: offer.equipment_type  ?? undefined,
        max_weight_lbs: offer.max_weight_lbs  ?? undefined,
        coverage,
        payment_terms:  paymentTerms,
        priority,
        auto_renew:     false,
        valid_from:     validFrom,
        valid_to:       validTo,
        status:         'active',
        notes:          notes || undefined,
      });
    },
    onSuccess: (res) => {
      setSavedContract(res.data.data);
      setStage('done');
      toast.success('Contract created and saved.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Failed to create contract.'),
  });

  const canSaveContract = coverage.trim().length > 0 && paymentTerms && validFrom && validTo;

  // ── Inputs ────────────────────────────────────────────────────────────────

  const inputCls = 'w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20';
  const labelCls = 'block mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]';

  // ── Render ────────────────────────────────────────────────────────────────

  const RATE_LABEL: Record<string, string> = { flat: 'Flat rate', per_mile: 'Per mile', hourly: 'Hourly' };

  const panel = (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-[var(--color-white)] z-50 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)] shrink-0">
          <div>
            <p className="text-base font-bold text-[var(--color-slate)]">Offer from {offer.carrier_name || 'Carrier'}</p>
            <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
              {job?.title || `Job #${offer.freight_job_id}`}
              {job?.route_distance_miles && ` · ${parseFloat(job.route_distance_miles).toFixed(0)} mi`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-text-faint)] hover:bg-[var(--color-cream-dark)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Stage: view ────────────────────────────────────── */}
          {stage === 'view' && (
            <>
              {/* Carrier info */}
              <div className="rounded-xl bg-[var(--color-cream)] px-4 py-3.5 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Carrier</p>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-teal)] text-sm font-bold text-white">
                    {(offer.carrier_name || 'C').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text)]">{offer.carrier_name || '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5 text-xs text-amber-500 font-semibold">
                        <Star size={10} fill="currentColor" /> {(offer.carrier_rating ?? 5).toFixed(1)}
                      </span>
                      {offer.carrier_dot && (
                        <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-semibold">
                          <BadgeCheck size={10} /> DOT Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Job snapshot */}
              {job && (
                <div className="rounded-xl bg-[var(--color-cream)] px-4 py-3.5 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Job</p>
                  <div className="flex items-center gap-4">
                    {job.route_distance_miles && (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
                        <Route size={13} className="text-[var(--color-teal)]" />
                        {parseFloat(job.route_distance_miles).toFixed(0)} mi
                      </span>
                    )}
                    {job.stops_count > 0 && (
                      <span className="flex items-center gap-1.5 text-sm text-[var(--color-text-faint)]">
                        <MapPin size={12} />
                        {job.stops_count} stop{job.stops_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <Link href={to(`/shipper/jobs/${offer.freight_job_id}`)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)] hover:underline mt-0.5">
                    View job <ExternalLink size={10} />
                  </Link>
                </div>
              )}

              {/* Offer rate */}
              <div className="rounded-xl border border-[var(--color-cream-dark)] overflow-hidden">
                <div className="px-4 py-3 bg-[var(--color-cream)] border-b border-[var(--color-cream-dark)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Rate</p>
                </div>
                <div className="px-4">
                  <DetailRow label="Rate type" value={RATE_LABEL[offer.rate_type] ?? offer.rate_type} highlight />
                  {(offer.rate_type === 'per_mile' || offer.rate_type === 'hourly') && offer.rate_value != null && (
                    <DetailRow
                      label={offer.rate_type === 'per_mile' ? 'Per mile' : 'Per hour'}
                      value={fmt(offer.rate_value) + (offer.rate_type === 'per_mile' ? '/mi' : '/hr')}
                    />
                  )}
                  <DetailRow icon={DollarSign} label="Total amount" value={fmt(offer.amount)} highlight />
                </div>
              </div>

              {/* Additional terms */}
              {(offer.fuel_surcharge != null || offer.detention_rate != null ||
                offer.equipment_type  || offer.max_weight_lbs  || offer.payment_terms) && (
                <div className="rounded-xl border border-[var(--color-cream-dark)] overflow-hidden">
                  <div className="px-4 py-3 bg-[var(--color-cream)] border-b border-[var(--color-cream-dark)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Terms</p>
                  </div>
                  <div className="px-4">
                    {offer.fuel_surcharge != null && (
                      <DetailRow icon={Fuel} label="Fuel surcharge" value={fmt(offer.fuel_surcharge)} />
                    )}
                    {offer.detention_rate != null && (
                      <DetailRow icon={Clock} label="Detention rate"
                        value={`${fmt(offer.detention_rate)}/hr · ${offer.free_time_hrs ?? 0}h free`} />
                    )}
                    {offer.equipment_type && (
                      <DetailRow icon={Truck} label="Equipment" value={offer.equipment_type} />
                    )}
                    {offer.max_weight_lbs && (
                      <DetailRow icon={Scale} label="Max weight" value={`${Number(offer.max_weight_lbs).toLocaleString()} lbs`} />
                    )}
                    {offer.payment_terms && (
                      <DetailRow icon={CreditCard} label="Payment terms" value={offer.payment_terms} />
                    )}
                  </div>
                </div>
              )}

              {/* Note */}
              {offer.note && (
                <div className="rounded-xl border border-[var(--color-cream-dark)] px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)] mb-2">
                    <MessageSquare size={11} /> Note from carrier
                  </div>
                  <p className="text-sm text-[var(--color-text)]">{offer.note}</p>
                </div>
              )}
            </>
          )}

          {/* ── Stage: contract form ───────────────────────────── */}
          {stage === 'contract' && (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <p className="text-sm font-semibold text-emerald-800">Offer accepted — carrier assigned.</p>
              </div>

              <div className="rounded-2xl border border-[var(--color-cream-dark)] overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-teal)]">
                    <FileText size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text)]">Create Contract</p>
                    <p className="text-xs text-[var(--color-text-faint)]">
                      Lock in this carrier's terms for future jobs
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-4">

                  {/* Pre-filled read-only summary */}
                  <div className="rounded-xl bg-[var(--color-cream)] px-4 py-3 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">From offer (pre-filled)</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-[var(--color-text-faint)]">Carrier</span>
                      <span className="font-semibold text-[var(--color-text)]">{offer.carrier_name}</span>
                      <span className="text-[var(--color-text-faint)]">Rate type</span>
                      <span className="font-semibold text-[var(--color-text)]">{RATE_LABEL[offer.rate_type]}</span>
                      <span className="text-[var(--color-text-faint)]">Rate</span>
                      <span className="font-semibold text-[var(--color-text)]">
                        {offer.rate_type === 'flat'
                          ? fmt(offer.amount)
                          : `${fmt(offer.rate_value)}/${offer.rate_type === 'per_mile' ? 'mi' : 'hr'}`}
                      </span>
                      {offer.fuel_surcharge != null && <>
                        <span className="text-[var(--color-text-faint)]">Fuel</span>
                        <span className="font-semibold text-[var(--color-text)]">{fmt(offer.fuel_surcharge)}</span>
                      </>}
                      {offer.equipment_type && <>
                        <span className="text-[var(--color-text-faint)]">Equipment</span>
                        <span className="font-semibold text-[var(--color-text)]">{offer.equipment_type}</span>
                      </>}
                    </div>
                  </div>

                  {/* Coverage */}
                  <div>
                    <label className={labelCls}>Coverage area <span className="text-red-500">*</span></label>
                    <input type="text" value={coverage} onChange={e => setCoverage(e.target.value)}
                      placeholder="e.g. Chicago, IL → Detroit, MI or Midwest region"
                      className={inputCls} />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className={labelCls}>Priority</label>
                    <div className="flex gap-2">
                      {['First Call', 'Preferred', 'Standard'].map(p => (
                        <button key={p} type="button" onClick={() => setPriority(p)}
                          className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-colors ${
                            priority === p
                              ? 'border-[var(--color-teal)] bg-[var(--color-teal)] text-white'
                              : 'border-[var(--color-cream-dark)] text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]'
                          }`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment terms */}
                  <div>
                    <label className={labelCls}>Payment terms <span className="text-red-500">*</span></label>
                    <div className="flex gap-2 flex-wrap">
                      {CONTRACT_PAYMENT_TERMS.map(pt => (
                        <button key={pt} type="button" onClick={() => setPaymentTerms(pt)}
                          className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
                            paymentTerms === pt
                              ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)] text-[var(--color-teal)]'
                              : 'border-[var(--color-cream-dark)] text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]'
                          }`}>
                          {pt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Validity dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Valid from <span className="text-red-500">*</span></label>
                      <input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Valid to <span className="text-red-500">*</span></label>
                      <input type="date" value={validTo} onChange={e => setValidTo(e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className={labelCls}>Notes <span className="normal-case font-normal opacity-60">optional</span></label>
                    <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Additional context…"
                      className={`${inputCls} resize-none`} />
                  </div>

                </div>
              </div>
            </>
          )}

          {/* ── Stage: done ────────────────────────────────────── */}
          {stage === 'done' && savedContract && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">Contract created</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {offer.carrier_name} · {savedContract.rate_type} · {savedContract.rate}
                  </p>
                </div>
              </div>
              <Link href={to('/shipper/contracts')} onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-teal)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] transition-colors">
                View in Contracts <ChevronRight size={14} />
              </Link>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-[var(--color-cream-dark)] bg-[var(--color-white)]">

          {stage === 'view' && offer.status === 'pending' && can.do('loads.decide') && (
            <div className="flex gap-3">
              <button onClick={() => declineMutation.mutate()} disabled={declineMutation.isPending}
                className="flex-1 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50">
                {declineMutation.isPending ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Decline'}
              </button>
              <button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-teal)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] shadow-sm transition-colors disabled:opacity-60">
                {acceptMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Accepting…</>
                  : <>Accept &amp; assign <ChevronRight size={14} /></>
                }
              </button>
            </div>
          )}

          {stage === 'view' && offer.status !== 'pending' && (
            <p className="text-center text-sm text-[var(--color-text-faint)]">
              This offer has been <strong>{offer.status}</strong>.
            </p>
          )}

          {stage === 'contract' && (
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 rounded-xl border border-[var(--color-cream-dark)] py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-cream)] transition-colors">
                Skip for now
              </button>
              <button onClick={() => contractMutation.mutate()} disabled={!canSaveContract || contractMutation.isPending}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  canSaveContract && !contractMutation.isPending
                    ? 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)] shadow-sm'
                    : 'bg-[var(--color-cream-dark)] text-[var(--color-text-faint)] cursor-not-allowed'
                }`}>
                {contractMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : <><FileText size={14} /> Save contract</>
                }
              </button>
            </div>
          )}

          {stage === 'done' && (
            <button onClick={onClose}
              className="w-full rounded-xl border border-[var(--color-cream-dark)] py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-cream)] transition-colors">
              Close
            </button>
          )}

        </div>
      </div>
    </>
  );

  return typeof window !== 'undefined' ? createPortal(panel, document.body) : null;
}
