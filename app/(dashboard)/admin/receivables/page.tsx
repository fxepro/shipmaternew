import { Receipt } from 'lucide-react';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminReceivablesPage() {
  return (
    <AdminPlaceholder
      icon={Receipt}
      title="Receivables"
      description="What shippers owe the platform."
      planned={[
        'Shipper payment terms: prepaid card or net 15/30/45',
        'Credit limits and current exposure per shipper',
        'Invoices issued at delivery, with status',
        'AR aging: current, 30, 60, 90+ days',
        'Reminders and holds for late payers',
      ]}
    />
  );
}
