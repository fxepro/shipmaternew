import { redirect } from 'next/navigation';

/** Team is a tab in Company */
export default function CarrierTeamPage() {
  redirect('/carrier/company?tab=team');
}
