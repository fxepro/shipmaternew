'use client';

import Link from 'next/link';
import { T } from '@/lib/type-scale';

import {
  ArrowRight, MapPin, Truck, ShieldCheck, Zap, DollarSign, Package,
  CheckCircle2, Route, FileText, BarChart2, Star,
  ChevronRight, Lock, BadgeCheck, Globe,
} from 'lucide-react';

// ── Blue-teal palette ─────────────────────────────────────────────────────────
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

// ── Type scale ────────────────────────────────────────────────────────────────

const BODY = 'var(--font-body)';
const DISPLAY = 'var(--font-display)';

// ── Data ──────────────────────────────────────────────────────────────────────

const HOW_STEPS = [
  { n: '01', title: 'Describe what you need moved',   desc: 'Tell us what it is, where it is, where it\'s going and any handling requirements. Takes two minutes.' },
  { n: '02', title: 'Vetted providers respond',        desc: 'Background-checked, insured providers submit transparent quotes. Compare ratings, coverage and experience.' },
  { n: '03', title: 'Confirm your provider',           desc: 'Select the best match. Your provider is notified instantly and your delivery is confirmed.' },
  { n: '04', title: 'Track every mile, live',          desc: 'Follow your delivery on a live map with real-time updates at every milestone through to confirmed receipt.' },
];

const SENDER_POINTS = [
  'Any load — LTL pallets, full truckload, flatbed, reefer or heavy haul',
  'Every carrier is checked against FMCSA authority, insurance and safety records',
  'Live GPS — see exactly where your delivery is at every moment',
  'Payment held securely and only released on confirmed delivery',
  'Clear upfront pricing — no hidden fees, no surprises after the fact',
  'Complete audit trail — every update and status change logged automatically',
];

const PROVIDER_POINTS = [
  'Browse loads that match your lanes, equipment and authority',
  'Respond in seconds — no phone calls, no back-and-forth paperwork',
  'Build standing arrangements with clients who want you on call first',
  'Get paid fast — payment released immediately on confirmed delivery',
  'Your verification record and ratings are visible to every client',
  'Dispatchers manage the fleet from desktop; drivers run loads from their phone',
];

const FEATURES = [
  { icon: MapPin,      title: 'Real-Time Tracking',        desc: 'Every location update plotted live on your map. Know exactly where your delivery is — every minute, every mile.' },
  { icon: ShieldCheck, title: 'Vetted Providers',           desc: 'Every provider passes background checks, insurance verification and credential review before their first delivery.' },
  { icon: DollarSign,  title: 'Transparent Pricing',        desc: 'Post your request and receive clear, itemised quotes. Compare providers on price, rating and relevant experience.' },
  { icon: FileText,    title: 'Priority Arrangements',      desc: 'Set up standing arrangements with trusted providers for recurring or time-sensitive needs. No renegotiating every time.' },
  { icon: Route,       title: 'Smart Routing',              desc: 'Multi-stop deliveries are automatically optimised for the fastest, most efficient path — saving time and cost.' },
  { icon: Zap,         title: 'Instant Notifications',      desc: 'Alerts when your provider is confirmed, en route, approaching and at the moment of delivery.' },
  { icon: Lock,        title: 'Secure Payments',            desc: 'Payment is held and only released when the recipient confirms delivery. Neither party can skip the process.' },
  { icon: BarChart2,   title: 'Delivery History',           desc: 'Full logs, cost summaries and provider performance — all in one place, always exportable.' },
  { icon: Globe,       title: 'Any Shipment, Anywhere',     desc: 'A single pallet or a full truckload, regional or coast to coast — Shipmater handles it.' },
];

