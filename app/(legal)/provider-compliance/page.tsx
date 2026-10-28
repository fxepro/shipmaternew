import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Truck, FileText, ShieldCheck, Activity, AlertTriangle,
  CheckCircle2, XCircle, ArrowRight, RefreshCw,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Service Provider Compliance — Shipmater',
  description: 'Requirements all carriers and service providers must meet to operate on the Shipmater platform.',
};

const REQUIREMENTS_BY_SERVICE = [
  {
    service: 'General Freight / Hotshot / Flatbed',
    icon: Truck,
    required: [
      'Active USDOT Number (FMCSA registered)',
      'Active MC Authority (if interstate)',
      'Commercial Auto Liability — minimum $750,000',
      'Cargo Insurance — minimum $100,000',
      'Valid DOT Medical Examiner Certificate',
    ],
    recommended: ['CDL Class A or B', 'FMCSA Cargo Securement Certification'],
  },
  {
    service: 'Hazardous Materials',
    icon: AlertTriangle,
    required: [
      'Active USDOT Number',
      'Active MC Authority',
      'CDL with HAZMAT Endorsement',
      'DOT Hazardous Materials Certification (49 CFR 172.704)',
      'Commercial Auto Liability — minimum $1,000,000',
      'Valid DOT Medical Examiner Certificate',
      'DOT Drug & Alcohol Testing Program',
    ],
    recommended: ['ELD Compliance', 'OSHA 30-Hour General Industry'],
  },
  {
    service: 'Auto Transport',
    icon: Truck,
    required: [
      'Active USDOT Number',
      'Active MC Authority',
      'Commercial Auto Liability — minimum $750,000',
      'Cargo / On-Hook Insurance — minimum $250,000',
    ],
    recommended: ['CDL Class B', 'FMCSA Cargo Securement Certification'],
  },
  {
    service: 'Flatbed / Heavy Haul / Oversize',
    icon: FileText,
    required: [
      'Active USDOT Number',
      'Active MC Authority',
      'CDL Class A',
      'Commercial Auto Liability — minimum $1,000,000',
      'Cargo Insurance — minimum $100,000',
    ],
    recommended: ['FMCSA Cargo Securement Certification', 'Load Securement Training'],
  },
];

const ONGOING = [
  'Insurance certificates must remain active — expiry is tracked and carriers are suspended 7 days before lapse if not renewed',
  'DOT Medical Examiner Certificates are tracked for expiry',
  'HAZMAT certifications require renewal every 3 years per federal regulation',
  'Carriers falling below a 3.0 rating are placed under review',
  'Background checks and Clearinghouse queries may be re-run annually for hazmat and high-value service types',
];

export default function ProviderCompliancePage() {
  return (
    <div className="bg-[var(--color-cream)]">

      {/* Hero */}
      <div className="bg-[var(--color-slate)] text-white px-6 py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-sage-light)] mb-4">For Carriers & Service Providers</p>
        <h1 className="text-5xl md:text-6xl text-white mb-6" style={{ fontFamily: 'var(--font-display)' }}>
          Service Provider<br />Compliance Requirements
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[var(--color-sage-light)] leading-relaxed">
          Every carrier and service provider on Shipmater must meet minimum standards that protect shippers, receivers, and the integrity of the platform. Requirements vary by service type.
        </p>
      </div>

      {/* Requirements by service type */}
      <div className="mx-auto max-w-6xl px-6 py-20 space-y-6">
        <h2 className="text-2xl font-semibold text-[var(--color-slate)] mb-8" style={{ fontFamily: 'var(--font-display)' }}>
          Requirements by Service Type
        </h2>
        {REQUIREMENTS_BY_SERVICE.map(({ service, icon: Icon, required, recommended }) => (
          <div key={service} className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-teal-pale)]">
                <Icon size={18} className="text-[var(--color-teal)]" />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-slate)]">{service}</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-red-500 mb-3">Required</p>
                <ul className="space-y-2">
                  {required.map(r => (
                    <li key={r} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-red-500" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-teal)] mb-3">Recommended</p>
                <ul className="space-y-2">
                  {recommended.map(r => (
                    <li key={r} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--color-teal)]" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ongoing compliance */}
      <div className="bg-[var(--color-white)] border-t border-b border-[var(--color-cream-dark)] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-6">
            <RefreshCw size={20} className="text-[var(--color-teal)]" />
            <h2 className="text-2xl font-semibold text-[var(--color-slate)]" style={{ fontFamily: 'var(--font-display)' }}>
              Ongoing Compliance
            </h2>
          </div>
          <p className="text-[var(--color-text-muted)] mb-6">Approval to join the platform is not permanent. Carriers must maintain active standing:</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {ONGOING.map(item => (
              <div key={item} className="flex items-start gap-2.5 rounded-xl border border-[var(--color-cream-dark)] p-3.5">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--color-teal)]" />
                <p className="text-sm text-[var(--color-text-muted)]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Suspension */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <XCircle size={20} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-red-700 mb-2">Grounds for Suspension</p>
              <p className="text-sm text-red-600 leading-relaxed">
                Carriers with lapsed insurance, expired DOT medical certificates, failed background checks, sustained complaint patterns, or FMCSA safety violations are suspended from receiving new jobs. Suspended accounts receive notice and a 14-day resolution window before account termination.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-[var(--color-slate)] text-white px-6 py-16 text-center">
        <h2 className="text-3xl text-white mb-4" style={{ fontFamily: 'var(--font-display)' }}>Ready to join the network?</h2>
        <p className="text-[var(--color-sage-light)] mb-8">Create your carrier account and complete your profile with your certifications and service types.</p>
        <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-8 py-3 text-sm font-semibold text-white hover:bg-[var(--color-teal-light)] transition-colors">
          Apply as a carrier <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
