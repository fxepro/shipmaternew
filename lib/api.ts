import axios from 'axios';
import { viewAsHeader } from './viewAs';

/**
 * Production browser: same-origin /api/* (proxied by app/api/[...path]).
 * Local dev: http://127.0.0.1:8888 (matches `npm run dev:api`).
 * Override with NEXT_PUBLIC_API_URL in .env.local.
 */
function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.');
    if (!isLocal) return '';
  }

  if (process.env.NEXT_PUBLIC_API_PROXY === 'true') return '';

  return (
    process.env.API_PROXY_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://127.0.0.1:8888'
  );
}

const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// ── Bearer-token helpers ──────────────────────────────────────────────
const TOKEN_KEY = 'sm_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window !== 'undefined' && token && token !== 'undefined' && token !== 'null') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearStoredToken(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}


// ── Request interceptor: attach token on every request ────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // Admin Console, Carrier View and Shipper View: read as the chosen company (read-only; admins only)
    const viewAs = viewAsHeader();
    if (viewAs) config.headers['X-View-As-Org'] = viewAs;
  }
  return config;
});

// ── Response interceptor: pass errors through ────────────────────────
// Do NOT auto-redirect on 401 here — getUser() already handles that.
// A global redirect would break demo mode and cause redirect loops.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Posting a load without a subscription: say why and where to fix it
    if (typeof window !== 'undefined' && err?.response?.data?.code === 'subscription_required') {
      import('sonner').then(({ toast }) => toast.error('You need an active subscription to post loads.', {
        action: { label: 'Subscribe', onClick: () => { window.location.href = `${window.location.pathname.startsWith('/broker') ? '/broker' : '/shipper'}/company?tab=subscription`; } },
      }));
    }
    // The company (or carrier owner) isn't approved yet, or is restricted: say why once
    if (typeof window !== 'undefined' && err?.config?.method !== 'get'
        && ['company_not_approved', 'carrier_not_approved'].includes(err?.response?.data?.code)) {
      const msg = err.response.data.error as string;
      import('sonner').then(({ toast }) => toast.error(msg, { id: 'not-approved' }));
    }
    // The role matrix refused an action (Settings, Roles & Permissions): say so once.
    // Refused reads are left to the page, so opening a page doesn't pop up a message.
    if (typeof window !== 'undefined' && err?.config?.method !== 'get'
        && ['not_permitted', 'not_assigned'].includes(err?.response?.data?.code)) {
      const msg = err.response.data.error as string;
      import('sonner').then(({ toast }) => toast.error(msg, { id: `perm-${err.response.data.permission}` }));
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────
export const authApi = {
  login:    (data: { email: string; password: string }) => api.post('/api/v1/auth/login', data),
  logout:   () => api.post('/api/v1/auth/logout'),
  register: (data: Record<string, unknown>) => api.post('/api/v1/auth/register', data),
  me:       () => api.get('/api/v1/user'),
  verifyEmail: (token: string) => api.post('/api/v1/auth/email/verify', { token }),
  resendVerification: () => api.post('/api/v1/auth/email/resend'),
};

// ── Fees and shipper subscription (docs/fees-and-billing.md) ─────────
export const feesApi = {
  get:    ()                              => api.get('/api/v1/fees'),
  update: (data: Record<string, unknown>) => api.put('/api/v1/admin/settings/fees', data),
};

export const subscriptionApi = {
  get:       ()                          => api.get('/api/v1/shipper/subscription'),
  subscribe: (statedAnnualValue: number, paymentMethodId?: number | null) =>
    api.post('/api/v1/shipper/subscription', { stated_annual_value: statedAnnualValue, payment_method_id: paymentMethodId ?? null }),
  confirm:   (sessionId: string)         => api.post('/api/v1/shipper/subscription/confirm', { session_id: sessionId }),
  cancel:    ()                          => api.post('/api/v1/shipper/subscription/cancel'),
  resume:    ()                          => api.post('/api/v1/shipper/subscription/resume'),
};

export const factorStripeApi = {
  connect: () => api.post('/api/v1/factor/stripe/connect'),
  status:  () => api.get('/api/v1/factor/stripe/status'),
};

// ── Factoring: NOAs and factored loads (carrier, factor, shipper, admin) ──
// Payout account setup for carriers and factors (PayoutSetupController): collected here, sent to Stripe once
export const payoutsApi = {
  setup:    ()                               => api.get('/api/v1/payouts/setup'),
  business: (data: Record<string, unknown>)  => api.put('/api/v1/payouts/business', data),
  bank:     (data: Record<string, unknown>)  => api.put('/api/v1/payouts/bank', data),
  submit:   ()                               => api.post('/api/v1/payouts/submit'),
  refresh:  ()                               => api.post('/api/v1/payouts/refresh'),
};

export const factoringApi = {
  noas:           ()                                   => api.get('/api/v1/factoring/noas'),
  loads:          ()                                   => api.get('/api/v1/factoring/loads'),
  factors:        (q?: string)                         => api.get('/api/v1/factoring/factors', { params: q ? { q } : undefined }),
  fileNoa:        (data: FormData)                     => api.post('/api/v1/factoring/noas', data),
  requestRelease: (id: number)                         => api.post(`/api/v1/factoring/noas/${id}/request-release`),
  decideNoa:      (id: number, action: 'confirm' | 'decline', reason?: string) => api.post(`/api/v1/factoring/noas/${id}/decide`, { action, reason }),
  release:        (id: number, data: FormData)         => api.post(`/api/v1/factoring/noas/${id}/release`, data),
  eligibleLoads:  ()                                   => api.get('/api/v1/factoring/eligible-loads'),
  factorLoad:     (loadType: string, loadId: number)   => api.post('/api/v1/factoring/loads', { load_type: loadType, load_id: loadId }),
  withdrawLoad:   (id: number)                         => api.delete(`/api/v1/factoring/loads/${id}`),
  decideLoad:     (id: number, action: 'accept' | 'decline' | 'funded', reason?: string) => api.post(`/api/v1/factoring/loads/${id}/decide`, { action, reason }),
  acknowledge:    (id: number)                         => api.post(`/api/v1/factoring/loads/${id}/acknowledge`),
};

// ── Marketing / white-label leads (public) ────────────────────────────
export const marketingApi = {
  submitLead: (data: Record<string, unknown>) => api.post('/api/v1/platform-leads', data),
};

// ── Shipments: read-only summaries of loads (freight jobs) ─────────────
// Loads are created, offered on and run through freightJobApi; these are the list and panel views.
export const shipmentApi = {
  list:          (params?: Record<string, unknown>) => api.get('/api/v1/shipments', { params }),
  get:           (id: number) => api.get(`/api/v1/shipments/${id}`),
  /** GPS ping from the driver's device; the first one starts the trip */
  ping:          (id: number, data: { lat: number; lng: number; speed?: number | null }) => api.post(`/api/v1/jobs/${id}/ping`, data),
};


// ── Carrier ───────────────────────────────────────────────────────────
export const carrierApi = {
  earnings: () => api.get('/api/v1/carrier/earnings'),
  list:     (params?: Record<string, unknown>) => api.get('/api/v1/carriers', { params }),
  lookup:   (dot: string) => api.get('/api/v1/carriers', { params: { dot } }),
};

// ── Tracking (public) ─────────────────────────────────────────────────
export const trackApi = {
  get:     (token: string) => api.get(`/api/v1/track/${token}`),
  confirm: (token: string) => api.post(`/api/v1/track/${token}`),
};

// ── Payment methods ───────────────────────────────────────────────────
export const paymentApi = {
  list:        () => api.get('/api/v1/payment-methods'),
  /** Stripe SetupIntent the browser confirms with Elements; then save the resulting payment method id */
  setupIntent: () => api.post('/api/v1/payment-methods/setup-intent'),
  save:        (paymentMethodId: string) => api.post('/api/v1/payment-methods', { payment_method_id: paymentMethodId }),
  destroy:    (id: number) => api.delete(`/api/v1/payment-methods/${id}`),
  setDefault: (id: number) => api.post(`/api/v1/payment-methods/${id}/default`),
};

// ── Load payments: shipper pays, carrier earns, factor receives, admin sees all ──
export const paymentsApi = {
  list:      (params?: Record<string, unknown>) => api.get('/api/v1/payments', { params }),
  summary:   () => api.get('/api/v1/payments/summary'),
  retry:     (id: number) => api.post(`/api/v1/payments/${id}/retry`),
  payEarly:  (id: number) => api.post(`/api/v1/payments/${id}/pay-early`),
  fees:      () => api.get('/api/v1/payments/fees'),
  retryFee:  (id: number) => api.post(`/api/v1/payments/fees/${id}/retry`),
};

// ── Admin finance: revenue ledger, receivables, payment routing ───────
export const adminFinanceApi = {
  ledger:         (params?: Record<string, unknown>) => api.get('/api/v1/admin/ledger', { params }),
  receivables:    () => api.get('/api/v1/admin/receivables'),
  settings:       () => api.get('/api/v1/admin/settings/payments'),
  updateSettings: (flow: 'direct' | 'platform') => api.put('/api/v1/admin/settings/payments', { flow }),
};

// ── Admin: company role matrix (Settings, Roles & Permissions) ─────────
export const adminRoleApi = {
  matrix: () => api.get('/api/v1/admin/roles/matrix'),
  update: (type: string, changes: { role: string; permission: string; level: string }[]) =>
    api.put(`/api/v1/admin/roles/matrix/${type}`, { changes }),
  reset:  (type: string) => api.post(`/api/v1/admin/roles/matrix/${type}/reset`),
};

// ── Preferred carriers ────────────────────────────────────────────────
export const preferredCarrierApi = {
  list:   () => api.get('/api/v1/preferred-carriers'),
  add:    (data: Record<string, unknown>) => api.post('/api/v1/preferred-carriers', data),
  remove: (id: number) => api.delete(`/api/v1/preferred-carriers/${id}`),
};

// ── Contracts ─────────────────────────────────────────────────────────
export const contractApi = {
  list:    (params?: Record<string, unknown>) => api.get('/api/v1/contracts', { params }),
  create:  (data: Record<string, unknown>) => api.post('/api/v1/contracts', data),
  update:  (id: number, data: Record<string, unknown>) => api.put(`/api/v1/contracts/${id}`, data),
  destroy: (id: number) => api.delete(`/api/v1/contracts/${id}`),
};

// ── Locations address book ────────────────────────────────────────────
export const locationApi = {
  list:    (params?: Record<string, unknown>) => api.get('/api/v1/locations', { params }),
  create:  (data: Record<string, unknown>)    => api.post('/api/v1/locations', data),
  update:  (id: number, data: Record<string, unknown>) => api.put(`/api/v1/locations/${id}`, data),
  destroy: (id: number)                       => api.delete(`/api/v1/locations/${id}`),
  /** For building a load: your own locations, your receivers', and public matches for q */
  usable:  (q?: string)                       => api.get('/api/v1/locations/usable', { params: q ? { q } : {} }),
};

// ── Organizations directory: every company in shipping, their locations and contacts ──
export const directoryApi = {
  search:         (params: { q?: string; type?: string; limit?: number }) => api.get('/api/v1/directory/orgs', { params }),
  get:            (id: number)                                   => api.get(`/api/v1/directory/orgs/${id}`),
  /** List a receiver or broker that isn't on Shipmater yet, with locations and contacts */
  create:         (data: Record<string, unknown>)                => api.post('/api/v1/directory/orgs', data),
  update:         (id: number, data: Record<string, unknown>)    => api.put(`/api/v1/directory/orgs/${id}`, data),
  addLocation:    (orgId: number, data: Record<string, unknown>) => api.post(`/api/v1/directory/orgs/${orgId}/locations`, data),
  updateLocation: (id: number, data: Record<string, unknown>)    => api.put(`/api/v1/directory/locations/${id}`, data),
  removeLocation: (id: number)                                   => api.delete(`/api/v1/directory/locations/${id}`),
  addContact:     (orgId: number, data: Record<string, unknown>) => api.post(`/api/v1/directory/orgs/${orgId}/contacts`, data),
  updateContact:  (id: number, data: Record<string, unknown>)    => api.put(`/api/v1/directory/contacts/${id}`, data),
  removeContact:  (id: number)                                   => api.delete(`/api/v1/directory/contacts/${id}`),
  /** Public, for sign-up: listed companies by name */
  claimable:      (q: string)                                    => api.get('/api/v1/directory/claimable', { params: { q } }),
  claim:          (orgId: number, asType?: string)               => api.post(`/api/v1/directory/orgs/${orgId}/claim`, { as_type: asType }),
};

// ── A company's own list of receivers and brokers ─────────────────────
export const partnerApi = {
  list:   (relation?: 'receiver' | 'broker') => api.get('/api/v1/partners', { params: relation ? { relation } : {} }),
  add:    (partnerOrgId: number, relation: 'receiver' | 'broker' = 'receiver') => api.post('/api/v1/partners', { partner_org_id: partnerOrgId, relation }),
  remove: (orgId: number) => api.delete(`/api/v1/partners/${orgId}`),
};

// ── Admin: claims on listed companies ─────────────────────────────────
export const adminClaimApi = {
  list:   (status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending') => api.get('/api/v1/admin/claims', { params: { status } }),
  decide: (id: number, action: 'approve' | 'reject', note?: string) => api.post(`/api/v1/admin/claims/${id}/decide`, { action, note }),
};

// ── Freight jobs (contracted) ─────────────────────────────────────────
export const freightJobApi = {
  // Shipper
  shipperList: (params?: Record<string, unknown>) => api.get('/api/v1/shipper/freight-jobs', { params }),
  create:      (data: Record<string, unknown>)    => api.post('/api/v1/shipper/freight-jobs', data),
  get:         (id: number)                       => api.get(`/api/v1/shipper/freight-jobs/${id}`),
  optimise:    (id: number)                       => api.post(`/api/v1/shipper/freight-jobs/${id}/optimise`),
  saveBilling: (id: number, data: Record<string, unknown>) => api.patch(`/api/v1/shipper/freight-jobs/${id}/billing`, data),
  // The shipper declaration goes with the post: commodity, weight, sanitary instructions, declaration: true
  post:        (id: number, body: Record<string, unknown> = {}) => api.post(`/api/v1/shipper/freight-jobs/${id}/post`, body),
  /** PDF docs — must use blob + Bearer (plain <a> links return JSON 401). */
  rateConfirmation: (id: number) =>
    api.get(`/api/v1/jobs/${id}/rate-confirmation`, { responseType: 'blob', headers: { Accept: 'application/pdf' } }),
  bol: (id: number) =>
    api.get(`/api/v1/jobs/${id}/bol`, { responseType: 'blob', headers: { Accept: 'application/pdf' } }),
  invoice: (id: number) =>
    api.get(`/api/v1/jobs/${id}/invoice`, { responseType: 'blob', headers: { Accept: 'application/pdf' } }),
  // Carrier
  carrierList: (params?: Record<string, unknown>) => api.get('/api/v1/carrier/freight-jobs', { params }),
  carrierGet:  (id: number)                       => api.get(`/api/v1/carrier/freight-jobs/${id}`),
  updateStop:  (jobId: number, stopId: number, data: Record<string, unknown>) =>
                 api.patch(`/api/v1/carrier/freight-jobs/${jobId}/stops/${stopId}`, data),
  // Offers — carrier
  submitOffer:   (jobId: number, data: { amount: number; note?: string }) =>
                   api.post(`/api/v1/carrier/freight-jobs/${jobId}/offers`, data),
  withdrawOffer: (jobId: number, offerId: number) =>
                   api.delete(`/api/v1/carrier/freight-jobs/${jobId}/offers/${offerId}`),
  // Offers — shipper (all jobs)
  shipperAllOffers: (params?: Record<string, unknown>) =>
                   api.get('/api/v1/shipper/offers', { params }),
  // Offers — shipper (per job)
  listOffers:    (jobId: number) =>
                   api.get(`/api/v1/shipper/freight-jobs/${jobId}/offers`),
  acceptOffer:   (jobId: number, offerId: number) =>
                   api.post(`/api/v1/shipper/freight-jobs/${jobId}/offers/${offerId}/accept`),
  declineOffer:  (jobId: number, offerId: number) =>
                   api.post(`/api/v1/shipper/freight-jobs/${jobId}/offers/${offerId}/decline`),
  // Offer terms — shipper saves quote requirements on open job
  saveTerms:     (jobId: number, data: { quote_requirements: Record<string, unknown>; posted_rate_cents?: number | null }) =>
                   api.patch(`/api/v1/shipper/freight-jobs/${jobId}/terms`, data),
  // Carrier: all my offers across all jobs
  carrierMyOffers: (params?: Record<string, unknown>) =>
                   api.get('/api/v1/carrier/my-offers', { params }),

  // Evidence (photos) per stop
  listEvidence:    (jobId: number, stopId: number) =>
                     api.get(`/api/v1/jobs/${jobId}/stops/${stopId}/evidence`),
  uploadEvidence:  (jobId: number, stopId: number, formData: FormData) =>
                     api.post(`/api/v1/jobs/${jobId}/stops/${stopId}/evidence`, formData, {
                       headers: { 'Content-Type': 'multipart/form-data' },
                     }),
  deleteEvidence:  (jobId: number, evidenceId: number) =>
                     api.delete(`/api/v1/jobs/${jobId}/evidence/${evidenceId}`),
  saveSignature:   (jobId: number, stopId: number, data: { signature_data: string; signature_name: string }) =>
                     api.post(`/api/v1/jobs/${jobId}/stops/${stopId}/signature`, data),
  generatePod:     (jobId: number, stopId: number) =>
                     api.post(`/api/v1/jobs/${jobId}/stops/${stopId}/pod`),
};

// ── KYC / Identity ─────────────────────────────────────────────────────
export const kycApi = {
  status:               () => api.get('/api/v1/carrier/kyc-status'),
  startIdentitySession: () => api.post('/api/v1/stripe/identity/session'),
};

// ── Blog ───────────────────────────────────────────────────────────────
export const blogApi = {
  list:    (params?: Record<string, unknown>)                        => api.get('/api/v1/blog', { params }),
  get:     (slug: string)                                            => api.get(`/api/v1/blog/${slug}`),
  adminList: (params?: Record<string, unknown>)                      => api.get('/api/v1/admin/blog', { params }),
  create:  (data: Record<string, unknown>)                           => api.post('/api/v1/admin/blog', data),
  update:  (id: number, data: Record<string, unknown>)               => api.put(`/api/v1/admin/blog/${id}`, data),
  destroy: (id: number)                                              => api.delete(`/api/v1/admin/blog/${id}`),
};

// ── Service Types ──────────────────────────────────────────────────────
export const serviceTypeApi = {
  list:  () => api.get('/api/v1/service-types'),
  rules: (keys: string[]) => api.get('/api/v1/service-types/rules', { params: { types: keys } }),
};

// ── Certifications ─────────────────────────────────────────────────────
export const certificationApi = {
  list: () => api.get('/api/v1/certifications'),
  sync: (keys: string[]) => api.put('/api/v1/carrier/certifications', { certification_keys: keys }),
};

// ── Org / Team ──────────────────────────────────────────────────────────
export const orgApi = {
  get:               ()                                         => api.get('/api/v1/org'),
  update:            (data: Record<string, unknown>)            => api.put('/api/v1/org', data),
  /** How the company is paid outside Shipmater (Account → Finance) */
  remittance:        ()                                         => api.get('/api/v1/org/remittance'),
  updateRemittance:  (data: Record<string, unknown>)            => api.put('/api/v1/org/remittance', data),
  members:           ()                                         => api.get('/api/v1/org/members'),
  updateMember:      (id: number, role: string)                 => api.put(`/api/v1/org/members/${id}`, { role }),
  removeMember:      (id: number)                               => api.delete(`/api/v1/org/members/${id}`),
  invitations:       ()                                         => api.get('/api/v1/org/invitations'),
  invite:            (email: string, role: string)              => api.post('/api/v1/org/invitations', { email, role }),
  acceptInvitation:  (token: string)                            => api.post('/api/v1/org/invitations/accept', { token }),
  cancelInvitation:  (id: number)                               => api.delete(`/api/v1/org/invitations/${id}`),
  resendInvitation:  (id: number)                               => api.post(`/api/v1/org/invitations/${id}/resend`),
  switchOrg:         (orgId: number)                            => api.put('/api/v1/org/switch', { org_id: orgId }),
  myOrganizations:   ()                                         => api.get('/api/v1/user/organizations'),
  /** Public: what an invite link is for, shown before signing up or signing in */
  showInvitation:    (token: string)                            => api.get(`/api/v1/invitations/${token}`),
};

// ── A person's own checks (docs/people-types-and-checks.md) ─────────────
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };
export const myChecksApi = {
  get:              ()                                           => api.get('/api/v1/me/checks'),
  updateIdentity:   (data: Record<string, unknown>)              => api.put('/api/v1/me/identity', data),
  uploadIdentity:   (kind: string, file: File) => {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    return api.post('/api/v1/me/identity/files', form, multipart);
  },
  saveCredential:   (data: FormData, id?: number)                =>
    api.post(id ? `/api/v1/me/credentials/${id}` : '/api/v1/me/credentials', data, multipart),
  deleteCredential: (id: number)                                 => api.delete(`/api/v1/me/credentials/${id}`),
};

// ── Admin: org management + Stripe toggle ─────────────────────────────
export const adminOrgApi = {
  listOrgs:    (params?: Record<string, unknown>)  => api.get('/api/v1/admin/orgs', { params }),
  getOrg:      (id: number)                        => api.get(`/api/v1/admin/orgs/${id}`),
  /** The pivotal toggle: flip an org between Shipmater's Stripe and their own. */
  updateStripe: (id: number, data: {
    stripe_mode: 'platform' | 'connect';
    stripe_connect_id?: string | null;
    commission_rate?: number | null;
  })                                               => api.put(`/api/v1/admin/orgs/${id}/stripe`, data),

  // Platform tenant management
  listTenants:   (params?: Record<string, unknown>) => api.get('/api/v1/admin/platform-tenants', { params }),
  createTenant:  (data: Record<string, unknown>)    => api.post('/api/v1/admin/platform-tenants', data),
  updateTenant:  (id: number, data: Record<string, unknown>) => api.put(`/api/v1/admin/platform-tenants/${id}`, data),
  convertLead:   (leadId: number, data: Record<string, unknown>) => api.post(`/api/v1/admin/leads/${leadId}/convert`, data),
};

// ── Profile (shipper + carrier) ────────────────────────────────────────
export const profileApi = {
  getShipper:    () => api.get('/api/v1/shipper/profile'),
  updateShipper: (data: Record<string, unknown>) => api.put('/api/v1/shipper/profile', data),
  getCarrier:    () => api.get('/api/v1/carrier/profile'),
  updateCarrier: (data: Record<string, unknown>) => api.put('/api/v1/carrier/profile', data),
};

export const shipperVerificationApi = {
  resendEmail:     () => api.post('/api/v1/shipper/verify/email/resend'),
  sendPhoneCode:   (phone?: string) => api.post('/api/v1/shipper/verify/phone/send', phone ? { phone } : {}),
  confirmPhoneCode:(code: string) => api.post('/api/v1/shipper/verify/phone/confirm', { code }),
  listDocuments:   () => api.get('/api/v1/shipper/documents'),
  uploadDocument:  (form: FormData) => api.post('/api/v1/shipper/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  submitBusiness:  () => api.post('/api/v1/shipper/verify/business/submit'),
  adminPending:    () => api.get('/api/v1/admin/shippers/pending-review'),
  adminReview:     (id: number, action: 'approve' | 'reject', notes?: string) =>
    api.post(`/api/v1/admin/shippers/${id}/review`, { action, notes }),
};

// ── Ratings ────────────────────────────────────────────────────────────────
export const ratingApi = {
  create:      (jobId: number, data: object) => api.post(`/api/v1/jobs/${jobId}/ratings`, data),
  jobRatings:  (jobId: number) => api.get(`/api/v1/jobs/${jobId}/ratings`),
  orgRatings:  (orgId: number, page = 1) => api.get(`/api/v1/orgs/${orgId}/ratings?page=${page}`),
};

// ── Carrier Verification (FMCSA + Stripe Identity + Clearinghouse) ──────
export const verificationApi = {
  verifyDot:             (dotNumber: string) =>
                           api.post('/api/v1/carrier/verify/dot', { dot_number: dotNumber }),
  verifyMc:              (mcNumber: string) =>
                           api.post('/api/v1/carrier/verify/mc', { mc_number: mcNumber }),
  list:                  () => api.get('/api/v1/carrier/verifications'),
  identitySession:       () => api.post('/api/v1/stripe/identity/session'),
  clearinghouseInitiate:   () => api.post('/api/v1/carrier/clearinghouse'),
  clearinghouseStatus:     () => api.get('/api/v1/carrier/clearinghouse/status'),
};

// ── Background checks: basic and complete levels, owners and drivers ─────
export type CheckLevel = 'basic' | 'complete';
export interface BackgroundForm {
  status: 'paid' | 'invitation_sent' | 'pending' | 'clear' | 'consider' | 'suspended' | 'expired';
  paid_by: 'carrier' | 'shipper'; payer: string | null;
  invitation_url: string | null; check_id: number | null; completed_at: string | null;
}
export interface BackgroundSummary {
  user_id: number; name: string; role: string | null;
  level: CheckLevel | null; complete_expires_at: string | null;
  basic: BackgroundForm | null; complete: BackgroundForm | null;
  next_complete_kind: 'upgrade' | 'full';
  prices?: { basic: number; complete: number; upgrade: number };
}
export const backgroundApi = {
  get:   (userId?: number) => api.get('/api/v1/background', { params: userId ? { user_id: userId } : {} }),
  pay:   (level: CheckLevel, userId?: number) => api.post('/api/v1/background/pay', { level, ...(userId ? { user_id: userId } : {}) }),
  start: (checkId: number) => api.post(`/api/v1/background/checks/${checkId}/start`),
  // Shippers, for carriers they have an active contract with
  // carrierId is the carrier company (organizations.id)
  shipperGet:   (carrierId: number) => api.get(`/api/v1/shipper/carriers/${carrierId}/background`),
  shipperOrder: (carrierId: number) => api.post(`/api/v1/shipper/carriers/${carrierId}/background`),
  // Admin → Settings
  settings:       () => api.get('/api/v1/admin/settings/background'),
  updateSettings: (data: Record<string, unknown>) => api.put('/api/v1/admin/settings/background', data),
  test:           (provider: string) => api.post('/api/v1/admin/settings/background/test', { provider }),
};

// ── Admin → Settings → Business verification (KYB: EIN, Secretary of State, address, OFAC) ──
export const kybApi = {
  settings:       () => api.get('/api/v1/admin/settings/kyb'),
  updateSettings: (data: { provider: string; mode?: 'test' | 'live'; countries?: string[] }) => api.put('/api/v1/admin/settings/kyb', data),
  test:           (provider: string) => api.post('/api/v1/admin/settings/kyb/test', { provider }),
  countries:      () => api.get('/api/v1/kyb/countries'),
};

// One Test / Live switch for every outside check (api/app/Support/PlatformMode.php)
export const platformModeApi = {
  get:  () => api.get('/api/v1/admin/settings/mode'),
  save: (mode: 'test' | 'live') => api.put('/api/v1/admin/settings/mode', { mode }),
};

// ── Admin → Integrations: every outside service, keys set or not (never values), connection test ──
// ── Rate check: market rate guidance (api/app/Services/Rates/RateEstimator.php) ──
export const ratesApi = {
  check:    (data: Record<string, unknown>) => api.post('/api/v1/rates/check', data),
  history:  () => api.get('/api/v1/rates/checks'),
  forJob:   (jobId: number) => api.get(`/api/v1/shipper/freight-jobs/${jobId}/market-rate`),
  settings: () => api.get('/api/v1/admin/settings/rates'),
  saveSettings: (data: Record<string, unknown>) => api.put('/api/v1/admin/settings/rates', data),
};

export const integrationsApi = {
  list: () => api.get('/api/v1/admin/integrations'),
  test: (key: string) => api.post(`/api/v1/admin/integrations/${key}/test`),
};

// ── Admin: financial reporting ─────────────────────────────────────────
export const adminFinancialsApi = {
  get:    (params: Record<string, string>) => api.get('/api/v1/admin/financials', { params }),
  export: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    window.location.href = `/api/v1/admin/financials/export?${qs}`;
  },
};
