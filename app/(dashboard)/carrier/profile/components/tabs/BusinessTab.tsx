'use client';

import { BusinessDetailsForm } from '@/components/payouts/PayoutSetup';

/**
 * Business tab: how the carrier's business is set up (individual, LLC, corporation…) and the details
 * Stripe asks for that setup. Sent to Stripe together with Personal and Financial.
 */
export function BusinessTab({ profile }: { profile: { name?: string; street?: string; city?: string; state?: string; zip?: string; phone?: string } }) {
  return (
    <BusinessDetailsForm
      personName={profile.name}
      home={{ street: profile.street ?? '', city: profile.city ?? '', state: profile.state ?? '', zip: profile.zip ?? '', phone: profile.phone ?? '' }}
    />
  );
}
