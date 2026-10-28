'use client';

import Link from 'next/link';
import {
  ArrowRight, Search, ShieldCheck, MapPin, CreditCard, FileText,
  Users, BarChart2, Package, Clock, Building2, CheckCircle2,
  BadgeCheck, Lock,
} from 'lucide-react';
import { MarketingHub } from '@/components/marketing/MarketingHub';
import { SHIPPER_HUB } from '@/lib/marketing/hub-links';
import { T } from '@/lib/type-scale';


// ── Palette & scale (matches marketing system) ────────────────────────────────
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
    title: 'Post your shipment',
    desc: 'Describe what you need moved, select the service type, add pickup and delivery addresses, and set your timeline. Takes under two minutes.',
  },
  {
    n: '02',
    title: 'Choose your provider',
    desc: 'Post to the open market and let verified providers bid, or assign directly from your preferred network. Filter by service type, location and certifications.',
  },
  {
    n: '03',
    title: 'Track it live',
    desc: 'Follow your delivery on a real-time map with live GPS. You and your receiver see the same view — pickup confirmed, route shown, ETA live.',
  },
  {
    n: '04',
    title: 'Pay on delivery',
    desc: 'Funds are held in escrow when the provider is assigned. Released automatically on delivery confirmation. Dispute resolution built in.',
  },
];

const FEATURES = [
  {
    icon: Search,
    title: 'Find the right provider',
    desc: 'Search by service type, location, certifications and verification status. Every provider profile shows their rating, deliveries and what they transport.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified providers only',
    desc: 'Every provider on the platform has credentials, insurance and background verified before accepting a single delivery. No exceptions.',
  },
  {
    icon: MapPin,
    title: 'Live GPS tracking',
    desc: 'Real-time provider position on a live map. Route polyline, ETA and every ping stored. Your receiver gets the same view automatically.',
  },
  {
    icon: CreditCard,
    title: 'Escrow payment protection',
    desc: 'Funds are held in escrow and only released on delivery confirmation. Full dispute resolution if something goes wrong.',
  },
  {
    icon: FileText,
    title: 'Priority arrangements',
    desc: 'Lock in rates with trusted providers on recurring lanes. Set flat or per-load rates. Contracted jobs dispatch directly with no bidding friction.',
  },
  {
    icon: Users,
    title: 'Multi-user organisation',
    desc: 'Invite your team. Dispatchers create and manage jobs. Managers review reporting. Admins control settings and billing.',
  },
  {
    icon: BarChart2,
    title: 'Full delivery history',
    desc: 'Every delivery — active, completed, or disputed — stays in your account permanently. Export records for compliance and accounting.',
  },
  {
    icon: Package,
    title: 'Any trailer type',
    desc: 'Dry van, reefer, flatbed, hotshot, hazmat, auto transport and heavy haul. Match the right carrier to every load.',
  },
];

const INDUSTRIES = [
  { label: 'Auto & Dealerships',           href: '/industries/auto-dealerships' },
  { label: 'Food & Beverage',              href: '/industries/food-beverage' },
  { label: 'Construction & Equipment',     href: '/industries/construction-equipment' },
  { label: 'Retail & E-Commerce',          href: '/industries/retail-ecommerce' },
  { label: 'Manufacturing',                href: '/industries/manufacturing' },
  { label: 'Government & Public Sector',   href: '/industries/government' },
];

