'use client';

import Link from 'next/link';
import { T } from '@/lib/type-scale';

import {
  ShieldCheck, BadgeCheck, ScanFace, FileSearch,
  ClipboardCheck, Activity, Globe2, ArrowRight,
  CheckCircle2, Lock, AlertTriangle, Star,
} from 'lucide-react';

// ── Design tokens (shared with /platform page) ────────────────────────────────
const B = {
  teal:     '#90E0EF',
  tealMid:  '#48CAE4',
  tealDark: '#0096C7',
  tealDeep: '#0077B6',
  tealNavy: '#023E8A',
  darkSec:  '#0A2E40',
  darkCard: '#0A1520',
  gray70:   '#525252',
  gray20:   '#E0E0E0',
  gray10:   '#F4F4F4',
  white:    '#FFFFFF',
  green:    '#1B9C6B',
};
const BODY = 'var(--font-body)';
const DISPLAY = 'var(--font-display)';

// ── Verification steps ────────────────────────────────────────────────────────

const STEPS = [
  {
    icon:  ScanFace,
    step:  '01',
    title: 'Government ID + Selfie Match',
    badge: 'Powered by Stripe Identity',
    badgeColor: '#6772e5',
    desc:  'Every carrier submits a government-issued ID — driver\'s license or passport — and captures a live selfie. Stripe\'s AI cross-matches the selfie against the document photo and performs a liveness check to prevent spoofing.',
    bullets: [
      '100+ countries, 10,000+ document types supported',
      'Liveness detection — photos and deepfakes rejected',
      'Selfie matched against ID in real time',
      'DOB extracted and age-verified from the document itself',
    ],
    link:     'https://stripe.com/identity',
    linkText: 'Stripe Identity',
    color: B.tealDeep,
  },
  {
    icon:  Activity,
    step:  '02',
    title: 'FMCSA DOT & MC# Live Lookup',
    badge: 'Federal Motor Carrier Safety Administration',
    badgeColor: '#1B5E20',
    desc:  'We perform a live lookup against the FMCSA carrier registry to verify DOT and MC numbers are active, in-good-standing, and match the carrier\'s submitted information — not just accepted at face value.',
    bullets: [
      'Real-time FMCSA API lookup, not static database',
      'Confirms operating authority status',
      'Catches revoked or inactive operating authority',
      'Required for interstate freight carriers',
    ],
    link:     'https://safer.fmcsa.dot.gov',
    linkText: 'FMCSA SAFER',
    color: B.green,
  },
  {
    icon:  FileSearch,
    step:  '03',
    title: 'Criminal Background Check',
    badge: 'Basic or Complete',
    badgeColor: '#1a56db',
    desc:  'Every carrier owner and every driver is background checked through an accredited screening company. The Basic check screens criminal history, the sex offender registry and global watchlists; the Complete check adds county court records, the driving record and the FMCSA Clearinghouse.',
    bullets: [
      'SSN trace, criminal history, sex offender registry',
      'County courthouse records and driving record (Complete check)',
      'Global watchlist screening',
      'FCRA-compliant — carriers notified and have dispute rights',
    ],
    link:     '/verification',
    linkText: 'Verification requirements',
    color: '#1a56db',
  },
  {
    icon:  ClipboardCheck,
    step:  '04',
    title: 'FMCSA Drug & Alcohol Clearinghouse',
    badge: 'U.S. DOT Mandate',
    badgeColor: '#7e1f05',
    desc:  'A mandatory federal query to the FMCSA Drug and Alcohol Clearinghouse confirms the carrier has no unresolved drug or alcohol violations — required by law for CDL holders operating commercial vehicles.',
    bullets: [
      'Federal mandate for CDL holders (49 CFR Part 382)',
      'Queries the FMCSA central repository directly',
      'Catches violations from previous employers',
      'Renewed annually per DOT requirement',
    ],
    link:     'https://clearinghouse.fmcsa.dot.gov',
    linkText: 'FMCSA Clearinghouse',
    color: '#7e1f05',
  },
  {
    icon:  BadgeCheck,
    step:  '05',
    title: 'Human Review & Final Approval',
    badge: 'Shipmater Trust Team',
    badgeColor: B.tealNavy,
    desc:  'Every carrier goes through a final human review before being approved. Our trust team examines the full verification record — identity, background, DOT status, clearinghouse, and insurance — and approves only carriers who meet our standards.',
    bullets: [
      'No carrier can work without explicit human approval',
      'Approval blocked until identity verification is confirmed',
      'Ongoing monitoring — re-review triggered by any new violation',
      'Insurance validity checked at onboarding and renewal',
    ],
    color: B.tealNavy,
  },
];

