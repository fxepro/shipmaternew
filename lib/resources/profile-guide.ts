/**
 * Customer-facing Profile guide (shipper Account → Profile).
 * No vendor/admin/dev setup content — that belongs in a separate internal manual.
 */

export interface GuideSection {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
}

export interface GuideMatrix {
  title: string;
  description?: string;
  columns: string[];
  rows: string[][];
}

export const SHIPPER_PROFILE_TABS: GuideSection[] = [
  {
    id: 'tab-profile',
    title: 'Profile',
    summary:
      'Your personal contact details and shipping defaults. Email and phone saved here are what verification uses on the Business tab—save before you verify.',
    bullets: [
      'Required: first name, last name, email, phone (with country code)',
      'Optional: middle name, suffix, WhatsApp, ship-from address, pickup contact, internal ref format',
      'Email format must look like you@company.com (short domain ending)',
      'Phone: local digits only (6–12); country code is selected separately',
    ],
  },
  {
    id: 'tab-business',
    title: 'Business',
    summary:
      'Your company identity, addresses, and verification. Complete company details here, then verify email, phone, and business so partners can trust your account.',
    bullets: [
      'Required: legal business name and tax ID (EIN must be 9 digits in the US)',
      'Optional: DBA, type, industry, currency, addresses, company contacts',
      'Upload W-9 (or equivalent) before submitting business for review',
      'Verify email and phone first — those actions toast if contact data is missing',
    ],
  },
  {
    id: 'tab-services',
    title: 'Services',
    summary:
      'Tell the platform what kinds of freight you ship so carrier matching and search stay relevant to your business.',
    bullets: [
      'Optional: select all service types your company ships',
      'No required fields — save whenever you update selections',
    ],
  },
  {
    id: 'tab-compliance',
    title: 'Compliance',
    summary:
      'Optional documents some loads or partners may require. Upload files and track expiry dates so you are not caught with an expired certificate.',
    bullets: [
      'Optional unless a partner or load type asks for them',
      'COI, HIPAA BAA, and HazMat registration with expiry dates',
      'Renew before expiry — you are alerted about 30 days out',
    ],
  },
  {
    id: 'tab-payment',
    title: 'Payment',
    summary:
      'Saved ways to pay for freight. Cards and bank accounts live here; invoice history lives under Financials → Payments.',
    bullets: [
      'Not in the page banner — validated when you add a method',
      'Card: name, 13–19 digit number, MM/YY expiry, 3–4 digit CVV',
      'Bank: holder name, 9-digit routing, account (≥4 digits) with confirm match',
      'You can also add a bank account through Stripe',
    ],
  },
  {
    id: 'tab-subscription',
    title: 'Subscription',
    summary:
      'Your plan and billing cycle for the workspace—what is included, when you are charged next, and options to change or cancel.',
    bullets: [
      'No required profile fields',
      'See plan, billing cycle, and cancel options here',
    ],
  },
  {
    id: 'tab-notifications',
    title: 'Notifications',
    summary:
      'Choose which shipment events reach you by email or text so you stay informed without unnecessary noise.',
    bullets: [
      'Optional toggles for email and SMS events',
      'Save preferences so they apply going forward',
    ],
  },
  {
    id: 'tab-team',
    title: 'Team',
    summary:
      'Invite coworkers to your organization and manage roles so the right people can post jobs, pay, or view only.',
    bullets: [
      'Invite requires a valid email and a role (admin, dispatcher, viewer, …)',
      'Invalid invite emails are blocked with a toast — not listed in the page banner',
      'Update or remove member access anytime',
    ],
  },
];

/** What must be true before each verification step succeeds. */
export const SHIPPER_VERIFICATION_MATRIX: GuideMatrix = {
  title: 'Verification checklist',
  description:
    'Complete these in order. Email and phone use the contact values saved on the Profile tab. Business review needs company details and a tax form on the Business tab. Failures toast when you click the action — they are not listed in the amber banner.',
  columns: ['Step', 'Required first', 'What you do', 'When it is done'],
  rows: [
    [
      'Email',
      'Valid email saved on Profile tab',
      'Send verification email → open the link in your inbox (check spam)',
      'Badge shows Verified',
    ],
    [
      'Phone',
      'Valid phone + country code saved on Profile tab',
      'Send code by text → enter the code on Business tab',
      'Badge shows Verified',
    ],
    [
      'Business',
      'Email verified; legal business name and tax ID saved; W-9 (or equivalent) uploaded',
      'Submit for review on Business tab',
      'In review → Verified after platform approval',
    ],
  ],
};

/** Field / document requirements at a glance. */
export const SHIPPER_REQUIREMENTS_MATRIX: GuideMatrix = {
  title: 'What is required where',
  description:
    'Use this when something is blocked or a badge stays “Not verified.” The amber banner at the top of Account Settings only lists missing or invalid data fields.',
  columns: ['Item', 'Where', 'Rule', 'Shown in'],
  rows: [
    ['First name', 'Profile', 'Required', 'Banner + save'],
    ['Last name', 'Profile', 'Required', 'Banner + save'],
    ['Email', 'Profile', 'Required; valid format (e.g. you@company.com)', 'Banner + save'],
    ['Phone', 'Profile', 'Required; 6–12 local digits + country code', 'Banner + save'],
    ['WhatsApp', 'Profile', 'Optional; no verification', '—'],
    ['Legal business name', 'Business', 'Required', 'Banner + save'],
    ['Tax ID / EIN', 'Business', 'Required; EIN = 9 digits', 'Banner + save'],
    ['W-9 / tax form', 'Business (upload)', 'Required to submit business', 'Toast on submit'],
    ['Service types', 'Services', 'Optional', '—'],
    ['COI / HIPAA / HazMat', 'Compliance', 'Optional / partner-specific', '—'],
    ['Card / bank', 'Payment', 'Validated when adding', 'Toast on add'],
    ['Invite email + role', 'Team', 'Required to send invite; valid email', 'Toast on invite'],
  ],
};

/** How validation behaves across the page. */
export const SHIPPER_VALIDATION_BEHAVIOR_MATRIX: GuideMatrix = {
  title: 'How validation works',
  description:
    'Three layers keep the page clear: a banner for missing data, save blockers on each tab, and toasts for verification or add-method actions.',
  columns: ['Layer', 'When it appears', 'What it covers'],
  rows: [
    [
      'Amber banner',
      'While browsing any Account Settings tab',
      'Missing or invalid Profile + Business fields only',
    ],
    [
      'Save on tab',
      'When you click Save',
      'Blocks save; shows inline errors and a toast',
    ],
    [
      'Action toast',
      'When you click Verify / Submit / Invite / Add card or bank',
      'Email, SMS, W-9 submit, team invite, payment method rules',
    ],
  ],
};
