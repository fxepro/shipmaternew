'use client';

import Link from 'next/link';
import {
  CheckCircle2, ArrowRight, Building2, Sparkles, Truck, Landmark,
  CreditCard, FileText, MapPin, ShieldCheck, ChevronDown,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { T } from '@/lib/type-scale';
import { feesApi } from '@/lib/api';


// ── Design tokens ─────────────────────────────────────────────────────────────
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
  amber:    '#D97706',
};
const BODY = 'var(--font-body)';
const DISPLAY = 'var(--font-display)';

// ── Fees (live from Platform → Fees; these are the fallbacks) ───────────────
// docs/fees-and-billing.md: carriers pay every load fee, shippers pay a tiered subscription, factors are free.

interface Tier { key: string; label: string; max_annual_value: number | null; monthly_price: number }
interface Fees { standard_rate: number; early_rate: number; onboarding_fee: number; tiers: Tier[] }

const DEFAULT_FEES: Fees = {
  standard_rate: 0.10,
  early_rate: 0.075,
  onboarding_fee: 99,
  tiers: [
    { key: 'small',  label: 'Up to $10,000',          max_annual_value: 10000,    monthly_price: 35  },
    { key: 'medium', label: '$10,000 to $10,000,000', max_annual_value: 10000000, monthly_price: 75  },
    { key: 'large',  label: 'Over $10,000,000',       max_annual_value: null,     monthly_price: 199 },
  ],
};

const pct   = (r: number) => `${+(r * 100).toFixed(2)}%`;
const money = (n: number) => `$${n.toLocaleString('en-US')}`;

function faqs(f: Fees) {
  return [
    {
      q: 'Who pays the Shipmater fee on a load?',
      a: `The carrier. The fee is ${pct(f.standard_rate)} of the total load cost, taken out of the load payment before it reaches the carrier. Shippers pay the agreed load price and nothing on top.`,
    },
    {
      q: 'Is there a discount for paying early?',
      a: `Yes, and it's the only one. When the shipper pays at booking instead of at delivery, the fee drops to ${pct(f.early_rate)}.`,
    },
    {
      q: 'How is the shipper subscription priced?',
      a: 'By the value of loads you expect to move through Shipmater in a year. You pick your tier when you subscribe. After 12 months we compare it with what you actually moved and set the right tier for the next year. A subscription is needed to post loads.',
    },
    {
      q: 'Can loads be paid outside Shipmater?',
      a: 'No. Every load is paid through Shipmater, with no exceptions. It keeps everyone protected from payment fraud.',
    },
    {
      q: 'What about factored loads?',
      a: `When a carrier factors a load, the shipper still pays through Shipmater, straight into the factoring company's own Stripe account. The carrier's ${pct(f.standard_rate)} fee applies when the factor pays the carrier. Factoring companies use Shipmater for free.`,
    },
    {
      q: 'Does Shipmater hold my money?',
      a: 'No. Shipmater takes only its fee. Payments go through Stripe to the carrier or factor.',
    },
  ];
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${B.gray20}`, padding: '18px 0' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, gap: 16, textAlign: 'left' }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: B.darkCard, lineHeight: 1.4 }}>{q}</span>
        <ChevronDown size={18} color={B.gray70} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>
      {open && <p style={{ fontSize: 15, color: B.gray70, lineHeight: 1.75, margin: '12px 0 0' }}>{a}</p>}
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = { background: B.white, border: `1.5px solid ${B.gray20}`, borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 };
const cta = (bg: string): React.CSSProperties => ({ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 8, background: bg, color: B.white, fontWeight: 700, fontSize: 14, padding: '12px 20px', borderRadius: 10, textDecoration: 'none' });

function CardHead({ icon: Icon, title, sub, color }: { icon: React.ElementType; title: string; sub: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '18', border: `1.5px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <p style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</p>
        <p style={{ fontSize: 13, color: B.gray70, margin: 0 }}>{sub}</p>
      </div>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((t) => (
        <li key={t} style={{ display: 'flex', gap: 10, fontSize: 14, color: B.darkCard, lineHeight: 1.5 }}>
          <CheckCircle2 size={16} color={B.green} style={{ flexShrink: 0, marginTop: 2 }} />{t}
        </li>
      ))}
    </ul>
  );
}

