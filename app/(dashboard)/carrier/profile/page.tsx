'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, verificationApi, ratingApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Upload, Check, Loader2, CheckCircle, AlertCircle, Clock, Plus, Trash2, Star,
  ShieldCheck, ExternalLink, RefreshCw, ChevronDown, MessageCircle, Phone,
} from 'lucide-react';
import ServiceTypeSelector from '@/components/carrier/ServiceTypeSelector';
import CertificationSelector from '@/components/carrier/CertificationSelector';
import { certificationApi } from '@/lib/api';
import { FinancialTab as FinancialTabComponent } from './components/tabs/FinancialTab';
import { COUNTRIES, getCountry } from '@/lib/countries';
import {
  collectCarrierFieldIssues,
  validateCarrierPersonalForm,
  carrierPersonalFieldErrors,
  checkrPrereqError,
  validateCarrierInsuranceForm,
  validateCarrierCommercialForm,
  validateCarrierVehicleForm,
  type CarrierValidationIssue,
  type CarrierProfileTabId,
} from '@/lib/carrier-profile-validation';

// ── FMCSA result type ────────────────────────────────────────────────────────
interface FmcsaResult {
  dot_number: string;
  legal_name: string | null;
  dba_name: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  allowed_to_operate: boolean;
  operating_status: string | null;
  safety_rating: string | null;
  safety_rating_date: string | null;
  bipd_insurance_on_file: boolean;
  cargo_insurance_on_file: boolean;
  total_drivers: number;
  total_power_units: number;
  mcs150_date: string | null;
}

// ── Vehicle types ─────────────────────────────────────────────────────────────
interface Vehicle {
  id: string;
  year: string;
  make: string;
  model: string;
  type: string;
  vin: string;
  license_plate: string;
  license_plate_state: string;
  gvwr: string;
  max_payload: string;
  cargo_length: string;
  cargo_width: string;
  cargo_height: string;
  registration_expiry: string;
  liftgate: boolean;
  climate_controlled: boolean;
  enclosed: boolean;
  is_primary: boolean;
}

type Tab = 'personal' | 'services' | 'certifications' | 'dot' | 'financial' | 'background' | 'medical' | 'insurance' | 'vehicles' | 'reviews';

// ── Shared helpers ────────────────────────────────────────────────────────────

function RequiredMark() {
  return <span className="text-red-500 font-bold" aria-hidden="true"> *</span>;
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">
      {children}
      {required && <RequiredMark />}
    </p>
  );
}

function DialCodeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (countryCode: string) => void;
}) {
  const current = getCountry(value || 'US');
  return (
    <div className="relative min-w-[7.5rem]">
      <select
        value={current.code}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-2.5 pr-8 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20"
        aria-label="Country calling code"
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.dialCode}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
    </div>
  );
}

