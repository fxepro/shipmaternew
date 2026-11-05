'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Briefcase, ArrowRight, Weight, Clock, Users, Loader2, CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { jobApi, bidApi, shipmentApi } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useCan } from '@/components/layout/PermissionsContext';

const bidSchema = z.object({
  amount:                  z.coerce.number().positive('Enter a valid amount'),
  estimated_pickup_date:   z.string().min(1, 'Required'),
  estimated_delivery_date: z.string().min(1, 'Required'),
  note:                    z.string().optional(),
});
type BidForm = z.infer<typeof bidSchema>;

interface OpenJob {
  id: number; item_description: string; item_category?: string; weight_lbs?: number;
  service_type?: { key: string; name: string; icon: string } | null;
  special_notes?: string; pickup_city: string; pickup_state: string;
  delivery_city: string; delivery_state: string; pickup_date?: string;
  distance_miles?: number; bids_count: number; already_bid: boolean;
  shipper_name?: string; created_at: string; status: string;
}

interface ContractedOffer {
  id: number; item_description: string; weight_lbs?: number;
  pickup_city: string; pickup_state: string; delivery_city: string; delivery_state: string;
  pickup_date?: string; delivery_date?: string; distance_miles?: number;
  agreed_cost?: number; contract_rate?: number; contract_rate_type?: string;
  shipper_name?: string; created_at: string;
}

const inputCls = 'w-full bg-[var(--color-cream)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors';

function BidModal({ job, onClose }: { job: OpenJob; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<BidForm>({ resolver: zodResolver(bidSchema) });

  const mutation = useMutation({
    mutationFn: (data: BidForm) => bidApi.place(job.id, data),
    onSuccess: () => { toast.success('Bid placed!'); onClose(); },
    onError: () => toast.error('Failed to place bid.'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-[var(--color-white)] rounded-2xl shadow-xl">
        <div className="px-6 py-5 border-b border-[var(--color-cream-dark)]">
          <p className="font-medium text-[var(--color-text)]">Place a Bid</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {job.pickup_city}, {job.pickup_state} → {job.delivery_city}, {job.delivery_state}
          </p>
        </div>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)] mb-1.5">Your Price ($)</label>
            <input type="number" step="0.01" className={inputCls} placeholder="850.00" {...register('amount')} />
            {errors.amount && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.amount.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)] mb-1.5">Est. Pickup</label>
              <input type="date" className={inputCls} {...register('estimated_pickup_date')} />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)] mb-1.5">Est. Delivery</label>
              <input type="date" className={inputCls} {...register('estimated_delivery_date')} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)] mb-1.5">Note (optional)</label>
            <textarea rows={2} className={inputCls} placeholder="I have experience with this freight type…" {...register('note')} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-[var(--color-cream-dark)] py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-cream)]">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-teal)] py-2.5 text-sm font-medium text-white hover:bg-[var(--color-teal-light)] disabled:opacity-60">
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {isSubmitting ? 'Placing…' : 'Place Bid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OpenJobCard({ job, onBid }: { job: OpenJob; onBid: () => void }) {
  const can = useCan();
  return (
    <div className="bg-[var(--color-white)] rounded-xl border border-[var(--color-cream-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-[var(--color-text)] line-clamp-2">{job.item_description}</p>
        {job.service_type ? (
          <span className="shrink-0 text-xs font-medium bg-[var(--color-cream)] text-[var(--color-text-faint)] border border-[var(--color-cream-dark)] rounded-full px-2 py-0.5">
            {job.service_type.icon} {job.service_type.name}
          </span>
        ) : job.item_category ? (
          <span className="shrink-0 text-xs font-medium bg-[var(--color-cream)] text-[var(--color-text-faint)] border border-[var(--color-cream-dark)] rounded-full px-2 py-0.5">{job.item_category}</span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
        <span>{job.pickup_city}, {job.pickup_state}</span>
        <ArrowRight size={12} className="text-[var(--color-text-faint)]" />
        <span>{job.delivery_city}, {job.delivery_state}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-faint)]">
        {job.weight_lbs && <span className="flex items-center gap-1"><Weight size={10} />{job.weight_lbs} lbs</span>}
        {job.distance_miles && <span>{job.distance_miles.toFixed(0)} mi</span>}
        {job.pickup_date && <span className="flex items-center gap-1"><Clock size={10} />{formatDate(job.pickup_date)}</span>}
        <span className="flex items-center gap-1"><Users size={10} />{job.bids_count} bid{job.bids_count !== 1 ? 's' : ''}</span>
      </div>

      {job.special_notes && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)] italic line-clamp-2">{job.special_notes}</p>
      )}

      {job.already_bid ? (
        <div className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-cream)] border border-[var(--color-cream-dark)] py-2 text-sm font-medium text-[var(--color-text-muted)]">
          <CheckCircle2 size={14} className="text-[var(--color-sage)]" />
          Bid placed
        </div>
      ) : can.do('loads.bid') && (
        <button
          onClick={onBid}
          className="mt-4 w-full rounded-lg bg-[var(--color-teal)] py-2 text-sm font-medium text-white hover:bg-[var(--color-teal-light)] transition-colors"
        >
          Place Bid
        </button>
      )}
    </div>
  );
}

