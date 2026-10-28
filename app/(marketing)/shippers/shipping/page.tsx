'use client';

import Link from 'next/link';
import {
  ArrowRight, Package, ClipboardList, Route, FileText,
  MapPin, Users, Layers, CheckCircle2, Building2, Clock,
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
};
const BODY = 'var(--font-body)';
const DISPLAY = 'var(--font-display)';

const STATS = [
  { value: '<2 min', label: 'Average time to post' },
  { value: '3',      label: 'Dispatch modes' },
  { value: '37+',    label: 'Freight & service types' },
  { value: '∞',      label: 'Stops per route' },
];

const MODES = [
  {
    icon: ClipboardList,
    title: 'Open market',
    desc: 'Post a load to the verified carrier network. Receive competitive bids filtered by equipment, service type, and operating region. Compare rates, ratings, and credentials before you assign.',
    bullets: ['Itemised quotes with base rate and accessorials', 'Bid expiry and counter-offer support', 'Preferred carrier shortlists'],
    color: B.tealDeep,
  },
  {
    icon: FileText,
    title: 'Contracted lanes',
    desc: 'Lock in rates with carriers you trust on recurring lanes. Set flat or per-load pricing, dispatch without re-bidding, and keep volume moving on predictable schedules.',
    bullets: ['Flat-rate or per-mile contracted pricing', 'Direct dispatch to approved carrier pools', 'Archive and renew lane agreements'],
    color: B.tealNavy,
  },
  {
    icon: Route,
    title: 'Multi-stop routes',
    desc: 'Build pickup and delivery sequences across several stops. Optimise stop order, assign one carrier to the full route, and track progression stop by stop.',
    bullets: ['Drag-and-drop stop sequencing', 'OSRM real-road distance estimates', 'Per-stop status and GPS milestones'],
    color: B.tealDark,
  },
];

const WORKFLOW = [
  { n: '01', title: 'Describe the load', desc: 'Cargo type, dimensions, weight, service requirements, and handling notes — captured once and reused across your organisation.' },
  { n: '02', title: 'Set pickup & delivery', desc: 'Addresses from your saved location book or ad hoc entry. Date windows, access instructions, and contact details per stop.' },
  { n: '03', title: 'Choose how to dispatch', desc: 'Open market for competitive bids, contracted lane for known carriers, or multi-stop builder for complex routes.' },
  { n: '04', title: 'Assign and go', desc: 'Carrier accepts, escrow funds on assignment, and live tracking begins at pickup confirmation.' },
];

const CAPABILITIES = [
  { icon: Layers,    title: 'Service type matching', desc: 'Dry van, reefer, flatbed, hotshot, hazmat, auto transport, heavy haul and more — carriers only see loads they are equipped to haul.' },
  { icon: MapPin,    title: 'Saved locations',       desc: 'Organisation-wide address book for warehouses, docks, clinics, and job sites. Pre-fill pickup on every new shipment.' },
  { icon: Users,     title: 'Team permissions',      desc: 'Dispatchers post and manage jobs. Managers review activity. Admins control billing, compliance docs, and org settings.' },
  { icon: Building2, title: 'Internal references',   desc: 'PO numbers, cost centres, and job codes attached to every shipment for accounting and audit trails.' },
];

const SERVICE_TYPES = [
  'General freight', 'Refrigerated', 'Flatbed & heavy haul', 'Dry van',
  'Hotshot / expedited', 'Hazmat', 'Auto transport', 'Oversize / wide load',
];

