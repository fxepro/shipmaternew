'use client';

import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, MapPin,
  Truck, HardHat, Car,
  Shield, FileText, Lock, Zap,
} from 'lucide-react';
import { MarketingHub } from '@/components/marketing/MarketingHub';
import { USE_CASES_HUB } from '@/lib/marketing/hub-links';
import { T } from '@/lib/type-scale';


// ── Palette & scale ───────────────────────────────────────────────────────────
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

// ── Industries ────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  {
    id: 'freight-logistics',
    icon: Truck,
    label: 'Freight & Logistics',
    headline: 'Open market dispatch.\nContracted routes.\nOne platform.',
    intro: 'The foundational use case. Whether you\'re running a one-off load or managing contracted lanes with regular carriers, Shipmater handles both models simultaneously. Post to the open market and get competitive bids, or assign directly to contracted providers and dispatch in seconds.',
    points: [
      'Open market bidding — post a job, receive bids from verified providers, compare and assign',
      'Contracted dispatch — assign directly to preferred providers under agreed rates',
      'Real-road route planning with live ETA updates across every active job',
      'Live GPS tracking from pickup through every stop to final delivery',
      'Full bid and contract lifecycle managed in one place — no spreadsheets, no email chains',
      'Cost breakdowns, fuel surcharges and detention terms visible before you commit',
    ],
    scenario: {
      title: 'A regional distributor dispatches three routes simultaneously',
      items: [
        { time: '7:55am',  text: 'Three jobs posted to open market' },
        { time: '8:09am',  text: '11 bids received across all three routes' },
        { time: '8:22am',  text: 'All three routes assigned — best rate selected' },
        { time: '10:40am', text: 'Live GPS active — all trucks en route' },
        { time: '4:52pm',  text: 'All deliveries confirmed · Full cost log exported' },
      ],
      tag: '3 routes · 11 bids · All delivered on time',
    },
  },
  {
    id: 'auto-transport',
    icon: Car,
    label: 'Auto Transport',
    headline: 'Every scratch documented\nbefore it moves an inch.',
    intro: 'Vehicle transport lives and dies on condition documentation. Shipmater captures VIN, condition reports and photos at both pickup and delivery — creating an irrefutable before-and-after record. Disputes are settled with evidence, not memory. Works for individual moves and fleet transport alike.',
    points: [
      'VIN capture and vehicle condition report fields built into every auto delivery',
      'Photo capture enforced at pickup and delivery — front, rear, sides and interior',
      'Open market model for one-off moves — competitive bids from transport-rated providers',
      'Contracted model for dealers and fleet operators needing regular, consistent transport',
      'Evidence-based dispute resolution — condition record is timestamped and tamper-proof',
      'Provider ratings filtered by auto transport experience — not just general ratings',
    ],
    scenario: {
      title: 'A dealer ships a purchased vehicle to a buyer across two states',
      items: [
        { time: '9:00am',  text: 'Job posted — VIN logged, condition noted' },
        { time: '9:18am',  text: 'Provider confirmed — auto transport rated, insured' },
        { time: '10:05am', text: 'Pickup · 8 condition photos taken · VIN verified' },
        { time: '2:30pm',  text: 'En route · Live tracking shared with buyer' },
        { time: '6:14pm',  text: 'Delivered · 8 delivery photos taken · Buyer confirmed' },
      ],
      tag: 'VIN logged · 16 condition photos · Zero disputes',
    },
  },
  {
    id: 'construction',
    icon: HardHat,
    label: 'Construction Equipment',
    headline: 'Heavy, oversized,\none-off. Open market\nhandles it.',
    intro: 'Skid steers, excavators, flatbed loads, oversize machinery. Construction equipment moves don\'t happen on a schedule — they happen when a job needs them. Shipmater\'s open market model is built for this: post your load specifications, and only providers with the right equipment and permits see the job.',
    points: [
      'Open market model — one-off heavy moves get competitive bids from qualified providers',
      'Flatbed, lowboy, oversize and heavy haul handling requirements specifiable',
      'Weight, dimensions and permit requirements captured upfront — no surprises',
      'Provider matching by equipment type — only appropriate rigs see your job',
      'Photo documentation at pickup and delivery — condition and load security recorded',
      'Oversize load routing support — providers confirm route compliance before accepting',
    ],
    scenario: {
      title: 'A contractor moves a skid steer to a job site 180 miles away',
      items: [
        { time: '7:00am',  text: 'Job posted — weight 8,200 lbs, flatbed required' },
        { time: '7:22am',  text: '4 bids received — flatbed-rated providers only' },
        { time: '7:35am',  text: 'Provider confirmed · Equipment verified' },
        { time: '9:00am',  text: 'Pickup · Load secured · Photos taken' },
        { time: '1:45pm',  text: 'Delivered to site · Condition confirmed · Job closed' },
      ],
      tag: 'Flatbed matched · 4 competitive bids · On site same day',
    },
  },
];

