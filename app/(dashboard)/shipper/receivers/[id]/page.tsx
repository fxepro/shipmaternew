'use client';

import { usePortal } from '@/lib/portal';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { partnerApi } from '@/lib/api';
import { OrgProfile } from '@/components/orgs/OrgProfile';
import { useCan } from '@/components/layout/PermissionsContext';

/** Shipper — one receiver or broker: details, locations, contacts and their load updates */
export default function ShipperReceiverPage() {
  const to = usePortal();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const can = useCan();

  return (
    <div className="space-y-4">
      <Link href={to('/shipper/receivers')} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        <ArrowLeft size={14} /> Receivers
      </Link>
      <OrgProfile
        orgId={Number(id)}
        readOnly={!can.do('locations.manage')}
        headerActions={can.do('locations.manage') && (
          <button className="btn btn-outline btn-sm" onClick={async () => {
            if (!confirm('Remove from your list? It stays in the directory, and loads already using its locations are not changed.')) return;
            await partnerApi.remove(Number(id));
            qc.invalidateQueries({ queryKey: ['partners'] });
            toast.success('Removed from your list.');
            router.push(to('/shipper/receivers'));
          }}>Remove from my list</button>
        )}
      />
    </div>
  );
}
