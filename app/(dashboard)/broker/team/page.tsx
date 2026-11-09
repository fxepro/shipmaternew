import { redirect } from 'next/navigation';

/** Team is a tab in Company */
export default function BrokerTeamPage() {
  redirect('/broker/company?tab=team');
}
