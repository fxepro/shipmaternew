'use client';

import { TeamManager } from '@/components/team/TeamManager';

/** Receiver — Team: invite colleagues and set their roles */
export default function ReceiverTeamPage() {
  return (
    <div className="space-y-6">
      <h1 className="page-title">Team</h1>
      <TeamManager type="receiver" />
    </div>
  );
}
