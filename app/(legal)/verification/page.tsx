'use client';

import { CheckCircle, AlertCircle, Clock, Shield, Users, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const fade = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

// Sole Proprietor checks
const SOLE_PROPRIETOR_CHECKS = [
  {
    name: 'Personal Identity',
    description: 'Verify who you are',
    items: [
      { requirement: 'Photo ID (Drivers License or Passport)', service: 'Stripe Identity', required: true },
      { requirement: 'Selfie for identity matching', service: 'Stripe Identity', required: true },
      { requirement: 'Full legal name', service: 'Manual entry', required: true },
      { requirement: 'Date of birth', service: 'Manual entry', required: true },
      { requirement: 'Social Security Number (last 4 digits)', service: 'Manual entry', required: true },
    ]
  },
  {
    name: 'Background Check',
    description: 'Ensure safety and trust',
    items: [
      { requirement: 'Criminal background check (national; county in the Complete check)', service: 'Background screening', required: true },
      { requirement: 'Motor Vehicle Record (MVR) - driving history', service: 'Background screening (Complete check)', required: false },
      { requirement: 'OFAC / Sanctions list screening', service: 'Background screening', required: true },
      { requirement: 'Sex offender registry check', service: 'Background screening', required: true },
    ]
  },
  {
    name: 'DOT-Commercial',
    description: 'Operating authority (optional)',
    items: [
      { requirement: 'Commercial Driver License (CDL) number & class', service: 'Manual entry', required: false },
      { requirement: 'CDL expiry date', service: 'Manual entry', required: false },
      { requirement: 'USDOT number (if operating as authority)', service: 'Manual entry', required: false },
      { requirement: 'HazMat endorsement (if applicable)', service: 'Manual entry', required: false },
    ]
  },
  {
    name: 'Medical Certification',
    description: 'Safety compliance',
    items: [
      { requirement: 'DOT Medical Certificate', service: 'Document upload', required: true },
      { requirement: 'Medical certificate expiry date', service: 'Manual entry', required: true },
      { requirement: 'Drug & alcohol testing consent', service: 'Manual acknowledgement', required: true },
    ]
  },
  {
    name: 'Insurance',
    description: 'Financial protection',
    items: [
      { requirement: 'Commercial Auto Insurance certificate', service: 'Document upload', required: true },
      { requirement: 'Minimum coverage: $750,000 (freight) / $1M+ (HazMat)', service: 'Verification', required: true },
      { requirement: 'Cargo insurance (optional but recommended)', service: 'Document upload', required: false },
      { requirement: 'Insurance expiry date tracking', service: 'System monitoring', required: true },
    ]
  },
  {
    name: 'Vehicles',
    description: 'Fleet inventory',
    items: [
      { requirement: 'Vehicle type (box truck, flatbed, etc.)', service: 'Manual entry', required: true },
      { requirement: 'Make, model, year, VIN', service: 'Manual entry', required: true },
      { requirement: 'Gross Vehicle Weight Rating (GVWR)', service: 'Manual entry', required: true },
      { requirement: 'Vehicle registration', service: 'Document upload', required: true },
      { requirement: 'Vehicle photos (front, rear, cargo area)', service: 'Photo upload', required: true },
    ]
  },
];

// Company checks
const COMPANY_CHECKS = [
  {
    name: 'Business Identity',
    description: 'Verify your company',
    items: [
      { requirement: 'Legal business name', service: 'Manual entry', required: true },
      { requirement: 'Business type (LLC, S-Corp, C-Corp, etc.)', service: 'Manual entry', required: true },
      { requirement: 'EIN (Employer Identification Number)', service: 'Manual entry + IRS verification', required: true },
      { requirement: 'Business address (registered & operating)', service: 'Manual entry', required: true },
      { requirement: 'Secretary of State filing / Articles of Incorporation', service: 'Document upload', required: true },
    ]
  },
  {
    name: 'DOT-MC Verification',
    description: 'Operating authority (REQUIRED)',
    items: [
      { requirement: 'USDOT number', service: 'Manual entry', required: true },
      { requirement: 'MC (Motor Carrier) number', service: 'Manual entry', required: true },
      { requirement: 'FMCSA operating status check', service: 'FMCSA SAFER API', required: true },
      { requirement: 'Safety rating (Satisfactory/Conditional/Unsatisfactory)', service: 'FMCSA API', required: true },
      { requirement: 'Cargo authority verification', service: 'FMCSA API', required: true },
      { requirement: 'SMS Safety Score review', service: 'FMCSA API', required: true },
    ]
  },
  {
    name: 'Key Personnel',
    description: 'Owner & authorized signers',
    items: [
      { requirement: 'Owner legal name & DOB', service: 'Manual entry', required: true },
      { requirement: 'Owner photo ID', service: 'Document upload', required: true },
      { requirement: 'Owner background check', service: 'Background screening', required: true },
      { requirement: 'Owner SSN (for Stripe payouts)', service: 'Secure collection', required: true },
    ]
  },
  {
    name: 'Company Insurance',
    description: 'Fleet protection',
    items: [
      { requirement: 'Primary liability insurance certificate', service: 'Document upload', required: true },
      { requirement: 'Minimum coverage: $750k (freight) / $1M+ (HazMat)', service: 'Verification', required: true },
      { requirement: 'Cargo insurance certificate', service: 'Document upload', required: true },
      { requirement: 'General liability (recommended)', service: 'Document upload', required: false },
      { requirement: 'Workers compensation (if you have W-2 employees)', service: 'Document upload', required: true },
      { requirement: 'Insurance expiry date tracking & alerts', service: 'System monitoring', required: true },
    ]
  },
  {
    name: 'Drivers',
    description: 'Your roster',
    items: [
      { requirement: 'CDL number, class, expiry for each driver', service: 'Manual entry', required: true },
      { requirement: 'Background check for each driver', service: 'Background screening', required: true },
      { requirement: 'DOT medical certificate for each driver', service: 'Document upload', required: true },
      { requirement: 'Driver assignment to vehicles', service: 'Manual assignment', required: true },
    ]
  },
  {
    name: 'Fleet Vehicles',
    description: 'Truck & trailer inventory',
    items: [
      { requirement: 'Vehicle type, VIN, license plate', service: 'Manual entry', required: true },
      { requirement: 'Vehicle registration & expiry', service: 'Document upload', required: true },
      { requirement: 'GVWR and cargo dimensions', service: 'Manual entry', required: true },
      { requirement: 'DOT inspection records', service: 'Document upload', required: true },
      { requirement: 'Vehicle assignment to drivers', service: 'Manual assignment', required: true },
    ]
  },
];

function CheckItem({ item }: { item: any }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="shrink-0 pt-0.5">
        {item.required ? (
          <CheckCircle size={16} className="text-[var(--color-success)]" />
        ) : (
          <Clock size={16} className="text-[var(--color-warning)]" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm text-[var(--color-text)]">{item.requirement}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">via {item.service}</p>
      </div>
      {item.required && (
        <span className="text-xs font-medium px-2 py-1 bg-[var(--color-success)] bg-opacity-10 text-[var(--color-success)] rounded">
          Required
        </span>
      )}
      {!item.required && (
        <span className="text-xs font-medium px-2 py-1 bg-[var(--color-warning)] bg-opacity-10 text-[var(--color-warning)] rounded">
          Optional
        </span>
      )}
    </div>
  );
}

function CheckSection({ section, index }: { section: any; index: number }) {
  const Icon = index === 0 ? Shield : index === 1 ? AlertCircle : Truck;

  return (
    <motion.div
      variants={fade}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="bg-[var(--color-white)] rounded-xl border border-[var(--color-cream-dark)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-[var(--color-teal-pale)] flex items-center justify-center shrink-0">
          <Icon size={20} className="text-[var(--color-teal)]" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--color-text)]">{section.name}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{section.description}</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-[var(--color-cream-dark)] pt-4">
        {section.items.map((item: any, i: number) => (
          <CheckItem key={i} item={item} />
        ))}
      </div>
    </motion.div>
  );
}

