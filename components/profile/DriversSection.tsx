'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { DataCard, Pill, expiryPill } from './DataCard';
import { useCatalog, nameOf } from '@/components/entities/catalog';

interface Member {
  user_id: number; name: string; email: string; role: string; status: string; is_owner: boolean;
  person_status: string; drives: boolean; endorsements: string[]; medical_expires: string | null;
  cdl: { class: string | null; state: string | null; expires: string | null; verified: boolean } | null;
}

const STATUS_TONE: Record<string, 'good' | 'warn' | 'bad' | 'neutral'> = { approved: 'good', pending_review: 'warn', rejected: 'bad', suspended: 'bad' };

/**
 * People who drive for the carrier: members with the driver role, and anyone (the owner-operator included)
 * with a CDL on file. Drivers are added by inviting them on the Team page with the Driver role; each driver
 * then enters their own CDL and checks on their Verification page. The owner adds theirs under Me, Driving credentials.
 */
export function DriversSection({ isOwnerOperator, onGoToDriving }: { isOwnerOperator: boolean; onGoToDriving: () => void }) {
  const catalog = useCatalog();
  const { data = [], isLoading } = useQuery({
    queryKey: ['org-members'],
    queryFn: () => api.get('/api/v1/org/members').then((r) => (r.data?.data ?? []) as Member[]),
  });
  const drivers = data.filter((m) => m.drives && m.status === 'active');
  const owner = data.find((m) => m.is_owner);
  const ownerMissing = isOwnerOperator && owner && !owner.drives;

  return (
    <div className="space-y-3">
      {ownerMissing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-800">
          You run this company as an owner-operator. Add your CDL under{' '}
          <button onClick={onGoToDriving} className="font-semibold underline">Me, Driving credentials</button> and you&apos;ll show here as its driver.
        </div>
      )}
      {!isLoading && drivers.length === 0 && !ownerMissing && (
        <p className="text-sm italic text-[var(--color-text-faint)]">No drivers yet.</p>
      )}
      {drivers.map((m) => (
        <DataCard key={m.user_id} title={m.name} subtitle={m.is_owner ? 'Owner · drives for the company' : 'Driver'}
          action={m.person_status !== 'not_required' ? <Pill tone={STATUS_TONE[m.person_status] ?? 'neutral'}>{m.person_status.replace(/_/g, ' ')}</Pill> : undefined}
          rows={[
            ['Email', m.email],
            ['CDL', m.cdl ? `Class ${m.cdl.class ?? '?'}${m.cdl.state ? ` · ${m.cdl.state}` : ''}${m.cdl.verified ? ' · verified' : ''}` : 'Not entered'],
            ['CDL expires', expiryPill(m.cdl?.expires)],
            ['Endorsements', m.endorsements.map((k) => nameOf(catalog.endorsements, k)).join(', ') || null],
            ['Medical card expires', expiryPill(m.medical_expires)],
          ]} />
      ))}
      <Link href="/carrier/company?tab=team" className="inline-flex items-center gap-1.5 text-base font-medium text-[var(--color-teal)] hover:underline">
        <UserPlus size={14} /> Invite a driver (Team page, role Driver)
      </Link>
    </div>
  );
}