const VETTING = [
  {
    icon: BadgeCheck,
    title: 'Credential Verification',
    desc: 'Every provider\'s credentials, licences and insurance certificates are independently verified before they can accept a single delivery on the platform.',
  },
  {
    icon: ShieldCheck,
    title: 'Background Checked',
    desc: 'All providers complete a full background check and relevant clearance queries as part of onboarding. No self-certification. No exceptions.',
  },
  {
    icon: FileText,
    title: 'Provider Agreement',
    desc: 'Every provider operates under a formal agreement that clearly defines accountability, liability and conduct — protecting both parties on every engagement.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'We tender 40 loads a week across our regional lanes. Shipmater gave us verified carriers on demand — no more chasing check calls.',
    name:  'Sandra K.',
    role:  'Logistics Manager, Regional Distributor',
    stars: 5,
  },
  {
    quote: 'I run a six-truck fleet. Loads come to me, rate cons are generated automatically, and payouts land when the POD is signed.',
    name:  'James R.',
    role:  'Owner-Operator & Dispatcher, JR Transport',
    stars: 5,
  },
  {
    quote: 'Our team moves high-value equipment between sites regularly. The verification process alone makes Shipmater worth it. The tracking is a bonus.',
    name:  'Michelle T.',
    role:  'Operations Director, Precision Systems Inc.',
    stars: 5,
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{ fontFamily: BODY, WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', background: B.white }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(145deg, #023E8A 0%, #0096C7 45%, #90E0EF 100%)', position: 'relative', overflow: 'hidden' }}>
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="relative mx-auto max-w-[1200px] px-6 pt-28 pb-28">
          <div className="max-w-3xl">
            <span style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', fontFamily: BODY, fontSize: T.label, fontWeight: 600, color: B.teal, letterSpacing: '0.09em', textTransform: 'uppercase' }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-8">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: B.tealMid, display: 'inline-block' }} />
              Freight Dispatch · Live Tracking · Verified Carriers
            </span>
            <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.hero, lineHeight: 1.07, letterSpacing: '-0.025em', color: B.white }}>
              Now everyone is<br />
              <span style={{ color: B.tealPale }}>a dispatcher.</span>
            </h1>
            <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, lineHeight: 1.75, color: 'rgba(255,255,255,0.80)', marginTop: 24, maxWidth: 580 }}>
              For shippers, dispatchers and drivers — post loads, match FMCSA-verified carriers, and track every truck live from pickup to POD.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-10">
              <Link href="/register"
                style={{ background: B.tealDark, fontFamily: BODY, fontSize: T.body, fontWeight: 600, color: B.white, padding: '14px 28px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
                className="hover:opacity-90 transition-opacity">
                Get started free <ArrowRight size={16} />
              </Link>
              <Link href="/carriers"
                style={{ border: '1px solid rgba(255,255,255,0.26)', fontFamily: BODY, fontSize: T.body, fontWeight: 400, color: 'rgba(255,255,255,0.84)', padding: '14px 28px', borderRadius: 6, textDecoration: 'none' }}
                className="hover:bg-white/10 transition-colors">
                Join as a provider
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section style={{ background: B.white }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-14">
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.tealDark }}>How it works</p>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.gray100, marginTop: 10, lineHeight: 1.2 }}>
              Simple enough for anyone.<br />Secure enough for anything.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-0">
            {HOW_STEPS.map((step, i) => (
              <div key={step.n} style={{ borderTop: `3px solid ${i === 0 ? B.tealDark : '#E0E0E0'}`, paddingTop: 20, position: 'relative', paddingRight: 24 }}>
                <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, color: B.tealDark, letterSpacing: '0.08em' }}>{step.n}</p>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: T.h4, color: B.gray100, marginTop: 10, lineHeight: 1.3 }}>{step.title}</h3>
                <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, marginTop: 8, lineHeight: 1.68 }}>{step.desc}</p>
                {i < HOW_STEPS.length - 1 && (
                  <ChevronRight size={16} style={{ position: 'absolute', top: 22, right: 0, color: '#C6C6C6' }} className="hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR SENDERS ──────────────────────────────────────────────────── */}
      <section style={{ background: B.gray10, borderTop: '1px solid #E0E0E0', borderBottom: '1px solid #E0E0E0' }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6 grid md:grid-cols-2 gap-16 items-center">
          <div style={{ background: `linear-gradient(160deg, ${B.darkSec} 0%, ${B.tealDeep} 100%)`, borderRadius: 8, padding: '48px 40px' }}>
            <span style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.teal }}>For Shippers</span>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.white, marginTop: 14, lineHeight: 1.2 }}>
              Your freight deserves<br />more than a load board.
            </h2>
            <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: 'rgba(255,255,255,0.65)', marginTop: 16, lineHeight: 1.75 }}>
              Whether it's a recurring dry van lane, a time-critical hotshot or an oversize equipment move — Shipmater puts a verified, insured, trackable carrier behind every load.
            </p>
            <Link href="/how-it-works"
              style={{ marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: BODY, fontSize: T.body, fontWeight: 600, color: B.teal, textDecoration: 'none' }}
              className="hover:text-white transition-colors">
              See how it works <ArrowRight size={16} />
            </Link>
          </div>
          <div className="space-y-4">
            {SENDER_POINTS.map(pt => (
              <div key={pt} className="flex items-start gap-3">
                <CheckCircle2 size={18} style={{ color: B.tealDark, marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, lineHeight: 1.68 }}>{pt}</p>
              </div>
            ))}
            <div style={{ paddingTop: 12 }}>
              <Link href="/register"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: B.tealDark, fontFamily: BODY, fontSize: T.body, fontWeight: 600, color: B.white, padding: '12px 24px', borderRadius: 6, textDecoration: 'none' }}
                className="hover:opacity-90 transition-opacity">
                Post your first load <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR PROVIDERS ────────────────────────────────────────────────── */}
      <section style={{ background: B.white }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6 grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-4 order-2 md:order-1">
            {PROVIDER_POINTS.map(pt => (
              <div key={pt} className="flex items-start gap-3">
                <CheckCircle2 size={18} style={{ color: B.tealDark, marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, lineHeight: 1.68 }}>{pt}</p>
              </div>
            ))}
            <div style={{ paddingTop: 12 }}>
              <Link href="/register"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `2px solid ${B.tealDark}`, fontFamily: BODY, fontSize: T.body, fontWeight: 600, color: B.tealDark, padding: '12px 24px', borderRadius: 6, textDecoration: 'none' }}
                className="hover:bg-[#E0F7FA] transition-colors">
                Apply as a provider <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <div style={{ background: `linear-gradient(160deg, ${B.darkCard} 0%, ${B.darkSec} 100%)`, borderRadius: 8, padding: '48px 40px' }} className="order-1 md:order-2">
            <span style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.teal }}>For Carriers</span>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.white, marginTop: 14, lineHeight: 1.2 }}>
              More work.<br />Better clients.<br />Less chasing.
            </h2>
            <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: 'rgba(255,255,255,0.65)', marginTop: 16, lineHeight: 1.75 }}>
              Stop waiting for the phone to ring. Get notified the moment a load matching your lanes and equipment is posted. Respond in seconds and build a verified reputation that keeps clients coming back.
            </p>
            <Link href="/carriers"
              style={{ marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: BODY, fontSize: T.body, fontWeight: 600, color: B.teal, textDecoration: 'none' }}
              className="hover:text-white transition-colors">
              Learn more for providers <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ────────────────────────────────────────────────── */}
      <section style={{ background: B.gray10, borderTop: '1px solid #E0E0E0', borderBottom: '1px solid #E0E0E0' }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-14 text-center">
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.tealDark }}>What we offer</p>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.gray100, marginTop: 10 }}>
              Everything a delivery needs to go right
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: '#E0E0E0' }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: B.white, padding: '32px 28px' }}>
                <f.icon size={22} style={{ color: B.tealDark, marginBottom: 14 }} />
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: T.h4, color: B.gray100, marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, lineHeight: 1.68 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE TRACKING ────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(160deg, #051520 0%, ${B.darkSec} 55%, ${B.tealDeep} 100%)`, position: 'relative', overflow: 'hidden' }} className="py-24">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: `linear-gradient(${B.tealMid} 1px, transparent 1px), linear-gradient(90deg, ${B.tealMid} 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
        <div className="relative mx-auto max-w-[1200px] px-6 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.teal }}>Live Tracking</p>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.white, marginTop: 12, lineHeight: 1.2 }}>
              Watch it move.<br />Every mile. In real time.
            </h2>
            <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: 'rgba(255,255,255,0.65)', marginTop: 16, lineHeight: 1.75 }}>
              You never have to wonder. Every location update appears on your live map the moment it happens — across every active delivery, simultaneously.
            </p>
            <div className="mt-8 space-y-3">
              {[
                'Live ETA calculated from current position',
                'Instant alerts at every milestone',
                'Delay detection and automatic notification',
                'Shareable tracking link for recipients',
              ].map(pt => (
                <div key={pt} className="flex items-center gap-3">
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: B.tealMid, flexShrink: 0 }} />
                  <p style={{ fontFamily: BODY, fontSize: T.body, color: 'rgba(255,255,255,0.75)' }}>{pt}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Placeholder — real screenshot goes here */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, aspectRatio: '16/10', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <MapPin size={32} style={{ color: B.tealMid, opacity: 0.5 }} />
            <p style={{ fontFamily: BODY, fontSize: T.label, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.06em' }}>Dashboard screenshot</p>
          </div>
        </div>
      </section>

      {/* ── VETTING ──────────────────────────────────────────────────────── */}
      <section style={{ background: B.white }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-14 text-center">
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.tealDark }}>The vetting standard</p>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.gray100, marginTop: 10 }}>
              Every provider. Every delivery. Verified.
            </h2>
            <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, maxWidth: 540, margin: '16px auto 0', lineHeight: 1.75 }}>
              We don't let providers self-certify. Every credential, every background check and every insurance policy is independently verified before a provider handles their first delivery.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: '#E0E0E0' }}>
            {VETTING.map(c => (
              <div key={c.title} style={{ background: B.white, padding: '36px 32px' }}>
                <div style={{ width: 48, height: 48, background: B.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 20 }}>
                  <c.icon size={22} style={{ color: B.tealDark }} />
                </div>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: T.h4, color: B.gray100, marginBottom: 10 }}>{c.title}</h3>
                <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, lineHeight: 1.70 }}>{c.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32, background: B.tealBg, borderLeft: `4px solid ${B.tealDark}`, borderRadius: 4, padding: '18px 22px' }}>
            <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, lineHeight: 1.68 }}>
              <strong style={{ fontWeight: 600, color: B.gray100 }}>Provider Agreement — </strong>
              Every provider on Shipmater operates under a formal agreement that defines accountability, liability and conduct standards. You're covered before the first mile is driven.
            </p>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section style={{ background: B.tealBg, borderTop: `1px solid #B0DDE8`, borderBottom: `1px solid #B0DDE8` }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-14 text-center">
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.tealDark }}>What they say</p>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.gray100, marginTop: 10 }}>
              Real deliveries. Real peace of mind.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{ background: B.white, border: '1px solid #B0DDE8', borderRadius: 8, padding: '28px 28px', display: 'flex', flexDirection: 'column' }}>
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={14} style={{ color: '#F59E0B' }} fill="#F59E0B" />
                  ))}
                </div>
                <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: B.gray70, lineHeight: 1.75, flex: 1 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E0E0E0' }}>
                  <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: T.body, color: B.gray100 }}>{t.name}</p>
                  <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.label, color: B.gray50, marginTop: 3 }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── THREE ROLES ──────────────────────────────────────────────────── */}
      <section style={{ background: B.white, borderBottom: '1px solid #E0E0E0' }} className="py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mb-14 text-center">
            <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: B.tealDark }}>One platform</p>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, letterSpacing: '-0.02em', color: B.gray100, marginTop: 10 }}>
              Built for everyone in the chain
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: '#E0E0E0' }}>
            {[
              { label: 'Shipper',  role: 'Shipper',  icon: Package, desc: 'Post loads, review verified carriers and track every shipment live from pickup to signed POD.',      cta: 'Start shipping',    href: '/register', bg: B.tealBg   },
              { label: 'Carrier',  role: 'Carrier',  icon: Truck,   desc: 'Dispatchers and drivers browse loads, bid in seconds, build a verified reputation and get paid fast on every delivery.',    cta: 'Apply now',        href: '/register', bg: B.tealDark },
              { label: 'Receiver', role: 'Receiver', icon: MapPin,  desc: 'Track incoming deliveries in real time. Get notified when your delivery is on the way and confirm receipt directly.',   cta: 'Track a delivery', href: '/register', bg: B.gray10   },
            ].map(r => {
              const dark = r.bg === B.tealDark;
              const iconColor  = dark ? 'rgba(255,255,255,0.65)' : B.tealDark;
              const labelColor = dark ? B.tealPale : B.tealDark;
              const headColor  = dark ? B.white    : B.gray100;
              const bodyColor  = dark ? 'rgba(255,255,255,0.70)' : B.gray70;
              const linkColor  = dark ? B.white    : B.tealDark;
              return (
                <div key={r.role} style={{ background: r.bg, padding: '40px 32px', display: 'flex', flexDirection: 'column' }}>
                  <r.icon size={24} style={{ color: iconColor, marginBottom: 18 }} />
                  <p style={{ fontFamily: BODY, fontSize: T.label, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: labelColor, marginBottom: 8 }}>{r.label}</p>
                  <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: T.h3, color: headColor, marginBottom: 14, lineHeight: 1.3 }}>{r.role}</h3>
                  <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: bodyColor, lineHeight: 1.70, flex: 1 }}>{r.desc}</p>
                  <Link href={r.href}
                    style={{ marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: BODY, fontSize: T.body, fontWeight: 600, color: linkColor, textDecoration: 'none' }}
                    className="hover:opacity-75 transition-opacity">
                    {r.cta} <ArrowRight size={15} />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(145deg, ${B.tealDeep} 0%, ${B.tealNavy} 100%)`, position: 'relative', overflow: 'hidden' }} className="py-28">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="relative mx-auto max-w-[1200px] px-6 text-center">
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h1, letterSpacing: '-0.025em', color: B.white, lineHeight: 1.15 }}>
            Ready to move what matters?
          </h2>
          <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, color: 'rgba(255,255,255,0.65)', marginTop: 20, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.75 }}>
            Join thousands already using Shipmater for deliveries that can't wait and can't go wrong. Free to start. No credit card required.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <Link href="/register"
              style={{ background: B.white, fontFamily: BODY, fontSize: T.body, fontWeight: 700, color: B.tealDeep, padding: '16px 36px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
              className="hover:opacity-95 transition-opacity">
              Create free account <ArrowRight size={16} />
            </Link>
            <Link href="/how-it-works"
              style={{ border: '1px solid rgba(255,255,255,0.28)', fontFamily: BODY, fontSize: T.body, fontWeight: 400, color: 'rgba(255,255,255,0.84)', padding: '16px 36px', borderRadius: 6, textDecoration: 'none' }}
              className="hover:bg-white/10 transition-colors">
              See how it works
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
