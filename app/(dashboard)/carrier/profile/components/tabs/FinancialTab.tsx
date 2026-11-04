'use client';

import { BankAccountForm, PayoutStatus } from '@/components/payouts/PayoutSetup';

/**
 * Financial tab: the bank account payouts go to, and payout setup at the bottom.
 * Payout setup sends this tab, Personal and Business to Stripe in one go (components/payouts/PayoutSetup).
 * The onboarding fee lives at the end of the Background tab, since it pays for the background check.
 */
export function FinancialTab({ onGoTo }: { onGoTo: (tab: string) => void }) {
  return (
    <div className="space-y-8">
      <BankAccountForm />

      <p className="border-t border-[var(--color-cream-dark)] pt-6 text-xs text-[var(--color-text-faint)]">
        Shipmater&apos;s fee is taken from each payment before it reaches you. If you earn over $600 in a year, you&apos;ll get a 1099 for your taxes, based on the details you give Stripe.
      </p>

      <div className="border-t border-[var(--color-cream-dark)] pt-6">
        <PayoutStatus
          tabs={{ person: { id: 'personal', label: 'Personal' }, business: { id: 'business', label: 'Business' }, bank: { id: 'financial', label: 'Financial' } }}
          onGoTo={onGoTo}
        />
      </div>
    </div>
  );
}