// ── Scenario card ─────────────────────────────────────────────────────────────

function ScenarioCard({ scenario }: { scenario: typeof INDUSTRIES[0]['scenario'] }) {
  return (
    <div style={{ background: B.darkSec, borderRadius: 8, overflow: 'hidden', boxShadow: '0 20px 56px rgba(0,0,0,0.18)' }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${B.tealNavy} 0%, ${B.darkSec} 100%)`, padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
          <span style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live delivery</span>
        </div>
        <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: T.h4, color: B.white, lineHeight: 1.4 }}>{scenario.title}</p>
      </div>
      {/* Timeline */}
      <div style={{ padding: '24px 28px' }}>
        {scenario.items.map((item, i) => (
          <div key={i} className="flex items-start gap-4" style={{ paddingBottom: i < scenario.items.length - 1 ? 20 : 0 }}>
            <div className="flex flex-col items-center" style={{ flexShrink: 0, width: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === scenario.items.length - 1 ? '#22C55E' : B.tealDark, flexShrink: 0, marginTop: 4, border: `2px solid ${i === scenario.items.length - 1 ? '#16A34A' : B.tealDeep}` }} />
              {i < scenario.items.length - 1 && (
                <div style={{ width: 1, background: 'rgba(255,255,255,0.12)', marginTop: 5, minHeight: 24, flex: 1 }} />
              )}
            </div>
            <div style={{ paddingBottom: 2 }}>
              <span style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 700, color: B.tealMid }}>{item.time}</span>
              <p style={{ fontFamily: BODY, fontSize: T.body, color: 'rgba(255,255,255,0.72)', marginTop: 3, lineHeight: 1.55 }}>{item.text}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Footer tag */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '16px 28px' }}>
        <span style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, color: B.teal }}>{scenario.tag}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UseCasesPage() {
  return (
    <div style={{ fontFamily: BODY, WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', background: B.white }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(145deg, ${B.tealNavy} 0%, ${B.tealDeep} 50%, ${B.tealDark} 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="relative mx-auto max-w-[1200px] px-6 pt-20 pb-20">
          <div className="max-w-2xl">
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.teal, marginBottom: 16 }}>
              Industries
            </p>
            <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.hero, lineHeight: 1.1, letterSpacing: '-0.025em', color: B.white }}>
              Built for the industries<br />
              <span style={{ color: B.tealPale }}>that can't afford to get it wrong.</span>
            </h1>
            <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, lineHeight: 1.75, color: 'rgba(255,255,255,0.75)', marginTop: 20, maxWidth: 540 }}>
              Freight, auto transport and heavy equipment. Different loads, different stakes — one platform for shippers, dispatchers and drivers with the same standard of vetting, tracking and accountability.
            </p>
          </div>
          {/* Industry jump links (in-page anchors — use-cases stays as one long page) */}
          <div className="flex flex-wrap gap-2 mt-12">
            {INDUSTRIES.map(ind => (
              <a key={ind.id} href={`#${ind.id}`}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', fontFamily: BODY, fontSize: T.label, fontWeight: 500, color: 'rgba(255,255,255,0.80)', padding: '8px 16px', borderRadius: 6, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                className="hover:bg-white/15 transition-colors">
                <ind.icon size={13} />
                {ind.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <MarketingHub heading="Use Cases" pages={USE_CASES_HUB.map(p => ({ ...p, active: p.href === '/use-cases' }))} />

      {/* ── INDUSTRY SECTIONS ────────────────────────────────────────────── */}
      {INDUSTRIES.map((ind, i) => {
        const isEven = i % 2 === 0;
        const bg = isEven ? B.white : B.gray10;
        return (
          <section key={ind.id} id={ind.id}
            style={{ background: bg, borderTop: '1px solid #E0E0E0' }}
            className="py-24">
            <div className="mx-auto max-w-[1200px] px-6">
              <div className="grid md:grid-cols-2 gap-16 items-start">

                {/* Text side */}
                <div className={!isEven ? 'md:order-2' : ''}>
                  <div className="flex items-center gap-3 mb-6">
                    <div style={{ width: 48, height: 48, background: B.tealBg, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ind.icon size={22} style={{ color: B.tealDark }} />
                    </div>
                    <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.tealDark }}>{ind.label}</p>
                  </div>
                  <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.gray100, lineHeight: 1.2, whiteSpace: 'pre-line' }}>
                    {ind.headline}
                  </h2>
                  <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, marginTop: 16, lineHeight: 1.75 }}>
                    {ind.intro}
                  </p>
                  <div className="mt-8 space-y-3">
                    {ind.points.map(pt => (
                      <div key={pt} className="flex items-start gap-3">
                        <CheckCircle2 size={18} style={{ color: B.tealDark, marginTop: 2, flexShrink: 0 }} />
                        <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, lineHeight: 1.65 }}>{pt}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 28 }}>
                    <Link href="/register"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: B.tealDark, fontFamily: BODY, fontSize: T.body, fontWeight: 600, color: B.white, padding: '12px 22px', borderRadius: 6, textDecoration: 'none' }}
                      className="hover:opacity-90 transition-opacity">
                      Get started <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>

                {/* Scenario card side */}
                <div className={!isEven ? 'md:order-1' : ''}>
                  <ScenarioCard scenario={ind.scenario} />
                </div>

              </div>
            </div>
          </section>
        );
      })}

      {/* ── CONSISTENT STANDARD ──────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(160deg, #051520 0%, ${B.darkSec} 55%, ${B.tealDeep} 100%)` }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-14 text-center max-w-2xl mx-auto">
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.teal }}>Across every industry</p>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.white, marginTop: 10, lineHeight: 1.2 }}>
              The platform standard doesn't change.<br />The industry requirements do.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: 'rgba(255,255,255,0.07)' }}>
            {[
              { icon: Shield,   title: 'Vetted providers',  desc: 'Background-checked, insured and credential-verified before their first load — authority, insurance and safety record checked.' },
              { icon: MapPin,   title: 'Live GPS',          desc: 'Real-time position from pickup to delivery. Every mile tracked, every milestone logged.' },
              { icon: Lock,     title: 'Secure payments',   desc: 'Payment held in escrow and only released when the recipient confirms delivery.' },
              { icon: FileText, title: 'Full audit trail',  desc: 'Every handoff, photo, temperature reading and status change logged permanently.' },
            ].map(item => (
              <div key={item.title} style={{ background: 'rgba(255,255,255,0.03)', padding: '32px 28px' }}>
                <div style={{ width: 44, height: 44, background: 'rgba(144,224,239,0.10)', border: `1px solid ${B.teal}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 16 }}>
                  <item.icon size={20} style={{ color: B.teal }} />
                </div>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: T.h4, color: B.white, marginBottom: 10 }}>{item.title}</h3>
                <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ background: B.tealBg, borderTop: `1px solid #B0DDE8` }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6 text-center">
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h1, letterSpacing: '-0.025em', color: B.gray100, lineHeight: 1.15 }}>
            Your industry. Your requirements.<br />Our platform.
          </h2>
          <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, marginTop: 20, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.75 }}>
            Free to start. Tell us what you need to move and we'll show you who can handle it.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <Link href="/register"
              style={{ background: B.tealDark, fontFamily: BODY, fontSize: T.body, fontWeight: 700, color: B.white, padding: '16px 36px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
              className="hover:opacity-90 transition-opacity">
              Get started free <ArrowRight size={16} />
            </Link>
            <Link href="/how-it-works"
              style={{ border: `2px solid ${B.tealDark}`, fontFamily: BODY, fontSize: T.body, fontWeight: 600, color: B.tealDark, padding: '14px 36px', borderRadius: 6, textDecoration: 'none' }}
              className="hover:bg-white transition-colors">
              See how it works
            </Link>
          </div>
          <p style={{ fontFamily: BODY, fontSize: T.fine, color: B.gray50, marginTop: 20 }}>
            No setup fees · No long-term commitment
          </p>
        </div>
      </section>

    </div>
  );
}
