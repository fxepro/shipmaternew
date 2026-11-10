import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Package, Briefcase, Truck, DollarSign, BarChart2, User,
} from 'lucide-react';

export type ManualAudience = 'shipper' | 'carrier';

export interface ManualSubtopic {
  id: string;
  title: string;
  /** ~50-word lead */
  summary: string;
  /** Capability-specific bullets */
  bullets: string[];
  href?: string;
  /** Rich customer guide (tabs + matrices) */
  guideKey?: 'shipper-profile' | 'carrier-profile';
}

export interface ManualTopic {
  slug: string;
  title: string;
  /** ~50-word lead */
  summary: string;
  /** Capability-specific bullets */
  bullets: string[];
  icon: LucideIcon;
  href?: string;
  subtopics: ManualSubtopic[];
}

export const SHIPPER_TOPICS: ManualTopic[] = [
  {
    slug: 'overview',
    title: 'Overview',
    summary:
      'Home after login. A status board for what needs attention now—open work, alerts, and shortcuts—so you jump into the right page without scanning the whole sidebar.',
    bullets: [
      'See open shipments, jobs, and offers at a glance',
      'Spot alerts that need action today',
      'Jump straight into Shipments, Jobs, or Offers',
    ],
    icon: LayoutDashboard,
    subtopics: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        href: '/shipper',
        summary:
          'The Overview landing page. Scan company freight health, then open the record that needs work. It orients you; detailed create/edit work lives in the other sections.',
        bullets: [
          'View summary cards for active freight and pending decisions',
          'Open linked shipments, jobs, or offers from an alert',
          'Return here after login or mid-day for a fresh priority list',
        ],
      },
    ],
  },
  {
    slug: 'shipments',
    title: 'Shipments',
    summary:
      'Operational home for freight you own: list moves, plan multi-stop routes, and watch loads in transit. Use this when the question is about the physical move—not bidding or billing.',
    bullets: [
      'List and open every shipment for your organization',
      'Plan multi-stop routes before you post',
      'Track in-progress loads on a live map',
      'Share public tracking links when a token exists',
    ],
    icon: Package,
    subtopics: [
      {
        id: 'my-shipments',
        title: 'Shipments',
        href: '/shipper/shipments',
        summary:
          'Every load, from draft to delivered, with Draft, Posted, Booked, In transit and Delivered tabs. Drafts and posted loads open the load page; booked ones open tracking, documents and delivery. Brokers see this page as Loads.',
        bullets: [
          'Filter and scan shipments by status',
          'Open a shipment for stops, carrier, and history',
          'Check assignment and delivery outcome on a single move',
          'Follow up on exceptions without leaving the list workflow',
        ],
      },
      {
        id: 'route-planner',
        title: 'Route Planner',
        href: '/shipper/route-planner',
        summary:
          'Design multi-stop itineraries before you commit. Geocode stops, review distance and time, then reuse the plan on a shipment or job.',
        bullets: [
          'Add and order multiple stops on one run',
          'Geocode addresses and validate locations',
          'Review distance and estimated time',
          'Carry a planned route into a shipment or job',
        ],
      },
      {
        id: 'live-tracking',
        title: 'Live Tracking',
        href: '/shipper/tracking',
        summary:
          'Map view of loads that are moving and reporting GPS. Use it for “where is it now?” and to share progress with receivers.',
        bullets: [
          'See in-transit loads on a map',
          'Monitor carrier GPS updates in real time',
          'Open a load’s tracking context from the map',
          'Share a public tracking link when available',
        ],
      },
    ],
  },
  {
    slug: 'jobs',
    title: 'Freight',
    summary:
      'Get loads moving: post a load to the Marketplace or tender it to a contract carrier, decide on offers, and keep your carrier contracts.',
    bullets: [
      'Post a load to the Marketplace (spot) or to a contract carrier',
      'Accept or decline Marketplace offers',
      'Tender contract freight at your agreed rates',
      'Keep the contracts those rates come from',
    ],
    icon: Briefcase,
    subtopics: [
      {
        id: 'rate-check',
        title: 'Rate check',
        href: '/shipper/rate-check',
        summary:
          'See the market range for a lane before you post: low, typical and high, worked out from road miles, a per-mile rate for the equipment, the weekly diesel price and extras such as hazmat or extra stops. Once a lane has enough completed loads on Shipmater, their rates are blended in. The same range appears in the rate step of Post a load, where you set the posted rate carriers see.',
        bullets: [
          'Enter origin, destination, equipment and extras',
          'Use the typical figure as the posted rate, or set your own',
          'Offers show how far above or below market they are',
          'Recent checks are kept for your company',
        ],
      },
      {
        id: 'create-job',
        title: 'Post a load',
        href: '/shipper/jobs/contracted/new',
        summary:
          'Build a load with its pickups, drop-offs, freight and terms, then post it to the Marketplace for offers or tender it to a carrier you have a contract with.',
        bullets: [
          'Enter stops, freight, equipment and timing',
          'Marketplace: set the terms carriers make offers on',
          'Contract carrier: pick the contract and its rate',
          'Reuse saved locations on the form',
        ],
      },
      {
        id: 'offers',
        title: 'Offers',
        href: '/shipper/jobs/offers',
        summary:
          'Offers carriers have made on your Marketplace loads. Accept one to book that carrier; decline the rest.',
        bullets: [
          'Review offers on your Marketplace loads',
          'Compare rate and service on each offer',
          'Accept an offer to book the carrier',
          'Decline offers you will not take',
        ],
      },
      {
        id: 'contracted',
        title: 'Contract freight',
        href: '/shipper/jobs/contracted',
        summary:
          'Loads tendered to your contract carriers at agreed rates, with no Marketplace offers. Repeat lanes without pricing each load again.',
        bullets: [
          'See loads tendered under carrier contracts',
          'Use contract rates (per mile, flat, hourly)',
          'Tender repeat lanes quickly',
          'Keep contract freight apart from Marketplace loads',
        ],
      },
    ],
  },
  {
    slug: 'network',
    title: 'Network',
    summary:
      'Reference information: the carriers and receivers you work with and your saved locations. Contracts are under Freight.',
    bullets: [
      'Find and prefer carriers',
      'Store standing rate contracts',
      'Save pickup (ship-from) addresses',
      'Save delivery (consignee) addresses',
    ],
    icon: Truck,
    subtopics: [
      {
        id: 'carriers',
        title: 'Carriers',
        href: '/shipper/carriers',
        summary:
          'Directory of haulers you can work with. Review partners, set preferences, and see platform verification signals on the carrier side.',
        bullets: [
          'Browse and search carriers on the platform',
          'Mark or manage preferred carriers',
          'View carrier verification badges',
          'Support cleaner tenders and contracted relationships',
        ],
      },
      {
        id: 'contracts',
        title: 'Contracts',
        href: '/shipper/contracts',
        summary:
          'Standing commercial agreements with preferred carriers. Source of truth for rates used when tendering contract freight.',
        bullets: [
          'Create and maintain rate agreements',
          'Store per-mile, flat, hourly, or similar terms',
          'Tie preferred pricing to contracted job posting',
          'Update or retire agreements when pricing changes',
        ],
      },
      {
        id: 'pickup-addresses',
        title: 'Pickup Addresses',
        href: '/shipper/locations?type=pickup',
        summary:
          'Saved ship-from facilities and contacts. Reuse them on jobs and shipments instead of retyping origins.',
        bullets: [
          'Add and edit ship-from locations',
          'Store dock contacts and site details',
          'Reuse pickups when you post a load',
          'Retire obsolete origins so they are not selected by mistake',
        ],
      },
      {
        id: 'delivery-addresses',
        title: 'Delivery Addresses',
        href: '/shipper/locations',
        summary:
          'Saved consignee and destination facilities. Keeps ship-tos consistent for posting, planning, and tracking.',
        bullets: [
          'Add and edit delivery / consignee locations',
          'Store receiving contacts and site details',
          'Reuse destinations on jobs and shipments',
          'Keep geocodable addresses for planning and tracking',
        ],
      },
    ],
  },
  {
    slug: 'financials',
    title: 'Financials',
    summary:
      'Billing section for your organization. Use Payments for invoices, transaction history, and outstanding freight charges—not for adding cards (that’s Profile under Account).',
    bullets: [
      'Payments — invoices, billing history, and pay status',
    ],
    icon: DollarSign,
    subtopics: [
      {
        id: 'payments',
        title: 'Payments',
        href: '/shipper/payments',
        summary:
          'Invoices, transactions, and billing history for freight charges. Review what you owe or paid; manage saved cards under Profile.',
        bullets: [
          'See total paid, outstanding, this month, and avg per shipment',
          'Browse invoices by shipment, carrier, amount, and status',
          'Filter paid / pending / processing / failed / refunded',
          'Open a transaction for payment, shipment, and carrier detail',
          'Export CSV or download invoice PDF from the page',
        ],
      },
    ],
  },
  {
    slug: 'reports',
    title: 'Reports',
    summary:
      'Analytics for volume, spend, and performance across many moves—trends and reviews, not live truck location or invoice detail.',
    bullets: [
      'View operational summaries for your org',
      'Review spend and volume over time',
      'Spot performance patterns across lanes and partners',
      'Open report views as they ship',
    ],
    icon: BarChart2,
    href: '/shipper/reports',
    subtopics: [],
  },
  {
    slug: 'account',
    title: 'Account',
    summary:
      'Your company’s settings on the platform. Open Profile for contacts, business details, payment methods, compliance docs, notifications, team, and verification.',
    bullets: [
      'Profile — all account settings tabs in one place',
    ],
    icon: User,
    subtopics: [
      {
        id: 'profile',
        title: 'Profile',
        href: '/shipper/profile',
        summary:
          'Account Settings for your shipper organization. Use the tabs below to keep identity, billing methods, and verification up to date. Invoice history is under Financials → Payments.',
        bullets: [
          'Eight tabs: Profile, Business, Services, Compliance, Payment, Subscription, Notifications, Team',
          'Amber banner lists missing Profile + Business fields',
          'Verify email and phone before submitting business verification',
          'Save payment methods on the Payment tab; invite teammates on Team',
        ],
        guideKey: 'shipper-profile',
      },
    ],
  },
];

