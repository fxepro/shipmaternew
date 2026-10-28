import {
  Package, MapPin, ShieldCheck, ClipboardList,
  Briefcase, DollarSign, Globe, UserCircle2, Lock,
  Building2, Truck, HardHat, Car,
  Globe2, Flag, Table2,
} from 'lucide-react';
import type { HubPage } from '@/components/marketing/MarketingHub';

export const SHIPPER_HUB: HubPage[] = [
  { icon: Package,       title: 'Overview',          desc: 'You are here — ship anything, track live, pay on delivery.',              href: '/shippers',            active: true },
  { icon: ClipboardList, title: 'Shipping & Lanes',  desc: 'Post shipments, multi-stop routes, and contracted lanes.',               href: '/shippers/shipping' },
  { icon: MapPin,        title: 'Tracking & Pay',    desc: 'Live GPS, escrow payments, and delivery confirmation.',                  href: '/shippers/tracking' },
  { icon: ShieldCheck,   title: 'Verified Carriers', desc: 'Every carrier vetted — identity, authority, background, human review.',  href: '/shippers/trust' },
];

export const CARRIER_HUB: HubPage[] = [
  { icon: Briefcase,   title: 'Overview',       desc: 'You are here — drive more loads, get paid faster.',                   href: '/carriers',                  active: true },
  { icon: DollarSign,  title: 'Earnings',       desc: 'Job board, bids, escrow payouts, and ratings.',                     href: '/carriers/earnings' },
  { icon: ShieldCheck, title: 'Trust & Safety', desc: '5-layer carrier verification before any load is assigned.',           href: '/carrier-trust' },
  { icon: Globe,       title: 'International',  desc: 'Register from 100+ countries — credentials adapt to your market.',  href: '/international-carriers' },
];

export const HOW_IT_WORKS_HUB: HubPage[] = [
  { icon: ClipboardList, title: 'Overview',     desc: 'You are here — the full Shipmater workflow end to end.',            href: '/how-it-works',       active: true },
  { icon: Package,       title: 'Post & Match', desc: 'Describe your shipment and get quotes from vetted providers.',     href: '/how-it-works/post' },
  { icon: MapPin,        title: 'Track Live',   desc: 'GPS from pickup through delivery — alerts at every milestone.',    href: '/how-it-works/track' },
  { icon: Lock,          title: 'Pay Securely', desc: 'Escrow holds funds until delivery is confirmed by both parties.',  href: '/how-it-works/pay' },
];

/** Use Cases hub — leave as-is (overview + existing use-case pages). */
export const USE_CASES_HUB: HubPage[] = [
  { icon: Building2,   title: 'All Use Cases',  desc: 'You are here — browse every use case Shipmater serves.',                href: '/use-cases',                    active: true },
  { icon: Truck,       title: 'Freight',        desc: 'FTL, LTL, hotshot, multi-stop routes, and heavy haul.',               href: '/use-cases/freight-logistics' },
  { icon: HardHat,     title: 'Construction',   desc: 'Heavy equipment, oversize loads, permits and flatbed matching.',     href: '/use-cases/construction' },
  { icon: Car,         title: 'Auto Transport', desc: 'VIN logging, condition photos, dealer and private moves.',          href: '/use-cases/auto-transport' },
];

export const INTERNATIONAL_HUB: HubPage[] = [
  { icon: Globe2,      title: 'Global Overview',        desc: 'You are here — freight without borders across USMCA and beyond.',         href: '/global',                 active: true },
  { icon: Flag,        title: 'USMCA',                  desc: 'US, Canada & Mexico — compliance, docs, and payouts per country.',       href: '/usmca' },
  { icon: Table2,      title: 'Country Coverage',       desc: 'GPS, identity, background checks, and payouts — what works where.',      href: '/coverage' },
  { icon: UserCircle2, title: 'International Carriers', desc: 'Register from anywhere. Credentials and payouts adapt to your country.', href: '/international-carriers' },
];
