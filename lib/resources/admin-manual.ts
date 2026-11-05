import type { LucideIcon } from 'lucide-react';
import { Mail, MessageSquare, ShieldCheck, Server, KeyRound } from 'lucide-react';
import { PROFILE_VERIFICATION_TOPIC } from './dev/profile-verification';
import { COMPANIES_AND_PEOPLE_TOPIC } from './dev/companies-and-people';

/**
 * Admin / Dev technical manual — platform operators only.
 * Never put real secrets here; document env var names and setup steps only.
 */

export interface AdminManualTopic {
  slug: string;
  /** Grouping on the overview and sidebar; training write-ups of each build go under "Contents" */
  category?: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  bullets: string[];
  sections: {
    id: string;
    title: string;
    paragraphs: string[];
    bullets?: string[];
    code?: string;
  }[];
}

export const ADMIN_TOPICS: AdminManualTopic[] = [
  {
    slug: 'mail',
    title: 'Mail setup',
    summary:
      'Outbound email for verification links and notifications. Production uses SMTP on the API host (e.g. Railway), not the frontend host.',
    icon: Mail,
    bullets: [
      'Configure MAIL_* on the API (Laravel)',
      'Use Brevo (or another) SMTP relay in production',
      'Authenticate the sending domain (SPF / DKIM / DMARC)',
      'Never set mail secrets on Netlify alone — mail is sent by the API',
    ],
    sections: [
      {
        id: 'where',
        title: 'Where to configure',
        paragraphs: [
          'Shipmater sends mail from the Laravel API. Set environment variables on the API deployment (Railway or equivalent). Frontend (Netlify) does not send verification email.',
        ],
      },
      {
        id: 'env',
        title: 'Required environment variables',
        paragraphs: [
          'Use your provider’s SMTP credentials. Store values only in the host’s secret store — never commit them to git or paste them into this manual.',
        ],
        bullets: [
          'MAIL_MAILER=smtp',
          'MAIL_HOST=smtp-relay.brevo.com (or your provider host)',
          'MAIL_PORT=587',
          'MAIL_USERNAME=…',
          'MAIL_PASSWORD=…',
          'MAIL_ENCRYPTION=tls (or as required by provider)',
          'MAIL_FROM_ADDRESS=noreply@yourdomain.com',
          'MAIL_FROM_NAME=Shipmater (or tenant brand)',
        ],
        code: `MAIL_MAILER=smtp
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USERNAME=<smtp-login>
MAIL_PASSWORD=<smtp-password>
MAIL_FROM_ADDRESS=noreply@yourdomain.com
MAIL_FROM_NAME=Shipmater`,
      },
      {
        id: 'domain',
        title: 'Domain authentication',
        paragraphs: [
          'In the mail provider dashboard, authenticate your sending domain. Add SPF, DKIM, and DMARC DNS records so verification emails are not marked as spam.',
          'Local development may use MAIL_MAILER=log so messages are written to the API log instead of being delivered.',
        ],
      },
      {
        id: 'verify',
        title: 'How shipper email verification uses mail',
        paragraphs: [
          'Business → Send verification email creates a signed link and sends it to the user’s login email. The user opens /verify-email?token=… to complete verification.',
          'If MAIL_MAILER is log or unset, the API will not deliver real email — fix Railway MAIL_* and redeploy.',
        ],
      },
    ],
  },
  {
    slug: 'sms',
    title: 'SMS setup',
    summary:
      'Phone verification uses Twilio when configured. Without Twilio, local/dev may return a one-time code in the API response for testing only.',
    icon: MessageSquare,
    bullets: [
      'Set TWILIO_* on the API host',
      'Prefer Twilio Verify SID when available',
      'Local without Twilio is for development only',
    ],
    sections: [
      {
        id: 'env',
        title: 'Required environment variables',
        paragraphs: [
          'Configure on the Laravel API. Do not commit tokens to the repository.',
        ],
        bullets: [
          'TWILIO_ACCOUNT_SID=…',
          'TWILIO_AUTH_TOKEN=…',
          'TWILIO_VERIFY_SID=… (preferred for OTP verify)',
          'TWILIO_FROM=… (fallback sender if not using Verify)',
        ],
        code: `TWILIO_ACCOUNT_SID=<account-sid>
TWILIO_AUTH_TOKEN=<auth-token>
TWILIO_VERIFY_SID=<verify-service-sid>
# optional fallback:
# TWILIO_FROM=+1…`,
      },
      {
        id: 'flow',
        title: 'Shipper phone verification flow',
        paragraphs: [
          'User saves a phone on Profile, then on Business taps Send SMS code. The API sends an OTP via Twilio Verify (or SMS). User enters the code to confirm.',
          'If Twilio is not configured in production, send will fail with a clear error — do not rely on local OTP behavior in production.',
        ],
      },
    ],
  },
  {
    slug: 'verification',
    title: 'Shipper verification',
    summary:
      'Email, phone, and business (EIN / W-9) verification for shippers. Admins approve business submissions in Shipper Queue.',
    icon: ShieldCheck,
    bullets: [
      'Email — link via mail provider',
      'Phone — SMS OTP via Twilio',
      'Business — W-9 upload + submit → Shipper Queue approve/reject',
    ],
    sections: [
      {
        id: 'matrix',
        title: 'Operator checklist',
        paragraphs: [
          'Customers see a non-technical guide under Resources → Account → Profile. Operators use this page for wiring and queues.',
        ],
        bullets: [
          'Email: requires MAIL_* working; user must have email on Profile',
          'Phone: requires TWILIO_*; user must have phone on Profile',
          'Business: requires verified email, legal name, tax ID, W-9; then Submit for review',
          'Approve/reject at Admin → Shipper Queue',
        ],
      },
      {
        id: 'api',
        title: 'Key API routes',
        paragraphs: ['Authenticated shipper verification endpoints under /api/v1/shipper/…'],
        bullets: [
          'POST …/verification/email/resend',
          'POST …/verification/phone/send',
          'POST …/verification/phone/confirm',
          'POST …/documents (W-9 upload)',
          'POST …/verification/business/submit',
          'Admin: GET/POST shipper queue approve/reject',
        ],
      },
    ],
  },
  {
    slug: 'environment',
    title: 'Environment & proxy',
    summary:
      'Frontend talks to the API through a Next.js proxy. Production needs correct API_PROXY_URL and matching CORS/Sanctum settings.',
    icon: Server,
    bullets: [
      'API_PROXY_URL must include https://',
      'Mail and SMS secrets live on the API host',
      'Keep .env.local and Railway secrets out of git',
    ],
    sections: [
      {
        id: 'frontend',
        title: 'Frontend (Netlify / local)',
        paragraphs: [
          'Next.js rewrites or route handlers proxy /api/* to the Laravel backend. Misconfigured API_PROXY_URL (missing scheme) causes login 502s.',
        ],
        bullets: [
          'API_PROXY_URL=https://your-api.example.com',
          'Do not put MAIL_PASSWORD or TWILIO_AUTH_TOKEN on Netlify unless the frontend itself sends mail (it does not)',
        ],
      },
      {
        id: 'api',
        title: 'API (Railway / local)',
        paragraphs: [
          'Laravel .env (or Railway variables) holds APP_URL, DB_*, MAIL_*, TWILIO_*, Stripe, Plaid, etc. After changing mail/SMS vars, redeploy the API.',
        ],
      },
    ],
  },
  {
    slug: 'secrets',
    title: 'Secrets hygiene',
    summary:
      'Never commit SMTP passwords, API keys, or Twilio tokens. Rotate anything that was pasted into chat, docs, or tickets.',
    icon: KeyRound,
    bullets: [
      'Use host secret managers only',
      'Rotate leaked credentials immediately',
      'Keep operator docs free of live passwords',
    ],
    sections: [
      {
        id: 'rules',
        title: 'Rules',
        paragraphs: [
          'This Admin manual documents variable names and steps only. Real credentials belong in Railway / Netlify / vault — not in git, not in docs/Brevo-style notes with live passwords.',
          'If a secret was ever committed or shared, rotate it in the provider dashboard and update the host env.',
        ],
      },
    ],
  },
  PROFILE_VERIFICATION_TOPIC,
  COMPANIES_AND_PEOPLE_TOPIC,
];

export const DEFAULT_CATEGORY = 'Platform setup';

/** Topics grouped by category, in first-seen order */
export function topicsByCategory(): { category: string; topics: AdminManualTopic[] }[] {
  const groups: { category: string; topics: AdminManualTopic[] }[] = [];
  for (const t of ADMIN_TOPICS) {
    const category = t.category ?? DEFAULT_CATEGORY;
    const g = groups.find((x) => x.category === category);
    if (g) g.topics.push(t);
    else groups.push({ category, topics: [t] });
  }
  return groups;
}

export function getAdminTopic(slug: string): AdminManualTopic | undefined {
  return ADMIN_TOPICS.find((t) => t.slug === slug);
}
