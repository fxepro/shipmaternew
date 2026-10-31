import { redirect } from 'next/navigation';

/** Team now lives under Account → Team */
export default function FactorTeamPage() {
  redirect('/factor/profile?tab=team');
}
