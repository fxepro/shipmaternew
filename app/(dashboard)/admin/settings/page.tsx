import { Settings } from 'lucide-react';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminPlatformSettingsPage() {
  return (
    <AdminPlaceholder
      icon={Settings}
      title="Platform Settings"
      description="Platform-wide rules and reference data."
      planned={[
        'Fees and defaults',
        'Service types and certifications',
        'Legal text and terms versions',
      ]}
    />
  );
}