// ── Stat blocks ───────────────────────────────────────────────────────────────

const STATS = [
  { value: '100+',   label: 'Countries covered by Stripe Identity' },
  { value: '5-layer',label: 'Verification stack per carrier' },
  { value: '0',      label: 'Approved without identity verification' },
  { value: 'FCRA',   label: 'Compliant background screening' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function CarrierTrustPage() {
  return (
    <div style={{ fontFamily: BODY, background: B.white, color: B.darkCard }}>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, ${B.tealNavy} 0%, ${B.darkSec} 100%)`, padding: 'clamp(64px, 8vw, 112px) 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(144,224,239,0.12)', border: '1px solid rgba(144,224,239,0.3)', borderRadius: 99, padding: '6px 16px', marginBottom: 24 }}>
            <ShieldCheck size={14} color={B.teal} />
            <span style={{ fontSize: 12, fontWeight: 600, color: B.teal, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Carrier Trust & Safety
            </span>
          </div>
          <h1 style={{ fontSize: T.hero, fontWeight: 700, color: B.white, lineHeight: 1.15, margin: '0 0 20px' }}>
            Every carrier, verified.<br />
            <span style={{ color: B.tealMid }}>Five layers deep.</span>
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, maxWidth: 600, margin: '0 auto 36px' }}>
            Shipmater runs the most thorough carrier verification stack in freight brokerage — government ID, live selfie match, FMCSA lookup, criminal background, and drug clearinghouse — before any carrier moves a single load.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/register"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: B.tealMid, color: B.tealNavy, fontWeight: 700, fontSize: 15, padding: '12px 28px', borderRadius: 10, textDecoration: 'none' }}
            >
              Ship with confidence <ArrowRight size={16} />
            </Link>
            <Link
              href="/register?role=carrier"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: B.white, fontWeight: 600, fontSize: 15, padding: '12px 28px', borderRadius: 10, border: `1px solid rgba(255,255,255,0.25)`, textDecoration: 'none' }}
            >
              Become a carrier
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────────────────────────── */}
      <section style={{ background: B.tealNavy, borderBottom: `1px solid rgba(144,224,239,0.15)` }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24 }}>
          {STATS.map(s => (
            <div key={s.value} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, color: B.tealMid, margin: '0 0 4px' }}>{s.value}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Intro ─────────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(48px, 6vw, 80px) 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: T.h2, fontWeight: 700, color: B.darkCard, margin: '0 0 16px' }}>
          The problem with "self-reported" freight
        </h2>
        <p style={{ fontSize: T.body, color: B.gray70, lineHeight: 1.75 }}>
          Most load boards accept carrier information at face value. An MC number typed into a form field
          is not a verification. Shipmater connects directly to FMCSA, Stripe, and an accredited background screening company — every
          check is live, authoritative, and cannot be falsified by the carrier.
        </p>
      </section>

      {/* ── Verification steps ────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px clamp(64px, 8vw, 96px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.step}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: 28,
                  background: B.gray10,
                  borderRadius: 16,
                  padding: 'clamp(20px, 3vw, 36px)',
                  border: `1px solid ${B.gray20}`,
                }}
              >
                {/* Icon + step number */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: step.color + '18', border: `1.5px solid ${step.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} color={step.color} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: step.color, letterSpacing: '0.12em' }}>{step.step}</span>
                </div>

                {/* Content */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <h3 style={{ fontSize: T.h3, fontWeight: 700, color: B.darkCard, margin: 0 }}>{step.title}</h3>
                    {step.badge && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: step.badgeColor, background: step.badgeColor + '15', border: `1px solid ${step.badgeColor}30`, borderRadius: 99, padding: '2px 10px', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        {step.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 15, color: B.gray70, lineHeight: 1.7, margin: '0 0 16px' }}>{step.desc}</p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px 16px' }}>
                    {step.bullets.map(b => (
                      <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <CheckCircle2 size={13} color={step.color} style={{ marginTop: 3, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: B.gray70, lineHeight: 1.5 }}>{b}</span>
                      </div>
                    ))}
                  </div>

                  {step.link && (
                    <a href={step.link} target="_blank" rel="noopener noreferrer"
                       style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 12, fontWeight: 600, color: step.color, textDecoration: 'none' }}>
                      Learn more about {step.linkText} <ArrowRight size={11} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── For shippers ──────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, ${B.tealNavy} 0%, ${B.darkSec} 100%)`, padding: 'clamp(48px, 6vw, 80px) 24px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: T.h2, fontWeight: 700, color: B.white, margin: '0 0 16px' }}>
              What this means for shippers
            </h2>
            <p style={{ fontSize: T.body, color: 'rgba(255,255,255,0.72)', lineHeight: 1.75, margin: '0 0 28px' }}>
              Every carrier on Shipmater has been personally verified through five independent layers. You're not relying on a self-reported MC number — you're relying on FMCSA, Stripe, a background screening company, and a human approval.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Cargo insurance verified at onboarding',
                'Criminal background clear before first load',
                'Operating authority confirmed active in FMCSA',
                'No unresolved drug/alcohol violations (DOT mandate)',
                'Identity confirmed against government-issued ID',
              ].map(item => (
                <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Lock size={14} color={B.tealMid} style={{ marginTop: 3, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(144,224,239,0.07)', border: '1px solid rgba(144,224,239,0.2)', borderRadius: 16, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Star size={18} color={B.tealMid} />
              <span style={{ fontSize: 14, fontWeight: 700, color: B.white }}>Platform Standard</span>
            </div>
            {[
              { label: 'Identity (Stripe)', status: 'Required', ok: true },
              { label: 'Age Verification (18+)', status: 'Required', ok: true },
              { label: 'FMCSA DOT/MC', status: 'Required', ok: true },
              { label: 'Background Check (owner and every driver)', status: 'Required', ok: true },
              { label: 'Drug & Alcohol Clearinghouse', status: 'Required', ok: true },
              { label: 'Human Approval', status: 'Required', ok: true },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(144,224,239,0.1)' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{row.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 99, padding: '2px 8px' }}>
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For carriers ──────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(48px, 6vw, 80px) 24px', textAlign: 'center' }}>
        <AlertTriangle size={28} color={B.tealDark} style={{ marginBottom: 12 }} />
        <h2 style={{ fontSize: T.h2, fontWeight: 700, color: B.darkCard, margin: '0 0 16px' }}>
          Verified carriers earn more
        </h2>
        <p style={{ fontSize: T.body, color: B.gray70, lineHeight: 1.75, margin: '0 0 32px' }}>
          Shippers on Shipmater can see your verification badges. Carriers with full verification — identity, DOT, background, clearinghouse — get priority placement on loads and are more likely to be selected from the same-rate pool.
        </p>
        <Link
          href="/register?role=carrier"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: B.tealDeep, color: B.white, fontWeight: 700, fontSize: 15, padding: '13px 30px', borderRadius: 10, textDecoration: 'none' }}
        >
          Start carrier onboarding <ArrowRight size={16} />
        </Link>
      </section>

      {/* ── Footer note ───────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '24px', borderTop: `1px solid ${B.gray20}`, fontSize: 12, color: B.gray70 }}>
        Stripe Identity verification powered by{' '}
        <a href="https://stripe.com/identity" target="_blank" rel="noopener noreferrer" style={{ color: B.tealDark }}>stripe.com/identity</a>.
        Background checks by an accredited, FCRA-compliant screening company.
        All carrier verification is conducted in accordance with applicable federal and state law.
      </div>
    </div>
  );
}
