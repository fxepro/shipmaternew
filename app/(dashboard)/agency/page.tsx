import { redirect } from 'next/navigation';

/** Law enforcement starts on Companies search */
export default function AgencyHome() {
  redirect('/admin/companies');
}
