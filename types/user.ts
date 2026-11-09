export type UserRole   = 'shipper' | 'broker' | 'carrier' | 'receiver' | 'admin' | 'factor';
export type OrgType    = 'carrier' | 'shipper' | 'factor' | 'receiver' | 'broker';
export type OrgRole    = 'owner' | 'staff' | 'dispatcher' | 'driver' | 'viewer';
export type OrgPlan    = 'free' | 'pro' | 'enterprise';
export type OrgStatus  = 'active' | 'suspended' | 'onboarding' | 'listed';
export type StripeMode = 'platform' | 'connect';

export interface Org {
  id: number;
  name: string;
  slug: string;
  type: OrgType;
  status: OrgStatus;
  plan: OrgPlan;
  logo_url?: string;
  is_platform_tenant?: boolean;
  /** Company approval (pending, approved, rejected, restricted ...) */
  verification_status?: string | null;
  created_at?: string | null;
}

/** Admin-only view of an org (includes Stripe settings). */
export interface OrgAdmin extends Org {
  stripe_mode: StripeMode;
  stripe_connect_id: string | null;
  commission_rate: number | null;
  effective_rate: number;
  fmcsa_broker_mc: string | null;
  owner: { id: number; name: string; email: string } | null;
  created_at: string;
  /** Added by a company (a customer, a receiver); nobody from it signed up */
  third_party: boolean;
  added_by: string | null;
  /** Companies that have it in their list */
  connected_count: number;
  locations_count: number;
  city: string | null;
  state: string | null;
}

export interface PlatformTenant {
  id: number;
  org_id: number;
  org_name: string | null;
  lead_id: number | null;
  lead_company: string | null;
  subdomain: string | null;
  custom_domain: string | null;
  app_url: string;
  brand_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url_dark: string | null;
  favicon_url: string | null;
  hide_powered_by: boolean;
  fmcsa_broker_mc: string | null;
  feature_flags: Record<string, boolean> | null;
  stripe_subscription_id: string | null;
  status: 'pending' | 'active' | 'suspended';
  notes: string | null;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;

  // Multi-org
  org?: Org;
  org_role?: OrgRole;
  /** Level for each action in the role matrix (lib/permissions.ts); empty without a company */
  /** Sign-up isn't finished until the email is verified */
  email_verified?: boolean;
  /** Admin Console, Carrier or Shipper View: the company an admin is reading as (read-only) */
  viewing_as?: { id: number; name: string; type: string } | null;
  /** Signed up to take over a listed company; waiting for approval */
  pending_claim?: { id: number; as_type: string; org: { id: number; name: string; city?: string | null; state?: string | null } | null } | null;
  permissions?: Record<string, 'full' | 'view' | 'assigned' | 'self' | 'none'>;
}

export interface CarrierProfile {
  dot_number?: string;
  dot_verified: boolean;
  mc_number?: string;
  insurance_verified: boolean;
  background_check_status: 'pending' | 'approved' | 'rejected' | 'not_submitted';
  rating: number;
  total_deliveries: number;
}

// Helpers
export function isCarrier(user: User): boolean {
  return user.org?.type === 'carrier' || user.role === 'carrier';
}

export function isShipper(user: User): boolean {
  return user.org?.type === 'shipper' || user.role === 'shipper';
}

export function isFactor(user: User): boolean {
  return user.org?.type === 'factor' || user.role === 'factor';
}

export function canDispatch(user: User): boolean {
  return ['owner', 'staff', 'dispatcher'].includes(user.org_role ?? '');
}

export function canManageTeam(user: User): boolean {
  return ['owner', 'staff'].includes(user.org_role ?? '');
}
