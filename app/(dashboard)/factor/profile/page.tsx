'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Landmark, Users, Loader2, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, orgApi, payoutsApi } from '@/lib/api';
import { TeamManager } from '@/components/team/TeamManager';
import { ComplianceItems, type ComplianceItem } from '@/components/compliance/ComplianceItems';
import { BusinessDetailsForm, BankAccountForm, PayoutStatus } from '@/components/payouts/PayoutSetup';

type Tab = 'company' | 'finance' | 'compliance' | 'team';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'finance', label: 'Finance', icon: Landmark  },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'team',    label: 'Team',    icon: Users     },
];

interface Field { key: string; label: string; placeholder?: string; type?: string; wide?: boolean; inputMode?: 'numeric' }

type Values = Record<string, string | null>;

function errorMessage(e: unknown): string {
  const data = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  return Object.values(data?.errors ?? {})[0]?.[0] ?? data?.message ?? 'Could not save';
}

/** A titled card of inputs over a shared values object */
function FieldCard({ title, note, fields, values, onChange }: {
  title: string; note?: string; fields: Field[]; values: Values; onChange: (key: string, v: string) => void;
}) {
  return (
    <section className="card">
      <div className="card-head card-head-tint px-5 py-3"><p className="card-title">{title}</p></div>
      <div className="card-body space-y-4">
        {note && <p className="text-sm text-[var(--color-text-muted)]">{note}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.key} className={`block ${f.wide ? 'sm:col-span-2' : ''}`}>
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">{f.label}</span>
              <input type={f.type ?? 'text'} inputMode={f.inputMode} value={values[f.key] ?? ''} placeholder={f.placeholder}
                onChange={(e) => onChange(f.key, e.target.value)} className="profile-input" />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function SaveBar({ pending, updatedAt }: { pending: boolean; updatedAt?: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <button type="submit" disabled={pending} className="btn btn-navy flex items-center gap-2 disabled:opacity-60">
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
      </button>
      {updatedAt && <span className="text-xs text-[var(--color-text-faint)]">Last saved {new Date(updatedAt).toLocaleString()}</span>}
    </div>
  );
}

// ── Company ─────────────────────────────────────────────────────────────────

// Legal name, EIN, address, phone and website are in the business details below (sent to Stripe for payouts)
const COMPANY_FIELDS: Field[] = [
  { key: 'name',    label: 'Company name shown on Shipmater', placeholder: 'Acme Capital', wide: true },
  { key: 'email',   label: 'Company email', placeholder: 'ops@acmecapital.com', type: 'email' },
];

function CompanyTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['org'], queryFn: () => orgApi.get().then((r) => r.data.data as Values) });
  const [form, setForm] = useState<Values>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Values = {};
      for (const f of COMPANY_FIELDS) payload[f.key] = form[f.key]?.trim() || null;
      if (!payload.name) delete payload.name;
      return orgApi.update(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org'] }); toast.success('Company details saved'); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <div className="skeleton h-80 rounded-xl" />;
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
        <FieldCard title="Company" note="Carriers and shippers see these on NOAs and on the loads you fund."
          fields={COMPANY_FIELDS} values={form} onChange={set} />
        <SaveBar pending={save.isPending} />
      </form>

      <section className="card">
        <div className="card-head card-head-tint px-5 py-3"><p className="card-title">Business details</p></div>
        <div className="card-body">
          <p className="mb-6 text-sm text-[var(--color-text-muted)]">What Stripe needs to open your payout account. Fields marked <span className="font-bold text-red-500">*</span> are required. They&apos;re sent to Stripe once, from the Finance tab.</p>
          <BusinessDetailsForm />
        </div>
      </section>
    </div>
  );
}

// ── Finance ─────────────────────────────────────────────────────────────────

const ACH_FIELDS: Field[] = [
  { key: 'payee_name',     label: 'Account holder (pay to)', placeholder: 'Acme Capital LLC', wide: true },
  { key: 'bank_name',      label: 'Bank name' },
  { key: 'routing_number', label: 'ACH routing number', placeholder: '9 digits', inputMode: 'numeric' },
];
const WIRE_FIELDS: Field[] = [
  { key: 'wire_routing_number', label: 'Wire routing number (if different)', placeholder: '9 digits', inputMode: 'numeric' },
];
const CHECK_FIELDS: Field[] = [
  { key: 'check_payable_to', label: 'Make checks payable to', wide: true },
  { key: 'check_street',     label: 'Mailing address', placeholder: 'PO Box or street', wide: true },
  { key: 'check_city',       label: 'City' },
  { key: 'check_state',      label: 'State' },
  { key: 'check_zip',        label: 'ZIP' },
];
const REMIT_FIELDS: Field[] = [
  { key: 'remittance_email', label: 'Remittance email', placeholder: 'remit@acmecapital.com', type: 'email' },
  { key: 'remittance_phone', label: 'Remittance phone', type: 'tel' },
];
const BILLING_FIELDS: Field[] = [
  { key: 'billing_name',  label: 'Billing contact' },
  { key: 'billing_email', label: 'Billing email', type: 'email' },
  { key: 'billing_phone', label: 'Billing phone', type: 'tel' },
];

