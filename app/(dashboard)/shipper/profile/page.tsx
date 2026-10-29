'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentApi, profileApi, orgApi, shipperVerificationApi } from '@/lib/api';
import { TeamManager } from '@/components/team/TeamManager';
import { PlaidLinkButton } from '@/components/payments/PlaidLinkButton';
import {
  User, Building2, CreditCard, Bell, Zap,
  Camera, Check, ChevronDown, Plus, Trash2,
  Mail, Phone, MapPin, Globe, Hash, Shield,
  AlertCircle, Landmark, X, Loader2, Star,
  CalendarDays, RefreshCw, ChevronRight, Upload, FileCheck,
  Users, Package, Crown, UserMinus, Send, MessageCircle,
} from 'lucide-react';
import ServiceTypeSelector from '@/components/carrier/ServiceTypeSelector';
import AddressFields from '@/components/shared/AddressFields';
import { ProfileSection } from '@/components/shared/ProfileSection';
import { toast } from 'sonner';
import { COUNTRIES, getCountry } from '@/lib/countries';
import {
  collectFieldIssues,
  validateProfileTabForm,
  validateBusinessTabForm,
  profileTabFieldErrors,
  looksLikeEmail,
  looksLikePhone,
  looksLikeNationalPhone,
  type ProfileTabId,
  type ValidationIssue,
} from '@/lib/shipper-profile-validation';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'business' | 'services' | 'compliance' | 'payment' | 'subscription' | 'notifications' | 'team';

interface ShipperProfile {
  name: string; email: string; phone: string; member_since: string;
  phone_country_code: string;
  whatsapp: string;
  whatsapp_country_code: string;
  street: string; city: string; state: string; zip: string; country: string;
  // business
  company: string; dba: string; business_type: string; ein: string;
  tax_id: string; tax_id_type: string;
  state_of_incorporation: string; year_established: string; employee_count: string;
  industry: string; website: string; business_phone: string; business_email: string;
  sam_gov_number: string; currency: string;
  // registered address
  biz_street: string; biz_city: string; biz_state: string; biz_zip: string; biz_country: string;
  // operating address
  ops_same_as_biz: boolean;
  ops_street: string; ops_city: string; ops_state: string; ops_zip: string; ops_country: string;
  // verification
  verification_status: string; email_verified: boolean; phone_verified: boolean; ein_verified: boolean;
  // shipping defaults
  default_pickup_contact_name: string; default_pickup_contact_phone: string;
  internal_ref_format: string; preferred_categories: string[]; notif_recipients: string[];
  // compliance
  coi_url: string; coi_expiry: string;
  hipaa_baa_url: string; hipaa_baa_expiry: string;
  hazmat_reg_url: string; hazmat_reg_expiry: string;
  // notifications
  notif_email: Record<string, boolean>;
  notif_sms:   Record<string, boolean>;
  // org / services
  service_type_keys: string[];
  org_name: string;
}

interface PaymentMethod {
  id: number; type: 'card' | 'bank';
  brand: string | null; last4: string;
  exp_month: string | null; exp_year: string | null;
  bank_name: string | null; account_type: 'checking' | 'savings' | null;
  is_default: boolean;
}

interface NewCardPayload { type: 'card'; brand: string; last4: string; exp_month: string; exp_year: string; }
interface NewBankPayload { type: 'bank'; bank_name: string; last4: string; account_type: 'checking' | 'savings'; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function DialCodeSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (countryCode: string) => void;
  id?: string;
}) {
  const current = getCountry(value || 'US');
  return (
    <div className="profile-select-wrap min-w-[7.5rem]">
      <select
        id={id}
        value={current.code}
        onChange={(e) => onChange(e.target.value)}
        className="profile-select pr-8"
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

function RequiredMark() {
  return <span className="text-red-500 font-bold" aria-hidden="true"> *</span>;
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="profile-label">
      {children}
      {required && <RequiredMark />}
    </label>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder, icon: Icon, readOnly, required, error,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; icon?: React.ElementType; readOnly?: boolean;
  required?: boolean; error?: string;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="relative">
        {Icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">
            <Icon size={14} />
          </div>
        )}
        <input
          type={type} value={value} readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          className={`profile-input ${Icon ? 'pl-9' : ''} ${readOnly ? 'bg-[var(--color-cream)] cursor-default text-[var(--color-text-muted)]' : ''} ${
            error ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''
          }`}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
  required?: boolean;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <div className="profile-select-wrap">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="profile-select" aria-required={required || undefined}>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
      </div>
    </div>
  );
}

function ValidationBanner({
  issues,
  onGoToTab,
}: {
  issues: ValidationIssue[];
  onGoToTab: (tab: ProfileTabId) => void;
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

function Toggle({ checked, onChange, label, sub }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[var(--color-cream-dark)] last:border-0">
      <div>
        <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
        {sub && <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{sub}</p>}
      </div>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          checked ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-cream-dark)]'
        }`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
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
            : 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)] shadow-sm'
        }`}>
        {isPending
          ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
          : saved
          ? <><Check size={15} /> Saved</>
          : 'Save changes'}
      </button>
    </div>
  );
}

// ── Tab: Profile ──────────────────────────────────────────────────────────────

