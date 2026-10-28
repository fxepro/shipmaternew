'use client';

import Link from 'next/link';
import {
  ArrowRight, ShieldCheck, ScanFace, FileSearch, BadgeCheck,
  ClipboardCheck, Star, Lock, CheckCircle2,
  Globe2, Activity, Users, X, UserCheck,
} from 'lucide-react';
import { MarketingHub } from '@/components/marketing/MarketingHub';
import { SHIPPER_HUB } from '@/lib/marketing/hub-links';
import { T } from '@/lib/type-scale';


const B = {
  teal:     '#90E0EF',
  tealMid:  '#48CAE4',
  tealDark: '#0096C7',
  tealDeep: '#0077B6',
  tealNavy: '#023E8A',
  tealBg:   '#E0F7FA',
  tealPale: '#CAF0F8',
  darkSec:  '#0A2E40',
  darkCard: '#0A1520',
  gray100:  '#161616',
  gray70:   '#525252',
  gray50:   '#8D8D8D',
  gray20:   '#E0E0E0',
  gray10:   '#F4F4F4',
  white:    '#FFFFFF',
  green:    '#1B9C6B',
};
const BODY = 'var(--font-body)';
const DISPLAY = 'var(--font-display)';

const STATS = [
  { value: '100+',    label: 'Countries — identity verification' },
  { value: '5-layer', label: 'Independent checks per carrier' },
  { value: '0',       label: 'Loads without human approval' },
  { value: 'FCRA',    label: 'Compliant background screening' },
];

const LAYERS = [
  {
    icon: ScanFace,
    step: '01',
    title: 'Government ID + selfie match',
    badge: 'Identity verification',
    desc: 'Every carrier submits a government-issued ID and a live selfie. Document photos are cross-matched with liveness detection — spoofed images and mismatched identities are rejected before onboarding continues.',
    bullets: ['100+ countries and thousands of document types', 'Liveness check blocks photos and deepfakes', 'Date of birth extracted and age-verified from the document'],
    color: B.tealDeep,
  },
  {
    icon: Activity,
    step: '02',
    title: 'Operating authority — live lookup',
    badge: 'Authoritative registry',
    desc: 'USDOT/MC for US carriers, NSC for Canada, Permiso SCT for Mexico — verified against live government registries, not accepted from a typed form field.',
    bullets: ['Real-time authority status — not a static database', 'Revoked or inactive authority blocks approval', 'Credential rules adapt by operating country'],
    color: B.green,
  },
  {
    icon: FileSearch,
    step: '03',
    title: 'Background screening',
    badge: 'Compliance-grade checks',
    desc: 'Criminal history, watchlist, and county-level records screened to the standard expected of commercial freight operators. Carriers are notified and have dispute rights under applicable law.',
    bullets: ['Routed by carrier operating country', 'Sex offender and global watchlist screening', 'Re-screening triggered on policy violations'],
    color: '#1a56db',
  },
  {
    icon: ClipboardCheck,
    step: '04',
    title: 'Drug & alcohol clearinghouse',
    badge: 'US CDL mandate',
    desc: 'For US commercial drivers, a mandatory query to the federal clearinghouse confirms no unresolved drug or alcohol violations — required under 49 CFR Part 382 before operating a CMV.',
    bullets: ['Federal mandate for CDL holders', 'Queries the central repository directly', 'Catches violations reported by prior employers', 'Renewed on the DOT-required schedule'],
    color: '#7e1f05',
  },
  {
    icon: BadgeCheck,
    step: '05',
    title: 'Insurance, credentials & human approval',
    badge: 'Shipmater trust team',
    desc: 'COI, licences, endorsements, and certifications uploaded and reviewed. No carrier hauls freight until a human reviewer signs off on the complete verification record.',
    bullets: ['COI expiry tracking with renewal alerts', 'Hazmat, TWIC, and reefer endorsements on profile', 'Admin queue — approve or reject with notes', 'Ongoing monitoring on expired documents'],
    color: B.tealNavy,
  },
];

const COMPARE = [
  { feature: 'Identity verified against government ID',     loadboard: false, shipmater: true },
  { feature: 'Operating authority — live registry lookup',  loadboard: false, shipmater: true },
  { feature: 'Background screening before first load',        loadboard: false, shipmater: true },
  { feature: 'Drug & alcohol clearinghouse (US CDL)',         loadboard: false, shipmater: true },
  { feature: 'Human approval before hauling freight',         loadboard: false, shipmater: true },
  { feature: 'Post-job ratings from completed shipments',     loadboard: 'Sometimes', shipmater: true },
  { feature: 'Insurance & COI on file with expiry tracking',  loadboard: false, shipmater: true },
];

