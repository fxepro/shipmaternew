import { Plug } from 'lucide-react';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminIntegrationsPage() {
  return (
    <AdminPlaceholder
      icon={Plug}
      title="Integrations"
      description="Third-party services the platform depends on."
      planned={[
        'Stripe, Plaid, Checkr, FMCSA, Clearinghouse, Twilio, email, file storage, maps',
        'Configured or missing for each, without showing secret values',
        'Test connection button per provider',
        'Webhook URLs to copy and the last event received',
      ]}
    />
  );
}
