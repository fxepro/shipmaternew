import { redirect } from 'next/navigation';

/** Team is a tab in Agency */
export default function AgencyTeamPage() {
  redirect('/agency/company?tab=team');
}
