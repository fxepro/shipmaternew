'use client';

import { TeamManager } from '@/components/team/TeamManager';

export default function CarrierTeamPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Team</h1>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">Drivers, dispatchers and office staff at your company.</p>
      </div>
      <TeamManager type="carrier" />
    </div>
  );
}
