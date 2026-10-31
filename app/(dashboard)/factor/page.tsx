'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FileSignature, Truck, Package } from 'lucide-react';
import { orgApi, factoringApi } from '@/lib/api';
import { getUser } from '@/lib/auth';

interface Company { name: string; phone: string | null; email: string | null; tax_id: string | null; street: string | null }

/** What a factoring company does on Shipmater (docs/noa-factoring.md) */
const STEPS = [
  { key: 'carriers', icon: Truck,         title: 'Carriers',         text: 'Carriers with an active NOA with you.',                                          tab: 'noas'  },
  { key: 'noas',     icon: FileSignature, title: 'NOAs to confirm',  text: 'Confirm each NOA a carrier files with you. Nothing is redirected until you do.', tab: 'noas'  },
  { key: 'loads',    icon: Package,       title: 'Loads to accept',  text: 'Accept or decline each load a carrier wants to factor with you.',              tab: 'loads' },
] as const;

export default function FactorDashboard() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: getUser });
  const { data: company } = useQuery({ queryKey: ['org'], queryFn: () => orgApi.get().then((r) => r.data.data as Company) });
  const { data: noas }  = useQuery({ queryKey: ['factoring-noas'],  queryFn: () => factoringApi.noas().then((r) => r.data.data as { status: string; carrier: { id: number } }[]) });
  const { data: loads } = useQuery({ queryKey: ['factoring-loads'], queryFn: () => factoringApi.loads().then((r) => r.data.data as { status: string }[]) });
  const counts = {
    carriers: new Set((noas ?? []).filter((n) => n.status === 'active').map((n) => n.carrier.id)).size,
    noas:     (noas ?? []).filter((n) => n.status === 'pending_factor').length,
    loads:    (loads ?? []).filter((l) => l.status === 'requested').length,
  };
  const profileDone = !!(company?.tax_id && company?.phone && company?.email && company?.street);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{company?.name ?? 'Dashboard'}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. This is your factoring company&apos;s home on Shipmater.</p>
      </div>

      {company && !profileDone && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-teal)] bg-[var(--color-teal-pale)] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">Finish your company details</p>
            <p className="text-sm text-[var(--color-text-muted)]">Carriers and shippers see your EIN, phone, email and address on NOAs.</p>
          </div>
          <Link href="/factor/profile?tab=company" className="btn btn-navy flex items-center gap-1.5">Company details <ArrowRight size={14} /></Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STEPS.map(({ key, icon: Icon, title, text }) => (
          <Link key={key} href="/factor/factoring" className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-5 transition-colors hover:border-[var(--color-teal)]">
            <div className="flex items-center justify-between">
              <Icon size={18} className="text-[var(--color-teal)]" />
              <span className="text-2xl font-semibold text-[var(--color-text)]">{counts[key]}</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