const ASSIGN_FLOW = [
  { n: '01', title: 'Review bids or offers', desc: 'Open-market bidders and contracted carriers surface with verification badges, ratings, and equipment match visible before you open the profile.' },
  { n: '02', title: 'Inspect the carrier profile', desc: 'See identity status, authority confirmation, background result, insurance expiry, endorsements, and completed delivery count — not just a company name.' },
  { n: '03', title: 'Filter your network', desc: 'Add approved carriers to preferred lists. Contracted lanes and direct dispatch only surface operators you have already accepted into your network.' },
  { n: '04', title: 'Assign with confidence', desc: 'Escrow funds on assignment. GPS and proof-of-delivery build an audit trail tied to a verified operator — not an anonymous MC number.' },
];

const SHIPPER_CONTROLS = [
  { icon: Users,       title: 'Preferred carrier lists',  desc: 'Build an approved network. Only carriers you have explicitly added can receive contracted direct offers from your organisation.' },
  { icon: Lock,        title: 'Contracted-only pools',    desc: 'Hazmat, reefer, and high-value lanes can be restricted to pre-vetted carriers — no open-market exposure.' },
  { icon: Star,        title: 'Ratings drive selection',  desc: 'Reliability, communication, and overall scores accumulate after every completed job. Low-rated carriers are visible before you assign.' },
  { icon: Globe2,      title: 'Cross-border credentials', desc: 'US, Canada, and Mexico carriers verified against the correct authority registry for their operating country.' },
];

const PROFILE_BADGES = [
  { label: 'Identity verified',     status: 'Passed',  ok: true },
  { label: 'Operating authority',   status: 'Active',  ok: true },
  { label: 'Background screening',  status: 'Clear',   ok: true },
  { label: 'Clearinghouse query',   status: 'Clear',   ok: true },
  { label: 'COI on file',           status: 'Valid',   ok: true },
  { label: 'Human approval',        status: 'Approved', ok: true },
  { label: 'Overall rating',        status: '4.9 ★',   ok: true },
];

