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
        title: 'My Shipments',
        href: '/shipper/shipments',
        summary:
          'Master list of your organization’s shipments—status, carrier, and tracking context. Open a row for detail, documents, and delivery outcome.',
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
    title: 'Jobs',
    summary:
      'Turn demand into work carriers can accept: post jobs, manage your postings, decide on offers, and run contracted freight against standing rates.',
    bullets: [
      'Create spot or contracted job postings',
      'Track every job from open through complete',
      'Accept or decline carrier offers',
      'Run preferred freight under Network contracts',
    ],
    icon: Briefcase,
    subtopics: [
      {
        id: 'create-job',
        title: 'Create Job',
        href: '/shipper/jobs/contracted/new',
        summary:
          'Post new work with pickup, delivery, equipment, and terms. Prefer contracted flow when a Network contract already sets the partner and rate.',
        bullets: [
          'Enter origin, destination, equipment, and timing',
          'Set commercial terms for carriers to respond to',
          'Start from a contracted agreement when one exists',
          'Reuse saved Network addresses on the form',
        ],
      },
      {
        id: 'my-jobs',
        title: 'My Jobs',
        href: '/shipper/jobs',
        summary:
          'Inventory of jobs you posted and where each sits in its lifecycle—from open to awarded to complete.',
        bullets: [
          'List all jobs for your organization',
          'See lifecycle status on each posting',
          'Open a job for detail and next actions',
          'Find stale open work to close or retender',
        ],
      },
      {
        id: 'offers',
        title: 'Offers',
        href: '/shipper/jobs/offers',
        summary:
          'Decision queue for inbound carrier bids and offers. Accept to award; decline to clear noise.',
        bullets: [
          'Review incoming carrier bids and offers',
          'Compare rate and service on each response',
          'Accept an offer to award the job',
          'Decline offers you will not take',
        ],
      },
      {
        id: 'contracted',
        title: 'Contracted',
        href: '/shipper/jobs/contracted',
        summary:
          'Jobs tied to standing Network contracts and preferred rates—repeat freight without a full spot auction each time.',
        bullets: [
          'Work jobs linked to preferred carrier agreements',
          'Use contract rates (per mile, flat, hourly, etc.)',
          'Post contracted freight faster for repeat lanes',
          'Keep preferred partners separate from pure spot tenders',
        ],
      },
    ],
  },
  {
    slug: 'network',
    title: 'Network',
    summary:
      'Your partners and reference data: carriers, rate agreements, and saved pickup/delivery locations that Jobs and Shipments reuse.',
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
          'Standing commercial agreements with preferred carriers. Source of truth for rates used when posting contracted jobs.',
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
          'Reuse pickups on Create Job and shipments',
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
      'Carrier home after login. See available freight signals, active work, and whether verification still blocks bidding—then jump to the right Jobs or Account page.',
    bullets: [
      'See available freight and active assignments at a glance',
      'Spot verification or readiness gaps early',
      'Jump into Available, My Jobs, or Profile',
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
    title: 'Jobs',
    summary:
      'Find loads, run assigned work, and answer direct shipper offers. This is the haul workflow—not payouts or profile documents.',
    bullets: [
      'Browse open jobs you can bid on',
      'Execute assigned jobs through delivery',
      'Accept or decline direct shipper offers',
    ],
    icon: Briefcase,
    subtopics: [
      {
        id: 'available',
        title: 'Available',
        href: '/carrier/jobs',
        summary:
          'Open market of jobs you can pursue once the carrier account is approved. Discovery and bidding—not execution.',
        bullets: [
          'Browse open jobs by lane and equipment',
          'Review timing and rate expectations',
          'Submit bids when the account is approved',
          'Move won work into My Jobs after award',
        ],
      },
      {
        id: 'my-jobs',
        title: 'My Jobs',
        href: '/carrier/my-jobs',
        summary:
          'Assigned freight for your carrier org. Start, update, and deliver from here so shippers see accurate progress.',
        bullets: [
          'List jobs assigned to your organization',
          'Start and update job status through delivery',
          'Keep location/status updates current for shipper tracking',
          'Handle exceptions on committed hauls',
        ],
      },
      {
        id: 'offers',
        title: 'Offers',
        href: '/carrier/offers',
        summary:
          'Direct proposals from shippers pointed at you. Respond quickly—accept to take the load, decline to free capacity.',
        bullets: [
          'Review direct tenders from shippers',
          'Accept an offer to take the assignment',
          'Decline offers you cannot cover',
          'Confirm accepted work appears under My Jobs',
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
          'Clear verification gaps that block Available jobs',
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