export default function VerificationPage() {
  return (
    <div className="space-y-0">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <motion.div
          variants={fade}
          initial="hidden"
          animate="show"
          transition={{ duration: 0.5 }}
        >
          <h1
            className="mx-auto max-w-3xl text-5xl md:text-6xl leading-tight text-[var(--color-slate)] mb-6"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Trust & Safety
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--color-text-muted)]">
            We verify every carrier to keep shippers safe and set carriers up for success. Here's exactly what we check.
          </p>
        </motion.div>
      </section>

      {/* Tabs for Carrier Type */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="flex gap-4 mb-10 justify-center flex-wrap">
          <motion.div
            variants={fade}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="rounded-2xl border border-[var(--color-cream-dark)] p-8 flex flex-col flex-1 min-w-[280px] max-w-xs bg-[var(--color-teal-pale)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Truck size={20} className="text-[var(--color-teal)]" />
              <p className="text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-teal)]">Owner-Operator</p>
            </div>
            <h3 className="text-2xl font-bold text-[var(--color-slate)] mb-2">Sole Proprietor</h3>
            <p className="text-sm text-[var(--color-text-muted)] flex-1">Individual with your own truck or fleet</p>
            <p className="text-xs text-[var(--color-text-faint)] mt-4">
              {SOLE_PROPRIETOR_CHECKS.reduce((sum, s) => sum + s.items.length, 0)} verification checks
            </p>
          </motion.div>

          <motion.div
            variants={fade}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-[var(--color-cream-dark)] p-8 flex flex-col flex-1 min-w-[280px] max-w-xs bg-[var(--color-white)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Users size={20} className="text-[var(--color-slate)]" />
              <p className="text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Company</p>
            </div>
            <h3 className="text-2xl font-bold text-[var(--color-slate)] mb-2">Freight Company</h3>
            <p className="text-sm text-[var(--color-text-muted)] flex-1">Fleet with employees or contractors</p>
            <p className="text-xs text-[var(--color-text-faint)] mt-4">
              {COMPANY_CHECKS.reduce((sum, s) => sum + s.items.length, 0)} verification checks
            </p>
          </motion.div>
        </div>

        {/* Sole Proprietor Section */}
        <motion.div
          variants={fade}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mb-20"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[var(--color-slate)] mb-2">Sole Proprietor Verification</h2>
            <p className="text-[var(--color-text-muted)]">
              Individual owners and operators go through identity, background, medical, and insurance verification.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {SOLE_PROPRIETOR_CHECKS.map((section, i) => (
              <CheckSection key={section.name} section={section} index={i} />
            ))}
          </div>
        </motion.div>

        {/* Company Section */}
        <motion.div
          variants={fade}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[var(--color-slate)] mb-2">Freight Company Verification</h2>
            <p className="text-[var(--color-text-muted)]">
              Companies require DOT-MC verification, EIN validation, key personnel checks, and driver roster verification.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {COMPANY_CHECKS.map((section, i) => (
              <CheckSection key={section.name} section={section} index={i} />
            ))}
          </div>
        </motion.div>
      </section>

      {/* Timeline & Status */}
      <section className="bg-[var(--color-white)] border-t border-[var(--color-cream-dark)] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            variants={fade}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl font-bold text-[var(--color-slate)] mb-2">Verification Timeline</h2>
            <p className="text-[var(--color-text-muted)]">From signup to verified carrier</p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-4">
            {[
              { step: '1', label: 'Submit Profile', desc: 'Complete your information' },
              { step: '2', label: 'Automated Checks', desc: 'Background & identity verify' },
              { step: '3', label: 'Admin Review', desc: 'Team reviews your docs' },
              { step: '4', label: 'Verified!', desc: 'Start bidding on jobs' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                variants={fade}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-[var(--color-cream)] rounded-lg p-6 text-center"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--color-teal)] text-white flex items-center justify-center font-bold mx-auto mb-3">
                  {item.step}
                </div>
                <h4 className="font-semibold text-[var(--color-text)] mb-1">{item.label}</h4>
                <p className="text-xs text-[var(--color-text-muted)]">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Status Legend */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          variants={fade}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl font-bold text-[var(--color-slate)] mb-2">Verification Status</h2>
          <p className="text-[var(--color-text-muted)]">What each status means</p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              status: 'Incomplete',
              color: 'bg-red-100 text-red-700',
              desc: 'You haven\'t completed all required fields yet. Keep filling out your profile.',
            },
            {
              status: 'Submitted',
              color: 'bg-yellow-100 text-yellow-700',
              desc: 'Your profile is complete and waiting for review. Our team will check your docs.',
            },
            {
              status: 'In Review',
              color: 'bg-blue-100 text-blue-700',
              desc: 'Background checks are running and documents are being verified.',
            },
            {
              status: 'Verified',
              color: 'bg-green-100 text-green-700',
              desc: 'You\'re approved! Start bidding on jobs immediately.',
            },
            {
              status: 'Conditionally Verified',
              color: 'bg-green-100 text-green-700',
              desc: 'Verified with a minor issue (e.g., insurance expiring soon). Still can work.',
            },
            {
              status: 'Suspended',
              color: 'bg-red-100 text-red-700',
              desc: 'We found an issue (failed background check, expired license, etc.). Contact support.',
            },
          ].map((item, i) => (
            <motion.div
              key={item.status}
              variants={fade}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg p-6"
            >
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-3 ${item.color}`}>
                {item.status}
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <motion.div variants={fade} initial="hidden" whileInView="show" viewport={{ once: true }}>
          <h2 className="text-4xl font-bold text-[var(--color-slate)] mb-4">Ready to get verified?</h2>
          <p className="text-[var(--color-text-muted)] mb-8">Join verified carriers on Shipmater and start earning.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-teal)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-teal-light)] transition-colors"
            >
              Sign Up as Carrier
            </a>
            <a
              href="/features"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-cream-dark)] px-6 py-3 text-sm font-medium text-[var(--color-text-muted)] hover:border-[var(--color-teal)] transition-colors"
            >
              Learn More
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