function ProfileTab({ initialData }: { initialData: ShipperProfile }) {
  const qc = useQueryClient();
  const parts = initialData.name.trim().split(/\s+/);
  const [form, setForm] = useState({
    first_name:  parts[0] || '',
    middle_name: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
    last_name:   parts.length > 1 ? parts[parts.length - 1] : '',
    suffix:      '',
    email:       initialData.email,
    phone:       initialData.phone,
    phone_country_code: initialData.phone_country_code || 'US',
    whatsapp:    initialData.whatsapp || '',
    whatsapp_country_code: initialData.whatsapp_country_code || initialData.phone_country_code || 'US',
    street:      initialData.street,
    city:        initialData.city,
    state:       initialData.state,
    zip:         initialData.zip,
    country:     initialData.country,
    // Shipping defaults
    default_pickup_contact_name:  initialData.default_pickup_contact_name,
    default_pickup_contact_phone: initialData.default_pickup_contact_phone,
    internal_ref_format:          initialData.internal_ref_format,
  });
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setSaved(false);
    setErrors((e) => {
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const fullName = [form.first_name, form.middle_name, form.last_name, form.suffix].filter(Boolean).join(' ');
      return profileApi.updateShipper({ ...form, name: fullName });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipper-profile'] });
      setSaved(true);
      toast.success('Profile saved.');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast.error('Could not save profile.'),
  });

  const handleSave = () => {
    const msg = validateProfileTabForm(form);
    if (msg) {
      setErrors(profileTabFieldErrors(form));
      toast.error(msg);
      return;
    }
    setErrors({});
    saveMutation.mutate();
  };

  const initials = [form.first_name[0], form.last_name[0]].filter(Boolean).join('').toUpperCase() || '?';

  return (
    <div className="space-y-6">
      {/* Avatar + name */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="h-20 w-20 rounded-2xl bg-[var(--color-slate)] flex items-center justify-center text-2xl font-bold text-white select-none">
            {initials}
          </div>
          <button className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-teal)] text-white shadow-md hover:bg-[var(--color-teal-light)] transition-colors">
            <Camera size={13} />
          </button>
        </div>
        <div>
          <p className="text-base font-semibold text-[var(--color-text)]">
            {[form.first_name, form.last_name].filter(Boolean).join(' ') || '—'}
          </p>
          <p className="text-sm text-[var(--color-text-faint)]">Shipper account</p>
          <p className="mt-1 text-xs text-[var(--color-text-faint)]">Member since {initialData.member_since}</p>
        </div>
      </div>

      {/* Legal name */}
      <ProfileSection icon={User} title="Legal name">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name"  value={form.first_name}  onChange={set('first_name')}  placeholder="Alex" required error={errors.first_name} />
          <Field label="Middle name" value={form.middle_name} onChange={set('middle_name')} placeholder="Optional" />
          <Field label="Last name"   value={form.last_name}   onChange={set('last_name')}   placeholder="Morgan" required error={errors.last_name} />
          <div>
            <Label>Suffix</Label>
            <div className="profile-select-wrap">
              <select value={form.suffix} onChange={e => set('suffix')(e.target.value)} className="profile-select">
                <option value="">None</option>
                <option>Jr.</option><option>Sr.</option>
                <option>II</option><option>III</option><option>IV</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            </div>
          </div>
        </div>
      </ProfileSection>

      {/* Contact */}
      <ProfileSection icon={Mail} title="Contact">
        <div className="space-y-4">
          <Field label="Email address" value={form.email} onChange={set('email')} icon={Mail} type="email" placeholder="you@company.com" required error={errors.email} />
          <div>
            <Label required>Phone number</Label>
            <div className="flex gap-2">
              <DialCodeSelect
                value={form.phone_country_code}
                onChange={(code) => {
                  setForm((f) => ({ ...f, phone_country_code: code }));
                  setSaved(false);
                }}
              />
              <div className="relative flex-1 min-w-0">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">
                  <Phone size={14} />
                </div>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone')(e.target.value)}
                  placeholder="555 000 0000"
                  aria-required
                  aria-invalid={errors.phone ? true : undefined}
                  className={`profile-input pl-9 ${errors.phone ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''}`}
                />
              </div>
            </div>
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
            <p className="mt-1 text-xs text-[var(--color-text-faint)]">
              Used for SMS verification. Country code is required for international delivery.
            </p>
          </div>
          <div>
            <Label>WhatsApp</Label>
            <div className="flex gap-2">
              <DialCodeSelect
                value={form.whatsapp_country_code}
                onChange={(code) => {
                  setForm((f) => ({ ...f, whatsapp_country_code: code }));
                  setSaved(false);
                }}
              />
              <div className="relative flex-1 min-w-0">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">
                  <MessageCircle size={14} />
                </div>
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={(e) => set('whatsapp')(e.target.value)}
                  placeholder="Optional — same or different number"
                  className="profile-input pl-9"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-faint)]">
              Optional contact channel. No verification required.
            </p>
          </div>
        </div>
      </ProfileSection>

      {/* Default ship-from address */}
      <ProfileSection
        icon={MapPin}
        title="Default ship-from address"
        subtitle="Pre-filled as pickup on new shipments"
      >
        <AddressFields
          value={{ address: form.street, city: form.city, state: form.state, zip: form.zip, country: form.country || 'US' }}
          onChange={v => setForm(f => ({
            ...f,
            street: v.address ?? v.street ?? '',
            city: v.city, state: v.state, zip: v.zip, country: v.country,
          }))}
          showStreet
        />
      </ProfileSection>

      {/* Shipping defaults */}
      <ProfileSection
        icon={Zap}
        title="Shipment defaults"
        subtitle="Pre-filled on every new shipment"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Default pickup contact — name"  value={form.default_pickup_contact_name}  onChange={set('default_pickup_contact_name')}  placeholder="Warehouse manager" />
            <Field label="Default pickup contact — phone" value={form.default_pickup_contact_phone} onChange={set('default_pickup_contact_phone')} type="tel" placeholder="+1 (555) 000-0000" />
          </div>
          <div>
            <Field label="Internal reference format" value={form.internal_ref_format} onChange={set('internal_ref_format')} placeholder="e.g. PO-{number} or CC-{code}" />
            <p className="mt-1 text-xs text-[var(--color-text-faint)]">Appears on every shipment for your own record-keeping (PO number, job code, cost center)</p>
          </div>
        </div>
      </ProfileSection>

      <SaveBar saved={saved} onSave={handleSave} isPending={saveMutation.isPending} />
    </div>
  );
}

// ── Tab: Business ─────────────────────────────────────────────────────────────

function VerificationBadge({ status }: { status: 'verified' | 'review' | 'pending' }) {
  if (status === 'verified') {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <Check size={11} /> Verified
      </span>
    );
  }
  if (status === 'review') {
    return (
      <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        In review
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-[var(--color-cream)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-text-faint)]">
      Not verified
    </span>
  );
}

