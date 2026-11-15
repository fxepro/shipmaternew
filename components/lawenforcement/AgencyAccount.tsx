'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Building2, Loader2, Save, ShieldCheck, User, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, orgApi } from '@/lib/api';
import { TeamManager } from '@/components/team/TeamManager';
import { ComplianceItems, type ComplianceItem } from '@/components/compliance/ComplianceItems';
import { MyVerification } from '@/components/people/MyVerification';
import { PersonHeader, CompanyHeader } from '@/components/account/AccountHeader';
import { PersonalDetails } from '@/components/account/PersonalDetails';
import { errorMessage } from './shared';

/**
 * Profile (/agency/profile) and Agency (/agency/company), the same page as the other company types.
 * Who the officer is and which agency they work for, kept in case a search is ever questioned.
 */
type Tab = 'personal' | 'officer' | 'verification' | 'agency' | 'compliance' | 'team';

const PROFILE_TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'personal',     label: 'Personal',     icon: User        },
  { id: 'officer',      label: 'Officer',      icon: BadgeCheck  },
  { id: 'verification', label: 'Verification', icon: ShieldCheck },
];
const COMPANY_TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'agency',     label: 'Agency',     icon: Building2   },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'team',       label: 'Team',       icon: Users       },
];

type Values = Record<string, string | null>;
interface Field { key: string; label: string; placeholder?: string; type?: string; wide?: boolean }

const OFFICER_FIELDS: Field[] = [
  { key: 'badge_number', label: 'Badge or ID number' },
  { key: 'title', label: 'Rank or title', placeholder: 'Trooper' },
  { key: 'unit', label: 'Unit or post', placeholder: 'Commercial Vehicle Enforcement', wide: true },
  { key: 'work_phone', label: 'Work phone', type: 'tel' },
];
const SUPERVISOR_FIELDS: Field[] = [
  { key: 'supervisor_name', label: 'Supervisor name' },
  { key: 'supervisor_email', label: 'Supervisor email', type: 'email' },
  { key: 'supervisor_phone', label: 'Supervisor phone', type: 'tel' },
];
const AGENCY_FIELDS: Field[] = [
  { key: 'name', label: 'Agency name', wide: true },
  { key: 'ori_number', label: 'ORI number', placeholder: 'OH0250000' },
  { key: 'jurisdiction', label: 'Jurisdiction', placeholder: 'State of Ohio' },
  { key: 'phone', label: 'Main phone', type: 'tel' },
  { key: 'email', label: 'Agency email', type: 'email' },
  { key: 'street', label: 'Street', wide: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'zip', label: 'ZIP' },
];
const KINDS: [string, string][] = [
  ['state_police', 'State police'], ['highway_patrol', 'Highway patrol'], ['sheriff', 'Sheriff'], ['police', 'Police department'],
  ['federal', 'Federal'], ['port', 'Port of entry'], ['dot_enforcement', 'DOT enforcement'], ['other', 'Other'],
];

function FieldCard({ title, fields, values, onChange, children }: {
  title: string; fields: Field[]; values: Values; onChange: (k: string, v: string) => void; children?: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-head card-head-tint px-5 py-3"><p className="card-title">{title}</p></div>
      <div className="card-body">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {children}
          {fields.map((f) => (
            <label key={f.key} className={`block ${f.wide ? 'sm:col-span-2' : ''}`}>
              <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">{f.label}</span>
              <input type={f.type ?? 'text'} value={values[f.key] ?? ''} placeholder={f.placeholder}
                onChange={(e) => onChange(f.key, e.target.value)} className="profile-input" />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="btn btn-navy flex items-center gap-2 disabled:opacity-60">
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
    </button>
  );
}

function OfficerTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['agency-officer'], queryFn: () => api.get('/api/v1/agency/officer').then((r) => r.data.data as Values) });
  const [form, setForm] = useState<Values>({});
  useEffect(() => { if (data) setForm(data); }, [data]);
  const save = useMutation({
    mutationFn: () => {
      const payload: Values = {};
      for (const f of [...OFFICER_FIELDS, ...SUPERVISOR_FIELDS]) payload[f.key] = form[f.key]?.trim() || null;
      return api.put('/api/v1/agency/officer', payload);
    },
    onSuccess: (r) => { qc.setQueryData(['agency-officer'], r.data.data); toast.success('Saved'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading) return <div className="skeleton h-80 rounded-xl" />;
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
      <FieldCard title="Officer" fields={OFFICER_FIELDS} values={form} onChange={set} />
      <FieldCard title="Supervisor" fields={SUPERVISOR_FIELDS} values={form} onChange={set} />
      <SaveButton pending={save.isPending} />
    </form>
  );
}

function AgencyTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['org'], queryFn: () => orgApi.get().then((r) => r.data.data as Values) });
  const [form, setForm] = useState<Values>({});
  useEffect(() => { if (data) setForm(data); }, [data]);
  const save = useMutation({
    mutationFn: () => {
      const payload: Values = { agency_kind: form.agency_kind || null };
      for (const f of AGENCY_FIELDS) payload[f.key] = form[f.key]?.trim() || null;
      if (!payload.name) delete payload.name;
      return orgApi.update(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org'] }); toast.success('Agency saved'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading) return <div className="skeleton h-80 rounded-xl" />;
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
      {data?.verification_status && data.verification_status !== 'approved' && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          Shipmater approves your agency before searches open. Fill in the details below and upload the authorization letter under Compliance.
        </p>
      )}
      <FieldCard title="Agency" fields={AGENCY_FIELDS} values={form} onChange={set}>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">Type of agency</span>
          <select value={form.agency_kind ?? ''} onChange={(e) => set('agency_kind', e.target.value)} className="profile-select">
            <option value="">Select…</option>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </FieldCard>
      <SaveButton pending={save.isPending} />
    </form>
  );
}

function ComplianceTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['org-compliance'],
    queryFn: () => api.get('/api/v1/org/compliance').then((r) => r.data.data as ComplianceItem[]),
  });
  if (isLoading) return <div className="skeleton h-64 rounded-xl" />;
  return <ComplianceItems items={data ?? []} uploadUrl={(key) => `/api/v1/org/compliance/${key}`}
    onChange={(items) => qc.setQueryData(['org-compliance'], items)} />;
}

export function AgencyAccount() {
  const router = useRouter();
  const params = useSearchParams();
  const companyPage = (usePathname() ?? '').endsWith('/company');
  const base = companyPage ? '/agency/company' : '/agency/profile';
  const TABS = companyPage ? COMPANY_TABS : PROFILE_TABS;
  const requested = params.get('tab') as Tab | null;
  const tab: Tab = TABS.some((t) => t.id === requested) ? (requested as Tab) : TABS[0].id;

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="page-title">{companyPage ? 'Agency' : 'Profile'}</h1>
      {companyPage ? <CompanyHeader type="agency" /> : <PersonHeader />}
      <div className="flex gap-1 rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => router.replace(`${base}?tab=${id}`)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[length:var(--text-nav)] font-semibold transition-all ${
              tab === id ? 'bg-[var(--color-slate)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>
      {tab === 'personal' && <PersonalDetails />}
      {tab === 'officer' && <OfficerTab />}
      {tab === 'verification' && <MyVerification embedded />}
      {tab === 'agency' && <AgencyTab />}
      {tab === 'compliance' && <ComplianceTab />}
      {tab === 'team' && <TeamManager type="agency" />}
    </div>
  );
}