const INCLUDED = [
  { icon: CreditCard,  label: 'Payments through Stripe' },
  { icon: FileText,    label: 'BOL / POD documents' },
  { icon: MapPin,      label: 'Real-time GPS tracking' },
  { icon: ShieldCheck, label: 'Identity verification' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [fees, setFees] = useState<Fees>(DEFAULT_FEES);
  useEffect(() => {
    feesApi.get().then((r) => setFees(r.data.data as Fees)).catch(() => { /* keep the fallbacks */ });
  }, []);

  return (
    <div style={{ fontFamily: BODY, background: B.white, color: B.darkCard }}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, ${B.tealNavy} 0%, ${B.darkSec} 100%)`, padding: 'clamp(64px, 8vw, 112px) 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(144,224,239,0.12)', border: '1px solid rgba(144,224,239,0.3)', borderRadius: 99, padding: '6px 16px', marginBottom: 24 }}>
            <Sparkles size={14} color={B.teal} />
            <span style={{ fontSize: 12, fontWeight: 600, color: B.teal, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pricing</span>
          </div>
          <h1 style={{ fontSize: T.hero, fontWeight: 700, color: B.white, lineHeight: 1.15, margin: '0 0 20px' }}>
            One fee per load.<br />
            <span style={{ color: B.tealMid }}>A subscription sized to your freight.</span>
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, maxWidth: 600, margin: '0 auto' }}>
            Carriers pay {pct(fees.standard_rate)} per load. Shippers pay a flat monthly subscription based on the freight they move. Factoring companies are free.
          </p>
        </div>
      </section>

      {/* ── Included strip ───────────────────────────────────────────────────── */}
      <section style={{ background: B.tealNavy, borderBottom: '1px solid rgba(144,224,239,0.15)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: B.teal, letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 8 }}>Everyone gets:</span>
          {INCLUDED.map(({ icon: Icon, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(144,224,239,0.1)', border: '1px solid rgba(144,224,239,0.2)', borderRadius: 99, padding: '5px 12px' }}>
              <Icon size={12} color={B.tealMid} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Who pays what ────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(48px, 6vw, 80px) 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 24, alignItems: 'start' }}>

          {/* Shippers */}
          <div style={card}>
            <CardHead icon={Building2} title="Shippers" sub="Monthly subscription" color={B.tealDark} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fees.tiers.map((t) => (
                <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '10px 14px', borderRadius: 10, background: B.gray10 }}>
                  <span style={{ fontSize: 13, color: B.gray70 }}>{t.label} a year</span>
                  <span style={{ fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap' }}>{money(t.monthly_price)}<span style={{ fontSize: 12, fontWeight: 500, color: B.gray70 }}>/mo</span></span>
                </div>
              ))}
            </div>
            <Bullets items={[
              'Nothing added to the load price: the carrier pays the Shipmater fee',
              'Pick your tier by the freight you expect to move in a year',
              'Adjusted to your actual volume after 12 months',
              'Needed to post loads; cancel any time',
            ]} />
            <Link href="/register" style={cta(B.tealDark)}>Sign up as a shipper <ArrowRight size={15} /></Link>
          </div>

          {/* Carriers */}
          <div style={{ ...card, border: `2px solid ${B.tealDark}` }}>
            <CardHead icon={Truck} title="Carriers" sub="Pay only when you move freight" color={B.green} />
            <div>
              <p style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, margin: 0 }}>{pct(fees.standard_rate)}</p>
              <p style={{ fontSize: 13, color: B.gray70, margin: '6px 0 0' }}>of the total load cost, taken from the load payment</p>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: B.green + '12', fontSize: 13, color: B.darkCard }}>
              <strong>{pct(fees.early_rate)}</strong> when the shipper pays at booking
            </div>
            <Bullets items={[
              `${money(fees.onboarding_fee)} one-time onboarding (verification and background check)`,
              'No subscription',
              'Paid through Stripe; Shipmater never holds your money',
              'Factor a load and the factor is paid directly',
            ]} />
            <Link href="/register" style={cta(B.green)}>Sign up as a carrier <ArrowRight size={15} /></Link>
          </div>

          {/* Factors */}
          <div style={card}>
            <CardHead icon={Landmark} title="Factoring companies" sub="Free" color={B.amber} />
            <div>
              <p style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, margin: 0 }}>$0</p>
              <p style={{ fontSize: 13, color: B.gray70, margin: '6px 0 0' }}>no fees, no subscription</p>
            </div>
            <Bullets items={[
              'Confirm NOAs and the loads you fund',
              'Shippers pay factored loads into your own Stripe account',
              'See every load you fund in one place',
            ]} />
            <Link href="/register" style={cta(B.darkCard)}>Sign up as a factor <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section style={{ background: B.gray10, padding: 'clamp(48px, 6vw, 80px) 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontSize: T.h2, fontWeight: 700, color: B.darkCard, textAlign: 'center', margin: '0 0 8px' }}>Frequently asked questions</h2>
          <p style={{ fontSize: 16, color: B.gray70, textAlign: 'center', margin: '0 0 40px' }}>
            Have a question not listed here? <a href="/contact" style={{ color: B.tealDark, textDecoration: 'none', fontWeight: 600 }}>Contact us</a>.
          </p>
          <div>
            {faqs(fees).map((faq) => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, ${B.tealNavy} 0%, ${B.darkSec} 100%)`, padding: 'clamp(48px, 6vw, 80px) 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: T.h2, fontWeight: 700, color: B.white, margin: '0 0 16px' }}>Ready to get started?</h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: '0 0 36px' }}>
            Small shippers start at {money(fees.tiers[0]?.monthly_price ?? 35)} a month. Carriers pay only when they move freight.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: B.tealMid, color: B.tealNavy, fontWeight: 700, fontSize: 15, padding: '13px 30px', borderRadius: 10, textDecoration: 'none' }}>
              Create an account <ArrowRight size={16} />
            </Link>
            <Link href="/contact?intent=sales" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: B.white, fontWeight: 600, fontSize: 15, padding: '13px 30px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.25)', textDecoration: 'none' }}>
              Talk to sales
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
