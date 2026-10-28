import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck, Lock, Eye, FileCheck, AlertTriangle,
  Server, RefreshCw, ArrowRight, CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Platform Compliance — Shipmater',
  description: 'How Shipmater protects data, ensures carrier integrity, and meets regulatory requirements.',
};

const PILLARS = [
  {
    icon: Lock,
    color: 'bg-teal-50 text-[var(--color-teal)]',
    title: 'Data Encryption',
    items: [
      'All data encrypted at rest (AES-256) and in transit (TLS 1.3)',
      'Sanctum-issued Bearer tokens for API authentication',
      'Passwords hashed using bcrypt with a minimum cost factor of 12',
      'No plain-text credentials stored anywhere in the system',
    ],
  },
  {
    icon: ShieldCheck,
    color: 'bg-emerald-50 text-emerald-600',
    title: 'Carrier Screening',
    items: [
      'DOT number and MC authority verified against FMCSA records',
      'Certificate of insurance required and expiry-tracked',
      'Background check status tracked per driver',
      'Service type–specific certification requirements enforced',
    ],
  },
  {
    icon: FileCheck,
    color: 'bg-blue-50 text-blue-600',
    title: 'Regulatory Compliance',
    items: [
      'FMCSA cargo securement rules applied to all freight jobs',
      'DOT drug and alcohol testing compliance tracked per carrier',
      'Hazmat shipments require HAZMAT-endorsed carriers only',
    ],
  },
  {
    icon: Eye,
    color: 'bg-purple-50 text-purple-600',
    title: 'Data Privacy',
    items: [
      'CCPA and GDPR-aligned data handling practices',
      'Users can request data export or deletion at any time',
      'Third-party data sharing limited to payment processing and verification',
      'Audit logs retained for all shipment and financial actions',
    ],
  },
  {
    icon: Server,
    color: 'bg-amber-50 text-amber-600',
    title: 'Infrastructure Security',
    items: [
      'Hosted on Railway with isolated container environments',
      'Automated daily database backups with point-in-time recovery',
      'Health monitoring and automatic restart on service failure',
      'Production credentials managed via environment variables — never in code',
    ],
  },
  {
    icon: AlertTriangle,
    color: 'bg-red-50 text-red-600',
    title: 'Incident Response',
    items: [
      'Breach notification within 72 hours per GDPR Article 33',
      'Dedicated incident response process with documented runbooks',
      'Automated anomaly detection on authentication and payment flows',
      'Dispute resolution team available for shipment conflicts',
    ],
  },
];

const CERTIFICATIONS = [
  { label: 'SOC 2 Type II', status: 'In Progress', color: 'bg-amber-50 text-amber-700' },
  { label: 'PCI DSS (via Stripe)', status: 'Active', color: 'bg-emerald-50 text-emerald-700' },
  { label: 'GDPR', status: 'Active', color: 'bg-emerald-50 text-emerald-700' },
  { label: 'CCPA', status: 'Active', color: 'bg-emerald-50 text-emerald-700' },
  { label: 'FMCSA Compliant', status: 'Active', color: 'bg-emerald-50 text-emerald-700' },
];

export default function PlatformCompliancePage() {
  return (
    <div className="bg-[var(--color-cream)]">

      {/* Hero */}
      <div className="bg-[var(--color-slate)] text-white px-6 py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-sage-light)] mb-4">Trust & Security</p>
        <h1 className="text-5xl md:text-6xl text-white mb-6" style={{ fontFamily: 'var(--font-display)' }}>
          Platform Compliance
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-[var(--color-sage-light)] leading-relaxed">
          Shipmater is built on a compliance-first foundation. Every layer — from carrier verification to payment handling to data storage — is designed to meet regulatory requirements and protect every party on the platform.
        </p>
      </div>

      {/* Certification badges */}
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-wrap justify-center gap-3">
          {CERTIFICATIONS.map(({ label, status, color }) => (
            <div key={label} className="flex items-center gap-2 rounded-full border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-4 py-2 shadow-sm">
              <CheckCircle2 size={14} className={color.includes('emerald') ? 'text-emerald-600' : 'text-amber-600'} />
              <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pillars */}
      <div className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map(({ icon: Icon, color, title, items }) => (
            <div key={title} className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                <Icon size={18} />
              </div>
              <h3 className="mb-3 text-base font-semibold text-[var(--color-slate)]">{title}</h3>
              <ul className="space-y-2">
                {items.map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--color-teal)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Audit + reporting */}
      <div className="bg-[var(--color-white)] border-t border-[var(--color-cream-dark)] px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <RefreshCw size={32} className="mx-auto mb-4 text-[var(--color-teal)]" />
          <h2 className="text-3xl text-[var(--color-slate)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Continuous Compliance
          </h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Compliance is not a one-time audit. Shipmater runs automated certificate expiry tracking, continuous carrier status monitoring, and quarterly internal reviews against FMCSA, HIPAA, and data protection frameworks. Carriers who fall out of compliance are flagged and suspended from receiving jobs until resolved.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-[var(--color-slate)] text-white px-6 py-16 text-center">
        <h2 className="text-3xl text-white mb-4" style={{ fontFamily: 'var(--font-display)' }}>Questions about compliance?</h2>
        <p className="text-[var(--color-sage-light)] mb-8">Our trust and safety team is available to answer specific regulatory or security questions.</p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/provider-compliance" className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-sage-light)]/30 px-6 py-3 text-sm font-semibold text-[var(--color-sage-light)] hover:border-white hover:text-white transition-colors">
            Service provider requirements <ArrowRight size={14} />
          </Link>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-teal-light)] transition-colors">
            Get started <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
