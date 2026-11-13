'use client';

/** Receiver — Profile: the signed-in person (personal details and their own verification). The company is in Company. */

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Award, Briefcase, ShieldCheck, User } from 'lucide-react';
import { PersonHeader } from '@/components/account/AccountHeader';
import { AccountTabs } from '@/components/account/AccountTabs';
import { PersonalDetails } from '@/components/account/PersonalDetails';
import { CertificationsSection } from '@/components/people/CertificationsSection';
import { ProProfileCard } from '@/components/entities/ProProfileCard';
import { MyVerification } from '@/components/people/MyVerification';

type Tab = 'personal' | 'certifications' | 'verification' | 'pro';
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'personal',     label: 'Personal',     icon: User        },
  { id: 'certifications', label: 'Certifications', icon: Award },
  { id: 'verification', label: 'Verification', icon: ShieldCheck },
  { id: 'pro',          label: 'Professional profile', icon: Briefcase },
];

function Profile() {
  const router = useRouter();
  const requested = useSearchParams().get('tab') as Tab | null;
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : 'personal';
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="page-title">Profile</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">You: your personal details and your own verification</p>
      </div>
      <PersonHeader />
      <AccountTabs tabs={TABS} active={tab} onSelect={(id) => router.replace(`/receiver/profile?tab=${id}`)} />
      {tab === 'personal' && <PersonalDetails />}
      {tab === 'certifications' && <CertificationsSection />}
      {tab === 'verification' && <MyVerification embedded />}
      {tab === 'pro' && <ProProfileCard driving={false} />}
    </div>
  );
}

export default function ReceiverProfilePage() {
  return <Suspense><Profile /></Suspense>;
}
