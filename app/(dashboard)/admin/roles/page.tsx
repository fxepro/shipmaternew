import { UserCog } from 'lucide-react';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminAdminsRolesPage() {
  return (
    <AdminPlaceholder
      icon={UserCog}
      title="Admins & Roles"
      description="Who can do what in the admin console."
      planned={[
        'Admin users and their roles',
        'Permissions such as approve carriers, move money, edit settings',
        'Audit log of admin actions, including surrogate views',
      ]}
    />
  );
}