const VETTING = [
  { icon: BadgeCheck, title: 'Credential verification',  desc: 'Licences, certifications and insurance certificates independently verified before a provider can accept any delivery.' },
  { icon: ShieldCheck, title: 'Background checked',       desc: 'All providers complete a full background check and relevant clearance queries as part of onboarding. No self-certification.' },
  { icon: Lock,        title: 'Formal provider agreement', desc: 'Every provider operates under a formal agreement defining accountability, liability and conduct on every engagement.' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShippersPage() {
  return (
    <div style={{ fontFamily: BODY, WebkitFontSmoothing: 'antialiased', background: B.white }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(145deg, ${B.tealNavy} 0%, ${B.tealDark} 55%, ${B.teal} 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="relative mx-auto max-w-[1200px] px-6 pt-24 pb-24 text-center">
          <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: T.label, letterSpacing: '0.12em', textTransform: 'uppercase', color: B.tealPale, marginBottom: 20 }}>
            For Shippers
          </p>
          <h1 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.hero, lineHeight: 1.07, letterSpacing: '-0.025em', color: B.white, maxWidth: 760, margin: '0 auto' }}>
            Ship anything.<br />
            <span style={{ color: B.tealPale }}>Track it live.</span><br />
            Pay only on delivery.
          </h1>
          <p style={{ fontFamily: BODY, fontWeight: 400, fontSize: T.body, lineHeight: 1.75, color: 'rgba(255,255,255,0.80)', marginTop: 24, maxWidth: 600, margin: '24px auto 0' }}>
            Shipmater connects you to verified providers across every service type — from dry van and reefer to flatbed and heavy haul. Post a load in minutes, track it in real time, pay with escrow protection.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <Link href="/register"
              style={{ background: B.tealDark, fontFamily: BODY, fontSize: T.body, fontWeight: 600, color: B.white, padding: '13px 28px', borderRadius: 6, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              className="hover:opacity-90 transition-opacity">
              Start shipping free <ArrowRight size={16} />
            </Link>
            <Link href="/how-it-works"
              style={{ fontFamily: BODY, fontSize: T.body, fontWeight: 500, color: 'rgba(255,255,255,0.80)', padding: '13px 24px', borderRadius: 6, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.25)', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              className="hover:border-white hover:text-white transition-colors">
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ────────────────────────────────────────────────────── */}
      <section style={{ background: B.white, borderBottom: `1px solid ${B.gray10}` }}>
        <div className="mx-auto max-w-[1200px] px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: '8',    label: 'Service categories' },
            { value: '37+',  label: 'Freight types' },
            { value: '100%', label: 'Provider verification' },
            { value: '5s',   label: 'GPS update interval' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p style={{ fontFamily: BODY, fontWeight: 700, fontSize: T.h2, color: B.tealDark }}>{value}</p>
              <p style={{ fontFamily: BODY, fontSize: T.label, color: B.gray50, marginTop: 4 }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      <MarketingHub heading="Shippers" pages={SHIPPER_HUB.map(p => ({ ...p, active: p.href === '/shippers' }))} />

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section style={{ background: B.gray10 }}>
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.tealDark, textAlign: 'center', marginBottom: 12 }}>
            Process
          </p>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, color: B.gray100, textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 56 }}>
            From post to delivery in four steps
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} style={{ background: B.white, borderRadius: 8, padding: '28px 24px', border: `1px solid rgba(0,150,199,0.12)` }}>
                <p style={{ fontFamily: BODY, fontWeight: 700, fontSize: T.h2, color: B.tealBg, lineHeight: 1, marginBottom: 16 }}>{n}</p>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: T.h4, color: B.gray100, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontFamily: BODY, fontSize: T.body, color: B.gray70, lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section style={{ background: B.white }}>
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.tealDark, textAlign: 'center', marginBottom: 12 }}>
            Features
          </p>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, color: B.gray100, textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 56 }}>
            Everything a shipper needs
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ background: B.gray10, borderRadius: 8, padding: '24px 22px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: B.tealBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon size={18} color={B.tealDark} />
                </div>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: T.h4, color: B.gray100, marginBottom: 8 }}>{title}</h3>
                <p style={{ fontFamily: BODY, fontSize: T.body, color: B.gray70, lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VETTING ──────────────────────────────────────────────────────── */}
      <section style={{ background: B.darkSec }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.teal, textAlign: 'center', marginBottom: 12 }}>
            Trust & Safety
          </p>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, color: B.white, textAlign: 'center', letterSpacing: '-0.02em', marginBottom: 48 }}>
            Who's handling your delivery
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {VETTING.map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '28px 24px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Icon size={24} color={B.teal} style={{ marginBottom: 16 }} />
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: T.h4, color: B.white, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontFamily: BODY, fontSize: T.body, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ───────────────────────────────────────────────────── */}
      <section style={{ background: B.tealBg }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20 text-center">
          <Building2 size={28} color={B.tealDark} style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, color: B.gray100, letterSpacing: '-0.02em', marginBottom: 32 }}>
            Built for your industry
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {INDUSTRIES.map(i => (
              <Link key={i.href} href={i.href} style={{ fontFamily: BODY, fontSize: T.body, color: B.gray70, background: B.white, border: `1px solid rgba(0,150,199,0.20)`, borderRadius: 999, padding: '8px 18px', textDecoration: 'none' }}
                className="hover:border-[#0096C7] hover:text-[#0096C7] transition-colors">
                {i.label}
              </Link>
            ))}
          </div>
          <p style={{ fontFamily: BODY, fontSize: T.body, color: B.gray70, marginTop: 28 }}>
            <Link href="/industries" style={{ color: B.tealDark, textDecoration: 'none', fontWeight: 500 }}>
              See industry-specific details →
            </Link>
          </p>
        </div>
      </section>

      {/* ── REGULATED FREIGHT CALLOUT ────────────────────────────────────────────────── */}
      <section style={{ background: B.white, borderTop: `1px solid ${B.gray10}` }}>
        <div className="mx-auto max-w-[1200px] px-6 py-16">
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '28px 32px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <ShieldCheck size={24} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontFamily: BODY, fontWeight: 600, fontSize: T.h4, color: '#14532d', marginBottom: 8 }}>Built for regulated freight</p>
              <p style={{ fontFamily: BODY, fontSize: T.body, color: '#166534', lineHeight: 1.65 }}>
                If you ship hazmat, high-value or temperature-controlled freight, Shipmater checks FMCSA authority, insurance and endorsements, logs GPS custody at every stop, and can restrict loads to contracted carrier pools.{' '}
                <Link href="/compliance" style={{ color: '#16a34a', fontWeight: 500 }}>Read our compliance page</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, ${B.tealNavy} 0%, ${B.darkSec} 100%)` }}>
        <div className="mx-auto max-w-[1200px] px-6 py-24 text-center">
          <Clock size={36} color={B.teal} style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: T.h2, color: B.white, letterSpacing: '-0.02em', marginBottom: 16 }}>
            Post your first shipment today
          </h2>
          <p style={{ fontFamily: BODY, fontSize: T.body, color: 'rgba(255,255,255,0.70)', marginBottom: 36, maxWidth: 440, margin: '0 auto 36px' }}>
            No setup fee. No monthly minimum. Pay only when a provider is assigned.
          </p>
          <Link href="/register"
            style={{ background: B.tealDark, fontFamily: BODY, fontSize: T.body, fontWeight: 600, color: B.white, padding: '14px 32px', borderRadius: 6, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            className="hover:opacity-90 transition-opacity">
            Create free shipper account <ArrowRight size={16} />
          </Link>
        </div>
      </section>

    </div>
  );
}
