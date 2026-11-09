import { redirect } from 'next/navigation';

/** Team is a tab in Company */
export default function FactorTeamPage() {
  redirect('/factor/company?tab=team');
}
