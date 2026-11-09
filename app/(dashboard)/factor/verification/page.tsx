import { redirect } from 'next/navigation';

/** Your own verification is the Verification tab in Profile. Query strings (e.g. ?identity=success from Stripe) are kept. */
export default async function FactorVerificationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string' && k !== 'tab') q.set(k, v);
  q.set('tab', 'verification');
  redirect(`/factor/profile?${q.toString()}`);
}
