'use client';

import Link from 'next/link';
import {
  ArrowRight, MapPin, Package, ShieldCheck, CheckCircle2,
  Clock, FileText, BadgeCheck, Zap, Lock, ChevronRight,
  Snowflake, HardHat, AlertTriangle, Car, Truck, Star,
} from 'lucide-react';
import { MarketingHub } from '@/components/marketing/MarketingHub';
import { HOW_IT_WORKS_HUB } from '@/lib/marketing/hub-links';
import { T } from '@/lib/type-scale';


// ── Palette & scale (shared system) ──────────────────────────────────────────
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
  gray90:   '#262626',
  gray70:   '#525252',
  gray50:   '#8D8D8D',
  gray10:   '#F4F4F4',
  white:    '#FFFFFF',
};


const BODY = 'var(--font-body)';
const DISPLAY = 'var(--font-display)';

// ── Data ──────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    title: 'Describe what you need moved',
    summary: 'Tell us what it is, where it starts and where it needs to go.',
    detail: [
      'Item description, dimensions and estimated value',
      'Pickup address and preferred date and time window',
      'Delivery address and any access instructions',
      'Special handling requirements — fragile, temperature-sensitive, high-value',
      'Optional: attach photos for provider reference',
    ],
    note: 'Takes under two minutes. No account required to get a quote.',
  },
  {
    n: '02',
    title: 'Vetted providers respond',
    summary: 'Only pre-screened, insured providers can see and respond to your request.',
    detail: [
      'Each quote is itemised — base rate, handling and any surcharges shown upfront',
      'Provider profiles show credentials, insurance coverage and verified ratings',
      'You can see relevant experience — equipment type, lanes run, hazmat and heavy haul history',
      'No pressure to accept — quotes are valid for 24 hours',
    ],
    note: 'You are never obligated to accept a quote.',
  },
  {
    n: '03',
    title: 'Confirm your provider',
    summary: 'Select the best match. Payment is held securely — not released until delivery is confirmed.',
    detail: [
      'Review the provider\'s profile, ratings and quote in full',
      'Accept and your payment is placed in secure escrow',
      'Your provider is notified instantly and the delivery is confirmed',
      'You receive a confirmation with provider details and tracking link',
    ],
    note: 'Payment is never released to the provider until you confirm receipt.',
  },
  {
    n: '04',
    title: 'Track every mile, live',
    summary: 'Live GPS from the moment of pickup through to confirmed delivery.',
    detail: [
      'Real-time map showing your delivery\'s current position',
      'Automatic alerts at pickup, en route, nearby and delivered',
      'Delay detection — you\'re notified the moment anything changes',
      'Shareable tracking link so recipients can follow along too',
      'Full delivery log stored in your account permanently',
    ],
    note: 'You have complete visibility. Nothing happens without a record.',
  },
];

const USE_CASES = [
  {
    icon: Truck,
    title: 'Dry Van & General Freight',
    desc: 'FTL and LTL across regional and long-haul lanes. Post a load, get bids from carriers with active authority and cargo coverage.',
    tags: ['FTL / LTL', 'Competitive bids', 'Live tracking'],
  },
  {
    icon: Snowflake,
    title: 'Refrigerated & Cold Chain',
    desc: 'Reefer loads with temperature requirements on the tender. Only reefer-equipped carriers can bid, and every stop is logged.',
    tags: ['Reefer only', 'Temp requirements', 'Per-stop log'],
  },
  {
    icon: HardHat,
    title: 'Flatbed & Heavy Haul',
    desc: 'Steel, lumber, machinery and oversize equipment. Dims, weight and permit notes captured upfront so only the right rigs respond.',
    tags: ['Flatbed / RGN', 'Oversize', 'Load-secure photos'],
  },
  {
    icon: AlertTriangle,
    title: 'Hazmat',
    desc: 'Hazardous materials restricted to carriers with hazmat endorsements, PHMSA registration and the right insurance limits.',
    tags: ['Endorsement checked', 'PHMSA', 'Full audit log'],
  },
  {
    icon: Car,
    title: 'Auto Transport',
    desc: 'Open and enclosed car haulers for dealers, auctions and fleets. VIN and condition photos at pickup and delivery.',
    tags: ['Open / enclosed', 'VIN logging', 'Condition photos'],
  },
  {
    icon: Star,
    title: 'Contracted Lanes',
    desc: 'Set up standing agreements with preferred carriers for recurring lanes. Agreed rates, direct dispatch, no re-bidding every week.',
    tags: ['Preferred carriers', 'Fixed rates', 'Direct dispatch'],
  },
];

