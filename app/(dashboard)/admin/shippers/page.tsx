import { redirect } from 'next/navigation';

// Carriers and shippers are now one Companies list
export default function AdminShippersPage() {
  redirect('/admin/companies?type=shipper');
}
