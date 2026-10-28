import { CreditCard } from 'lucide-react';
import { AdminPlaceholder } from '@/components/admin/AdminPlaceholder';

export default function AdminPaymentsPage() {
  return (
    <AdminPlaceholder
      icon={CreditCard}
      title="Payments"
      description="Turn payment instruments on or off and set platform fees."
      planned={[
        'Provider status (Stripe, Plaid) with test or live mode badge',
        'Instrument switches: card, ACH, carrier payouts, onboarding fee, identity checks, contracted job billing',
        'Platform commission, onboarding fee amount and payout schedule',
        'Quick-pay: on or off, fee percent, partner or self-funded',
        'Readiness checklist and recent payment failures',
      ]}
    />
  );
}
