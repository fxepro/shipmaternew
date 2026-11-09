import { redirect } from 'next/navigation';

/** Team is a tab in Company */
export default function ReceiverTeamPage() {
  redirect('/receiver/company?tab=team');
}
