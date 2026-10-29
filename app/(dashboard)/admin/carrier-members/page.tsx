import { redirect } from 'next/navigation';

// Replaced by People, which covers everyone at carrier and shipper companies
export default function AdminCarrierMembersPage() {
  redirect('/admin/people?type=carrier');
}