export default function ShippersTrustPage() {
  return (
    <div style={{ fontFamily: BODY, WebkitFontSmoothing: 'antialiased', background: B.white }}>

      {/* Hero */}
      <section style={{ background: `linear-gradient(145deg, ${B.tealNavy} 0%, ${B.tealDark} 55%, ${B.teal} 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="relative mx-auto max-w-[1200px] px-6 pt-24 pb-24 text-center">
          <p style={{ fontWeight: 600, fontSize: T.label, letterSpacing: '0.12em', textTransform: 'uppercase', color: B.tealPale, marginBottom: 20 }}>
            Verified Carriers
          </p>
          <h1 style={{ fontWeight: 700, fontSize: T.hero, lineHeight: 1.07, letterSpacing: '-0.025em', color: B.white, maxWidth: 800, margin: '0 auto' }}>
            No self-reported credentials.<br />
            <span style={{ color: B.tealPale }}>Every carrier, verified five layers deep.</span>
          </h1>
          <p style={{ fontSize: T.body, lineHeight: 1.75, color: 'rgba(255,255,255,0.80)', marginTop: 24, maxWidth: 640, margin: '24px auto 0' }}>
            Identity, operating authority, background screening, drug clearinghouse, and human approval — completed before any carrier moves freight on Shipmater. You see the full record before you assign.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <Link href="/register"
              style={{ background: B.tealDark, fontSize: T.body, fontWeight: 600, color: B.white, padding: '13px 28px', borderRadius: 6, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              className="hover:opacity-90 transition-opacity">
              Ship with confidence <ArrowRight size={16} />
            </Link>
            <Link href="/carrier-trust"
              style={{ fontSize: T.body, fontWeight: 500, color: 'rgba(255,255,255,0.80)', padding: '13px 24px', borderRadius: 6, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.25)', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              className="hover:border-white hover:text-white transition-colors">
              Technical verification details
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ background: B.tealNavy, borderBottom: '1px solid rgba(144,224,239,0.15)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <p style={{ fontWeight: 800, fontSize: T.h2, color: B.tealMid }}>{value}</p>
              <p style={{ fontSize: T.label, color: 'rgba(255,255,255,0.6)', marginTop: 4, lineHeight: 1.4 }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      <MarketingHub heading="Shippers" pages={SHIPPER_HUB.map(p => ({ ...p, active: p.href === '/shippers/trust' }))} />

      {/* Intro */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(48px, 6vw, 72px) 24px', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.tealDark, marginBottom: 12 }}>Trust & safety</p>
        <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.gray100, margin: '0 0 16px' }}>The problem with &ldquo;verified&rdquo; load boards</h2>
        <p style={{ fontSize: T.body, color: B.gray70, lineHeight: 1.75 }}>
          Most platforms accept carrier information at face value. An MC number typed into a registration form is not verification.
          Shipmater runs live registry lookups, identity and background checks, and requires human approval — checks that cannot be falsified by the carrier.
        </p>
      </section>

      {/* Comparison table */}
      <section style={{ background: B.gray10 }}>
        <div className="mx-auto max-w-[900px] px-6 py-20">
          <p style={{ fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.tealDark, textAlign: 'center', marginBottom: 12 }}>Comparison</p>
          <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.gray100, textAlign: 'center', marginBottom: 40 }}>Typical load board vs Shipmater</h2>
          <div style={{ background: B.white, borderRadius: 12, border: `1px solid ${B.gray20}`, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 0, background: B.tealBg, padding: '14px 20px', borderBottom: `1px solid ${B.gray20}` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: B.tealNavy, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Verification</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: B.gray50, textAlign: 'center' }}>Typical</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: B.tealDeep, textAlign: 'center' }}>Shipmater</span>
            </div>
            {COMPARE.map((row, i) => (
              <div key={row.feature} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', padding: '14px 20px', borderBottom: i < COMPARE.length - 1 ? `1px solid ${B.gray10}` : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: B.gray70 }}>{row.feature}</span>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {row.loadboard === false
                    ? <X size={18} color="#d64545" />
                    : <span style={{ fontSize: 12, color: B.gray50 }}>{row.loadboard}</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {row.shipmater === true && <CheckCircle2 size={18} color={B.green} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verification layers */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(48px, 6vw, 72px) 24px clamp(64px, 8vw, 96px)' }}>
        <p style={{ fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.tealDark, textAlign: 'center', marginBottom: 12 }}>Verification stack</p>
        <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.gray100, textAlign: 'center', marginBottom: 48 }}>Five independent layers — every carrier</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            return (
              <div key={layer.step} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, background: B.gray10, borderRadius: 16, padding: 'clamp(20px, 3vw, 36px)', border: `1px solid ${B.gray20}` }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: layer.color + '18', border: `1.5px solid ${layer.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} color={layer.color} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: layer.color, letterSpacing: '0.12em' }}>{layer.step}</span>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <h3 style={{ fontSize: T.h3, fontWeight: 700, color: B.darkCard, margin: 0 }}>{layer.title}</h3>
                    <span style={{ fontSize: 10, fontWeight: 600, color: layer.color, background: layer.color + '15', border: `1px solid ${layer.color}30`, borderRadius: 99, padding: '2px 10px', letterSpacing: '0.04em' }}>
                      {layer.badge}
                    </span>
                  </div>
                  <p style={{ fontSize: 15, color: B.gray70, lineHeight: 1.7, margin: '0 0 16px' }}>{layer.desc}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px 16px' }}>
                    {layer.bullets.map(b => (
                      <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <CheckCircle2 size={13} color={layer.color} style={{ marginTop: 3, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: B.gray70, lineHeight: 1.5 }}>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Carrier profile preview */}
      <section style={{ background: B.white }}>
        <div className="mx-auto max-w-[1080px] px-6 py-24">
          <p style={{ fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.tealDark, textAlign: 'center', marginBottom: 12 }}>Carrier profile</p>
          <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.gray100, textAlign: 'center', marginBottom: 48 }}>What you see before you assign a load</h2>
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div style={{ background: B.gray10, borderRadius: 16, padding: '32px 28px', border: `1px solid ${B.gray20}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, background: B.tealNavy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={26} color={B.teal} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 18, color: B.gray100, margin: '0 0 4px' }}>Reyes Transport LLC</p>
                  <p style={{ fontSize: 13, color: B.gray50, margin: 0 }}>MC-291847 · DOT 3842910 · 284 deliveries</p>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: B.green, background: '#E4F6EE', borderRadius: 99, padding: '4px 10px' }}>Verified</span>
              </div>
              {PROFILE_BADGES.map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${B.gray20}` }}>
                  <span style={{ fontSize: 14, color: B.gray70 }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: row.ok ? B.green : B.gray50 }}>{row.status}</span>
                </div>
              ))}
              <p style={{ fontSize: 12, color: B.gray50, marginTop: 16, fontStyle: 'italic' }}>Illustrative profile — actual data shown at assignment time.</p>
            </div>
            <div>
              <p style={{ fontSize: T.body, color: B.gray70, lineHeight: 1.75, marginBottom: 24 }}>
                Every bid and direct offer links to a carrier profile with verification status, credential expiry dates,
                equipment list, service types, and post-job ratings. Dispatch decisions are based on evidence — not a rate and a phone number.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  'Cargo insurance (COI) with expiry date visible',
                  'Hazmat, TWIC, and reefer endorsements listed',
                  'Reliability and communication scores after each job',
                  'Equipment types and service categories matched to your load',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Lock size={14} color={B.tealDeep} style={{ marginTop: 3, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: B.gray70, lineHeight: 1.55 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Assign workflow */}
      <section style={{ background: B.gray10 }}>
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <p style={{ fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.tealDark, textAlign: 'center', marginBottom: 12 }}>Your workflow</p>
          <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.gray100, textAlign: 'center', marginBottom: 56 }}>How shippers use verification at assignment</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ASSIGN_FLOW.map(({ n, title, desc }) => (
              <div key={n} style={{ background: B.white, borderRadius: 8, padding: '28px 24px', border: '1px solid rgba(0,150,199,0.12)' }}>
                <p style={{ fontWeight: 700, fontSize: T.h2, color: B.tealBg, lineHeight: 1, marginBottom: 16 }}>{n}</p>
                <h3 style={{ fontWeight: 600, fontSize: T.h4, color: B.gray100, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: T.body, color: B.gray70, lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shipper controls */}
      <section style={{ background: B.darkSec }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <p style={{ fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.teal, textAlign: 'center', marginBottom: 12 }}>Your controls</p>
          <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.white, textAlign: 'center', marginBottom: 48 }}>Verification is the floor — your network is the filter</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {SHIPPER_CONTROLS.map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '28px 24px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Icon size={22} color={B.teal} style={{ marginBottom: 14 }} />
                <h3 style={{ fontWeight: 600, fontSize: T.h4, color: B.white, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: T.body, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regulated freight callout */}
      <section style={{ background: B.white, borderTop: `1px solid ${B.gray10}` }}>
        <div className="mx-auto max-w-[1200px] px-6 py-16">
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '28px 32px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <ShieldCheck size={24} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontWeight: 600, fontSize: T.h4, color: '#14532d', marginBottom: 8 }}>Regulated freight needs more than a DOT number</p>
              <p style={{ fontSize: T.body, color: '#166534', lineHeight: 1.65 }}>
                Hazmat, high-value, and temperature-controlled shipments can be restricted to contracted carrier pools with
                hazmat endorsements, PHMSA registration, and TWIC credentials on file. Shipmater enforces credential requirements at the job level — not just at onboarding.{' '}
                <Link href="/use-cases/freight-logistics" style={{ color: '#16a34a', fontWeight: 500 }}>Freight details →</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* International */}
      <section style={{ background: B.tealBg }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20 text-center">
          <Globe2 size={28} color={B.tealDark} style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.gray100, marginBottom: 16 }}>Carriers from 100+ countries</h2>
          <p style={{ fontSize: T.body, color: B.gray70, lineHeight: 1.75, maxWidth: 560, margin: '0 auto 28px' }}>
            Identity verification, authority lookups, and background screening adapt to the carrier&apos;s operating country.
            USMCA cross-border carriers verified against the correct registry on each side of the border.
          </p>
          <Link href="/international-carriers" style={{ color: B.tealDeep, fontWeight: 600, fontSize: T.body, textDecoration: 'none' }}
            className="hover:underline">
            International carrier onboarding →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: `linear-gradient(135deg, ${B.tealNavy} 0%, ${B.darkSec} 100%)` }}>
        <div className="mx-auto max-w-[1200px] px-6 py-24 text-center">
          <ShieldCheck size={36} color={B.teal} style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.white, marginBottom: 16 }}>Assign freight to verified operators</h2>
          <p style={{ fontSize: T.body, color: 'rgba(255,255,255,0.70)', marginBottom: 36, maxWidth: 520, margin: '0 auto 36px' }}>
            Build a preferred carrier network, run contracted lanes with approved operators, and bid open-market loads knowing every carrier passed the same five-layer stack.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/register"
              style={{ background: B.tealDark, fontSize: T.body, fontWeight: 600, color: B.white, padding: '14px 32px', borderRadius: 6, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              className="hover:opacity-90 transition-opacity">
              Create free shipper account <ArrowRight size={16} />
            </Link>
            <Link href="/shippers/shipping"
              style={{ fontSize: T.body, fontWeight: 500, color: 'rgba(255,255,255,0.80)', padding: '13px 24px', borderRadius: 6, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.25)', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              className="hover:border-white hover:text-white transition-colors">
              Shipping & lanes
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