function FinanceTab({ onGoTo }: { onGoTo: (tab: string) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['org-remittance'], queryFn: () => orgApi.remittance().then((r) => r.data.data as Values) });
  const [form, setForm] = useState<Values>({});
  const [accountNumber, setAccountNumber] = useState('');
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Values = {};
      for (const f of [...ACH_FIELDS, ...WIRE_FIELDS, ...CHECK_FIELDS, ...REMIT_FIELDS, ...BILLING_FIELDS]) payload[f.key] = form[f.key]?.trim() || null;
      payload.account_type = form.account_type || null;
      payload.instructions = form.instructions?.trim() || null;
      if (accountNumber.trim()) payload.account_number = accountNumber.replace(/\s/g, '');
      return orgApi.updateRemittance(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-remittance'] }); setAccountNumber(''); toast.success('Finance details saved'); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <div className="skeleton h-96 rounded-xl" />;
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-5">
    <section className="card">
      <div className="card-body"><BankAccountForm /></div>
    </section>

    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
      <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-cream)] px-5 py-4 text-sm text-[var(--color-text-muted)]">
        The details below are printed on your NOAs and invoices. Load payments go to the payout bank account above.
      </div>

      <section className="card">
        <div className="card-head card-head-tint px-5 py-3"><p className="card-title">Bank (ACH) on NOAs</p></div>
        <div className="card-body">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ACH_FIELDS.map((f) => (
              <label key={f.key} className={`block ${f.wide ? 'sm:col-span-2' : ''}`}>
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">{f.label}</span>
                <input value={form[f.key] ?? ''} placeholder={f.placeholder} inputMode={f.inputMode}
                  onChange={(e) => set(f.key, e.target.value)} className="profile-input" />
              </label>
            ))}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Account number</span>
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" autoComplete="off"
                placeholder={form.account_last4 ? `On file: •••• ${form.account_last4} (type to replace)` : '4–17 digits'} className="profile-input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Account type</span>
              <select value={form.account_type ?? ''} onChange={(e) => set('account_type', e.target.value)} className="profile-select">
                <option value="">Select…</option>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </label>
            {WIRE_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">{f.label}</span>
                <input value={form[f.key] ?? ''} placeholder={f.placeholder} inputMode={f.inputMode}
                  onChange={(e) => set(f.key, e.target.value)} className="profile-input" />
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-faint)]">The account number is stored encrypted. Only the last 4 digits are shown back.</p>
        </div>
      </section>

      <FieldCard title="Checks by mail" fields={CHECK_FIELDS} values={form} onChange={set} />

      <section className="card">
        <div className="card-head card-head-tint px-5 py-3"><p className="card-title">Remittance advice</p></div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {REMIT_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">{f.label}</span>
                <input type={f.type} value={form[f.key] ?? ''} placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)} className="profile-input" />
              </label>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Payment instructions for shippers</span>
            <textarea value={form.instructions ?? ''} onChange={(e) => set('instructions', e.target.value)} rows={3} maxLength={2000}
              placeholder="e.g. Include the load number and carrier name in the payment memo." className="profile-input" />
          </label>
        </div>
      </section>

      <FieldCard title="Billing contact" note="Who receives Shipmater invoices and account notices."
        fields={BILLING_FIELDS} values={form} onChange={set} />

      <SaveBar pending={save.isPending} updatedAt={form.updated_at} />
    </form>

    <section className="card">
      <div className="card-body">
        <PayoutStatus
          tabs={{ person: { id: 'company', label: 'Company' }, business: { id: 'company', label: 'Company' }, bank: { id: 'finance', label: 'Finance' } }}
          onGoTo={onGoTo}
        />
      </div>
    </section>
    </div>
  );
}

// ── Compliance ──────────────────────────────────────────────────────────────

/** W-9, licence, NOA template: upload them here; Shipmater verifies them */
function MyCompliance() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['org-compliance'],
    queryFn: () => api.get('/api/v1/org/compliance').then((r) => r.data.data as ComplianceItem[]),
  });
  if (isLoading) return <div className="skeleton h-64 rounded-xl" />;
  return <ComplianceItems items={data ?? []} uploadUrl={(key) => `/api/v1/org/compliance/${key}`}
    onChange={(items) => qc.setQueryData(['org-compliance'], items)} />;
}

// ── Page ────────────────────────────────────────────────────────────────────

function Account() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get('tab') as Tab | null;
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : 'company';
  const qc = useQueryClient();
  const stripeResult = params.get('stripe');

  // Back from Stripe's review page: read its answer
  useEffect(() => {
    if (!stripeResult) return;
    router.replace('/factor/profile?tab=finance');
    if (stripeResult !== 'success') { toast('Stripe setup was not finished. Continue whenever you are ready.'); return; }
    payoutsApi.refresh().then((r) => {
      qc.setQueryData(['payout-setup'], r.data.data);
      const status = r.data.data?.stripe?.status;
      toast(status === 'verified' ? 'Payouts are on.' : status === 'reviewing' ? 'Stripe is checking your details.' : 'Stripe still needs a few things. See Payouts below.');
    }).catch(() => qc.invalidateQueries({ queryKey: ['payout-setup'] }));
  }, [stripeResult]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="page-title">Account Settings</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">Your factoring company&apos;s details, how shippers pay you, and your team</p>
      </div>

      <div className="flex gap-1 rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => router.replace(`/factor/profile?tab=${id}`)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              tab === id ? 'bg-[var(--color-slate)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === 'company' && <CompanyTab />}
      {tab === 'finance' && <FinanceTab onGoTo={(t) => router.replace(`/factor/profile?tab=${t}`)} />}
      {tab === 'compliance' && <MyCompliance />}
      {tab === 'team'    && <TeamManager type="factor" />}
    </div>
  );
}

export default function FactorAccountPage() {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}
