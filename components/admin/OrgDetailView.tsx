'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, LayoutDashboard, Briefcase, Package, ShieldCheck, Truck, CreditCard, Zap, Bell, Users, ClipboardList,
  CheckCircle2, Circle, ExternalLink, AlertTriangle, MapPin, Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserStatusBadge } from '@/components/admin/UserStatusBadge';
import { Table, display, type Row } from '@/components/admin/DetailParts';
import { CompanyStatusBadge } from '@/components/admin/CompanyBadges';
import { PersonStatusBadge, ROLE_LABELS } from '@/components/admin/PersonBadges';
import { formatCurrency } from '@/lib/utils';
import { OrgProfile } from '@/components/orgs/OrgProfile';
import { ClaimDecision } from '@/components/admin/ClaimDecision';
import { ComplianceItems, type ComplianceItem } from '@/components/compliance/ComplianceItems';
import { AuthorityRows, type Authority } from '@/components/entities/AuthoritiesPanel';
import { DataCard, DataRows, type DataRow } from '@/components/profile/DataCard';
import { FmcsaRecord } from '@/components/compliance/FmcsaRecord';
import { AdminReviews } from '@/components/admin/AdminReviews';
import { CategoriesEditor } from '@/components/entities/CategoriesEditor';
import { useCatalog, nameOf } from '@/components/entities/catalog';

interface CompanyDetail {
  company: Row & { name: string; type: 'carrier' | 'shipper' | 'factor' | 'receiver' | 'broker' };
  company_profile: Row | null;
  verification: {
    status: string; notes: string | null; updated_at: string | null; updated_by: string | null;
  };
  documents: Row[];
  members: (Row & { user_id: number; name: string; role: string; account_status: string })[];
  activity: Record<string, number | null>;
  recent_shipments: Row[];
  checklist: CheckRow[];
  compliance: ComplianceItem[];
  tabs: {
    services: string[]; certifications: string[]; vehicles: Row[];
    authorities: Authority[]; categories: string[];
    payment: Row; payment_methods: Row[];
    subscription: { plan: string | null; history: Row[] };
    invitations: Row[]; contracts: Row[]; preferred: Row[]; locations: Row[];
  } | null;
}

interface CheckRow {
  key: string; group: string; label: string; required: boolean; state: 'passed' | 'pending' | 'missing' | 'failed' | 'expired'; detail: string | null;
  /** From the verification policy (Admin Console, Compliance) */
  setting?: 'required' | 'optional' | 'deferred'; due?: string | null; overdue?: boolean; promotion?: string | null;
  /** What it is checked against (demo/compliance-checks.html) */
  check?: string | null; method?: 'auto' | 'review';
  /** When the check last ran or the item was last verified */
  checked_at?: string | null;
}

type Tab = 'overview' | 'business' | 'services' | 'compliance' | 'vehicles' | 'payment' | 'subscription' | 'notifications' | 'team' | 'loads' | 'directory' | 'reviews';
/** [key, label, verifiedKey?]: verifiedKey adds a Verified tag beside the value */
type Field = [string, string, string?];
type Section = { title: string; fields: Field[] };
type TabDef = { id: Tab; label: string; icon: React.ElementType };

// Same tabs the company sees on its own profile
const SHIPPER_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'services', label: 'Services', icon: Package }, { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'directory', label: 'Locations & contacts', icon: MapPin },
  { id: 'payment', label: 'Payment', icon: CreditCard }, { id: 'subscription', label: 'Subscription', icon: Zap },
  { id: 'notifications', label: 'Notifications', icon: Bell }, { id: 'team', label: 'Team', icon: Users },
  { id: 'loads', label: 'Loads', icon: ClipboardList }, { id: 'reviews', label: 'Reviews', icon: Star },
];
const CARRIER_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'services', label: 'Services', icon: Package }, { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'vehicles', label: 'Vehicles', icon: Truck }, { id: 'directory', label: 'Locations & contacts', icon: MapPin },
  { id: 'payment', label: 'Payouts', icon: CreditCard },
  { id: 'team', label: 'Team', icon: Users }, { id: 'loads', label: 'Loads', icon: ClipboardList }, { id: 'reviews', label: 'Reviews', icon: Star },
];
const TYPE_NAME: Record<string, string> = { carrier: 'Carrier', shipper: 'Shipper', factor: 'Factoring company', receiver: 'Receiver', broker: 'Broker' };