function BusinessTab({ initialData }: { initialData: ShipperProfile }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    company:                initialData.company,
    dba:                    initialData.dba,
    business_type:          initialData.business_type,
    ein:                    initialData.ein,
    tax_id:                 initialData.tax_id        ?? '',
    tax_id_type:            initialData.tax_id_type   ?? 'EIN',
    currency:               initialData.currency      ?? 'USD',
    state_of_incorporation: initialData.state_of_incorporation,
    year_established:       initialData.year_established,
    employee_count:         initialData.employee_count,
    industry:               initialData.industry,
    website:                initialData.website,
    business_phone:         initialData.business_phone,
    business_email:         initialData.business_email,
    sam_gov_number:         initialData.sam_gov_number,
    biz_street:             initialData.biz_street,
    biz_city:               initialData.biz_city,
    biz_state:              initialData.biz_state,
    biz_zip:                initialData.biz_zip,
    biz_country:            initialData.biz_country  ?? 'US',
    ops_same_as_biz:        initialData.ops_same_as_biz,
    ops_street:             initialData.ops_street,
    ops_city:               initialData.ops_city,
    ops_state:              initialData.ops_state,
    ops_zip:                initialData.ops_zip,
    ops_country:            initialData.ops_country  ?? 'US',
  });
  const [saved, setSaved] = useState(false);
  const [bizErrors, setBizErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (v: string | boolean) => {
    setForm(f => ({ ...f, [k]: v }));
    setSaved(false);
    if (typeof v === 'string') {
      setBizErrors((e) => {
        const key = k === 'tax_id' || k === 'ein' ? 'tax_id' : k === 'company' ? 'company' : '';
        if (!key || !e[key]) return e;
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => profileApi.updateShipper(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipper-profile'] });
      setSaved(true);
      toast.success('Business details saved.');
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast.error('Could not save business details.'),
  });

  const handleBusinessSave = () => {
    const msg = validateBusinessTabForm(form);
    if (msg) {
      setBizErrors({
        ...(!form.company.trim() ? { company: 'Required' } : {}),
        ...(!(form.tax_id || form.ein).trim()
          ? { tax_id: 'Required' }
          : (form.tax_id_type || 'EIN').toUpperCase() === 'EIN' && !/^\d{9}$/.test((form.tax_id || form.ein).replace(/\D/g, ''))
            ? { tax_id: 'Invalid EIN format' }
            : {}),
      });
      toast.error(msg);
      return;
    }
    setBizErrors({});
    saveMutation.mutate();
  };

  const [phoneCode, setPhoneCode] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: docsRes, refetch: refetchDocs } = useQuery({
    queryKey: ['shipper-documents'],
    queryFn: () => shipperVerificationApi.listDocuments().then(r => r.data.data as { id: number; type: string; name: string }[]),
  });
  const docs = docsRes ?? [];

  const resendEmail = useMutation({
    mutationFn: () => shipperVerificationApi.resendEmail(),
    onSuccess: (res) => toast.success(res.data?.message ?? 'Verification email sent.'),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Could not send email. Check API mail configuration.');
    },
  });

  const sendPhone = useMutation({
    mutationFn: () => shipperVerificationApi.sendPhoneCode(),
    onSuccess: (res) => {
      setPhoneSent(true);
      setDevCode(res.data?.dev_code ?? null);
      if (res.data?.dev_code) {
        toast.message(res.data?.message ?? 'Dev OTP only — SMS not configured.');
      } else {
        toast.success(res.data?.message ?? 'Code sent.');
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Could not send code.');
    },
  });

  const confirmPhone = useMutation({
    mutationFn: () => {
      if (phoneCode.trim().length < 4) {
        return Promise.reject({ response: { data: { message: 'Enter the code from the SMS.' } } });
      }
      return shipperVerificationApi.confirmPhoneCode(phoneCode.trim());
    },
    onSuccess: (res) => {
      toast.success(res.data?.message ?? 'Phone verified.');
      setPhoneCode('');
      setPhoneSent(false);
      setDevCode(null);
      qc.invalidateQueries({ queryKey: ['shipper-profile'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Invalid code.');
    },
  });

  const submitBusiness = useMutation({
    mutationFn: () => {
      const company = (form.company || initialData.company || '').trim();
      const ein = (form.tax_id || form.ein || initialData.ein || '').trim();
      if (!company || !ein) {
        return Promise.reject({ response: { data: { message: 'Save legal business name and tax ID first.' } } });
      }
      if (!docs.some(d => d.type === 'w9')) {
        return Promise.reject({ response: { data: { message: 'Upload a W-9 before submitting for review.' } } });
      }
      if (!initialData.email_verified) {
        return Promise.reject({ response: { data: { message: 'Verify your email before submitting business verification.' } } });
      }
      return shipperVerificationApi.submitBusiness();
    },
    onSuccess: (res) => {
      toast.success(res.data?.message ?? 'Submitted for review.');
      qc.invalidateQueries({ queryKey: ['shipper-profile'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Could not submit.');
    },
  });

  const handleSubmitBusiness = () => {
    const saveMsg = validateBusinessTabForm(form);
    if (saveMsg) {
      setBizErrors({
        ...(!form.company.trim() ? { company: 'Required' } : {}),
        ...(!(form.tax_id || form.ein).trim()
          ? { tax_id: 'Required' }
          : (form.tax_id_type || 'EIN').toUpperCase() === 'EIN' && !/^\d{9}$/.test((form.tax_id || form.ein).replace(/\D/g, ''))
            ? { tax_id: 'Invalid EIN format' }
            : {}),
      });
      toast.error(saveMsg);
      return;
    }
    if (!docs.some(d => d.type === 'w9')) {
      toast.error('Upload a W-9 (or equivalent tax form) before submitting for review.');
      return;
    }
    if (!initialData.email_verified) {
      toast.error('Verify your email before submitting business verification.');
      return;
    }
    submitBusiness.mutate();
  };

  async function onUploadDoc(type: 'w9' | 'articles' | 'other', file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('document', file);
      fd.append('type', type);
      await shipperVerificationApi.uploadDocument(fd);
      toast.success(`${file.name} uploaded.`);
      refetchDocs();
      qc.invalidateQueries({ queryKey: ['shipper-documents'] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  const emailStatus = initialData.email_verified ? 'verified' : 'pending';
  const phoneStatus = initialData.phone_verified ? 'verified' : 'pending';
  const einStatus = initialData.ein_verified
    ? 'verified'
    : initialData.verification_status === 'submitted'
    ? 'review'
    : 'pending';

  return (
    <div className="space-y-6">

      {/* Company identity */}
      <ProfileSection icon={Building2} title="Company identity">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Legal business name" value={form.company}       onChange={v => set('company')(v)} icon={Building2} placeholder="Acme Corp LLC" required error={bizErrors.company} />
          <Field label="DBA (if applicable)"  value={form.dba}          onChange={v => set('dba')(v)}     placeholder="Trading as…" />
          <Select label="Business type" value={form.business_type} onChange={v => set('business_type')(v)} options={[
            'Limited Liability Company (LLC)', 'S-Corporation', 'C-Corporation',
            'Sole Proprietor', 'Partnership', 'Non-Profit',
          ]} />
          <Select label="Industry" value={form.industry} onChange={v => set('industry')(v)} options={[
            'Freight & Logistics', 'Healthcare / Pharma', 'Automotive',
            'Food & Beverage', 'Construction', 'Retail / E-Commerce',
            'Manufacturing', 'Technology', 'Government', 'Other',
          ]} />
          {/* Tax ID — type selector + number */}
          <div>
            <Label required>Tax ID Type</Label>
            <div className="profile-select-wrap">
              <select
                value={form.tax_id_type}
                onChange={e => setForm(f => ({ ...f, tax_id_type: e.target.value }))}
                className="profile-select"
              >
                {[['EIN','EIN (USA)'],['BN','BN (Canada)'],['VAT','VAT Number (EU)'],['ABN','ABN (Australia)'],['GSTIN','GSTIN (India)'],['RFC','RFC (Mexico)'],['other','Other']].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            </div>
          </div>
          <Field
            label={form.tax_id_type || 'Tax ID'}
            value={form.tax_id || form.ein}
            onChange={v => {
              setForm(f => ({ ...f, tax_id: v, ein: v }));
              setSaved(false);
              setBizErrors((e) => {
                if (!e.tax_id) return e;
                const next = { ...e };
                delete next.tax_id;
                return next;
              });
            }}
            icon={Hash}
            placeholder={form.tax_id_type === 'EIN' ? 'XX-XXXXXXX' : form.tax_id_type === 'VAT' ? 'DE123456789' : 'Tax ID number'}
            required
            error={bizErrors.tax_id}
          />
          {/* Currency */}
          <div>
            <Label>Operating Currency</Label>
            <div className="profile-select-wrap">
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="profile-select"
              >
                {[['USD','USD — US Dollar'],['CAD','CAD — Canadian Dollar'],['MXN','MXN — Mexican Peso'],['EUR','EUR — Euro'],['GBP','GBP — British Pound'],['AUD','AUD — Australian Dollar'],['BRL','BRL — Brazilian Real'],['INR','INR — Indian Rupee'],['JPY','JPY — Japanese Yen'],['CNY','CNY — Chinese Yuan'],['SGD','SGD — Singapore Dollar'],['AED','AED — UAE Dirham'],['ZAR','ZAR — South African Rand']].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            </div>
          </div>
          <Field label="State of incorporation" value={form.state_of_incorporation} onChange={v => set('state_of_incorporation')(v)} placeholder="CO" />
          <Field label="Year established"       value={form.year_established}       onChange={v => set('year_established')(v)}       placeholder="2018" />
          <Select label="Number of employees" value={form.employee_count} onChange={v => set('employee_count')(v)} options={[
            '', '1–10', '11–50', '51–200', '201–500', '500+',
          ]} />
          <Field label="Business phone"  value={form.business_phone}  onChange={v => set('business_phone')(v)}  icon={Phone} type="tel" placeholder="+1 (555) 000-0000" />
          <Field label="Business email"  value={form.business_email}  onChange={v => set('business_email')(v)}  icon={Mail}  type="email" placeholder="ops@company.com" />
          <Field label="Website"         value={form.website}         onChange={v => set('website')(v)}         icon={Globe} type="url" placeholder="https://company.com" />
          <Field label="SAM.gov number"  value={form.sam_gov_number}  onChange={v => set('sam_gov_number')(v)}  placeholder="Optional — for government contracts" />
        </div>
      </ProfileSection>

      {/* Registered address */}
      <ProfileSection
        icon={MapPin}
        title="Registered address"
        subtitle="Legal registration address for billing and compliance"
      >
        <AddressFields
          value={{ address: form.biz_street, city: form.biz_city, state: form.biz_state, zip: form.biz_zip, country: form.biz_country }}
          onChange={v => setForm(f => ({
            ...f,
            biz_street: v.address ?? v.street ?? '',
            biz_city: v.city, biz_state: v.state, biz_zip: v.zip, biz_country: v.country,
          }))}
          showStreet
        />
      </ProfileSection>

      {/* Operating address */}
      <ProfileSection
        icon={MapPin}
        title="Operating address"
        actions={
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input type="checkbox" checked={form.ops_same_as_biz}
              onChange={e => set('ops_same_as_biz')(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-teal)]" />
            <span className="text-xs text-[var(--color-text-muted)]">Same as registered address</span>
          </label>
        }
      >
        {!form.ops_same_as_biz && (
          <AddressFields
            value={{ address: form.ops_street, city: form.ops_city, state: form.ops_state, zip: form.ops_zip, country: form.ops_country }}
            onChange={v => setForm(f => ({
              ...f,
              ops_street: v.address ?? v.street ?? '',
              ops_city: v.city, ops_state: v.state, ops_zip: v.zip, ops_country: v.country,
            }))}
            showStreet
          />
        )}
      </ProfileSection>

      {/* Verification status */}
      <ProfileSection
        icon={Shield}
        title="Verification status"
        actions={
          <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            initialData.verification_status === 'verified'
              ? 'bg-emerald-50 text-emerald-700'
              : initialData.verification_status === 'submitted'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-[var(--color-cream)] text-[var(--color-text-faint)]'
          }`}>
            {initialData.verification_status === 'verified'   ? 'Verified'
            : initialData.verification_status === 'submitted' ? 'In Review'
            : 'Incomplete'}
          </span>
        }
      >
        <div className="space-y-5">
          {/* Email */}
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-cream-dark)] pb-4">
            <div>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  Email address <span className="text-red-500 font-bold">*</span>
                </p>
                <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
                  {initialData.email
                    ? <>Send a verification link to <span className="text-[var(--color-text)]">{initialData.email}</span>. Check spam.</>
                    : <>Add and save an email on the Profile tab first. <span className="text-red-500 font-bold">*</span></>}
                </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <VerificationBadge status={emailStatus} />
              {!initialData.email_verified && (
                <button
                  type="button"
                  onClick={() => {
                    if (!initialData.email?.trim()) {
                      toast.error('Add an email on the Profile tab and save first.');
                      return;
                    }
                    if (!looksLikeEmail(initialData.email)) {
                      toast.error('Fix the email format on the Profile tab before verifying.');
                      return;
                    }
                    resendEmail.mutate();
                  }}
                  disabled={resendEmail.isPending || !initialData.email?.trim()}
                  className="text-xs font-semibold text-[var(--color-teal)] hover:underline disabled:opacity-50"
                >
                  {resendEmail.isPending ? 'Sending…' : 'Send verification email'}
                </button>
              )}
            </div>
          </div>

          {/* Phone */}
          <div className="border-b border-[var(--color-cream-dark)] pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  Phone number <span className="text-red-500 font-bold">*</span>
                </p>
                <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
                  {initialData.phone?.trim()
                    ? <>SMS one-time code to <span className="text-[var(--color-text)]">{getCountry(initialData.phone_country_code || 'US').dialCode} {initialData.phone}</span> (Profile tab).</>
                    : 'Add and save a phone number on the Profile tab first.'}
                </p>
              </div>
              <VerificationBadge status={phoneStatus} />
            </div>
            {!initialData.phone_verified && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!initialData.phone?.trim()) {
                      toast.error('Add a phone number on the Profile tab and save first.');
                      return;
                    }
                    if (!looksLikeNationalPhone(initialData.phone) && !looksLikePhone(initialData.phone)) {
                      toast.error('Fix the phone format on the Profile tab before verifying.');
                      return;
                    }
                    sendPhone.mutate();
                  }}
                  disabled={sendPhone.isPending || !initialData.phone?.trim()}
                  className="rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {sendPhone.isPending ? 'Sending…' : phoneSent ? 'Resend code' : 'Send SMS code'}
                </button>
                {phoneSent && (
                  <>
                    <input
                      value={phoneCode}
                      onChange={e => setPhoneCode(e.target.value)}
                      placeholder="6-digit code"
                      className="profile-input w-32"
                      maxLength={10}
                    />
                    <button
                      type="button"
                      onClick={() => confirmPhone.mutate()}
                      disabled={confirmPhone.isPending || phoneCode.length < 4}
                      className="rounded-lg border border-[var(--color-cream-dark)] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {confirmPhone.isPending ? 'Checking…' : 'Confirm'}
                    </button>
                  </>
                )}
                {devCode && (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                    Dev OTP: {devCode}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Business / EIN */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  Business (EIN) <span className="text-red-500 font-bold">*</span>
                </p>
                <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
                  Upload a W-9<span className="text-red-500 font-bold"> *</span>, save company name + tax ID, then submit for platform review.
                </p>
              </div>
              <VerificationBadge status={einStatus} />
            </div>

            {!initialData.ein_verified && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(['w9', 'articles'] as const).map((type) => {
                    const existing = docs.find(d => d.type === type);
                    return (
                      <label
                        key={type}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                          existing
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-dashed border-[var(--color-cream-dark)] text-[var(--color-text-muted)]'
                        }`}
                      >
                        <Upload size={12} />
                        {existing ? `${type.toUpperCase()}: ${existing.name}` : (
                          <>
                            Upload {type === 'w9' ? 'W-9' : 'Articles of Inc.'}
                            {type === 'w9' && <span className="text-red-500 font-bold"> *</span>}
                          </>
                        )}
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={e => onUploadDoc(type, e.target.files?.[0] ?? null)}
                        />
                      </label>
                    );
                  })}
                </div>
                {initialData.verification_status !== 'submitted' ? (
                  <button
                    type="button"
                    onClick={handleSubmitBusiness}
                    disabled={submitBusiness.isPending}
                    className="rounded-lg bg-[var(--color-slate)] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {submitBusiness.isPending ? 'Submitting…' : 'Submit for review'}
                  </button>
                ) : (
                  <p className="text-xs text-amber-700">Submitted — waiting for platform review.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </ProfileSection>

      <SaveBar saved={saved} onSave={handleBusinessSave} isPending={saveMutation.isPending} />
    </div>
  );
}

// ── Tab: Compliance ───────────────────────────────────────────────────────────

function UploadDoc({ required, url, expiry, onFileChange, onExpiryChange }: {
  label?: string; hint?: string; required?: boolean;
  url: string; expiry: string;
  onFileChange: (name: string) => void;
  onExpiryChange: (date: string) => void;
}) {
  const [fileName, setFileName] = useState(url ? 'Uploaded ✓' : '');
  const isExpired = expiry && new Date(expiry) < new Date();
  const expiresSoon = expiry && !isExpired && new Date(expiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-3">
      {required && <span className="text-xs font-medium text-red-500">Required</span>}

      {isExpired   && <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠ Certificate expired — upload a new one</div>}
      {expiresSoon && <div className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠ Expires within 30 days — consider renewing</div>}

      <div className="grid grid-cols-2 gap-3">
        <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer text-sm transition-colors ${
          fileName ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)] text-[var(--color-teal)]' : 'border-dashed border-[var(--color-cream-dark)] text-[var(--color-text-muted)] hover:border-[var(--color-teal)]'
        }`}>
          <Upload size={14} />
          <span className="truncate">{fileName || 'Upload PDF or image'}</span>
          <input type="file" accept=".pdf,image/*" className="hidden"
            onChange={e => {
              const name = e.target.files?.[0]?.name || '';
              setFileName(name);
              onFileChange(name);
            }} />
        </label>
        <div>
          <Label>Expiry date</Label>
          <input type="date" value={expiry ?? ''} onChange={e => onExpiryChange(e.target.value)} className="profile-input" />
        </div>
      </div>
    </div>
  );
}

function ComplianceTab({ initialData }: { initialData: ShipperProfile }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    coi_url:           initialData.coi_url           ?? '',
    coi_expiry:        initialData.coi_expiry        ?? '',
    hipaa_baa_url:     initialData.hipaa_baa_url     ?? '',
    hipaa_baa_expiry:  initialData.hipaa_baa_expiry  ?? '',
    hazmat_reg_url:    initialData.hazmat_reg_url    ?? '',
    hazmat_reg_expiry: initialData.hazmat_reg_expiry ?? '',
  });
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => profileApi.updateShipper(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipper-profile'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
        Compliance documents are required for specific shipment types. All documents have expiry tracking — you will be alerted 30 days before expiry.
      </div>

      <ProfileSection
        icon={FileCheck}
        title="Certificate of Insurance (COI)"
        subtitle="Required by some carriers before accepting a load. Proves declared value coverage on cargo."
      >
        <UploadDoc
          label="Certificate of Insurance (COI)"
          required={false}
          url={form.coi_url}
          expiry={form.coi_expiry}
          onFileChange={name => setForm(f => ({ ...f, coi_url: name }))}
          onExpiryChange={d => setForm(f => ({ ...f, coi_expiry: d }))}
        />
      </ProfileSection>
      <ProfileSection
        icon={FileCheck}
        title="HazMat Shipper Registration (PHMSA)"
        subtitle="Required if you ship any regulated hazardous materials. Registration is with the Pipeline and Hazardous Materials Safety Administration."
      >
        <UploadDoc
          label="HazMat Shipper Registration (PHMSA)"
          required={false}
          url={form.hazmat_reg_url}
          expiry={form.hazmat_reg_expiry}
          onFileChange={name => setForm(f => ({ ...f, hazmat_reg_url: name }))}
          onExpiryChange={d => setForm(f => ({ ...f, hazmat_reg_expiry: d }))}
        />
      </ProfileSection>

      <SaveBar saved={saved} onSave={() => saveMutation.mutate()} isPending={saveMutation.isPending} />
    </div>
  );
}

// ── Tab: Payment ──────────────────────────────────────────────────────────────

const BRAND_COLORS: Record<string, string> = { Visa: '#1A1F71', Mastercard: '#EB001B' };

function AddCardModal({ onClose, onAdd, isPending }: { onClose: () => void; onAdd: (p: NewCardPayload) => void; isPending: boolean }) {
  const [num, setNum] = useState(''); const [name, setName] = useState('');
  const [exp, setExp] = useState(''); const [cvv, setCvv]   = useState('');
  const formatCardNum = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 16); return d.replace(/(.{4})(?=.)/g, '$1 '); };
  const formatExp = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? d.slice(0, 2) + ' / ' + d.slice(2) : d; };
  const rawNum = num.replace(/\s/g, '');
  const brand  = rawNum.startsWith('4') ? 'Visa' : rawNum.startsWith('5') ? 'Mastercard' : 'Card';
  const valid  = rawNum.length === 16 && name.trim().length > 1 && exp.length === 7 && cvv.length >= 3;
  const handleAdd = () => { if (!valid || isPending) return; const [em, ey] = exp.replace(/\s/g, '').split('/'); onAdd({ type: 'card', brand, last4: rawNum.slice(-4), exp_month: em, exp_year: ey }); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-white)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-[var(--color-text)]">Add credit / debit card</h3>
          <button onClick={onClose} disabled={isPending} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"><X size={18} /></button>
        </div>
        <div className="mb-5 rounded-xl bg-gradient-to-br from-[var(--color-slate)] to-[#1e3a5f] p-4 text-white select-none">
          <p className="font-mono text-lg tracking-widest">{num || '•••• •••• •••• ••••'}</p>
          <div className="mt-3 flex items-end justify-between text-xs">
            <div><p className="mb-0.5 opacity-50 uppercase tracking-wider text-xs">Cardholder</p><p className="font-medium">{name || 'Your name'}</p></div>
            <div className="text-right"><p className="mb-0.5 opacity-50 uppercase tracking-wider text-xs">Expires</p><p className="font-medium">{exp || 'MM / YY'}</p></div>
          </div>
        </div>
        <div className="space-y-4">
          <div><Label>Card number</Label><input value={num} onChange={(e) => setNum(formatCardNum(e.target.value))} placeholder="1234 5678 9012 3456" maxLength={19} className="profile-input font-mono tracking-wider" /></div>
          <div><Label>Cardholder name</Label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" className="profile-input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Expiry</Label><input value={exp} onChange={(e) => setExp(formatExp(e.target.value))} placeholder="MM / YY" maxLength={7} className="profile-input font-mono" /></div>
            <div><Label>CVV</Label><input value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="•••" maxLength={4} type="password" className="profile-input font-mono" /></div>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} disabled={isPending} className="flex-1 rounded-xl border border-[var(--color-cream-dark)] py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleAdd} disabled={!valid || isPending} className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${valid && !isPending ? 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)] shadow-sm' : 'bg-[var(--color-cream-dark)] text-[var(--color-text-faint)] cursor-not-allowed'}`}>
            {isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save card'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddBankModal({ onClose, onAdd, isPending }: { onClose: () => void; onAdd: (p: NewBankPayload) => void; isPending: boolean }) {
  const [holder, setHolder]   = useState(''); const [routing, setRouting] = useState('');
  const [account, setAccount] = useState(''); const [confirm, setConfirm] = useState('');
  const [type, setType] = useState<'Checking' | 'Savings'>('Checking');
  const numMatch = account.length > 0 && confirm.length > 0 && account === confirm;
  const numMismatch = confirm.length > 0 && account !== confirm;
  const valid = holder.trim().length > 1 && routing.length === 9 && account.length >= 4 && numMatch;
  const handleAdd = () => { if (!valid || isPending) return; onAdd({ type: 'bank', bank_name: 'Bank Account', last4: account.slice(-4), account_type: type.toLowerCase() as 'checking' | 'savings' }); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-white)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-[var(--color-text)]">Add bank account (ACH)</h3>
          <button onClick={onClose} disabled={isPending} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div><Label>Account holder name</Label><input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Alex Morgan" className="profile-input" /></div>
          <div><Label>Account type</Label>
            <div className="flex gap-2">
              {(['Checking', 'Savings'] as const).map((t) => (
                <button key={t} onClick={() => setType(t)} className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-all ${type === t ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)] text-[var(--color-teal)]' : 'border-[var(--color-cream-dark)] text-[var(--color-text-muted)] hover:border-[var(--color-teal)]'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div><Label>Routing number</Label><input value={routing} onChange={(e) => setRouting(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="9-digit ABA routing number" maxLength={9} className="profile-input font-mono" />{routing.length > 0 && routing.length < 9 && <p className="mt-1 text-xs text-amber-600">{9 - routing.length} more digit{9 - routing.length !== 1 ? 's' : ''} needed</p>}</div>
          <div><Label>Account number</Label><input value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, '').slice(0, 17))} placeholder="Account number" maxLength={17} className="profile-input font-mono" /></div>
          <div><Label>Confirm account number</Label><input value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 17))} placeholder="Re-enter account number" maxLength={17} className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 bg-[var(--color-white)] ${numMismatch ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : numMatch ? 'border-emerald-400 focus:border-emerald-400 focus:ring-emerald-400/20' : 'border-[var(--color-cream-dark)] focus:border-[var(--color-teal)] focus:ring-[var(--color-teal)]/20'}`} />{numMismatch && <p className="mt-1 text-xs text-red-500">Account numbers don&apos;t match</p>}{numMatch && <p className="mt-1 text-xs text-emerald-600">✓ Numbers match</p>}</div>
        </div>
        <div className="mt-4 rounded-xl bg-[var(--color-cream)] px-3.5 py-3 text-xs text-[var(--color-text-faint)]">🔒 Your bank details are encrypted end-to-end. ACH payments are processed via Stripe.</div>
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} disabled={isPending} className="flex-1 rounded-xl border border-[var(--color-cream-dark)] py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleAdd} disabled={!valid || isPending} className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${valid && !isPending ? 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)] shadow-sm' : 'bg-[var(--color-cream-dark)] text-[var(--color-text-faint)] cursor-not-allowed'}`}>
            {isPending ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save bank account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentTab() {
  const queryClient = useQueryClient();
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const { data: methods = [], isLoading } = useQuery<PaymentMethod[]>({ queryKey: ['payment-methods'], queryFn: () => paymentApi.list().then((r) => r.data.data) });
  const cards = methods.filter((m) => m.type === 'card');
  const banks = methods.filter((m) => m.type === 'bank');
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
  const addMutation     = useMutation({ mutationFn: (p: NewCardPayload | NewBankPayload) => paymentApi.create(p as unknown as Record<string, unknown>) });
  const deleteMutation  = useMutation({ mutationFn: (id: number) => paymentApi.destroy(id), onSuccess: invalidate });
  const defaultMutation = useMutation({ mutationFn: (id: number) => paymentApi.setDefault(id), onSuccess: invalidate });
  const handleAddCard = (p: NewCardPayload) => addMutation.mutate(p, { onSuccess: () => { invalidate(); setShowAddCard(false); } });
  const handleAddBank = (p: NewBankPayload) => addMutation.mutate(p, { onSuccess: () => { invalidate(); setShowAddBank(false); } });
  return (
    <>
      {showAddCard && <AddCardModal onClose={() => setShowAddCard(false)} onAdd={handleAddCard} isPending={addMutation.isPending} />}
      {showAddBank && <AddBankModal onClose={() => setShowAddBank(false)} onAdd={handleAddBank} isPending={addMutation.isPending} />}
      <div className="space-y-6">
        <ProfileSection
          icon={CreditCard}
          title="Saved payment methods"
          actions={
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowAddBank(true)} className="flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors"><Plus size={12} /> Add bank</button>
              <button onClick={() => setShowAddCard(true)} className="flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors"><Plus size={12} /> Add card</button>
            </div>
          }
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-[var(--color-text-faint)]"><Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading payment methods…</span></div>
          ) : (
            <div className="space-y-3">
              {cards.map((card) => (
                <div key={card.id} className={`flex items-center gap-4 rounded-xl border p-4 ${card.is_default ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]' : 'border-[var(--color-cream-dark)]'}`}>
                  <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-white" style={{ background: BRAND_COLORS[card.brand ?? ''] ?? '#64748b' }}>{(card.brand ?? 'Card').toUpperCase().slice(0, 4)}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-[var(--color-text)]">{card.brand} •••• {card.last4}</p><p className="text-xs text-[var(--color-text-faint)]">Expires {card.exp_month} / {card.exp_year}</p></div>
                  {!card.is_default && <button onClick={() => defaultMutation.mutate(card.id)} disabled={defaultMutation.isPending} title="Set as default" className="text-[var(--color-text-faint)] hover:text-[var(--color-teal)] transition-colors"><Star size={14} /></button>}
                  {card.is_default && <span className="rounded-full bg-[var(--color-teal)] px-2.5 py-0.5 text-xs font-bold text-white">Default</span>}
                  <button onClick={() => deleteMutation.mutate(card.id)} disabled={deleteMutation.isPending} className="text-[var(--color-text-faint)] hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              ))}
              {banks.map((bank) => (
                <div key={bank.id} className={`flex items-center gap-4 rounded-xl border p-4 ${bank.is_default ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]' : 'border-[var(--color-cream-dark)]'}`}>
                  <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--color-slate)] text-white"><Landmark size={18} /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-[var(--color-text)]">{bank.bank_name} •••• {bank.last4}</p><p className="text-xs capitalize text-[var(--color-text-faint)]">{bank.account_type} account · ACH</p></div>
                  <span className="rounded-full bg-[var(--color-cream)] px-2.5 py-0.5 text-xs font-semibold capitalize text-[var(--color-text-muted)]">{bank.account_type}</span>
                  {!bank.is_default && <button onClick={() => defaultMutation.mutate(bank.id)} disabled={defaultMutation.isPending} title="Set as default" className="text-[var(--color-text-faint)] hover:text-[var(--color-teal)] transition-colors"><Star size={14} /></button>}
                  {bank.is_default && <span className="rounded-full bg-[var(--color-teal)] px-2.5 py-0.5 text-xs font-bold text-white">Default</span>}
                  <button onClick={() => deleteMutation.mutate(bank.id)} disabled={deleteMutation.isPending} className="text-[var(--color-text-faint)] hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              ))}
              {!isLoading && methods.length === 0 && <p className="py-8 text-center text-sm text-[var(--color-text-faint)]">No payment methods saved yet.</p>}
            </div>
          )}
        </ProfileSection>
        {/* ACH via Plaid */}
        <ProfileSection
          icon={Shield}
          title="ACH bank transfer (Plaid)"
          subtitle="Pay freight invoices directly from your bank account"
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              Connect your bank account to pay via ACH. Funds are verified instantly via Plaid and held in escrow until delivery is confirmed.
            </p>
            <PlaidLinkButton />
          </div>
        </ProfileSection>
      </div>
    </>
  );
}

// ── Tab: Notifications ────────────────────────────────────────────────────────

function NotificationsTab({ initialData }: { initialData: ShipperProfile }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState<Record<string, boolean>>(initialData.notif_email);
  const [sms,   setSms]   = useState<Record<string, boolean>>(initialData.notif_sms);
  const [saved, setSaved] = useState(false);

  const setE = (k: string) => (v: boolean) => { setEmail((s) => ({ ...s, [k]: v })); setSaved(false); };
  const setS = (k: string) => (v: boolean) => { setSms((s)   => ({ ...s, [k]: v })); setSaved(false); };

  const saveMutation = useMutation({
    mutationFn: () => profileApi.updateShipper({ notif_email: email, notif_sms: sms }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipper-profile'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div className="space-y-6">
      <ProfileSection
        icon={Mail}
        title="Email notifications"
        actions={<span className="shrink-0 text-xs text-[var(--color-text-faint)]">{initialData.email}</span>}
      >
        <Toggle checked={!!email.carrier_assigned} onChange={setE('carrier_assigned')} label="Carrier assigned"      sub="When a carrier accepts your shipment" />
        <Toggle checked={!!email.pickup_confirmed}  onChange={setE('pickup_confirmed')}  label="Pickup confirmed"       sub="When carrier confirms pickup" />
        <Toggle checked={!!email.in_transit}        onChange={setE('in_transit')}        label="In-transit GPS updates" sub="Every new GPS ping from the carrier" />
        <Toggle checked={!!email.delivered}         onChange={setE('delivered')}         label="Delivered"              sub="When delivery is confirmed with photo" />
        <Toggle checked={!!email.disputed}          onChange={setE('disputed')}          label="Dispute raised"         sub="Immediately when a dispute is opened" />
        <Toggle checked={!!email.weekly_summary}    onChange={setE('weekly_summary')}    label="Weekly summary"         sub="Overview of all shipment activity" />
        <Toggle checked={!!email.marketing}         onChange={setE('marketing')}         label="News & promotions"      sub="Product updates and feature announcements" />
      </ProfileSection>
      <ProfileSection
        icon={Phone}
        title="SMS notifications"
        actions={<span className="shrink-0 text-xs text-[var(--color-text-faint)]">{initialData.phone || 'No phone on file'}</span>}
      >
        <Toggle checked={!!sms.carrier_assigned} onChange={setS('carrier_assigned')} label="Carrier assigned"   sub="Text when a carrier accepts" />
        <Toggle checked={!!sms.pickup_confirmed}  onChange={setS('pickup_confirmed')}  label="Pickup confirmed"   sub="Text when carrier picks up" />
        <Toggle checked={!!sms.in_transit}        onChange={setS('in_transit')}        label="In-transit updates" sub="Text on each GPS ping" />
        <Toggle checked={!!sms.delivered}         onChange={setS('delivered')}         label="Delivered"          sub="Text on delivery confirmation" />
        <Toggle checked={!!sms.disputed}          onChange={setS('disputed')}          label="Dispute raised"     sub="Immediate text on dispute" />
      </ProfileSection>
      <SaveBar saved={saved} onSave={() => saveMutation.mutate()} isPending={saveMutation.isPending} />
    </div>
  );
}

// ── Tab: Services ─────────────────────────────────────────────────────────────

function ServicesTab({ initialData }: { initialData: ShipperProfile }) {
  const qc = useQueryClient();
  const [keys, setKeys] = useState<string[]>(initialData.service_type_keys ?? []);
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => profileApi.updateShipper({ service_type_keys: keys }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shipper-profile'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div className="space-y-6">
      <ProfileSection
        icon={Package}
        title="What do you ship?"
        subtitle="Select all service types your business ships. This helps us match you with the right carriers and pre-filter your carrier search."
      >
        <ServiceTypeSelector selected={keys} onChange={setKeys} />
      </ProfileSection>
      <SaveBar saved={saved} onSave={() => saveMutation.mutate()} isPending={saveMutation.isPending} />
    </div>
  );
}

// ── Tab: Team ── (shared with carriers; roles per docs/people-types-and-checks.md)

function TeamTab() {
  return <TeamManager type="shipper" />;
}

// ── Tab: Subscription (static — Stripe not yet integrated) ────────────────────

const PLANS = {
  monthly: { price: 100, label: '$100', period: 'mo', total: '$100/mo', billedAs: '$100 billed monthly' },
  yearly:  { price: 999, label: '$999', period: 'yr', total: '$83/mo',  billedAs: '$999 billed annually' },
} as const;
type BillingCycle = keyof typeof PLANS;
const FEATURES = [
  'Unlimited shipments', 'Live GPS tracking with 5-second updates', 'OSRM real-road route planning',
  'Multi-stop route builder', 'Carrier marketplace access', 'Escrow payment protection',
  'Dispute resolution support', 'Priority email & chat support',
];

function SubscriptionTab() {
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const plan = PLANS[cycle];
  const [currentCycle] = useState<BillingCycle>('monthly');
  const isCurrentPlan = cycle === currentCycle;
  const nextBilling = 'July 1, 2026'; const memberSince = 'June 1, 2026';
  const yearlySaving = PLANS.monthly.price * 12 - PLANS.yearly.price;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-teal)] bg-[var(--color-teal-pale)] p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-teal)] text-white"><Zap size={18} /></div>
        <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-[var(--color-slate)]">Professional Plan — Active</p><p className="text-xs text-[var(--color-text-faint)]">Billed monthly · Next charge <strong>$100</strong> on {nextBilling}</p></div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Active</span>
      </div>
      <ProfileSection icon={CalendarDays} title="Billing cycle">
        <div className="flex gap-3">
          {(['monthly', 'yearly'] as BillingCycle[]).map((c) => (
            <button key={c} onClick={() => setCycle(c)} className={`relative flex-1 rounded-xl border-2 p-4 text-left transition-all ${cycle === c ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]' : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]/50'}`}>
              {c === 'yearly' && <span className="absolute -top-2.5 right-3 rounded-full bg-[var(--color-teal)] px-2.5 py-0.5 text-xs font-bold text-white">Save ${yearlySaving}</span>}
              <p className="text-lg font-bold text-[var(--color-slate)]">{PLANS[c].label}<span className="text-sm font-normal text-[var(--color-text-faint)]">/{PLANS[c].period}</span></p>
              <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">{c === 'yearly' ? `${PLANS.yearly.total} · billed yearly` : 'Billed monthly'}</p>
              {c === currentCycle && <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)]"><Check size={11} /> Current plan</span>}
            </button>
          ))}
        </div>
        <button disabled={isCurrentPlan} className={`mt-4 w-full rounded-xl py-3 text-sm font-semibold transition-all ${isCurrentPlan ? 'bg-[var(--color-cream-dark)] text-[var(--color-text-faint)] cursor-not-allowed' : 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)] shadow-sm'}`}>
          {isCurrentPlan ? 'This is your current plan' : cycle === 'yearly' ? `Switch to yearly — save $${yearlySaving}/yr` : 'Switch to monthly billing'}
        </button>
      </ProfileSection>
      <ProfileSection icon={Zap} title="What's included">
        <ul className="space-y-2.5">{FEATURES.map((f) => (<li key={f} className="flex items-center gap-3 text-sm text-[var(--color-text)]"><div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50"><Check size={11} className="text-emerald-600" /></div>{f}</li>))}</ul>
      </ProfileSection>
      <ProfileSection icon={CalendarDays} title="Billing details">
        <div className="space-y-3">
          {[
            { label: 'Plan', value: 'Professional (Monthly)' }, { label: 'Amount', value: '$100.00 / month' },
            { label: 'Next billing', value: nextBilling }, { label: 'Member since', value: memberSince },
            { label: 'Payment method', value: 'Visa •••• 4242' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-1 border-b border-[var(--color-cream-dark)] last:border-0">
              <span className="text-sm text-[var(--color-text-faint)]">{label}</span>
              <span className="text-sm font-medium text-[var(--color-text)]">{value}</span>
            </div>
          ))}
        </div>
        <button className="mt-4 flex w-full items-center justify-between rounded-xl border border-[var(--color-cream-dark)] px-4 py-2.5 text-sm text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors">
          <span className="flex items-center gap-2"><RefreshCw size={13} /> View billing history</span>
          <ChevronRight size={14} />
        </button>
      </ProfileSection>
      <ProfileSection
        icon={AlertCircle}
        title="Cancel subscription"
        subtitle={`Your plan stays active until the end of the current billing period (${nextBilling}).`}
        headVariant="danger"
        className="border-red-100 bg-red-50/40"
      >
        <button className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">Cancel subscription</button>
      </ProfileSection>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile',       label: 'Profile',       icon: User       },
  { id: 'business',      label: 'Business',      icon: Building2  },
  { id: 'services',      label: 'Services',      icon: Package    },
  { id: 'compliance',    label: 'Compliance',    icon: FileCheck  },
  { id: 'payment',       label: 'Payment',       icon: CreditCard },
  { id: 'subscription',  label: 'Subscription',  icon: Zap        },
  { id: 'notifications', label: 'Notifications', icon: Bell       },
  { id: 'team',          label: 'Team',          icon: Users      },
];

export default function ShipperProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const { data: profile, isLoading } = useQuery<ShipperProfile>({
    queryKey: ['shipper-profile'],
    queryFn:  () => profileApi.getShipper().then((r) => r.data.data),
  });

  const validationIssues = profile
    ? collectFieldIssues({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        company: profile.company,
        taxId: profile.tax_id || profile.ein,
        taxIdType: profile.tax_id_type,
      })
    : [];

  return (
    <div className="w-[75%] min-w-[560px] space-y-6">
      <div>
        <h1 className="page-title">
          Account Settings
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">
          Manage your profile, business, payments, subscription and notifications
        </p>
      </div>

      {!isLoading && profile && (
        <ValidationBanner
          issues={validationIssues}
          onGoToTab={(tab) => setActiveTab(tab)}
        />
      )}

      <div className="flex gap-1 rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              activeTab === id ? 'bg-[var(--color-slate)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Loading skeleton for API-driven tabs */}
      {isLoading && (['profile', 'business', 'services', 'compliance', 'notifications'] as Tab[]).includes(activeTab) && (
        <div className="space-y-4 animate-pulse">
          <div className="h-36 rounded-2xl bg-[var(--color-cream-dark)]" />
          <div className="h-48 rounded-2xl bg-[var(--color-cream-dark)]" />
        </div>
      )}

      {!isLoading && profile && activeTab === 'profile'       && <ProfileTab       key={profile.email} initialData={profile} />}
      {!isLoading && profile && activeTab === 'business'      && <BusinessTab      key={`biz-${profile.email}`} initialData={profile} />}
      {!isLoading && profile && activeTab === 'services'      && <ServicesTab      key={`svc-${profile.email}`} initialData={profile} />}
      {!isLoading && profile && activeTab === 'compliance'    && <ComplianceTab    key={`cmp-${profile.email}`} initialData={profile} />}
      {!isLoading && profile && activeTab === 'notifications' && <NotificationsTab key={`ntf-${profile.email}`} initialData={profile} />}
      {activeTab === 'payment'       && <PaymentTab />}
      {activeTab === 'subscription'  && <SubscriptionTab />}
      {activeTab === 'team'          && <TeamTab />}
    </div>
  );
}