function ContractedOfferCard({ offer, onAccept, onDecline, isPending }: {
  offer: ContractedOffer;
  onAccept: () => void;
  onDecline: () => void;
  isPending: boolean;
}) {
  const can = useCan();
  const rate = offer.agreed_cost ?? offer.contract_rate;

  return (
    <div className="bg-[var(--color-white)] rounded-xl border border-[var(--color-cream-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-[var(--color-text)] line-clamp-2">{offer.item_description}</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5 flex items-center gap-1">
            <FileText size={10} />
            Contracted · {offer.shipper_name}
          </p>
        </div>
        {rate && (
          <p className="text-lg shrink-0 text-[var(--color-text)]" style={{ fontFamily: 'var(--font-display)' }}>
            {formatCurrency(rate)}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
        <span>{offer.pickup_city}, {offer.pickup_state}</span>
        <ArrowRight size={12} className="text-[var(--color-text-faint)]" />
        <span>{offer.delivery_city}, {offer.delivery_state}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-faint)]">
        {offer.weight_lbs && <span className="flex items-center gap-1"><Weight size={10} />{offer.weight_lbs} lbs</span>}
        {offer.distance_miles && <span>{offer.distance_miles.toFixed(0)} mi</span>}
        {offer.pickup_date && <span className="flex items-center gap-1"><Clock size={10} />{formatDate(offer.pickup_date)}</span>}
      </div>

      {can.do('loads.accept') && <div className="mt-4 flex gap-2">
        <button
          onClick={onDecline}
          disabled={isPending}
          className="flex-1 rounded-lg border border-[var(--color-cream-dark)] py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-cream)] disabled:opacity-60 transition-colors"
        >
          Decline
        </button>
        <button
          onClick={onAccept}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-teal)] py-2 text-sm font-medium text-white hover:bg-[var(--color-teal-light)] disabled:opacity-60 transition-colors"
        >
          {isPending && <Loader2 size={13} className="animate-spin" />}
          Accept
        </button>
      </div>}
    </div>
  );
}

type Tab = 'open' | 'contracted';

export default function CarrierAvailablePage() {
  const [tab, setTab]           = useState<Tab>('open');
  const [myServices, setMyServices] = useState(false);
  const [bidJob, setBidJob]     = useState<OpenJob | null>(null);
  const qc = useQueryClient();

  const { data: openRes, isLoading: openLoading } = useQuery({
    queryKey: ['jobs-open', myServices],
    queryFn: () => jobApi.available('open', myServices),
    enabled: tab === 'open',
  });

  const { data: contractedRes, isLoading: contractedLoading } = useQuery({
    queryKey: ['jobs-contracted'],
    queryFn: () => jobApi.available('contracted'),
    enabled: tab === 'contracted',
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => shipmentApi.acceptOffer(id),
    onSuccess: () => {
      toast.success('Job accepted — it\'s now in My Jobs.');
      qc.invalidateQueries({ queryKey: ['jobs-contracted'] });
      qc.invalidateQueries({ queryKey: ['carrier-my-jobs'] });
    },
    onError: () => toast.error('Failed to accept. Try again.'),
  });

  const declineMutation = useMutation({
    mutationFn: (id: number) => shipmentApi.declineOffer(id),
    onSuccess: () => {
      toast.success('Job declined.');
      qc.invalidateQueries({ queryKey: ['jobs-contracted'] });
    },
    onError: () => toast.error('Failed to decline. Try again.'),
  });

  const openJobs: OpenJob[] = openRes?.data?.data ?? [];
  const contractedOffers: ContractedOffer[] = contractedRes?.data?.data ?? [];

  const tabCls = (t: Tab) =>
    t === tab
      ? 'border-b-2 border-[var(--color-teal)] text-[var(--color-teal)] font-medium'
      : 'border-b-2 border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]';

  return (
    <div className="space-y-6">
      <h1 className="page-title">Available Jobs</h1>

      {/* Tabs + My Services toggle */}
      <div className="flex items-center justify-between border-b border-[var(--color-cream-dark)]">
        <div className="flex gap-6">
          <button className={`pb-3 text-sm transition-colors ${tabCls('open')}`} onClick={() => setTab('open')}>Open Market</button>
          <button className={`pb-3 text-sm transition-colors ${tabCls('contracted')}`} onClick={() => setTab('contracted')}>Contracted Offers</button>
        </div>
        {tab === 'open' && (
          <label className="flex items-center gap-2 pb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={myServices}
              onChange={e => setMyServices(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-teal)]"
            />
            <span className="text-xs font-medium text-[var(--color-text-muted)]">My service types only</span>
          </label>
        )}
      </div>

      {/* Open Market */}
      {tab === 'open' && (
        openLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 rounded-xl bg-[var(--color-cream)] animate-pulse" />)}
          </div>
        ) : openJobs.length === 0 ? (
          <EmptyState icon={Briefcase} title="No open jobs" description="New freight jobs will appear here as shippers post them." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openJobs.map((job) => (
              <OpenJobCard key={job.id} job={job} onBid={() => setBidJob(job)} />
            ))}
          </div>
        )
      )}

      {/* Contracted Offers */}
      {tab === 'contracted' && (
        contractedLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-52 rounded-xl bg-[var(--color-cream)] animate-pulse" />)}
          </div>
        ) : contractedOffers.length === 0 ? (
          <EmptyState icon={FileText} title="No contracted offers" description="Shippers will send you direct job offers based on your active contracts." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contractedOffers.map((offer) => (
              <ContractedOfferCard
                key={offer.id}
                offer={offer}
                onAccept={() => acceptMutation.mutate(offer.id)}
                onDecline={() => declineMutation.mutate(offer.id)}
                isPending={acceptMutation.isPending || declineMutation.isPending}
              />
            ))}
          </div>
        )
      )}

      {bidJob && <BidModal job={bidJob} onClose={() => setBidJob(null)} />}
    </div>
  );
}