const CARRIER_BUSINESS: Section[] = [
  { title: 'Company', fields: [['company_name', 'Legal business name'], ['carrier_type', 'Carrier type'], ['rating', 'Rating'], ['total_deliveries', 'Deliveries']] },
  { title: 'Address', fields: [['street', 'Street'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP'], ['country', 'Country']] },
];
const SHIPPER_BUSINESS: Section[] = [
  { title: 'Company identity', fields: [
    ['company_name', 'Legal business name'], ['dba', 'DBA'], ['business_type', 'Business type'], ['industry', 'Industry'],
    ['ein', 'EIN', 'ein_verified_at'], ['state_of_incorporation', 'State of incorporation'],
    ['year_established', 'Established'], ['employee_count', 'Employees'], ['verification_status', 'Profile status'],
  ] },
  { title: 'Contact', fields: [['business_phone', 'Business phone'], ['business_email', 'Business email'], ['website', 'Website'], ['phone', 'Owner phone'], ['whatsapp', 'WhatsApp']] },
  { title: 'Registered address', fields: [['biz_street', 'Street'], ['biz_city', 'City'], ['biz_state', 'State'], ['biz_zip', 'ZIP'], ['biz_country', 'Country']] },
  { title: 'Operating address', fields: [['ops_same_as_biz', 'Same as registered'], ['ops_street', 'Street'], ['ops_city', 'City'], ['ops_state', 'State'], ['ops_zip', 'ZIP'], ['ops_country', 'Country']] },
];

// ── Layout pieces ────────────────────────────────────────────────────────────

/** A titled section (same look as the Profile pages). flush: the body has no padding (tables, row lists). */
function Panel({ title, subtitle, action, children, flush }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  return (
    <DataCard title={title} subtitle={subtitle} action={action}>
      <div className={flush ? '' : 'px-4 py-3'}>{children}</div>
    </DataCard>
  );
}

/** Field name on the left, value on the right. Empty values show a dash so gaps are easy to spot. */
function Details({ data, fields }: { data: Row; fields: Field[] }) {
  return (
    <DataRows rows={fields.map(([key, label, verifiedKey]): DataRow => {
      const v = data[key];
      const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
      if (empty) return [label, null];
      return [label, (
        <span key={key} className="inline-flex flex-wrap items-center gap-1.5">
          {display(key, v)}
          {verifiedKey && (data[verifiedKey]
            ? <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-emerald-700"><CheckCircle2 size={10} />Verified</span>
            : <span className="rounded-full bg-[var(--color-cream)] px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">Not verified</span>)}
        </span>
      )];
    })} />
  );
}

/** A section whose rows are already worked out */
function Rows({ title, subtitle, action, rows }: { title: string; subtitle?: string; action?: React.ReactNode; rows: DataRow[] }) {
  return <DataCard title={title} subtitle={subtitle} action={action} rows={rows} />;
}

const CHECK_STYLE: Record<CheckRow['state'], [string, string]> = {
  passed:  ['bg-emerald-50 text-emerald-700', 'Passed'],
  pending: ['bg-amber-50 text-amber-700', 'Pending'],
  missing: ['bg-[var(--color-cream)] text-[var(--color-text-muted)]', 'Missing'],
  failed:  ['bg-red-50 text-red-700', 'Failed'],
  expired: ['bg-red-50 text-red-700', 'Expired'],
};

/** Every item checked before approval, grouped, with its state */
function ChecklistTable({ rows }: { rows: CheckRow[] }) {
  const required = rows.filter((r) => r.required);
  const met = required.filter((r) => r.state === 'passed').length;
  return (
    <Panel flush title="Verification status" subtitle="Everything checked before this company can be approved. What is required is set in Admin Console, Compliance."
      action={<span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${met === required.length ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{met} of {required.length} required passed</span>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-cream-dark)] text-left text-[11px] uppercase tracking-[0.05em] text-[var(--color-text-faint)]">
              <th className="px-4 py-1.5 font-medium">Check</th>
              <th className="px-2 py-1.5 font-medium">Area</th>
              <th className="px-2 py-1.5 font-medium">Checked against</th>
              <th className="px-2 py-1.5 font-medium">Required</th>
              <th className="px-2 py-1.5 font-medium">Status</th>
              <th className="px-2 py-1.5 font-medium">Checked</th>
              <th className="px-4 py-1.5 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const [cls, word] = CHECK_STYLE[r.state];
              return (
                <tr key={r.key ?? r.label} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
                  <td className="px-4 py-1.5 font-medium text-[var(--color-text)]">{r.label}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text-muted)]">{r.group}</td>
                  <td className="px-2 py-1.5 text-xs text-[var(--color-text-muted)]">{r.check ?? '—'}{r.method === 'review' && <span className="block text-[10px] text-[var(--color-text-faint)]">Shipmater review</span>}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text-muted)]">
                    {r.overdue ? <span className="font-semibold text-red-700">Overdue</span>
                      : r.setting === 'deferred' ? <span className="text-amber-700">Deferred{r.due ? ` · due ${new Date(r.due).toLocaleDateString()}` : ''}</span>
                      : r.required ? 'Required' : 'Optional'}
                    {r.promotion && <span className="block text-[10px] text-[var(--color-text-faint)]">{r.promotion}</span>}
                  </td>
                  <td className="px-2 py-1.5"><span className={`rounded-full px-2 py-px text-xs font-semibold ${cls}`}>{word}</span></td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs tabular-nums text-[var(--color-text-muted)]" title={r.checked_at ? new Date(r.checked_at).toLocaleString() : undefined}>
                    {r.checked_at ? new Date(r.checked_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-1.5 text-[var(--color-text-muted)]">{r.detail ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Pills({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm italic text-[var(--color-text-faint)]">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <span key={s} className="rounded-full border border-[var(--color-teal)]/30 bg-[var(--color-teal-pale)] px-3 py-1 text-xs font-medium text-[var(--color-teal-dark)]">{s}</span>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--color-text-faint)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--color-slate)]">{value}</p>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

/** One org's admin page. Companies (/admin/companies/{id}) and Organizations (/admin/orgs/{id}) both show it. */
export function OrgDetailView({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const catalog = useCatalog();
  const [notes, setNotes] = useState('');
  const [override, setOverride] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-company', id],
    queryFn: () => api.get(`/api/v1/admin/companies/${id}`).then((r) => r.data.data as CompanyDetail),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-company', id] });
    qc.invalidateQueries({ queryKey: ['admin-companies'] });
  };

  const review = useMutation({
    mutationFn: (action: 'approve' | 'reject') => api.post(`/api/v1/admin/companies/${id}/review`, { action, notes: notes || null, override: action === 'approve' && override }),
    onSuccess: (_, action) => { toast.success(action === 'approve' ? 'Company approved' : 'Company rejected'); setNotes(''); setOverride(false); refresh(); },
    onError: (e: { response?: { data?: { error?: string; message?: string } } }) =>
      toast.error(e.response?.data?.error ?? e.response?.data?.message ?? 'Action failed'),
  });

  // Run every outside check again now (business verification, FMCSA, SAM.gov)
  const runChecks = useMutation({
    mutationFn: () => api.post(`/api/v1/admin/companies/${id}/checks/run`),
    onSuccess: () => { toast.success('Checks run again'); refresh(); },
    onError: () => toast.error('Could not run the checks'),
  });

  const back = (
    <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
      <ArrowLeft size={14} /> Back
    </button>
  );

  if (isLoading) return <div className="space-y-4">{back}<div className="skeleton h-96 rounded-2xl" /></div>;
  if (isError || !data) return <div className="space-y-4">{back}<EmptyState icon={Building2} title="Company not found" /></div>;

  const c = data.company;
  const v = data.verification;
  const t = data.tabs;
  const profile = (data.company_profile ?? {}) as Row;
  const isCarrier = c.type === 'carrier';
  const dir = (data as unknown as { directory?: { listed: boolean; listed_by: string | null; pending_claims: { id: number; as_type: string; user: { id: number; name: string; email: string } | null; created_at: string }[] } }).directory;
  const act = data.activity;
  const ownerApproved = data.members.some((m) => m.role === 'owner' && (m.person_status === 'approved' || m.person_status === 'not_required'));
  const owner = c.owner as Row | null;
  const tabs = isCarrier ? CARRIER_TABS : SHIPPER_TABS;
  const current = tabs.some((x) => x.id === tab) ? tab : (tabs[0]?.id ?? 'overview');
  const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]';
  const noProfile = <p className="text-sm italic text-[var(--color-text-faint)]">The owner hasn&apos;t filled in a profile yet.</p>;
  const initials = c.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const activeSub = t?.subscription.history.find((s) => s.status === 'active');

  // What still stands between this company and working on Shipmater
  // (the required checks, as set in Admin Console, Compliance)
  const readiness: [string, boolean][] = [
    ...data.checklist.filter((r) => r.required).map((r) => [r.label, r.state === 'passed'] as [string, boolean]),
    ['Company approved', v.status === 'approved'],
  ];
  const blocking = data.checklist.filter((r) => r.required && r.state !== 'passed');
  // Uploaded files not already shown on a compliance item
  const itemFiles = new Set((data.compliance ?? []).map((i) => i.file).filter(Boolean));
  const itemKeys = new Set((data.compliance ?? []).map((i) => i.key));
  const otherDocs = data.documents.filter((d) => !itemFiles.has(String(d.url ?? '')) && !itemKeys.has(String(d.type ?? '')));
  const counts: Partial<Record<Tab, number>> = {
    team: data.members.length, compliance: (data.compliance ?? []).length, vehicles: t?.vehicles.length,
    loads: act.shipments ?? undefined, services: t ? t.services.length + t.certifications.length : undefined,
  };

  return (
    <div className="space-y-4">
      {back}

      {/* Header */}
      <section className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-slate)] text-base font-bold text-white">{initials || '—'}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{c.name}</h1>
              <CompanyStatusBadge status={v.status} />
              {dir?.listed && <span className="badge badge-muted">Third party{dir.listed_by ? ` · added by ${dir.listed_by}` : ''}</span>}
              {!!c.joined_promotion && v.status !== 'approved' && <span className="badge bg-amber-50 text-amber-700">Joined in {String(c.joined_promotion)} · not yet verified</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)]">
              <span className="rounded-full bg-[var(--color-cream)] px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-slate)]">
                {TYPE_NAME[String(c.type)] ?? String(c.type)}
              </span>
              {owner && <span>Owner <Link href={`/admin/people/${owner.id}`} className="font-medium text-[var(--color-text)] hover:underline">{String(owner.name)}</Link></span>}
              <span>{data.members.length} member{data.members.length === 1 ? '' : 's'}</span>
              {c.created_at ? <span>Since {new Date(String(c.created_at)).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span> : null}
              {c.plan ? <span>Plan: <span className="font-medium capitalize text-[var(--color-text)]">{String(c.plan)}</span></span> : null}
            </div>
          </div>
        </div>

        {readiness.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--color-cream-dark)] pt-3">
            {readiness.map(([label, done]) => (
              <span key={label} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--color-cream)] text-[var(--color-text-muted)]'}`}>
                {done ? <CheckCircle2 size={13} /> : <Circle size={13} />}{label}
              </span>
            ))}
          </div>
        )}
      </section>


      {/* Someone asked to take over this listed company */}
      {dir?.pending_claims && dir.pending_claims.length > 0 && (
        <Panel title="Waiting for approval" subtitle="These people signed up and asked to manage this company.">
          <div className="space-y-2">
            {dir.pending_claims.map((cl) => <ClaimDecision key={cl.id} claim={cl} orgName={c.name} onDone={() => qc.invalidateQueries({ queryKey: ['admin-company', id] })} />)}
          </div>
        </Panel>
      )}

      {/* Tabs */}
      {(
        <nav role="tablist" className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-[var(--color-cream-dark)]">
          {tabs.map(({ id: tid, label, icon: Icon }) => {
            const on = current === tid;
            return (
              <button key={tid} role="tab" aria-selected={on} onClick={() => setTab(tid)}
                className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  on ? 'border-[var(--color-teal)] text-[var(--color-slate)]' : 'border-transparent text-[var(--color-text-muted)] hover:border-[var(--color-cream-dark)] hover:text-[var(--color-text)]'
                }`}>
                <Icon size={15} className={on ? 'text-[var(--color-teal)]' : ''} />
                {label}
                {counts[tid] !== undefined && (
                  <span className={`rounded-full px-1.5 py-px text-[11px] font-semibold ${on ? 'bg-[var(--color-teal-pale)] text-[var(--color-teal-dark)]' : 'bg-[var(--color-cream)] text-[var(--color-text-faint)]'}`}>{counts[tid]}</span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* Overview */}
      {current === 'overview' && (<>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Shipments" value={act.shipments ?? 0} />
          <Stat label="Active" value={act.active ?? 0} />
          <Stat label="Delivered" value={act.delivered ?? 0} />
          <Stat label={isCarrier ? 'Earned' : 'Spent'} value={formatCurrency(Number(act.value ?? 0))} />
          {isCarrier ? <Stat label="Offers" value={act.bids ?? 0} /> : <Stat label="Contracts" value={t?.contracts.length ?? 0} />}
        </div>

        {data.checklist.length > 0 && <ChecklistTable rows={data.checklist} />}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Company approval" action={<CompanyStatusBadge status={v.status} />}
            subtitle={v.updated_at ? `${new Date(v.updated_at).toLocaleString()}${v.updated_by ? ` by ${v.updated_by}` : ''}` : 'Not reviewed yet'}>
            <div className="space-y-3">
              {v.notes && <p className="rounded-lg bg-[var(--color-cream)] px-3 py-2 text-sm text-[var(--color-text-muted)]">{v.notes}</p>}
              {blocking.length > 0 && v.status !== 'approved' && (
                <Callout>Approval needs these required checks to pass first: <strong>{blocking.map((r) => r.label).join(', ')}</strong>.
                  {blocking.some((r) => r.key === 'owner_identity' || r.key === 'owner_background') && <> See the <button onClick={() => setTab('team')} className="font-semibold underline">Team</button> tab for the owner.</>}
                </Callout>
              )}
              {blocking.length > 0 && v.status !== 'approved' && (
                <label className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                  <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5" />
                  <span>Approve anyway: a provider is down or a result is wrong. Say why below; it is kept on the record.</span>
                </label>
              )}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000}
                placeholder={override ? 'Why are you approving without every required check passed? (required)' : 'Notes (optional, kept on the record)'} className={inputCls} />
              <div className="flex flex-wrap gap-2">
                {v.status !== 'approved' && (
                  <button onClick={() => review.mutate('approve')} disabled={review.isPending || (blocking.length > 0 && (!override || !notes.trim()))}
                    className="btn btn-navy disabled:opacity-50">{override ? 'Approve anyway' : 'Approve company'}</button>
                )}
                {v.status !== 'rejected' && (
                  <button onClick={() => review.mutate('reject')} disabled={review.isPending}
                    className="btn border border-red-200 bg-red-50 text-red-700 disabled:opacity-50">Reject</button>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Outside checks" subtitle="Business verification, FMCSA and SAM.gov run on their own when the company's details change, and daily for FMCSA and SAM.gov.">
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-text-muted)]">Each item in Verification status says what it is checked against. Results arrive by webhook or lookup and approve the company automatically when every required item passes.</p>
              <button onClick={() => runChecks.mutate()} disabled={runChecks.isPending} className="btn btn-navy disabled:opacity-50">
                {runChecks.isPending ? 'Running…' : 'Run checks again'}
              </button>
            </div>
          </Panel>
        </div>
      </>)}

      {/* Business */}
      {current === 'business' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {!data.company_profile ? <Panel title="Business">{noProfile}</Panel> : (isCarrier ? CARRIER_BUSINESS : SHIPPER_BUSINESS).map((sec) => (
            <Panel flush key={sec.title} title={sec.title}><Details data={profile} fields={sec.fields} /></Panel>
          ))}
          <Panel flush title="Company record" subtitle="How the company is stored in Shipmater">
            <Details data={c as Row} fields={[['org_name', 'Company name'], ['plan', 'Plan'], ['status', 'Account status'], ['created_at', 'Created']]} />
          </Panel>
          {/* CategoriesEditor draws its own card */}
          {t && <CategoriesEditor value={t.categories ?? []} saveUrl={`/api/v1/admin/companies/${id}/categories`} onSaved={() => refresh()} />}
        </div>
      )}

      {/* Services */}
      {current === 'services' && t && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Rows title="Services" subtitle="Used to match carriers and filter searches" rows={[
            [isCarrier ? 'What they transport' : 'What they ship', t.services.length ? <Pills key="s" items={t.services} empty="" /> : null],
            ...(isCarrier ? [['Certifications', t.certifications.length ? <Pills key="c" items={t.certifications} empty="" /> : null] as DataRow] : []),
          ]} />
          {!isCarrier && (
            <Panel flush title="Shipment defaults" subtitle="Pre-filled on new shipments">
              <Details data={profile} fields={[['preferred_categories', 'Preferred categories'], ['default_pickup_contact_name', 'Pickup contact'], ['default_pickup_contact_phone', 'Pickup phone'], ['internal_ref_format', 'Reference format']]} />
            </Panel>
          )}
        </div>
      )}

      {/* Compliance */}
      {current === 'compliance' && (<>
        {/* Each item once: the company's data with its status, file and Verify. The authority's status sits under its USDOT / MC. */}
        <ComplianceItems variant="data" items={data.compliance ?? []}
          uploadUrl={(key) => `/api/v1/admin/companies/${id}/compliance/${key}`}
          verifyUrl={(key) => `/api/v1/admin/companies/${id}/compliance/${key}/verify`}
          onChange={() => refresh()}
          sectionExtra={(sec) => t && (sec === 'Operating authority' || sec === 'Authority')
            ? <AuthorityRows items={t.authorities ?? []} orgType={String(c.type)} orgId={Number(id)} onChange={() => refresh()} />
            : null} />
        {/* What FMCSA itself holds, saved daily: filings, BOC-3, authority history, revocations, safety */}
        {(isCarrier || c.type === 'broker') && (
          <div className="space-y-3">
            <p className="pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-faint)]">FMCSA record</p>
            <FmcsaRecord orgId={id} />
          </div>
        )}
        {otherDocs.length > 0 && (
          <Panel flush title="Other documents" subtitle="Uploaded files that aren't one of the items above">
            <Table rows={otherDocs} empty="" columns={[['type', 'Type'], ['name', 'Name'], ['expiry_date', 'Expires'], ['verified_at', 'Verified'], ['created_at', 'Uploaded'], ['url', 'File']]} />
          </Panel>
        )}
      </>)}

      {/* Vehicles */}
      {current === 'vehicles' && t && (
        <Panel flush title="Vehicles" subtitle={`${t.vehicles.length} on file`}>
          <Table rows={t.vehicles.map((v) => ({ ...v,
              equipment: v.equipment_type ? nameOf(catalog.equipment, String(v.equipment_type)) : null,
              features: ((v.capabilities as string[] | undefined) ?? []).map((k) => nameOf(catalog.features, k)).join(', ') || null,
              temp: v.temp_min_f != null || v.temp_max_f != null ? `${v.temp_min_f ?? '?'}° to ${v.temp_max_f ?? '?'}°F` : null,
              owned_by: v.owner_user_id ? 'Driver (owner-operator)' : v.owner_org_id && Number(v.owner_org_id) !== Number(id) ? 'Another company' : 'This company',
              // NHTSA check of the VIN: invalid, entered details that don't match it, recalls for the model
              vin_check: !v.vin ? 'No VIN' : v.vin_status === 'invalid' ? 'Invalid VIN' : v.vin_status === 'error' ? 'NHTSA unreachable' : !v.vin_status ? 'Checking…'
                : [((v.vin_mismatches as { field: string; entered: string; decoded: string }[] | undefined) ?? []).map((m) => `${m.field.replace('_', ' ')}: entered ${m.entered}, VIN says ${m.decoded}`).join('; ') || 'Valid, matches',
                   Number(v.recall_count) ? `${v.recall_count} recalls` : null].filter(Boolean).join(' · '),
            }))} empty="No vehicles added."
            columns={[['unit_number', 'Unit'], ['equipment', 'Equipment'], ['year', 'Year'], ['make', 'Make'], ['model', 'Model'], ['license_plate', 'Plate'], ['max_payload', 'Max payload (lb)'], ['temp', 'Temp. range'], ['features', 'Features'], ['owned_by', 'Owned by'], ['status', 'Status'], ['registration_expiry', 'Registration expires'], ['vin', 'VIN'], ['vin_check', 'VIN check (NHTSA)']]} />
        </Panel>
      )}

      {/* Payment */}
      {current === 'payment' && t && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel flush title={isCarrier ? 'Payouts' : 'Paying for loads'} subtitle="Only names, last 4 digits and statuses. Account numbers and tokens stay with the payment provider.">
            <Details data={{ ...t.payment, bank_institution_name: profile.bank_institution_name, profile_bank_last4: profile.bank_last4, bank_connected_at: profile.bank_connected_at }}
              fields={isCarrier
                ? [['payout_status', 'Stripe payouts'], ['stripe_connected', 'Stripe account linked'], ['stripe_mode', 'Stripe mode'], ['legal_name', 'Legal name on Stripe'], ['business_structure', 'Business structure'], ['bank_name', 'Payout bank'], ['bank_last4', 'Account last 4'], ['commission_rate', 'Commission rate']]
                : [['stripe_customer', 'Stripe customer set up'], ['stripe_mode', 'Stripe mode'], ['bank_institution_name', 'Linked bank'], ['profile_bank_last4', 'Account last 4'], ['bank_connected_at', 'Bank linked'], ['commission_rate', 'Commission rate']]} />
          </Panel>
          <Panel flush title="Payment methods" subtitle={`${t.payment_methods.length} on file`}>
            <Table rows={t.payment_methods} empty="No payment methods on file."
              columns={[['type', 'Type'], ['brand', 'Brand / bank'], ['last4', 'Last 4'], ['expires', 'Expires'], ['is_default', 'Default'], ['created_at', 'Added']]} />
          </Panel>
        </div>
      )}

      {/* Subscription */}
      {current === 'subscription' && t && (
        <div className="space-y-5">
          {activeSub ? (
            <Rows title="Current subscription" action={<span className="badge badge-success">Active</span>} rows={[
              ['Tier', display('tier', activeSub.tier)],
              ['Price', `${formatCurrency(Number(activeSub.monthly_price ?? 0))} a month`],
              ['Started', display('started_at', activeSub.started_at)],
              ['Renews', display('current_period_end', activeSub.current_period_end)],
            ]} />
          ) : (
            <Callout>
              No active subscription. This company can&apos;t post new loads until the owner subscribes on their Subscription tab.
              {t.subscription.history[0] ? <> Last status: <strong>{String(t.subscription.history[0].status).replace(/_/g, ' ')}</strong>.</> : null}
            </Callout>
          )}
          <Panel flush title="Subscription history">
            <Table rows={t.subscription.history} empty="Never subscribed."
              columns={[['tier', 'Tier'], ['monthly_price', 'Monthly price'], ['status', 'Status'], ['started_at', 'Started'], ['current_period_end', 'Renews'], ['tier_review_at', 'Tier review']]} />
          </Panel>
        </div>
      )}

      {/* Notifications */}
      {current === 'notifications' && (
        <div className="max-w-3xl">
          {!data.company_profile ? <Panel title="Notifications">{noProfile}</Panel> : (
            <Rows title="Notifications" rows={([
              ['Email alerts', 'notif_email'], ['SMS alerts', 'notif_sms'], ['Extra recipients', 'notif_recipients'],
            ] as const).map(([label, key]): DataRow => {
              const list = (profile[key] as string[]) ?? [];
              return [label, list.length ? <Pills key={key} items={list} empty="" /> : 'None turned on'];
            })} />
          )}
        </div>
      )}

      {/* Locations and contacts (admins may edit them) */}
      {current === 'directory' && <OrgProfile orgId={Number(c.id)} hideHeader />}

      {/* Team */}
      {current === 'team' && (<>
        <Panel flush title="Members" subtitle={`${data.members.length} ${data.members.length === 1 ? 'person' : 'people'} · click a row to review the person`}
          action={<Link href={`/admin/people?type=${c.type}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-teal)] hover:underline">All people <ExternalLink size={12} /></Link>}>
          {data.members.length === 0 ? (
            <p className="px-4 py-3 text-sm italic text-[var(--color-text-faint)]">No members.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-cream-dark)]">
                    {['Name', 'Role', 'Account', 'Required checks', 'Person approval', 'Joined'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-faint)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => (
                    <tr key={m.user_id} onClick={() => router.push(`/admin/people/${m.user_id}`)}
                      className="cursor-pointer border-b border-[var(--color-cream-dark)] last:border-b-0 hover:bg-[var(--color-cream)]">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-[var(--color-text)]">{m.name}</p>
                        <p className="text-xs text-[var(--color-text-faint)]">{String(m.email ?? '')}</p>
                      </td>
                      <td className="px-3 py-2.5">{ROLE_LABELS[m.role] ?? m.role}</td>
                      <td className="px-3 py-2.5"><UserStatusBadge status={m.account_status} /></td>
                      <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{Number(m.required_total) > 0 ? `${m.required_met} of ${m.required_total}` : 'None'}</td>
                      <td className="px-3 py-2.5"><PersonStatusBadge status={(m.person_status as string) ?? null} /></td>
                      <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{display('joined_at', m.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {isCarrier && <p className="border-t border-[var(--color-cream-dark)] px-4 py-2 text-xs text-[var(--color-text-faint)]">The owner must be approved before the company can be.</p>}
        </Panel>
        {t && (
          <Panel flush title="Invitations not yet accepted" subtitle={`${t.invitations.length} open`}>
            <Table rows={t.invitations} empty="No open invitations."
              columns={[['email', 'Email'], ['role', 'Role'], ['state', 'Status'], ['created_at', 'Sent'], ['expires_at', 'Expires']]} />
          </Panel>
        )}
      </>)}

      {/* Reviews */}
      {current === 'reviews' && <AdminReviews orgId={id} />}

      {/* Loads */}
      {current === 'loads' && t && (<>
        <Panel flush title="Recent shipments" subtitle={`${act.shipments ?? 0} in total · latest 10`}>
          {data.recent_shipments.length === 0 ? <p className="px-4 py-3 text-sm italic text-[var(--color-text-faint)]">No shipments.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-cream-dark)]">
                    {['#', 'Item', 'Route', 'Status', 'Cost', 'Created'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-faint)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent_shipments.map((s) => (
                    <tr key={String(s.id)} onClick={() => router.push(`/admin/shipments/${s.id}`)}
                      className="cursor-pointer border-b border-[var(--color-cream-dark)] last:border-b-0 hover:bg-[var(--color-cream)]">
                      <td className="px-3 py-2.5 text-[var(--color-text-faint)]">{String(s.id)}</td>
                      <td className="px-3 py-2.5 font-medium">{display('item', s.item)}</td>
                      <td className="px-3 py-2.5">{display('route', s.route)}</td>
                      <td className="px-3 py-2.5">{display('status', s.status)}</td>
                      <td className="px-3 py-2.5">{display('agreed_cost', s.agreed_cost)}</td>
                      <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{display('created_at', s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel flush title="Contracts" subtitle={`${t.contracts.length} in total`}>
            <Table rows={t.contracts} empty="No contracts."
              columns={[['title', 'Title'], ['with', isCarrier ? 'Shipper' : 'Carrier'], ['status', 'Status'], ['rate', 'Rate'], ['valid_to', 'Valid to']]} />
          </Panel>
          <Panel flush title={isCarrier ? 'On preferred lists' : 'Preferred carriers'} subtitle={`${t.preferred.length} in total`}>
            <Table rows={t.preferred} empty="None."
              columns={[['with', isCarrier ? 'Shipper' : 'Carrier'], ['status', 'Status'], ['created_at', 'Added']]} />
          </Panel>
        </div>
        {!isCarrier && (
          <Panel flush title="Saved locations" subtitle={`${t.locations.length} in total`}>
            <Table rows={t.locations} empty="No saved locations."
              columns={[['name', 'Name'], ['type', 'Type'], ['city', 'City'], ['state', 'State'], ['contact_name', 'Contact'], ['is_default', 'Default'], ['usage_count', 'Used']]} />
          </Panel>
        )}
      </>)}
    </div>
  );
}