export default function ShippersShippingPage() {
  return (
    <div style={{ fontFamily: BODY, WebkitFontSmoothing: 'antialiased', background: B.white }}>

      {/* Hero */}
      <section style={{ background: `linear-gradient(145deg, ${B.tealNavy} 0%, ${B.tealDark} 55%, ${B.teal} 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="relative mx-auto max-w-[1200px] px-6 pt-24 pb-24 text-center">
          <p style={{ fontWeight: 600, fontSize: T.label, letterSpacing: '0.12em', textTransform: 'uppercase', color: B.tealPale, marginBottom: 20 }}>
            Shipping & Lanes
          </p>
          <h1 style={{ fontWeight: 700, fontSize: T.hero, lineHeight: 1.07, letterSpacing: '-0.025em', color: B.white, maxWidth: 800, margin: '0 auto' }}>
            Post once.<br />
            <span style={{ color: B.tealPale }}>Run open market, contracted, or multi-stop.</span>
          </h1>
          <p style={{ fontSize: T.body, lineHeight: 1.75, color: 'rgba(255,255,255,0.80)', marginTop: 24, maxWidth: 640, margin: '24px auto 0' }}>
            Single load, locked-in lane, or a six-stop route — Shipmater gives shippers one workflow for every dispatch model. Post in under two minutes and assign verified carriers on your terms.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <Link href="/register"
              style={{ background: B.tealDark, fontSize: T.body, fontWeight: 600, color: B.white, padding: '13px 28px', borderRadius: 6, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              className="hover:opacity-90 transition-opacity">
              Create free shipper account <ArrowRight size={16} />
            </Link>
            <Link href="/shippers"
              style={{ fontSize: T.body, fontWeight: 500, color: 'rgba(255,255,255,0.80)', padding: '13px 24px', borderRadius: 6, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.25)', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              className="hover:border-white hover:text-white transition-colors">
              Shipper overview
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ background: B.white, borderBottom: `1px solid ${B.gray10}` }}>
        <div className="mx-auto max-w-[1200px] px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <p style={{ fontWeight: 700, fontSize: T.h2, color: B.tealDark }}>{value}</p>
              <p style={{ fontSize: T.label, color: B.gray50, marginTop: 4 }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      <MarketingHub heading="Shippers" pages={SHIPPER_HUB.map(p => ({ ...p, active: p.href === '/shippers/shipping' }))} />

      {/* Intro */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(48px, 6vw, 72px) 24px', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.tealDark, marginBottom: 12 }}>Dispatch models</p>
        <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.gray100, margin: '0 0 16px' }}>One platform, three ways to move freight</h2>
        <p style={{ fontSize: T.body, color: B.gray70, lineHeight: 1.75 }}>
          Spot market volatility, dedicated lanes, and complex stop sequences do not belong in separate tools.
          Shipmater unifies posting, bidding, contracting, and route building so your team dispatches from a single system of record.
        </p>
      </section>

      {/* Modes */}
      <section style={{ background: B.gray10 }}>
        <div className="mx-auto max-w-[1200px] px-6 pb-24">
          <div className="grid lg:grid-cols-3 gap-6">
            {MODES.map(({ icon: Icon, title, desc, bullets, color }) => (
              <div key={title} style={{ background: B.white, borderRadius: 12, padding: '28px 26px', border: `1px solid ${B.gray20}` }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: color + '14', border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <Icon size={22} color={color} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: T.h3, color: B.gray100, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: T.body, color: B.gray70, lineHeight: 1.65, marginBottom: 16 }}>{desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {bullets.map(b => (
                    <div key={b} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <CheckCircle2 size={14} color={color} style={{ marginTop: 3, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: B.gray70, lineHeight: 1.5 }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section style={{ background: B.white }}>
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <p style={{ fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.tealDark, textAlign: 'center', marginBottom: 12 }}>Workflow</p>
          <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.gray100, textAlign: 'center', marginBottom: 56 }}>From description to assigned carrier</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WORKFLOW.map(({ n, title, desc }) => (
              <div key={n} style={{ background: B.gray10, borderRadius: 8, padding: '28px 24px', border: '1px solid rgba(0,150,199,0.12)' }}>
                <p style={{ fontWeight: 700, fontSize: T.h2, color: B.tealBg, lineHeight: 1, marginBottom: 16 }}>{n}</p>
                <h3 style={{ fontWeight: 600, fontSize: T.h4, color: B.gray100, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: T.body, color: B.gray70, lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section style={{ background: B.darkSec }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <p style={{ fontWeight: 600, fontSize: T.label, letterSpacing: '0.10em', textTransform: 'uppercase', color: B.teal, textAlign: 'center', marginBottom: 12 }}>Built in</p>
          <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.white, textAlign: 'center', marginBottom: 48 }}>Everything dispatch needs behind the post</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {CAPABILITIES.map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '28px 24px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Icon size={22} color={B.teal} style={{ marginBottom: 14 }} />
                <h3 style={{ fontWeight: 600, fontSize: T.h4, color: B.white, marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: T.body, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service types */}
      <section style={{ background: B.tealBg }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20 text-center">
          <Package size={28} color={B.tealDark} style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.gray100, marginBottom: 32 }}>Match the right equipment to every job</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {SERVICE_TYPES.map(s => (
              <span key={s} style={{ fontSize: T.body, color: B.gray70, background: B.white, border: '1px solid rgba(0,150,199,0.20)', borderRadius: 999, padding: '8px 18px' }}>{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: `linear-gradient(135deg, ${B.tealNavy} 0%, ${B.darkSec} 100%)` }}>
        <div className="mx-auto max-w-[1200px] px-6 py-24 text-center">
          <Clock size={36} color={B.teal} style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontWeight: 700, fontSize: T.h2, color: B.white, marginBottom: 16 }}>Post your first shipment today</h2>
          <p style={{ fontSize: T.body, color: 'rgba(255,255,255,0.70)', marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            No setup fee. Open market, contracted lanes, and multi-stop routing included from day one.
          </p>
          <Link href="/register"
            style={{ background: B.tealDark, fontSize: T.body, fontWeight: 600, color: B.white, padding: '14px 32px', borderRadius: 6, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            className="hover:opacity-90 transition-opacity">
            Create free shipper account <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