function ValidationBanner({
  issues,
  onGoToTab,
}: {
  issues: CarrierValidationIssue[];
  onGoToTab: (tab: CarrierProfileTabId) => void;
}) {
  if (issues.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
      <div className="flex items-start gap-3">
        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {issues.length} required field{issues.length === 1 ? '' : 's'} need attention
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            Fields marked with <span className="text-red-500 font-bold">*</span> are required. Fix missing or invalid values below.
          </p>
        </div>
      </div>
      <ul className="space-y-1.5 pl-7">
        {issues.map((issue) => (
          <li key={issue.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-900">
            <span className="font-semibold">{issue.message}</span>
            <button
              type="button"
              onClick={() => onGoToTab(issue.tab)}
              className="font-semibold text-[var(--color-teal)] hover:underline"
            >
              Go to {issue.tab.charAt(0).toUpperCase() + issue.tab.slice(1)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder, readOnly, hint, required, error,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; readOnly?: boolean; hint?: string;
  required?: boolean; error?: string;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input
        type={type} value={value} readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-xl border bg-[var(--color-white)] px-3.5 py-2.5 text-sm text-[var(--color-text)] transition-colors
          placeholder:text-[var(--color-text-faint)]
          focus:outline-none focus:ring-2
          ${error
            ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
            : 'border-[var(--color-cream-dark)] focus:border-[var(--color-teal)] focus:ring-[var(--color-teal)]/20'}
          ${readOnly ? 'bg-[var(--color-cream)] cursor-default text-[var(--color-text-muted)]' : ''}
        `}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--color-text-faint)] mt-1">{hint}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-[var(--color-text)] mb-4">{children}</p>;
}

function Divider() {
  return <div className="border-t border-[var(--color-cream-dark)] pt-6 mt-2" />;
}

function UploadBox({ label, hint, required, docType, vehicleId }: {
  label: string; hint?: string; required?: boolean;
  docType: string; vehicleId?: number;
}) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('document', file);
      form.append('type', docType);
      form.append('name', file.name);
      if (vehicleId) form.append('vehicle_id', String(vehicleId));
      await api.post('/api/v1/carrier/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploaded(file.name);
      qc.invalidateQueries({ queryKey: ['carrier-documents'] });
      toast.success(`${label} uploaded`);
    } catch {
      toast.error(`Failed to upload ${label}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <Label>{label}</Label>
        {required && <span className="text-xs font-medium text-red-500 -mt-1.5">Required</span>}
      </div>
      {uploaded ? (
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[var(--color-teal)] bg-[var(--color-teal-pale)]">
          <CheckCircle size={16} className="text-[var(--color-teal)]" />
          <span className="text-sm text-[var(--color-text)] flex-1 truncate">{uploaded}</span>
          <button onClick={() => setUploaded('')} className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-danger)]">Replace</button>
        </div>
      ) : (
        <label className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-dashed cursor-pointer transition-colors ${
          uploading ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]' : 'border-[var(--color-cream-dark)] bg-[var(--color-cream)] hover:border-[var(--color-teal)]'
        }`}>
          {uploading ? <Loader2 size={16} className="text-[var(--color-teal)] animate-spin" /> : <Upload size={16} className="text-[var(--color-text-faint)]" />}
          <span className="text-sm text-[var(--color-text-muted)]">{uploading ? 'Uploading…' : 'Click to upload — PDF or image, max 10 MB'}</span>
          <input type="file" accept=".pdf,image/*" className="hidden" disabled={uploading} onChange={handleFile} />
        </label>
      )}
      {hint && <p className="text-xs text-[var(--color-text-faint)] mt-1">{hint}</p>}
    </div>
  );
}

function SaveBar({ saved, onSave, isPending }: { saved: boolean; onSave: () => void; isPending?: boolean }) {
  return (
    <div className="flex items-center justify-end pt-4 border-t border-[var(--color-cream-dark)]">
      <button onClick={onSave} disabled={isPending}
        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-60 ${
          saved
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-light)] shadow-sm'
        }`}>
        {isPending ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
          : saved ? <><Check size={15} /> Saved</>
          : 'Save changes'}
      </button>
    </div>
  );
}

// ── Financial Tab — see components/tabs/FinancialTab.tsx ─────────────────────

// ── Reviews Tab ───────────────────────────────────────────────────────────────

function StarDisplay({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={13}
          className={n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-[var(--color-cream-dark)]'}
        />
      ))}
    </span>
  );
}

function ReviewsTab({ orgId, rating, totalRatings }: { orgId: number; rating: number | null; totalRatings: number }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['org-ratings', orgId, page],
    queryFn:  () => ratingApi.orgRatings(orgId, page).then((r) => r.data),
    enabled:  !!orgId,
  });

  const reviews: any[] = data?.data ?? [];
  const lastPage: number = data?.meta?.last_page ?? 1;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div>
        <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Your Reviews</p>
        {rating != null && totalRatings > 0 ? (
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-[var(--color-slate)]">{Number(rating).toFixed(1)}</span>
            <div>
              <StarDisplay value={rating} />
              <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{totalRatings} review{totalRatings !== 1 ? 's' : ''}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-faint)]">No reviews yet.</p>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--color-cream)] animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 rounded-xl border-2 border-dashed border-[var(--color-cream-dark)]">
          <Star size={28} className="mx-auto text-[var(--color-text-faint)] mb-2" />
          <p className="text-sm text-[var(--color-text-muted)]">No public reviews yet</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-1">Reviews appear here once shippers submit them after completed jobs.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-[var(--color-cream-dark)] p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {typeof r.rater_org === 'string' ? r.rater_org : (r.rater_org?.name ?? 'Shipper')}
                  </p>
                  <p className="text-xs text-[var(--color-text-faint)] capitalize">{r.rater_type}</p>
                </div>
                <div className="text-right shrink-0">
                  <StarDisplay value={r.overall} />
                  <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-[var(--color-text-muted)]">
                <span>Communication: <strong className="text-[var(--color-text)]">{r.communication}/5</strong></span>
                <span>Reliability: <strong className="text-[var(--color-text)]">{r.reliability}/5</strong></span>
              </div>
              {r.comment && (
                <p className="text-sm text-[var(--color-text)] border-t border-[var(--color-cream-dark)] pt-2 mt-1">
                  {r.comment}
                </p>
              )}
            </div>
          ))}

          {/* Pagination */}
          {lastPage > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-[var(--color-cream-dark)] text-sm disabled:opacity-40 hover:border-[var(--color-teal)] transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-[var(--color-text-muted)]">{page} / {lastPage}</span>
              <button
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page === lastPage}
                className="px-3 py-1.5 rounded-lg border border-[var(--color-cream-dark)] text-sm disabled:opacity-40 hover:border-[var(--color-teal)] transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CarrierProfilePage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [saved, setSaved] = useState(false);

  // FMCSA live verification state
  const [dotVerifying, setDotVerifying]   = useState(false);
  const [dotResult, setDotResult]         = useState<FmcsaResult | null>(null);
  const [mcVerifying, setMcVerifying]     = useState(false);
  const [mcResult, setMcResult]           = useState<FmcsaResult | null>(null);

  // Stripe Identity state
  const [identityLoading, setIdentityLoading] = useState(false);

  // Checkr background check state
  const [bgCheckLoading, setBgCheckLoading]               = useState(false);
  const [clearinghouseLoading, setClearinghouseLoading]   = useState(false);
  const [clearinghouseRefreshing, setClearinghouseRefreshing] = useState(false);

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['carrier-profile'],
    queryFn: () => api.get('/api/v1/carrier/profile').then(r => r.data?.data),
    retry: false,
  });

  // Handle Stripe Connect + Stripe Identity returns + tab deep-links
  useEffect(() => {
    const stripeResult   = searchParams.get('stripe');
    const identityResult = searchParams.get('identity');
    const tabParam       = searchParams.get('tab') as Tab | null;

    // Deep-link: ?tab=financial (or any valid tab)
    const validTabs: Tab[] = ['personal', 'services', 'certifications', 'insurance', 'medical', 'financial', 'background', 'vehicles', 'dot', 'reviews'];
    // Stripe returns with ?tab=financial&stripe=..., so the Stripe result is handled first
    if (tabParam && validTabs.includes(tabParam) && !stripeResult && !identityResult) {
      setActiveTab(tabParam);
      router.replace('/carrier/profile');
      return;
    }

    if (stripeResult === 'success') {
      setActiveTab('financial');
      api.get('/api/v1/stripe/connect/status').then((r) => {
        qc.invalidateQueries({ queryKey: ['carrier-profile'] });
        if (r.data?.status === 'verified') toast.success('Stripe account connected!');
        else toast('Stripe is still reviewing your details. This page updates when it finishes.');
      });
      router.replace('/carrier/profile');
    } else if (stripeResult === 'refresh') {
      setActiveTab('financial');
      toast.error('Stripe setup incomplete — please try again.');
      router.replace('/carrier/profile');
    }

    if (identityResult === 'success') {
      setActiveTab('personal');
      qc.invalidateQueries({ queryKey: ['carrier-profile'] });
      toast.success('Identity submitted — verification typically takes a few minutes.');
      router.replace('/carrier/profile');
    }
  }, [searchParams]); // eslint-disable-line

  const [serviceTypeKeys, setServiceTypeKeys]       = useState<string[]>([]);
  const [certificationKeys, setCertificationKeys]   = useState<string[]>([]);

  const [personalForm, setPersonalForm] = useState({
    first_name: '', middle_name: '', last_name: '', suffix: '',
    date_of_birth: '', phone: '', phone_country_code: 'US',
    whatsapp: '', whatsapp_country_code: 'US',
    company_name: '',
    street: '', city: '', state: '', zip: '',
    id_type: 'dl', dl_number: '', dl_state: '', dl_expiry: '',
  });
  const [personalErrors, setPersonalErrors] = useState<Record<string, string>>({});

  const [dotForm, setDotForm] = useState({
    cdl_number: '', cdl_issuing_state: '', cdl_expiry_date: '', cdl_class: 'A',
    usdot_number: '', mc_number: '',
    hazmat_endorsement: false, hazmat_expiry_date: '',
    tanker_endorsement: false,
    passenger_endorsement: false,
  });

  const [medicalForm, setMedicalForm] = useState({
    medical_examiner_name: '',
    dot_medical_expiry: '',
    drug_test_date: '',
    drug_test_result: 'passed',
  });

  // Insurance state
  const [insuranceForm, setInsuranceForm] = useState({
    auto_policy_number: '', auto_insurer: '', auto_coverage: '', auto_effective: '', auto_expiry: '',
    cargo_policy_number: '', cargo_insurer: '', cargo_coverage: '', cargo_expiry: '',
  });
  const [insuranceSaved, setInsuranceSaved] = useState(false);
  const insuranceMutation = useMutation({
    mutationFn: () => api.put('/api/v1/carrier/profile', {
      auto_policy_number: insuranceForm.auto_policy_number,
      auto_insurer_name: insuranceForm.auto_insurer,
      auto_coverage_amount: insuranceForm.auto_coverage,
      auto_effective_date: insuranceForm.auto_effective,
      auto_expiry_date: insuranceForm.auto_expiry,
      cargo_policy_number: insuranceForm.cargo_policy_number,
      cargo_insurer_name: insuranceForm.cargo_insurer,
      cargo_coverage_amount: insuranceForm.cargo_coverage,
      cargo_expiry_date: insuranceForm.cargo_expiry,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carrier-profile'] });
      setInsuranceSaved(true);
      setTimeout(() => setInsuranceSaved(false), 2000);
      toast.success('Insurance information saved');
    },
    onError: () => toast.error('Failed to save insurance'),
  });

  // Vehicles — fetched from API
  const { data: vehiclesData = [] } = useQuery({
    queryKey: ['carrier-vehicles'],
    queryFn: () => api.get('/api/v1/carrier/vehicles').then(r => r.data?.data ?? []),
    retry: false,
  });
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  const newVehicle = (isPrimary: boolean): Vehicle => ({
    id: '',
    year: new Date().getFullYear().toString(),
    make: '', model: '', type: 'box_truck',
    vin: '', license_plate: '', license_plate_state: '',
    gvwr: '', max_payload: '',
    cargo_length: '', cargo_width: '', cargo_height: '',
    registration_expiry: '',
    liftgate: false, climate_controlled: false, enclosed: false,
    is_primary: isPrimary,
  });
  const [vehicleForm, setVehicleForm] = useState<Vehicle>(newVehicle(true));

  const addVehicleMutation = useMutation({
    mutationFn: (data: Omit<Vehicle, 'id'>) => api.post('/api/v1/carrier/vehicles', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carrier-vehicles'] });
      setShowAddVehicle(false);
      setVehicleForm(newVehicle(false));
      toast.success('Vehicle added');
    },
    onError: () => toast.error('Failed to add vehicle'),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/v1/carrier/vehicles/${id}`, { is_primary: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carrier-vehicles'] }),
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/carrier/vehicles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carrier-vehicles'] }),
    onError: () => toast.error('Failed to delete vehicle'),
  });

  useEffect(() => {
    if (profile?.service_type_keys)   setServiceTypeKeys(profile.service_type_keys);
    if (profile?.certification_keys)  setCertificationKeys(profile.certification_keys);
  }, [profile?.service_type_keys, profile?.certification_keys]);


  useEffect(() => {
    if (profile) {
      const parts = (profile.name || '').trim().split(/\s+/);
      setPersonalForm(prev => ({
        ...prev,
        first_name:  parts[0] || '',
        middle_name: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
        last_name:   parts.length > 1 ? parts[parts.length - 1] : '',
        date_of_birth: profile.date_of_birth || '',
        phone:       profile.phone     || '',
        phone_country_code: profile.phone_country_code || 'US',
        whatsapp:    profile.whatsapp  || '',
        whatsapp_country_code: profile.whatsapp_country_code || profile.phone_country_code || 'US',
        company_name: profile.company_name || '',
        street:      profile.street    || '',
        city:        profile.city      || '',
        state:       profile.state     || '',
        zip:         profile.zip       || '',
        id_type:     profile.id_type   || 'dl',
        dl_number:   profile.dl_number || '',
        dl_state:    profile.dl_state  || '',
        dl_expiry:   profile.dl_expiry || '',
      }));
      setPersonalErrors({});
      setDotForm({
        cdl_number: profile.cdl_number || '',
        cdl_issuing_state: profile.cdl_issuing_state || '',
        cdl_expiry_date: profile.cdl_expiry_date || '',
        cdl_class: profile.cdl_class || 'A',
        usdot_number: profile.usdot_number || '',
        mc_number: profile.mc_number || '',
        hazmat_endorsement: profile.hazmat_endorsement || false,
        hazmat_expiry_date: profile.hazmat_expiry_date || '',
        tanker_endorsement: profile.tanker_endorsement || false,
        passenger_endorsement: profile.passenger_endorsement || false,
      });

      // Restore last verification results — no need to re-check every visit
      if (profile.fmcsa_result) setDotResult(profile.fmcsa_result);
      if (profile.mc_result)    setMcResult(profile.mc_result);
      setMedicalForm({
        medical_examiner_name: profile.medical_examiner_name || '',
        dot_medical_expiry: profile.dot_medical_expiry || '',
        drug_test_date: profile.drug_test_date || '',
        drug_test_result: profile.drug_test_result || 'passed',
      });
      setInsuranceForm({
        auto_policy_number: profile.auto_policy_number || '',
        auto_insurer:       profile.auto_insurer_name  || '',
        auto_coverage:      profile.auto_coverage_amount ? String(profile.auto_coverage_amount) : '',
        auto_effective:     profile.auto_effective_date || '',
        auto_expiry:        profile.auto_expiry_date   || '',
        cargo_policy_number: profile.cargo_policy_number || '',
        cargo_insurer:       profile.cargo_insurer_name  || '',
        cargo_coverage:      profile.cargo_coverage_amount ? String(profile.cargo_coverage_amount) : '',
        cargo_expiry:        profile.cargo_expiry_date   || '',
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put('/api/v1/carrier/profile', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carrier-profile'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  // ── FMCSA DOT live verification ─────────────────────────────────────────
  async function verifyDot() {
    const dot = dotForm.usdot_number.trim();
    if (!dot) { toast.error('Enter a USDOT number first'); return; }
    setDotVerifying(true);
    setDotResult(null);
    try {
      const res = await verificationApi.verifyDot(dot);
      setDotResult(res.data.data);
      qc.invalidateQueries({ queryKey: ['carrier-profile'] });
      toast.success(res.data.verified ? '✓ DOT verified — active authority' : 'DOT found — not authorized to operate');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'DOT verification failed');
    } finally {
      setDotVerifying(false);
    }
  }

  // ── FMCSA MC live verification ───────────────────────────────────────────
  async function verifyMc() {
    const mc = dotForm.mc_number.trim();
    if (!mc) { toast.error('Enter an MC number first'); return; }
    setMcVerifying(true);
    setMcResult(null);
    try {
      const res = await verificationApi.verifyMc(mc);
      setMcResult(res.data.data);
      toast.success('MC number found in FMCSA records');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'MC verification failed');
    } finally {
      setMcVerifying(false);
    }
  }

  // ── Stripe Identity ─────────────────────────────────────────────────────
  async function startIdentityVerification() {
    setIdentityLoading(true);
    try {
      const res = await verificationApi.identitySession();
      window.location.href = res.data.url;
    } catch {
      toast.error('Could not start identity verification — try again');
      setIdentityLoading(false);
    }
  }

  if (isLoading) return <div className="py-12 text-center">Loading...</div>;
  if (isError || !profile) return <div className="py-12 text-center text-red-600">Error loading profile</div>;

  const save = (data: any) => updateMutation.mutate(data);

  const validationIssues = collectCarrierFieldIssues({
    firstName: personalForm.first_name || undefined,
    lastName: personalForm.last_name || undefined,
    name: profile.name,
    email: profile.email,
    phone: personalForm.phone || profile.phone || '',
    dateOfBirth: personalForm.date_of_birth || profile.date_of_birth || '',
    street: personalForm.street || profile.street || '',
    city: personalForm.city || profile.city || '',
    state: personalForm.state || profile.state || '',
    zip: personalForm.zip || profile.zip || '',
    requiredFields: profile.required_fields ?? [],
    autoPolicyNumber: insuranceForm.auto_policy_number || profile.auto_policy_number || '',
    cargoPolicyNumber: insuranceForm.cargo_policy_number || profile.cargo_policy_number || '',
    companyName: personalForm.company_name || profile.company_name || '',
    dotNumber: dotForm.usdot_number || profile.usdot_number || profile.dot_number || '',
    mcNumber: dotForm.mc_number || profile.mc_number || '',
    cdlNumber: dotForm.cdl_number || profile.cdl_number || '',
    cdlClass: dotForm.cdl_class || profile.cdl_class || '',
    hazmatEndorsement: !!(dotForm.hazmat_endorsement ?? profile.hazmat_endorsement),
    vehicleCount: Array.isArray(vehiclesData) ? vehiclesData.length : 0,
  });

  const checkrBlocked = checkrPrereqError({
    first_name: personalForm.first_name || (profile.name || '').trim().split(/\s+/)[0] || '',
    last_name: personalForm.last_name || (() => {
      const parts = (profile.name || '').trim().split(/\s+/).filter(Boolean);
      return parts.length > 1 ? parts[parts.length - 1] : '';
    })(),
    date_of_birth: personalForm.date_of_birth || profile.date_of_birth || '',
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'personal',        label: 'Personal' },
    { id: 'services',        label: 'Services' },
    { id: 'certifications',  label: 'Certifications' },
    { id: 'insurance',       label: 'Insurance' },
    { id: 'medical',         label: 'Medical' },
    { id: 'financial',       label: 'Financial' },
    { id: 'background',      label: 'Background' },
    { id: 'vehicles',        label: 'Vehicles' },
    { id: 'dot',             label: 'Commercial' },
    { id: 'reviews',         label: 'Reviews' },
  ];

  const initials = (() => {
    const parts = profile.name.trim().split(/\s+/);
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  })();

  return (
    <div className="w-[75%] min-w-[560px] space-y-6">

      {/* Page heading */}
      <div>
        <h1 className="page-title">
          Account Settings
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Manage your profile, verification documents, payments, and vehicles
        </p>
      </div>

      <ValidationBanner
        issues={validationIssues}
        onGoToTab={(tab) => setActiveTab(tab as Tab)}
      />

      {/* Profile card */}
      <div className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-xl p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[var(--color-slate)] flex items-center justify-center text-white text-lg font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1">
          <p className="text-lg font-semibold text-[var(--color-text)]">{profile.name}</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {profile.carrier_type === 'sole_proprietor' ? 'Owner-Operator' : 'Freight Company'}
          </p>
          <p className="text-xs text-[var(--color-text-faint)] mt-1">Member since {profile.member_since}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[var(--color-text)]">{profile.completion_percentage}%</p>
          <p className="text-xs text-[var(--color-text-faint)]">Complete</p>
          <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
            profile.verification_status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {profile.verification_status === 'verified' ? 'Verified' : 'Incomplete'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-cream-dark)]">
        <div className="flex gap-8">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-1 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[var(--color-teal)] text-[var(--color-teal)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab panels */}
      <div className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-xl p-8">

        {/* ── SERVICES ──────────────────────────────────────────────────── */}
        {activeTab === 'services' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)] mb-1">What do you transport?</p>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                Select all that apply. This determines your required certifications, guides your profile completion, and helps shippers find and filter you.
              </p>
            </div>
            <ServiceTypeSelector
              selected={serviceTypeKeys}
              onChange={setServiceTypeKeys}
            />
            <SaveBar
              saved={saved}
              onSave={() => save({ service_type_keys: serviceTypeKeys })}
              isPending={updateMutation.isPending}
            />
          </div>
        )}

        {/* ── CERTIFICATIONS ────────────────────────────────────────────── */}
        {activeTab === 'certifications' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Your Certifications</p>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                Select all certifications you hold. This builds trust with shippers and may be required for certain service types.
              </p>
            </div>
            <CertificationSelector
              selected={certificationKeys}
              onChange={setCertificationKeys}
            />
            <SaveBar
              saved={saved}
              onSave={async () => {
                await certificationApi.sync(certificationKeys);
                qc.invalidateQueries({ queryKey: ['carrier-profile'] });
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}
              isPending={updateMutation.isPending}
            />
          </div>
        )}

        {/* ── PERSONAL ──────────────────────────────────────────────────── */}
        {activeTab === 'personal' && (
          <div className="space-y-6">
            <SectionTitle>Legal Name</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="First Name"
                value={personalForm.first_name}
                onChange={v => { setPersonalForm(p => ({...p, first_name: v})); setPersonalErrors(e => ({ ...e, first_name: '' })); }}
                placeholder="John"
                required
                error={personalErrors.first_name}
              />
              <Field label="Middle Name" value={personalForm.middle_name} onChange={v => setPersonalForm(p => ({...p, middle_name: v}))} placeholder="Optional" />
              <Field
                label="Last Name"
                value={personalForm.last_name}
                onChange={v => { setPersonalForm(p => ({...p, last_name: v})); setPersonalErrors(e => ({ ...e, last_name: '' })); }}
                placeholder="Smith"
                required
                error={personalErrors.last_name}
              />
              <div>
                <Label>Suffix</Label>
                <select value={personalForm.suffix} onChange={e => setPersonalForm(p => ({...p, suffix: e.target.value}))}
                  className="w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none">
                  <option value="">None</option>
                  <option>Jr.</option><option>Sr.</option>
                  <option>II</option><option>III</option><option>IV</option>
                </select>
              </div>
            </div>

            <div className="border-t border-[var(--color-cream-dark)] pt-6">
              <SectionTitle>Contact Information</SectionTitle>
              <div className="space-y-4">
                <Field label="Email Address" value={profile.email} readOnly required />
                <div>
                  <Label required>Phone Number</Label>
                  <div className="flex gap-2">
                    <DialCodeSelect
                      value={personalForm.phone_country_code}
                      onChange={(code) => setPersonalForm(p => ({ ...p, phone_country_code: code }))}
                    />
                    <div className="relative flex-1 min-w-0">
                      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">
                        <Phone size={14} />
                      </div>
                      <input
                        type="tel"
                        value={personalForm.phone}
                        onChange={(e) => {
                          setPersonalForm(p => ({ ...p, phone: e.target.value }));
                          setPersonalErrors(err => ({ ...err, phone: '' }));
                        }}
                        placeholder="555 000 0000"
                        aria-required
                        aria-invalid={personalErrors.phone ? true : undefined}
                        className={`w-full rounded-xl border bg-[var(--color-white)] pl-9 pr-3.5 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 ${
                          personalErrors.phone
                            ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
                            : 'border-[var(--color-cream-dark)] focus:border-[var(--color-teal)] focus:ring-[var(--color-teal)]/20'
                        }`}
                      />
                    </div>
                  </div>
                  {personalErrors.phone && <p className="mt-1 text-xs text-red-600">{personalErrors.phone}</p>}
                  <p className="mt-1 text-xs text-[var(--color-text-faint)]">
                    Local digits only — country code is selected separately.
                  </p>
                </div>
                <div>
                  <Label>WhatsApp</Label>
                  <div className="flex gap-2">
                    <DialCodeSelect
                      value={personalForm.whatsapp_country_code}
                      onChange={(code) => setPersonalForm(p => ({ ...p, whatsapp_country_code: code }))}
                    />
                    <div className="relative flex-1 min-w-0">
                      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">
                        <MessageCircle size={14} />
                      </div>
                      <input
                        type="tel"
                        value={personalForm.whatsapp}
                        onChange={(e) => setPersonalForm(p => ({ ...p, whatsapp: e.target.value }))}
                        placeholder="Optional — same or different number"
                        className="w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] pl-9 pr-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-faint)]">
                    Optional contact channel. No verification required.
                  </p>
                </div>
                <Field
                  label="Company / DBA name"
                  value={personalForm.company_name}
                  onChange={v => setPersonalForm(p => ({ ...p, company_name: v }))}
                  placeholder="Optional — required for some freight authority types"
                />
              </div>
            </div>

            <div className="border-t border-[var(--color-cream-dark)] pt-6">
              <SectionTitle>Current Address</SectionTitle>
              <p className="text-xs text-[var(--color-text-faint)] mb-4">Required for county-level background check</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field
                    label="Street Address"
                    value={personalForm.street}
                    onChange={v => { setPersonalForm(p => ({...p, street: v})); setPersonalErrors(e => ({ ...e, street: '' })); }}
                    placeholder="3600 Brighton Blvd"
                    required
                    error={personalErrors.street}
                  />
                </div>
                <Field
                  label="City"
                  value={personalForm.city}
                  onChange={v => { setPersonalForm(p => ({...p, city: v})); setPersonalErrors(e => ({ ...e, city: '' })); }}
                  placeholder="Denver"
                  required
                  error={personalErrors.city}
                />
                <Field
                  label="State"
                  value={personalForm.state}
                  onChange={v => { setPersonalForm(p => ({...p, state: v})); setPersonalErrors(e => ({ ...e, state: '' })); }}
                  placeholder="CO"
                  required
                  error={personalErrors.state}
                />
                <Field
                  label="ZIP Code"
                  value={personalForm.zip}
                  onChange={v => { setPersonalForm(p => ({...p, zip: v})); setPersonalErrors(e => ({ ...e, zip: '' })); }}
                  placeholder="80216"
                  required
                  error={personalErrors.zip}
                />
              </div>
            </div>

            <div className="border-t border-[var(--color-cream-dark)] pt-6">
              <SectionTitle>Government-Issued ID</SectionTitle>
              <p className="text-xs text-[var(--color-text-faint)] mb-4">Required for identity verification and background check</p>
              <div className="flex gap-3 mb-4">
                {(['dl', 'passport'] as const).map(t => (
                  <button key={t} onClick={() => setPersonalForm(p => ({...p, id_type: t}))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      personalForm.id_type === t
                        ? 'bg-[var(--color-teal)] text-white border-[var(--color-teal)]'
                        : 'bg-[var(--color-cream)] text-[var(--color-text-muted)] border-[var(--color-cream-dark)]'
                    }`}>
                    {t === 'dl' ? "Driver's License" : 'Passport'}
                  </button>
                ))}
              </div>

              {personalForm.id_type === 'dl' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="DL Number" value={personalForm.dl_number} onChange={v => setPersonalForm(p => ({...p, dl_number: v}))} placeholder="D1234567" />
                    <Field label="Issuing State" value={personalForm.dl_state} onChange={v => setPersonalForm(p => ({...p, dl_state: v}))} placeholder="CO" />
                    <Field label="Expiry Date" value={personalForm.dl_expiry} onChange={v => setPersonalForm(p => ({...p, dl_expiry: v}))} type="date" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <UploadBox label="DL Front" required docType="dl_front" />
                    <UploadBox label="DL Back"  required docType="dl_back" />
                  </div>
                  <UploadBox label="Selfie (for identity matching)" required docType="selfie" hint="Clear photo of your face. Must match your ID." />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-[var(--color-text-faint)]">Upload your passport photo page and a selfie for identity matching.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div /><div />
                  </div>
                  <UploadBox label="Passport Photo Page" required docType="passport" />
                  <UploadBox label="Selfie (for identity matching)" required docType="selfie" hint="Clear photo of your face. Must match your passport." />
                </div>
              )}
            </div>

            <div className="border-t border-[var(--color-cream-dark)] pt-6">
              <SectionTitle>Date of Birth</SectionTitle>
              <div className="max-w-xs">
                <Field
                  label="Date of Birth"
                  value={personalForm.date_of_birth}
                  onChange={v => {
                    setPersonalForm(p => ({...p, date_of_birth: v}));
                    setPersonalErrors(e => ({ ...e, date_of_birth: '' }));
                  }}
                  type="date"
                  required
                  error={personalErrors.date_of_birth}
                  hint="Must be 18+. Required for identity verification and background check."
                />
              </div>
            </div>

            {/* ── Stripe Identity Verification ──────────────────────────── */}
            <div className="border-t border-[var(--color-cream-dark)] pt-6">
              <SectionTitle>Identity Verification</SectionTitle>
              <p className="text-xs text-[var(--color-text-faint)] mb-4">
                Powered by Stripe Identity. You'll be asked to photograph your ID and take a selfie. Takes about 2 minutes.
              </p>

              {profile.identity_verified ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Identity Verified</p>
                    {profile.identity_verified_at && (
                      <p className="text-xs text-emerald-700">
                        Verified {new Date(profile.identity_verified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-cream)] p-4 space-y-1.5 text-sm text-[var(--color-text-muted)]">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Stripe will verify</p>
                    <div className="flex items-center gap-2"><CheckCircle size={13} className="text-[var(--color-teal)] shrink-0" /> Government-issued ID (driver's license or passport)</div>
                    <div className="flex items-center gap-2"><CheckCircle size={13} className="text-[var(--color-teal)] shrink-0" /> Live selfie matched against your ID photo</div>
                    <div className="flex items-center gap-2"><CheckCircle size={13} className="text-[var(--color-teal)] shrink-0" /> ID number extracted and validated</div>
                  </div>
                  <button
                    onClick={startIdentityVerification}
                    disabled={identityLoading}
                    className="flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-60 transition-colors"
                  >
                    {identityLoading
                      ? <><Loader2 size={14} className="animate-spin" /> Opening Stripe…</>
                      : <><ShieldCheck size={14} /> Verify Identity</>}
                  </button>
                </div>
              )}
            </div>

            <SaveBar saved={saved} onSave={() => {
              const msg = validateCarrierPersonalForm(personalForm);
              if (msg) {
                setPersonalErrors(carrierPersonalFieldErrors(personalForm));
                toast.error(msg);
                return;
              }
              setPersonalErrors({});
              const fullName = [personalForm.first_name, personalForm.middle_name, personalForm.last_name, personalForm.suffix].filter(Boolean).join(' ');
              save({
                name:          fullName,
                phone:         personalForm.phone,
                phone_country_code: personalForm.phone_country_code,
                whatsapp:      personalForm.whatsapp || null,
                whatsapp_country_code: personalForm.whatsapp_country_code,
                company_name:  personalForm.company_name || null,
                date_of_birth: personalForm.date_of_birth,
                street:        personalForm.street,
                city:          personalForm.city,
                state:         personalForm.state,
                zip:           personalForm.zip,
                id_type:       personalForm.id_type,
                dl_number:     personalForm.dl_number,
                dl_state:      personalForm.dl_state,
                dl_expiry:     personalForm.dl_expiry || null,
              });
            }} isPending={updateMutation.isPending} />
          </div>
        )}

        {/* ── DOT-COMMERCIAL ────────────────────────────────────────────── */}
        {activeTab === 'dot' && (
          <div className="space-y-6">
            <SectionTitle>Commercial Driver License</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CDL Number" value={dotForm.cdl_number} onChange={v => setDotForm(p => ({...p, cdl_number: v}))} />
              <Field label="Issuing State" value={dotForm.cdl_issuing_state} onChange={v => setDotForm(p => ({...p, cdl_issuing_state: v}))} placeholder="CO" />
              <div>
                <Label>CDL Class</Label>
                <select value={dotForm.cdl_class} onChange={e => setDotForm(p => ({...p, cdl_class: e.target.value}))}
                  className="w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none">
                  <option value="A">Class A — Over 26,001 lbs</option>
                  <option value="B">Class B — Up to 26,000 lbs</option>
                  <option value="C">Class C — Specialized</option>
                </select>
              </div>
              <Field label="CDL Expiry Date" value={dotForm.cdl_expiry_date} onChange={v => setDotForm(p => ({...p, cdl_expiry_date: v}))} type="date" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <UploadBox label="CDL Front" required docType="cdl_front" />
              <UploadBox label="CDL Back"  required docType="cdl_back" />
            </div>

            <div className="border-t border-[var(--color-cream-dark)] pt-6">
              <SectionTitle>Endorsements</SectionTitle>
              <div className="space-y-3">
                {([
                  ['hazmat_endorsement', 'HazMat', true],
                  ['tanker_endorsement', 'Tanker', false],
                  ['passenger_endorsement', 'Passenger', false],
                ] as [keyof typeof dotForm, string, boolean][]).map(([key, label]) => (
                  <div key={key}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={!!dotForm[key]}
                        onChange={e => setDotForm(p => ({...p, [key]: e.target.checked}))}
                        className="w-4 h-4 rounded accent-[var(--color-teal)]" />
                      <span className="text-sm font-medium text-[var(--color-text)]">{label} Endorsement</span>
                    </label>
                    {key === 'hazmat_endorsement' && dotForm.hazmat_endorsement && (
                      <div className="mt-3 ml-7 max-w-xs">
                        <Field label="HazMat Expiry Date" value={dotForm.hazmat_expiry_date} onChange={v => setDotForm(p => ({...p, hazmat_expiry_date: v}))} type="date" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Operating Authority + FMCSA Verification ──────────────── */}
            <div className="border-t border-[var(--color-cream-dark)] pt-6">
              <SectionTitle>
                Operating Authority
                <span className="text-xs font-normal text-[var(--color-text-faint)] ml-2">— Only if operating under independent authority</span>
              </SectionTitle>

              {/* USDOT row */}
              <div className="space-y-3">
                <div>
                  <Label>USDOT Number</Label>
                  <div className="flex gap-2">
                    <input
                      value={dotForm.usdot_number}
                      onChange={e => setDotForm(p => ({...p, usdot_number: e.target.value}))}
                      placeholder="1234567"
                      className="flex-1 rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20"
                    />
                    <button
                      onClick={verifyDot}
                      disabled={dotVerifying || !dotForm.usdot_number.trim()}
                      className="flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-50 transition-colors shrink-0"
                    >
                      {dotVerifying
                        ? <><Loader2 size={13} className="animate-spin" /> Checking…</>
                        : profile.dot_verified
                          ? <><CheckCircle size={13} /> Verified</>
                          : <><ShieldCheck size={13} /> Verify with FMCSA</>}
                    </button>
                  </div>
                  {profile.dot_verified && !dotResult && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle size={11} /> DOT verified against FMCSA SAFER database
                    </p>
                  )}
                </div>

                {/* FMCSA DOT result panel */}
                {dotResult && (
                  <div className={`rounded-xl border p-4 space-y-3 ${
                    dotResult.allowed_to_operate
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {dotResult.allowed_to_operate
                          ? <CheckCircle size={15} className="text-emerald-600" />
                          : <AlertCircle size={15} className="text-red-600" />}
                        <span className={`text-sm font-semibold ${dotResult.allowed_to_operate ? 'text-emerald-800' : 'text-red-800'}`}>
                          {dotResult.allowed_to_operate ? 'Authorized to Operate' : 'NOT Authorized to Operate'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-[var(--color-text-faint)] flex items-center gap-1 justify-end">
                          <ExternalLink size={10} /> FMCSA SAFER
                        </span>
                        {profile.fmcsa_checked_at && (
                          <span className="text-xs text-[var(--color-text-faint)]">
                            Checked {new Date(profile.fmcsa_checked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {profile.fmcsa_expires_at && ` · expires ${new Date(profile.fmcsa_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      {dotResult.legal_name && (
                        <div><p className="text-[var(--color-text-faint)]">Legal Name</p><p className="font-medium text-[var(--color-text)]">{dotResult.legal_name}</p></div>
                      )}
                      {dotResult.operating_status && (
                        <div><p className="text-[var(--color-text-faint)]">Operating Status</p><p className="font-medium text-[var(--color-text)]">{dotResult.operating_status}</p></div>
                      )}
                      <div>
                        <p className="text-[var(--color-text-faint)]">Safety Rating</p>
                        <p className={`font-medium ${dotResult.safety_rating === 'Satisfactory' ? 'text-emerald-700' : dotResult.safety_rating === 'Unsatisfactory' ? 'text-red-700' : 'text-[var(--color-text)]'}`}>
                          {dotResult.safety_rating || 'Not Rated'}
                        </p>
                      </div>
                      {(dotResult.city || dotResult.state) && (
                        <div><p className="text-[var(--color-text-faint)]">Location</p><p className="font-medium text-[var(--color-text)]">{[dotResult.city, dotResult.state].filter(Boolean).join(', ')}</p></div>
                      )}
                      <div>
                        <p className="text-[var(--color-text-faint)]">BIPD Insurance</p>
                        <p className={`font-medium ${dotResult.bipd_insurance_on_file ? 'text-emerald-700' : 'text-red-700'}`}>
                          {dotResult.bipd_insurance_on_file ? 'On File' : 'Not on File'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--color-text-faint)]">Cargo Insurance</p>
                        <p className={`font-medium ${dotResult.cargo_insurance_on_file ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {dotResult.cargo_insurance_on_file ? 'On File' : 'Not on File'}
                        </p>
                      </div>
                      <div><p className="text-[var(--color-text-faint)]">Total Drivers</p><p className="font-medium text-[var(--color-text)]">{dotResult.total_drivers}</p></div>
                      <div><p className="text-[var(--color-text-faint)]">Power Units</p><p className="font-medium text-[var(--color-text)]">{dotResult.total_power_units}</p></div>
                    </div>
                  </div>
                )}

                {/* MC row */}
                <div>
                  <Label>MC Number</Label>
                  <div className="flex gap-2">
                    <input
                      value={dotForm.mc_number}
                      onChange={e => setDotForm(p => ({...p, mc_number: e.target.value}))}
                      placeholder="MC-123456"
                      className="flex-1 rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20"
                    />
                    <button
                      onClick={verifyMc}
                      disabled={mcVerifying || !dotForm.mc_number.trim()}
                      className="flex items-center gap-2 rounded-xl border border-[var(--color-teal)] text-[var(--color-teal)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--color-teal-pale)] disabled:opacity-50 transition-colors shrink-0"
                    >
                      {mcVerifying
                        ? <><Loader2 size={13} className="animate-spin" /> Checking…</>
                        : profile.mc_verified && !mcVerifying
                          ? <><CheckCircle size={13} /> Verified</>
                          : <><ShieldCheck size={13} /> Verify MC</>}
                    </button>
                  </div>
                  {profile.mc_verified && !mcResult && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <CheckCircle size={11} /> MC verified — active operating authority
                    </p>
                  )}
                </div>

                {/* FMCSA MC result panel */}
                {mcResult && (
                  <div className={`rounded-xl border p-4 space-y-3 ${
                    mcResult.allowed_to_operate
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {mcResult.allowed_to_operate
                          ? <CheckCircle size={15} className="text-emerald-600" />
                          : <AlertCircle size={15} className="text-red-600" />}
                        <span className={`text-sm font-semibold ${mcResult.allowed_to_operate ? 'text-emerald-800' : 'text-red-800'}`}>
                          {mcResult.allowed_to_operate ? 'Active Operating Authority' : 'Operating Authority NOT Active'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-[var(--color-text-faint)] flex items-center gap-1 justify-end">
                          <ExternalLink size={10} /> FMCSA SAFER
                        </span>
                        {profile.mc_checked_at && (
                          <span className="text-xs text-[var(--color-text-faint)]">
                            Checked {new Date(profile.mc_checked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {profile.mc_expires_at && ` · expires ${new Date(profile.mc_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      {mcResult.legal_name && (
                        <div><p className="text-[var(--color-text-faint)]">Legal Name</p><p className="font-medium text-[var(--color-text)]">{mcResult.legal_name}</p></div>
                      )}
                      {mcResult.operating_status && (
                        <div><p className="text-[var(--color-text-faint)]">Operating Status</p><p className="font-medium text-[var(--color-text)]">{mcResult.operating_status}</p></div>
                      )}
                      <div><p className="text-[var(--color-text-faint)]">DOT#</p><p className="font-medium text-[var(--color-text)]">{mcResult.dot_number}</p></div>
                      {(mcResult.city || mcResult.state) && (
                        <div><p className="text-[var(--color-text-faint)]">Location</p><p className="font-medium text-[var(--color-text)]">{[mcResult.city, mcResult.state].filter(Boolean).join(', ')}</p></div>
                      )}
                      <div>
                        <p className="text-[var(--color-text-faint)]">BIPD Insurance</p>
                        <p className={`font-medium ${mcResult.bipd_insurance_on_file ? 'text-emerald-700' : 'text-red-700'}`}>
                          {mcResult.bipd_insurance_on_file ? 'On File' : 'Not on File'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--color-text-faint)]">Cargo Insurance</p>
                        <p className={`font-medium ${mcResult.cargo_insurance_on_file ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {mcResult.cargo_insurance_on_file ? 'On File' : 'Not on File'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <SaveBar saved={saved} onSave={() => {
              const msg = validateCarrierCommercialForm(dotForm, profile.required_fields ?? []);
              if (msg) {
                toast.error(msg);
                return;
              }
              save({
                ...dotForm,
                usdot_number: dotForm.usdot_number,
                // Keep legacy alias in sync when API still reads dot_number
                dot_number: dotForm.usdot_number || undefined,
              });
            }} isPending={updateMutation.isPending} />
          </div>
        )}

        {/* ── FINANCIAL ─────────────────────────────────────────────────── */}
        {activeTab === 'financial' && (
          <FinancialTabComponent />
        )}

        {/* ── BACKGROUND ────────────────────────────────────────────────── */}
        {activeTab === 'background' && (
          <div className="space-y-6">
            <div>
              <SectionTitle>Background Screening</SectionTitle>
              <p className="text-sm text-[var(--color-text-muted)]">
                All carriers on Shipmater must pass a comprehensive background screen before platform access is granted.
                Checks are run through <strong className="text-[var(--color-text)]">Checkr</strong> (criminal, MVR, watchlist, sex offender registry)
                and the <strong className="text-[var(--color-text)]">FMCSA Drug &amp; Alcohol Clearinghouse</strong> (federal requirement for CDL holders).
              </p>
            </div>

            {/* ── Check breakdown grid ─────────────────────────────────── */}
            {(() => {
              const bgStatus = profile.background_check_status;
              const isDone   = bgStatus === 'clear';
              const isFailed = bgStatus === 'suspended';
              const isReview = bgStatus === 'consider';
              const isPending = ['pending', 'invitation_sent'].includes(bgStatus ?? '');

              const checks = [
                {
                  label: 'Criminal Background',
                  detail: 'National, federal, and county-level criminal records',
                  provider: 'Checkr',
                },
                {
                  label: 'Motor Vehicle Record',
                  detail: 'Driving history, violations, suspensions, DUI',
                  provider: 'Checkr',
                },
                {
                  label: 'Sex Offender Registry',
                  detail: 'National sex offender registry — required for all carriers',
                  provider: 'Checkr',
                  highlight: true,
                },
                {
                  label: 'OFAC / Watchlist',
                  detail: 'Terrorist watchlist, sanctions, global watchlists',
                  provider: 'Checkr',
                },
              ];

              return (
                <div className="rounded-xl border border-[var(--color-cream-dark)] divide-y divide-[var(--color-cream-dark)]">
                  {checks.map((c) => (
                    <div key={c.label} className={`flex items-center gap-4 px-4 py-3 ${c.highlight ? 'bg-[var(--color-cream-pale)]' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isDone   ? 'bg-emerald-100' :
                        isFailed ? 'bg-red-100' :
                        isReview ? 'bg-amber-100' :
                        isPending ? 'bg-blue-50' :
                        'bg-[var(--color-cream)]'
                      }`}>
                        {isDone   ? <CheckCircle size={14} className="text-emerald-600" /> :
                         isFailed ? <AlertCircle size={14} className="text-red-500" /> :
                         isReview ? <AlertCircle size={14} className="text-amber-500" /> :
                         isPending ? <Loader2 size={13} className="text-blue-500 animate-spin" /> :
                         <Clock size={13} className="text-[var(--color-text-faint)]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)]">{c.label}</p>
                        <p className="text-xs text-[var(--color-text-muted)] truncate">{c.detail}</p>
                      </div>
                      <span className="text-xs text-[var(--color-text-faint)] shrink-0">{c.provider}</span>
                    </div>
                  ))}

                  {/* Clearinghouse — separate federal check */}
                  <div className="flex items-center gap-4 px-4 py-3 bg-yellow-50">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-yellow-100">
                      <Clock size={13} className="text-yellow-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--color-text)]">Drug &amp; Alcohol Clearinghouse</p>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-200 text-yellow-800 uppercase tracking-wide">Federal — Required</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">FMCSA federal database — CDL drug/alcohol violations from all prior employers</p>
                    </div>
                    <span className="text-xs text-[var(--color-text-faint)] shrink-0">FMCSA</span>
                  </div>
                </div>
              );
            })()}

            {/* ── Prerequisites ───────────────────────────────────────── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Required information</p>
              <div className="rounded-xl border border-[var(--color-cream-dark)] divide-y divide-[var(--color-cream-dark)]">
                {[
                  { label: 'Legal name',                                             done: !!(profile.name) },
                  { label: "Driver's license number",                                done: !!(profile.cdl_number) },
                  { label: 'Date of birth',                                          done: !!(profile.date_of_birth) },
                  { label: 'Home address',                                           done: !!(personalForm.street && personalForm.city) },
                  { label: "Full SSN — entered directly on Checkr's secure form",   done: false, note: 'Collected by Checkr only' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    {item.done
                      ? <CheckCircle size={15} className="text-[var(--color-success)] shrink-0" />
                      : <Clock size={15} className="text-[var(--color-warning)] shrink-0" />}
                    <span className={`text-sm flex-1 ${item.done ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>{item.label}</span>
                    {item.note
                      ? <span className="text-xs text-[var(--color-text-faint)]">{item.note}</span>
                      : !item.done && <span className="text-xs text-[var(--color-text-faint)]">Missing</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Checkr status panel ──────────────────────────────────── */}
            {profile.background_check_status === 'clear' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Checkr Background Check — Passed</p>
                    {profile.background_check_completed_at && (
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Completed {new Date(profile.background_check_completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Criminal — clear', 'MVR — clear', 'Sex offender registry — clear', 'OFAC / Watchlist — clear'].map(item => (
                    <div key={item} className="flex items-center gap-1.5 text-xs text-emerald-700">
                      <CheckCircle size={11} className="shrink-0" /> {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.background_check_status === 'consider' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Under Manual Review</p>
                  <p className="text-xs text-amber-700 mt-0.5">One or more results require a manual review. Our team will follow up within 2 business days.</p>
                </div>
              </div>
            )}

            {profile.background_check_status === 'suspended' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Background Check — Not Passed</p>
                  <p className="text-xs text-red-700 mt-0.5">Your background check did not meet our requirements. Contact support@shipmater.com if you believe this is in error.</p>
                </div>
              </div>
            )}

            {profile.background_check_status === 'pending' && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
                <Loader2 size={18} className="text-blue-600 shrink-0 mt-0.5 animate-spin" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Checkr Report In Progress</p>
                  <p className="text-xs text-blue-700 mt-0.5">Processing your criminal, MVR, sex offender, and watchlist checks. Typically 3–5 business days.</p>
                </div>
              </div>
            )}

            {profile.background_check_status === 'invitation_sent' && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
                <Clock size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-800">Action Required — Complete the Checkr Form</p>
                  <p className="text-xs text-blue-700 mt-0.5 mb-3">Enter your SSN directly on Checkr's secure form — we never see or store it.</p>
                  {profile.background_check_invitation_url && (
                    <a
                      href={profile.background_check_invitation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 text-xs font-semibold hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink size={12} /> Open Checkr Form
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* ── FMCSA Clearinghouse ──────────────────────────────────── */}
            {(() => {
              const chStatus = profile.clearinghouse_query_status ?? 'not_run';
              const isClear      = chStatus === 'clear';
              const isViolations = chStatus === 'violations_found';
              const isPendingConsent = chStatus === 'pending_consent';
              const isQuerying   = chStatus === 'querying';
              const isError      = chStatus === 'error';
              const canInitiate  = ['not_run', 'error'].includes(chStatus);

              const statusConfig: Record<string, { label: string; bg: string; border: string; text: string }> = {
                not_run:         { label: 'Not started',        bg: 'bg-yellow-50',  border: 'border-yellow-200', text: 'text-yellow-800' },
                pending_consent: { label: 'Awaiting consent',   bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-800'   },
                querying:        { label: 'Processing',          bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-800'   },
                clear:           { label: 'No violations',       bg: 'bg-emerald-50', border: 'border-emerald-200','text': 'text-emerald-800' },
                violations_found:{ label: 'Violations found',   bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-800'    },
                error:           { label: 'Error — retry',       bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-800' },
              };
              const cfg = statusConfig[chStatus] ?? statusConfig['not_run'];

              return (
                <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-5 space-y-3`}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2 flex-wrap">
                        FMCSA Drug &amp; Alcohol Clearinghouse
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-200 text-yellow-800 uppercase tracking-wide">Federal Law · 49 CFR §382</span>
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Required for all CDL drivers. Checks federal drug &amp; alcohol violations across every prior employer.
                        Cost: $1.25 pre-employment query — covered by your platform fee.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Manual refresh when pending */}
                      {['pending_consent', 'querying'].includes(chStatus) && (
                        <button
                          onClick={async () => {
                            setClearinghouseRefreshing(true);
                            try {
                              await verificationApi.clearinghouseStatus();
                              await refetch();
                            } finally {
                              setClearinghouseRefreshing(false);
                            }
                          }}
                          disabled={clearinghouseRefreshing}
                          className="p-1.5 rounded-lg hover:bg-white/60 text-[var(--color-text-muted)] transition-colors"
                          title="Refresh status"
                        >
                          <RefreshCw size={13} className={clearinghouseRefreshing ? 'animate-spin' : ''} />
                        </button>
                      )}
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.border} ${cfg.text} ${cfg.bg}`}>
                        {isClear && <CheckCircle size={11} className="inline mr-1" />}
                        {isViolations && <AlertCircle size={11} className="inline mr-1" />}
                        {(isPendingConsent || isQuerying) && <Loader2 size={11} className="inline mr-1 animate-spin" />}
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Clear result */}
                  {isClear && (
                    <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                      <CheckCircle size={15} />
                      No drug or alcohol violations found
                      {profile.clearinghouse_completed_at && (
                        <span className="text-xs font-normal text-emerald-600 ml-1">
                          · Verified {new Date(profile.clearinghouse_completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Violations found */}
                  {isViolations && (
                    <div className="rounded-lg bg-white border border-red-200 p-3 text-xs text-red-800 space-y-1">
                      <p className="font-semibold">Violations found on your Clearinghouse record</p>
                      <p>Our team will review your record and contact you within 2 business days. You may dispute records directly at <a href="https://clearinghouse.fmcsa.dot.gov" target="_blank" rel="noopener noreferrer" className="underline">clearinghouse.fmcsa.dot.gov</a>.</p>
                    </div>
                  )}

                  {/* Awaiting consent */}
                  {isPendingConsent && (
                    <div className="rounded-lg bg-white border border-blue-200 p-3 space-y-2 text-xs text-blue-900">
                      <p className="font-semibold">Action required — grant consent on the FMCSA portal</p>
                      <p>You should have received an email from FMCSA. Log in at the link below, find the pending consent request from Shipmater, and approve it.</p>
                      <a
                        href="https://clearinghouse.fmcsa.dot.gov"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 font-semibold hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink size={11} /> Open FMCSA Clearinghouse Portal
                      </a>
                    </div>
                  )}

                  {/* Processing */}
                  {isQuerying && (
                    <div className="flex items-center gap-2 text-blue-700 text-sm">
                      <Loader2 size={14} className="animate-spin" />
                      Consent received — FMCSA is processing your report. Typically 1–3 business days.
                    </div>
                  )}

                  {/* Error */}
                  {isError && (
                    <p className="text-xs text-orange-800">Query encountered an error. Click &quot;Run Query&quot; below to retry.</p>
                  )}

                  {/* How it works (when not yet run) */}
                  {chStatus === 'not_run' && (
                    <div className="rounded-lg bg-white border border-yellow-200 p-3 space-y-1.5 text-xs text-[var(--color-text-muted)]">
                      <p className="font-semibold text-[var(--color-text)] mb-1">How it works:</p>
                      <div className="flex items-start gap-2"><span className="text-yellow-600 shrink-0">1.</span> We submit a query to FMCSA using your CDL number</div>
                      <div className="flex items-start gap-2"><span className="text-yellow-600 shrink-0">2.</span> FMCSA emails you a consent request — you approve at clearinghouse.fmcsa.dot.gov</div>
                      <div className="flex items-start gap-2"><span className="text-yellow-600 shrink-0">3.</span> FMCSA returns "no violations" or your violation history (1–3 days)</div>
                      <div className="flex items-start gap-2"><span className="text-yellow-600 shrink-0">4.</span> Annual limited queries run automatically (free)</div>
                    </div>
                  )}

                  {/* Initiate button */}
                  {canInitiate && (
                    <button
                      disabled={clearinghouseLoading || !profile.cdl_number || !profile.cdl_issuing_state}
                      title={!profile.cdl_number || !profile.cdl_issuing_state ? 'Add CDL number and state in the Commercial tab first' : ''}
                      onClick={async () => {
                        setClearinghouseLoading(true);
                        try {
                          const res = await verificationApi.clearinghouseInitiate();
                          await refetch();
                          toast.success(res.data.message ?? 'Clearinghouse query submitted — check your email for a consent request.');
                        } catch (err: unknown) {
                          const e = err as { response?: { data?: { error?: string; pending?: boolean } } };
                          if (e?.response?.data?.pending) {
                            toast.info('Clearinghouse integration is being finalised — you will be notified when it\'s ready.');
                          } else {
                            toast.error(e?.response?.data?.error ?? 'Failed to submit Clearinghouse query. Try again.');
                          }
                        } finally {
                          setClearinghouseLoading(false);
                        }
                      }}
                      className="flex items-center gap-2 rounded-lg bg-[var(--color-teal)] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[var(--color-teal-light)] disabled:opacity-40 transition-colors"
                    >
                      {clearinghouseLoading
                        ? <><Loader2 size={13} className="animate-spin" /> Submitting…</>
                        : isError ? 'Retry Query' : 'Run Clearinghouse Query'}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* ── Run Checkr button ────────────────────────────────────── */}
            {['not_started', 'suspended'].includes(profile.background_check_status ?? 'not_started') && (
              <div className="flex items-center justify-between pt-2 border-t border-[var(--color-cream-dark)]">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {profile.background_check_status === 'suspended' ? 'Re-run Checkr Background Check' : 'Start Checkr Background Check'}
                  </p>
                  <p className="text-xs text-[var(--color-text-faint)] mt-0.5">Criminal · MVR · Sex offender registry · OFAC — results in 3–5 business days</p>
                </div>
                <button
                  disabled={bgCheckLoading || !!checkrBlocked}
                  className="flex items-center gap-2 rounded-lg bg-[var(--color-teal)] text-white px-5 py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-[var(--color-teal-light)] transition-colors"
                  title={checkrBlocked || ''}
                  onClick={async () => {
                    const prereq = checkrPrereqError({
                      first_name: personalForm.first_name,
                      last_name: personalForm.last_name,
                      date_of_birth: personalForm.date_of_birth || profile.date_of_birth || '',
                    });
                    if (prereq) {
                      toast.error(prereq);
                      setActiveTab('personal');
                      return;
                    }
                    setBgCheckLoading(true);
                    try {
                      const res = await verificationApi.initiateBackgroundCheck();
                      const { invitation_url } = res.data;
                      await refetch();
                      if (invitation_url) window.open(invitation_url, '_blank');
                      toast.success('Background check initiated — complete the secure Checkr form.');
                    } catch (err: unknown) {
                      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
                      toast.error(msg ?? 'Failed to initiate background check. Try again.');
                    } finally {
                      setBgCheckLoading(false);
                    }
                  }}
                >
                  {bgCheckLoading
                    ? <><Loader2 size={13} className="animate-spin" /> Starting…</>
                    : 'Run Background Check'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MEDICAL ───────────────────────────────────────────────────── */}
        {activeTab === 'medical' && (
          <div className="space-y-6">
            <SectionTitle>DOT Medical Certificate</SectionTitle>
            <p className="text-sm text-[var(--color-text-muted)]">Required for all CDL holders. Must be renewed before expiry or your account will be suspended.</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Issuing Medical Examiner Name" value={medicalForm.medical_examiner_name} onChange={v => setMedicalForm(p => ({...p, medical_examiner_name: v}))} placeholder="Dr. Jane Smith" />
              <Field label="Expiry Date" value={medicalForm.dot_medical_expiry} onChange={v => setMedicalForm(p => ({...p, dot_medical_expiry: v}))} type="date" />
            </div>
            <UploadBox label="DOT Medical Certificate" required docType="medical_cert" hint="Upload the physical certificate issued by your medical examiner." />

            <div className="border-t border-[var(--color-cream-dark)] pt-6">
              <SectionTitle>Drug & Alcohol Testing</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Last Test Date" value={medicalForm.drug_test_date} onChange={v => setMedicalForm(p => ({...p, drug_test_date: v}))} type="date" />
                <div>
                  <Label>Result</Label>
                  <select value={medicalForm.drug_test_result} onChange={e => setMedicalForm(p => ({...p, drug_test_result: e.target.value}))}
                    className="w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none">
                    <option value="passed">Passed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 mt-0.5 rounded accent-[var(--color-teal)]" />
              <span className="text-sm text-[var(--color-text-muted)]">I consent to drug and alcohol testing as required by federal law and platform policy.</span>
            </label>

            <SaveBar saved={saved} onSave={() => save(medicalForm)} isPending={updateMutation.isPending} />
          </div>
        )}

        {/* ── INSURANCE ─────────────────────────────────────────────────── */}
        {activeTab === 'insurance' && (
          <div className="space-y-6">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
              <strong>Minimums:</strong> $750,000 commercial auto (general freight) · $1,000,000+ (HazMat) · Cargo insurance recommended
            </div>

            <SectionTitle>Commercial Auto Insurance</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Policy Number"     value={insuranceForm.auto_policy_number} onChange={v => setInsuranceForm(p => ({...p, auto_policy_number: v}))} />
              <Field label="Insurer Name"       value={insuranceForm.auto_insurer}       onChange={v => setInsuranceForm(p => ({...p, auto_insurer: v}))}       placeholder="Progressive Commercial" />
              <Field label="Coverage Amount ($)" value={insuranceForm.auto_coverage}     onChange={v => setInsuranceForm(p => ({...p, auto_coverage: v}))}     placeholder="750000" />
              <Field label="Effective Date"     value={insuranceForm.auto_effective}     onChange={v => setInsuranceForm(p => ({...p, auto_effective: v}))}     type="date" />
              <Field label="Expiry Date"        value={insuranceForm.auto_expiry}        onChange={v => setInsuranceForm(p => ({...p, auto_expiry: v}))}        type="date" />
            </div>
            <UploadBox label="Certificate of Insurance (COI)" required docType="insurance_auto" hint="Upload the Certificate of Insurance. Must be current." />

            <div className="border-t border-[var(--color-cream-dark)] pt-6">
              <SectionTitle>Cargo Insurance</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Policy Number"     value={insuranceForm.cargo_policy_number} onChange={v => setInsuranceForm(p => ({...p, cargo_policy_number: v}))} />
                <Field label="Insurer Name"       value={insuranceForm.cargo_insurer}       onChange={v => setInsuranceForm(p => ({...p, cargo_insurer: v}))} />
                <Field label="Coverage Amount ($)" value={insuranceForm.cargo_coverage}     onChange={v => setInsuranceForm(p => ({...p, cargo_coverage: v}))}   placeholder="50000" />
                <Field label="Expiry Date"        value={insuranceForm.cargo_expiry}        onChange={v => setInsuranceForm(p => ({...p, cargo_expiry: v}))}      type="date" />
              </div>
              <div className="mt-4">
                <UploadBox label="Cargo Insurance Certificate" docType="insurance_cargo" hint="Optional but strongly recommended." />
              </div>
            </div>

            <SaveBar saved={insuranceSaved} onSave={() => {
              const msg = validateCarrierInsuranceForm(
                {
                  auto_policy_number: insuranceForm.auto_policy_number,
                  cargo_policy_number: insuranceForm.cargo_policy_number,
                },
                profile.required_fields ?? [],
              );
              if (msg) {
                toast.error(msg);
                return;
              }
              insuranceMutation.mutate();
            }} isPending={insuranceMutation.isPending} />
          </div>
        )}

        {/* ── VEHICLES ──────────────────────────────────────────────────── */}
        {activeTab === 'vehicles' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <SectionTitle>Your Fleet</SectionTitle>
                <p className="text-xs text-[var(--color-text-faint)] -mt-3">{vehiclesData.length} vehicle{vehiclesData.length !== 1 ? 's' : ''} registered</p>
              </div>
              <button
                onClick={() => { setVehicleForm(newVehicle(vehiclesData.length === 0)); setShowAddVehicle(true); }}
                className="flex items-center gap-2 rounded-lg bg-[var(--color-teal)] text-white px-4 py-2 text-sm font-medium hover:bg-[var(--color-teal-light)]"
              >
                <Plus size={15} /> Add Vehicle
              </button>
            </div>

            {vehiclesData.length === 0 && !showAddVehicle && (
              <div className="text-center py-10 rounded-lg border-2 border-dashed border-[var(--color-cream-dark)]">
                <p className="text-sm text-[var(--color-text-muted)]">No vehicles yet</p>
                <p className="text-xs text-[var(--color-text-faint)] mt-1">Add your first truck or trailer to start bidding on jobs</p>
              </div>
            )}

            {vehiclesData.map((v: any) => (
              <div key={v.id} className="rounded-xl border border-[var(--color-cream-dark)] p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[var(--color-text)]">{v.year} {v.make} {v.model}</p>
                      {v.is_primary && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-teal-pale)] text-[var(--color-teal)] text-xs font-medium">
                          <Star size={11} fill="currentColor" /> Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-faint)] mt-0.5 capitalize">{v.type?.replace('_', ' ')} · {v.license_plate} {v.license_plate_state}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!v.is_primary && (
                      <button
                        onClick={() => setPrimaryMutation.mutate(String(v.id))}
                        disabled={setPrimaryMutation.isPending}
                        className="text-xs text-[var(--color-teal)] hover:underline disabled:opacity-50"
                      >
                        Set primary
                      </button>
                    )}
                    <button
                      onClick={() => deleteVehicleMutation.mutate(String(v.id))}
                      disabled={deleteVehicleMutation.isPending}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--color-text-faint)] hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      {deleteVehicleMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 text-xs text-[var(--color-text-muted)]">
                  <div><span className="text-[var(--color-text-faint)]">GVWR</span><br />{v.gvwr ? `${Number(v.gvwr).toLocaleString()} lbs` : '—'}</div>
                  <div><span className="text-[var(--color-text-faint)]">Payload</span><br />{v.max_payload ? `${Number(v.max_payload).toLocaleString()} lbs` : '—'}</div>
                  <div><span className="text-[var(--color-text-faint)]">Cargo (L×W×H)</span><br />
                    {v.cargo_length && v.cargo_width && v.cargo_height
                      ? `${v.cargo_length}" × ${v.cargo_width}" × ${v.cargo_height}"`
                      : '—'}
                  </div>
                  <div><span className="text-[var(--color-text-faint)]">VIN</span><br />{v.vin || '—'}</div>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {v.liftgate && <span className="px-1.5 py-0.5 rounded bg-[var(--color-cream)] text-xs text-[var(--color-text-faint)]">Liftgate</span>}
                  {v.climate_controlled && <span className="px-1.5 py-0.5 rounded bg-[var(--color-cream)] text-xs text-[var(--color-text-faint)]">Climate</span>}
                  {v.enclosed && <span className="px-1.5 py-0.5 rounded bg-[var(--color-cream)] text-xs text-[var(--color-text-faint)]">Enclosed</span>}
                  {v.registration_expiry && <span className="px-1.5 py-0.5 rounded bg-[var(--color-cream)] text-xs text-[var(--color-text-faint)]">Reg. exp. {v.registration_expiry}</span>}
                </div>
              </div>
            ))}

            {/* Add vehicle form */}
            {showAddVehicle && (
              <div className="rounded-xl border-2 border-[var(--color-teal)] p-6 space-y-5">
                <p className="font-semibold text-[var(--color-text)]">New Vehicle</p>

                {/* Year / Make / Model */}
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Year" value={vehicleForm.year} onChange={v => setVehicleForm(p => ({...p, year: v}))} placeholder={new Date().getFullYear().toString()} />
                  <Field label="Make" value={vehicleForm.make} onChange={v => setVehicleForm(p => ({...p, make: v}))} placeholder="Freightliner" />
                  <Field label="Model" value={vehicleForm.model} onChange={v => setVehicleForm(p => ({...p, model: v}))} placeholder="Cascadia" />
                </div>

                {/* Type */}
                <div>
                  <Label>Vehicle Type</Label>
                  <select value={vehicleForm.type} onChange={e => setVehicleForm(p => ({...p, type: e.target.value}))}
                    className="w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none">
                    <option value="box_truck">Box Truck</option>
                    <option value="flatbed">Flatbed</option>
                    <option value="enclosed_trailer">Enclosed Trailer</option>
                    <option value="refrigerated">Refrigerated</option>
                    <option value="tanker">Tanker</option>
                    <option value="pickup_with_trailer">Pickup with Trailer</option>
                    <option value="step_deck">Step Deck</option>
                    <option value="lowboy">Lowboy</option>
                  </select>
                </div>

                {/* VIN / Plate */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="VIN" value={vehicleForm.vin} onChange={v => setVehicleForm(p => ({...p, vin: v}))} placeholder="1FUJA6CV17LY12345" />
                  <Field label="License Plate" value={vehicleForm.license_plate} onChange={v => setVehicleForm(p => ({...p, license_plate: v}))} placeholder="ABC-1234" />
                  <Field label="Plate State" value={vehicleForm.license_plate_state} onChange={v => setVehicleForm(p => ({...p, license_plate_state: v}))} placeholder="CO" />
                </div>

                {/* GVWR / Payload */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="GVWR (lbs)" value={vehicleForm.gvwr} onChange={v => setVehicleForm(p => ({...p, gvwr: v}))} placeholder="80000" />
                  <Field label="Max Payload (lbs)" value={vehicleForm.max_payload} onChange={v => setVehicleForm(p => ({...p, max_payload: v}))} placeholder="45000" />
                </div>

                {/* Cargo Dimensions */}
                <div>
                  <Label>Cargo Dimensions (inches)</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Length" value={vehicleForm.cargo_length} onChange={v => setVehicleForm(p => ({...p, cargo_length: v}))} placeholder='480"' />
                    <Field label="Width" value={vehicleForm.cargo_width} onChange={v => setVehicleForm(p => ({...p, cargo_width: v}))} placeholder='96"' />
                    <Field label="Height" value={vehicleForm.cargo_height} onChange={v => setVehicleForm(p => ({...p, cargo_height: v}))} placeholder='110"' />
                  </div>
                </div>

                {/* Vehicle Registration */}
                <div className="grid grid-cols-2 gap-4 items-end">
                  <Field label="Registration Expiry" value={vehicleForm.registration_expiry} onChange={v => setVehicleForm(p => ({...p, registration_expiry: v}))} type="date" />
                </div>
                <UploadBox label="Vehicle Registration" required docType="vehicle_registration" hint="Upload current registration document." />

                {/* Vehicle Photos */}
                <div>
                  <Label>Vehicle Photos</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <UploadBox label="Front"      required docType="vehicle_photo_front" />
                    <UploadBox label="Rear"       required docType="vehicle_photo_rear" />
                    <UploadBox label="Cargo Area" required docType="vehicle_photo_cargo" />
                  </div>
                </div>

                {/* Features */}
                <div>
                  <Label>Features</Label>
                  <div className="flex gap-4">
                    {([['liftgate', 'Liftgate'], ['climate_controlled', 'Climate Controlled'], ['enclosed', 'Enclosed']] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={vehicleForm[key]}
                          onChange={e => setVehicleForm(p => ({...p, [key]: e.target.checked}))}
                          className="w-4 h-4 rounded accent-[var(--color-teal)]" />
                        <span className="text-sm text-[var(--color-text)]">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Primary */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={vehicleForm.is_primary}
                    onChange={e => setVehicleForm(p => ({...p, is_primary: e.target.checked}))}
                    className="w-4 h-4 rounded accent-[var(--color-teal)]" />
                  <span className="text-sm font-medium text-[var(--color-text)]">Set as primary vehicle</span>
                </label>

                <div className="flex gap-3 pt-2 border-t border-[var(--color-cream-dark)]">
                  <button
                    onClick={() => {
                      const msg = validateCarrierVehicleForm(vehicleForm);
                      if (msg) {
                        toast.error(msg);
                        return;
                      }
                      const { id, ...data } = vehicleForm;
                      addVehicleMutation.mutate(data as any);
                    }}
                    disabled={addVehicleMutation.isPending}
                    className="flex items-center gap-2 rounded-lg bg-[var(--color-teal)] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[var(--color-teal-light)] disabled:opacity-60"
                  >
                    {addVehicleMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                    Save Vehicle
                  </button>
                  <button
                    onClick={() => setShowAddVehicle(false)}
                    className="rounded-lg border border-[var(--color-cream-dark)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:border-[var(--color-teal)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── REVIEWS ──────────────────────────────────────────────────── */}
        {activeTab === 'reviews' && (
          <ReviewsTab orgId={profile.org_id} rating={profile.rating} totalRatings={profile.total_ratings} />
        )}

      </div>
    </div>
  );
}
