'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { adminClaimApi } from '@/lib/api';

const AS: Record<string, string> = { receiver: 'a receiver', shipper: 'a shipper', carrier: 'a carrier', broker: 'a broker', factor: 'a factor' };

export interface PendingClaim {
  id: number;
  as_type: string;
  user: { id: number; name: string; email: string } | null;
  created_at: string;
}

/** One pending claim on a listed company. Approving hands it over (it takes the type they signed up as); rejecting keeps it listed. */
export function ClaimDecision({ claim, orgName, emailIsContact, onDone }: {
  claim: PendingClaim;
  orgName: string;
  emailIsContact?: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');

  const decide = async (action: 'approve' | 'reject') => {
    if (action === 'approve' && !confirm(`Hand ${orgName} over to ${claim.user?.name ?? 'this person'}? After this only their team can change it.`)) return;
    setBusy(action);
    try {
      await adminClaimApi.decide(claim.id, action, note.trim() || undefined);
      toast.success(action === 'approve' ? 'Claim approved.' : 'Claim rejected.');
      onDone();
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Could not save.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-cream-dark)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-[var(--color-text)]">
            {claim.user?.name ?? 'Unknown'} <span className="font-normal text-[var(--color-text-muted)]">· {claim.user?.email}</span>
          </p>
          <p className="text-xs text-[var(--color-text-faint)]">
            Signed up as {AS[claim.as_type] ?? claim.as_type} · {new Date(claim.created_at).toLocaleDateString()}
            {emailIsContact === true && ' · Email matches a listed contact'}
            {emailIsContact === false && ' · Email is not one of the listed contacts'}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => decide('reject')}>
            {busy === 'reject' && <Loader2 size={13} className="animate-spin" />} Reject
          </button>
          <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => decide('approve')}>
            {busy === 'approve' && <Loader2 size={13} className="animate-spin" />} Approve
          </button>
        </div>
      </div>
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Note (optional), e.g. called the store to confirm"
        className="w-full rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-1.5 text-sm focus:border-[var(--color-teal)] focus:outline-none"
      />
    </div>
  );
}
