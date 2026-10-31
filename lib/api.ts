import axios from 'axios';

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
        action: { label: 'Subscribe', onClick: () => { window.location.href = '/shipper/profile?tab=subscription'; } },
      }));
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
};

// ── Fees and shipper subscription (docs/fees-and-billing.md) ─────────
export const feesApi = {
  get:    ()                              => api.get('/api/v1/fees'),
  update: (data: Record<string, unknown>) => api.put('/api/v1/admin/settings/fees', data),
};

export const subscriptionApi = {
  get:       ()                          => api.get('/api/v1/shipper/subscription'),
  subscribe: (statedAnnualValue: number) => api.post('/api/v1/shipper/subscription', { stated_annual_value: statedAnnualValue }),
  confirm:   (sessionId: string)         => api.post('/api/v1/shipper/subscription/confirm', { session_id: sessionId }),
  cancel:    ()                          => api.post('/api/v1/shipper/subscription/cancel'),
};

export const factorStripeApi = {
  connect: () => api.post('/api/v1/factor/stripe/connect'),
  status:  () => api.get('/api/v1/factor/stripe/status'),
};

// ── Factoring: NOAs and factored loads (carrier, factor, shipper, admin) ──
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

// ── Shipments ─────────────────────────────────────────────────────────
export const shipmentApi = {
  list:          (params?: Record<string, unknown>) => api.get('/api/v1/shipments', { params }),
  get:           (id: number) => api.get(`/api/v1/shipments/${id}`),
  create:        (data: Record<string, unknown>) => api.post('/api/v1/shipments', data),
  getBids:       (id: number) => api.get(`/api/v1/shipments/${id}/bids`),
  ping:          (id: number, data: { lat: number; lng: number; speed?: number | null }) => api.post(`/api/v1/shipments/${id}/ping`, data),
  acceptOffer:   (id: number) => api.put(`/api/v1/shipments/${id}/accept-offer`),
  declineOffer:  (id: number) => api.put(`/api/v1/shipments/${id}/decline-offer`),
  start:         (id: number) => api.put(`/api/v1/shipments/${id}/start`),
  deliver:       (id: number, data?: { delivery_photo_url?: string; delivery_notes?: string }) =>
                   api.post(`/api/v1/shipments/${id}/deliver`, data ?? {}),
};

// ── Bids ──────────────────────────────────────────────────────────────
export const bidApi = {
  place:         (shipmentId: number, data: Record<string, unknown>) => api.post(`/api/v1/shipments/${shipmentId}/bids`, data),
  /** Accept a bid. Nothing is charged now: the card on file is held the day before pickup, charged at delivery */
  accept:        (bidId: number) => api.put(`/api/v1/bids/${bidId}/accept`),
  withdraw:      (bidId: number) => api.put(`/api/v1/bids/${bidId}/withdraw`),
  carrierOffers: (params?: Record<string, unknown>) => api.get('/api/v1/carrier/offers', { params }),
};

// ── Plaid / ACH bank connection (shipper) ─────────────────────────────
export const plaidApi = {
  linkToken:   () => api.get('/api/v1/shipper/plaid/link-token'),
  exchange:    (data: { public_token: string; account_id: string; institution_name?: string }) =>
                 api.post('/api/v1/shipper/plaid/exchange', data),
  status:      () => api.get('/api/v1/shipper/plaid/status'),
  disconnect:  () => api.delete('/api/v1/shipper/plaid/disconnect'),
};

// ── Jobs (carrier) ────────────────────────────────────────────────────
export const jobApi = {
  list:      (params?: Record<string, unknown>) => api.get('/api/v1/jobs', { params }),
  available: (type: 'open' | 'contracted' = 'open', myServices = false) =>
               api.get('/api/v1/jobs', { params: { type, ...(myServices && { my_services: 1 }) } }),
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
};

// ── Freight jobs (contracted) ─────────────────────────────────────────
export const freightJobApi = {
  // Shipper
  shipperList: (params?: Record<string, unknown>) => api.get('/api/v1/shipper/freight-jobs', { params }),
  create:      (data: Record<string, unknown>)    => api.post('/api/v1/shipper/freight-jobs', data),
  get:         (id: number)                       => api.get(`/api/v1/shipper/freight-jobs/${id}`),
  optimise:    (id: number)                       => api.post(`/api/v1/shipper/freight-jobs/${id}/optimise`),
  saveBilling: (id: number, data: Record<string, unknown>) => api.patch(`/api/v1/shipper/freight-jobs/${id}/billing`, data),
  post:        (id: number)                       => api.post(`/api/v1/shipper/freight-jobs/${id}/post`),
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
  saveTerms:     (jobId: number, data: { quote_requirements: Record<string, unknown> }) =>
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

// ── Carrier Verification (FMCSA + Stripe Identity + Checkr) ─────────────
export const verificationApi = {
  verifyDot:             (dotNumber: string) =>
                           api.post('/api/v1/carrier/verify/dot', { dot_number: dotNumber }),
  verifyMc:              (mcNumber: string) =>
                           api.post('/api/v1/carrier/verify/mc', { mc_number: mcNumber }),
  list:                  () => api.get('/api/v1/carrier/verifications'),
  identitySession:       () => api.post('/api/v1/stripe/identity/session'),
  initiateBackgroundCheck: () => api.post('/api/v1/carrier/background-check'),
  onboardingFee:           () => api.post('/api/v1/stripe/onboarding-fee'),
  clearinghouseInitiate:   () => api.post('/api/v1/carrier/clearinghouse'),
  clearinghouseStatus:     () => api.get('/api/v1/carrier/clearinghouse/status'),
};

// ── Admin: financial reporting ─────────────────────────────────────────
export const adminFinancialsApi = {
  get:    (params: Record<string, string>) => api.get('/api/v1/admin/financials', { params }),
  export: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    window.location.href = `/api/v1/admin/financials/export?${qs}`;
  },
};