const VETTING_STEPS = [
  {
    icon: BadgeCheck,
    title: 'Credential check',
    desc: 'Licences, certifications and authority documents verified against live government databases before a provider can join the platform.',
  },
  {
    icon: ShieldCheck,
    title: 'Insurance verification',
    desc: 'Active insurance certificates confirmed directly with the issuing provider. Coverage limits validated against platform minimums.',
  },
  {
    icon: FileText,
    title: 'Background screening',
    desc: 'Full criminal background check and relevant clearance queries completed through an accredited screening partner.',
  },
  {
    icon: Star,
    title: 'Ongoing ratings',
    desc: 'Every completed delivery generates a verified rating. Providers below threshold are reviewed and suspended pending investigation.',
  },
  {
    icon: Lock,
    title: 'Provider agreement',
    desc: 'Every provider signs a formal agreement defining liability, conduct standards and accountability before their first delivery.',
  },
  {
    icon: Zap,
    title: 'Continuous monitoring',
    desc: 'Credential expiry alerts, insurance renewal tracking and real-time incident flagging keep the network current and clean.',
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HowItWorksPage() {
  return (
    <div style={{ fontFamily: BODY, WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', background: B.white }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(145deg, ${B.tealNavy} 0%, ${B.tealDeep} 50%, ${B.tealDark} 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="relative mx-auto max-w-[1200px] px-6 pt-20 pb-20">
          <div className="max-w-2xl">
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.teal, marginBottom: 16 }}>
              How it works
            </p>
            <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.hero, lineHeight: 1.1, letterSpacing: '-0.025em', color: B.white }}>
              Simple for you.<br />
              <span style={{ color: B.tealPale }}>Thorough on our end.</span>
            </h1>
            <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, lineHeight: 1.75, color: 'rgba(255,255,255,0.75)', marginTop: 20, maxWidth: 520 }}>
              Four steps stand between you and a verified, tracked, insured delivery — no logistics experience required.
            </p>
          </div>
          {/* Step progress bar */}
          <div className="flex items-center gap-0 mt-14 max-w-2xl">
            {['Describe', 'Providers respond', 'Confirm', 'Track live'].map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: B.tealDark, border: `2px solid ${B.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 700, color: B.white }}>0{i + 1}</span>
                  </div>
                  <span style={{ fontFamily: BODY, fontSize: T.fine, fontWeight: 500, color: B.tealPale, textAlign: 'center', whiteSpace: 'nowrap' }}>{s}</span>
                </div>
                {i < 3 && <div style={{ height: 2, flex: 1, background: `linear-gradient(90deg, ${B.tealDark}, ${B.teal}40)`, marginBottom: 22 }} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingHub heading="How It Works" pages={HOW_IT_WORKS_HUB.map(p => ({ ...p, active: p.href === '/how-it-works' }))} />

      {/* ── STEPS DETAIL ─────────────────────────────────────────────────── */}
      <section style={{ background: B.white }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6 space-y-0">
          {STEPS.map((step, i) => {
            const isEven = i % 2 === 0;
            return (
              <div key={step.n}
                style={{ borderTop: '1px solid #E0E0E0', paddingTop: 64, paddingBottom: 64 }}
                className={`grid md:grid-cols-2 gap-16 items-start ${!isEven ? 'md:[direction:rtl]' : ''}`}>
                {/* Number + title side */}
                <div style={{ direction: 'ltr' }}>
                  <div className="flex items-start gap-5">
                    <div style={{ width: 56, height: 56, borderRadius: 8, background: B.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: T.h4, color: B.tealDark }}>{step.n}</span>
                    </div>
                    <div>
                      <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.gray100, lineHeight: 1.2 }}>
                        {step.title}
                      </h2>
                      <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, marginTop: 12, lineHeight: 1.75 }}>
                        {step.summary}
                      </p>
                    </div>
                  </div>
                  <div style={{ marginTop: 28, background: B.tealBg, borderLeft: `3px solid ${B.tealDark}`, borderRadius: 4, padding: '14px 18px' }}>
                    <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 400, color: B.gray70, lineHeight: 1.65, fontStyle: 'italic' }}>
                      {step.note}
                    </p>
                  </div>
                </div>
                {/* Detail list side */}
                <div style={{ direction: 'ltr' }} className="space-y-3">
                  {step.detail.map(pt => (
                    <div key={pt} className="flex items-start gap-3">
                      <CheckCircle2 size={18} style={{ color: B.tealDark, marginTop: 2, flexShrink: 0 }} />
                      <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, lineHeight: 1.68 }}>{pt}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── USE CASES ────────────────────────────────────────────────────── */}
      <section style={{ background: B.gray10, borderTop: '1px solid #E0E0E0', borderBottom: '1px solid #E0E0E0' }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-14">
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.tealDark }}>What moves on Shipmater</p>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.gray100, marginTop: 10, lineHeight: 1.2 }}>
              From gold to a get-well card.<br />If it matters, we handle it.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {USE_CASES.map(uc => (
              <div key={uc.title} style={{ background: B.white, border: '1px solid #E0E0E0', borderRadius: 8, padding: '32px 28px' }}>
                <div style={{ width: 48, height: 48, background: B.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 18 }}>
                  <uc.icon size={22} style={{ color: B.tealDark }} />
                </div>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: T.h4, color: B.gray100, marginBottom: 10 }}>{uc.title}</h3>
                <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, lineHeight: 1.68, marginBottom: 16 }}>{uc.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {uc.tags.map(tag => (
                    <span key={tag} style={{ background: B.tealBg, fontFamily: BODY, fontSize: T.fine, fontWeight: 600, color: B.tealDark, padding: '4px 10px', borderRadius: 4, letterSpacing: '0.03em' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VETTING PROCESS ──────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(160deg, #051520 0%, ${B.darkSec} 55%, ${B.tealDeep} 100%)`, position: 'relative', overflow: 'hidden' }} className="py-24">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: `linear-gradient(${B.tealMid} 1px, transparent 1px), linear-gradient(90deg, ${B.tealMid} 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
        <div className="relative mx-auto max-w-[1200px] px-6">
          <div className="mb-14 max-w-2xl">
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.teal }}>The vetting standard</p>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.white, marginTop: 10, lineHeight: 1.2 }}>
              Every provider earns their place.<br />None of them self-certify.
            </h2>
            <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: 'rgba(255,255,255,0.65)', marginTop: 14, lineHeight: 1.75 }}>
              Before a provider can accept a single delivery on Shipmater, they go through six layers of independent verification. Here's exactly what that means.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: 'rgba(255,255,255,0.07)' }}>
            {VETTING_STEPS.map((v, i) => (
              <div key={v.title} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', padding: '32px 28px' }}>
                <div style={{ width: 44, height: 44, background: 'rgba(144,224,239,0.12)', border: `1px solid ${B.teal}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 16 }}>
                  <v.icon size={20} style={{ color: B.teal }} />
                </div>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: T.h4, color: B.white, marginBottom: 10 }}>{v.title}</h3>
                <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: 'rgba(255,255,255,0.60)', lineHeight: 1.68 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRACKING DETAIL ──────────────────────────────────────────────── */}
      <section style={{ background: B.white }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.tealDark }}>Live tracking</p>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.gray100, marginTop: 10, lineHeight: 1.2 }}>
              You never have<br />to wonder.
            </h2>
            <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, marginTop: 16, lineHeight: 1.75 }}>
              The moment your provider picks up, tracking begins. Every location update appears on your live map in real time — and every milestone triggers an automatic notification to you and your recipient.
            </p>
            <div className="mt-8 space-y-5">
              {[
                { icon: MapPin,    title: 'Live map',            desc: 'Current position, speed and estimated arrival updated continuously.' },
                { icon: Zap,       title: 'Milestone alerts',    desc: 'Automatic notifications at pickup, en route, nearby and delivery.' },
                { icon: Clock,     title: 'Delay detection',     desc: 'Any deviation from expected route or schedule triggers an instant alert.' },
                { icon: CheckCircle2, title: 'Confirmed receipt', desc: 'Recipient confirms delivery in the app. Payment releases only then.' },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-4">
                  <div style={{ width: 40, height: 40, background: B.tealBg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <item.icon size={18} style={{ color: B.tealDark }} />
                  </div>
                  <div>
                    <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: T.h4, color: B.gray100 }}>{item.title}</p>
                    <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, marginTop: 4, lineHeight: 1.65 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Screenshot placeholder */}
          <div style={{ background: B.gray10, border: '1px solid #E0E0E0', borderRadius: 8, aspectRatio: '4/3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <MapPin size={32} style={{ color: B.tealDark, opacity: 0.4 }} />
            <p style={{ fontFamily: BODY, fontSize: T.label, color: B.gray50, letterSpacing: '0.06em' }}>Tracking screenshot</p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(145deg, ${B.tealDeep} 0%, ${B.tealNavy} 100%)`, position: 'relative', overflow: 'hidden' }} className="py-24">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="relative mx-auto max-w-[1200px] px-6 text-center">
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h1, letterSpacing: '-0.025em', color: B.white, lineHeight: 1.15 }}>
            Ready to move what matters?
          </h2>
          <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: 'rgba(255,255,255,0.65)', marginTop: 20, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.75 }}>
            Free to start. No logistics experience needed. Your first delivery is a few minutes away.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <Link href="/register"
              style={{ background: B.white, fontFamily: BODY, fontSize: T.body, fontWeight: 700, color: B.tealDeep, padding: '16px 36px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
              className="hover:opacity-95 transition-opacity">
              Get started free <ArrowRight size={16} />
            </Link>
            <Link href="/"
              style={{ border: '1px solid rgba(255,255,255,0.28)', fontFamily: BODY, fontSize: T.body, fontWeight: 400, color: 'rgba(255,255,255,0.84)', padding: '16px 36px', borderRadius: 6, textDecoration: 'none' }}
              className="hover:bg-white/10 transition-colors">
              Back to home
            </Link>
          </div>
          <p style={{ fontFamily: BODY, fontSize: T.fine, color: 'rgba(255,255,255,0.35)', marginTop: 20 }}>
            No setup fees · No long-term commitment · Cancel any time
          </p>
        </div>
      </section>

    </div>
  );
}
