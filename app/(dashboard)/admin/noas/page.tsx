import { FileSignature } from 'lucide-react';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminNOAsFactoringPage() {
  return (
    <AdminPlaceholder
      icon={FileSignature}
      title="NOAs / Factoring"
      description="Carriers that have assigned their receivables to a factoring company."
      planned={[
        'Carriers with a Notice of Assignment on file and the factoring company they pay through',
        'NOA document review: approve or reject payee changes',
        'Payouts routed to the approved payee, never the carrier directly once an NOA is active',
        'Release letters when a carrier leaves a factor',
      ]}
    />
  );
}
