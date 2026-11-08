/**
 * The carrier profile, arranged by who owns the data: the person ("Me") and the company ("Company").
 * Web and the mobile app use the same groups, section ids, labels and order, so both show one thing the same way.
 * Each section reads and saves the same API resource on both:
 *   Me:      /api/v1/carrier/profile (person fields), /api/v1/me/pro-profile, background and checks endpoints
 *   Company: /api/v1/carrier/profile (company fields), /api/v1/org/authorities, /api/v1/org/categories,
 *            /api/v1/carrier/vehicles, /api/v1/org/members (drivers), payouts
 */
export type ProfileGroup = 'me' | 'company';
export type ProfileSection =
  | 'identity' | 'driving' | 'checks' | 'pro'
  | 'business' | 'authority' | 'services' | 'fleet' | 'drivers' | 'payouts' | 'reviews';

export interface SectionDef { id: ProfileSection; label: string; description: string; editable: boolean }

export const PROFILE_SECTIONS: Record<ProfileGroup, SectionDef[]> = {
  me: [
    { id: 'identity', label: 'Identity & contact', description: 'Your legal name, contact details, home address and government ID.', editable: true },
    { id: 'driving',  label: 'Driving credentials', description: 'Your CDL, endorsements and DOT medical card. Endorsements here are the ones used to match loads.', editable: true },
    { id: 'checks',   label: 'Background & checks', description: 'Background check, FMCSA Clearinghouse and identity verification.', editable: false },
    { id: 'pro',      label: 'Professional profile', description: 'Your experience and availability. It stays with you if you change companies.', editable: false },
  ],
  company: [
    { id: 'business',  label: 'Business',            description: 'How the business is set up for payouts, and what it is in the directory.', editable: false },
    { id: 'authority', label: 'Operating authority', description: 'The authority the company operates under (USDOT / MC, broker) and the insurance filed on it.', editable: true },
    { id: 'services',  label: 'Services',            description: 'What the company transports and its certifications.', editable: true },
    { id: 'fleet',     label: 'Fleet',               description: 'Trucks and trailers, who owns each one, and its equipment.', editable: false },
    { id: 'drivers',   label: 'Drivers',             description: 'People who drive for the company, the owner-operator included.', editable: false },
    { id: 'payouts',   label: 'Payouts',             description: 'Bank account and Stripe payout setup.', editable: false },
    { id: 'reviews',   label: 'Reviews',             description: 'Ratings from shippers.', editable: false },
  ],
};

export const groupOf = (s: ProfileSection): ProfileGroup =>
  PROFILE_SECTIONS.me.some((d) => d.id === s) ? 'me' : 'company';

/** Old tab ids (links, banners, Stripe returns) to the new sections */
export const LEGACY_TABS: Record<string, ProfileSection> = {
  personal: 'identity', dot: 'driving', medical: 'driving', background: 'checks',
  business: 'business', insurance: 'authority', services: 'services', certifications: 'services',
  vehicles: 'fleet', financial: 'payouts', reviews: 'reviews',
};

export const toSection = (id: string | null | undefined): ProfileSection | null => {
  if (!id) return null;
  const all = [...PROFILE_SECTIONS.me, ...PROFILE_SECTIONS.company].map((d) => d.id) as string[];
  return all.includes(id) ? (id as ProfileSection) : (LEGACY_TABS[id] ?? null);
};