export const CARRIER_TOPICS: ManualTopic[] = [
  {
    slug: 'overview',
    title: 'Overview',
    summary:
      'Carrier home after login. See available freight signals, active work, and whether verification still blocks bidding—then jump to the Marketplace, Loads or Account.',
    bullets: [
      'See available freight and active assignments at a glance',
      'Spot verification or readiness gaps early',
      'Jump into the Marketplace, Loads or Profile',
    ],
    icon: LayoutDashboard,
    subtopics: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        href: '/carrier',
        summary:
          'Landing page under Overview. Situational awareness for capacity opportunities, assignments, and account readiness.',
        bullets: [
          'View summary of open opportunities and active jobs',
          'Check verification / approval status',
          'Open the linked job or profile task from an alert',
        ],
      },
    ],
  },
  {
    slug: 'jobs',
    title: 'Freight',
    summary:
      'Find loads on the Marketplace, run the loads you are booked on, and follow your offers. This is the haul workflow, not payouts or profile documents.',
    bullets: [
      'Make offers on Marketplace loads',
      'Run booked loads through delivery',
      'Follow the offers you have made',
    ],
    icon: Briefcase,
    subtopics: [
      {
        id: 'available',
        title: 'Marketplace',
        href: '/carrier/jobs',
        summary:
          'Spot loads shippers and brokers have posted, open to approved carriers. Find work and make offers here; running the load happens under Loads.',
        bullets: [
          'Browse loads by lane and equipment',
          'Review timing and rate',
          'Make an offer once your company is approved',
          'Loads you win move to Loads',
        ],
      },
      {
        id: 'my-jobs',
        title: 'Loads',
        href: '/carrier/my-jobs',
        summary:
          'Every load your company is booked on, from Marketplace offers and contract freight, with Booked, In transit and Delivered tabs. Drivers see the loads they are on as Trips.',
        bullets: [
          'See booked, in-transit and delivered loads',
          'Assign a driver and run stops through delivery',
          'Keep stop updates current for shipper tracking',
          'Download rate confirmation, BOL and POD',
        ],
      },
      {
        id: 'offers',
        title: 'My offers',
        href: '/carrier/offers',
        summary:
          'Offers you have made on Marketplace loads and where each stands: waiting, accepted or declined.',
        bullets: [
          'See every offer you have made',
          'Withdraw an offer the shipper has not answered',
          'Accepted offers appear under Loads',
        ],
      },
    ],
  },
  {
    slug: 'financials',
    title: 'Financials',
    summary:
      'Payouts for your carrier organization. Use Earnings for balances and deposit setup—not for compliance documents (that’s Profile under Account).',
    bullets: [
      'Earnings — balances and deposit setup',
    ],
    icon: DollarSign,
    subtopics: [
      {
        id: 'earnings',
        title: 'Earnings',
        href: '/carrier/earnings',
        summary:
          'See what you have earned and set up how completed work gets deposited to your bank.',
        bullets: [
          'Complete payout setup so deposits can be sent',
          'View balances and payout status',
          'Confirm or update your bank destination',
          'Follow up on missing or pending deposits',
        ],
      },
    ],
  },
  {
    slug: 'reports',
    title: 'Reports',
    summary:
      'Performance and operational summaries for your carrier organization. Trends over time—not the live dispatch board or payout setup.',
    bullets: [
      'View carrier operational summaries',
      'Review performance patterns across hauls',
      'Support business reviews with summarized data',
    ],
    icon: BarChart2,
    href: '/carrier/reports',
    subtopics: [],
  },
  {
    slug: 'account',
    title: 'Account',
    summary:
      'Carrier identity and compliance. Profile holds DOT/MC, insurance, vehicles, and documents—payouts live under Financials → Earnings.',
    bullets: [
      'Profile — identity, authority, insurance, and documents',
    ],
    icon: User,
    subtopics: [
      {
        id: 'profile',
        title: 'Profile',
        href: '/carrier/profile',
        summary:
          'Carrier identity and compliance: who you are, authority numbers, insurance, equipment, and required documents. See the validation matrices below for what is required on each tab.',
        bullets: [
          'Ten tabs: Personal through Reviews',
          'Complete Personal before Identity and the background check',
          'Service types drive Insurance and Commercial requirements',
          'Clear verification gaps that block the Marketplace',
        ],
        guideKey: 'carrier-profile',
      },
    ],
  },
];

export function topicsFor(audience: ManualAudience): ManualTopic[] {
  return audience === 'shipper' ? SHIPPER_TOPICS : CARRIER_TOPICS;
}

export function getTopic(audience: ManualAudience, slug: string): ManualTopic | undefined {
  return topicsFor(audience).find((t) => t.slug === slug);
}
