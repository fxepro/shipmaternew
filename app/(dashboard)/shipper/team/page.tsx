import { redirect } from 'next/navigation';

/** Team is a tab in Company */
export default function ShipperTeamPage() {
  redirect('/shipper/company?tab=team');
}
