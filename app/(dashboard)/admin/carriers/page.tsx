import { redirect } from 'next/navigation';

// Carriers and shippers are now one Companies list
export default function AdminCarriersPage() {
  redirect('/admin/companies?type=carrier');
}
