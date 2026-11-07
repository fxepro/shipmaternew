'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, LayoutDashboard, Briefcase, Package, ShieldCheck, Truck, CreditCard, Zap, Bell, Users, ClipboardList,
  CheckCircle2, Circle, ExternalLink, AlertTriangle, MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserStatusBadge } from '@/components/admin/UserStatusBadge';
import { Table, display, type Row } from '@/components/admin/DetailParts';
import { CompanyStatusBadge, BackgroundBadge, BACKGROUND_RESULTS, BACKGROUND_PASSED } from '@/components/admin/CompanyBadges';
import { PersonStatusBadge, ROLE_LABELS } from '@/components/admin/PersonBadges';
import { formatCurrency } from '@/lib/utils';
import { OrgProfile } from '@/components/orgs/OrgProfile';
import { ClaimDecision } from '@/components/admin/ClaimDecision';

interface CompanyDetail {
  company: Row & { name: string; type: 'carrier' | 'shipper' | 'factor' | 'receiver' | 'broker' };
  company_profile: Row | null;
  verification: {
    status: string; notes: string | null; updated_at: string | null; updated_by: string | null;
    background_status: string; background_reference: string | null; background_notes: string | null; background_checked_at: string | null;
  };
  documents: Row[];
  members: (Row & { user_id: number; name: string; role: string; account_status: string })[];
  activity: Record<string, number | null>;
  recent_shipments: Row[];
  tabs: {
    services: string[]; certifications: string[]; vehicles: Row[];
    payment: Row; payment_methods: Row[];
    subscription: { plan: string | null; history: Row[] };
    invitations: Row[]; contracts: Row[]; preferred: Row[]; locations: Row[];
  } | null;
}

type Tab = 'overview' | 'business' | 'services' | 'compliance' | 'vehicles' | 'payment' | 'subscription' | 'notifications' | 'team' | 'loads' | 'directory';
type Section = { title: string; fields: [string, string][] };
type TabDef = { id: Tab; label: string; icon: React.ElementType };

// Same tabs the company sees on its own profile
const SHIPPER_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'services', label: 'Services', icon: Package }, { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'directory', label: 'Locations & contacts', icon: MapPin },
  { id: 'payment', label: 'Payment', icon: CreditCard }, { id: 'subscription', label: 'Subscription', icon: Zap },
  { id: 'notifications', label: 'Notifications', icon: Bell }, { id: 'team', label: 'Team', icon: Users },
  { id: 'loads', label: 'Loads', icon: ClipboardList },
];
const CARRIER_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'services', label: 'Services', icon: Package }, { id: 'compliance', label: 'Insurance & authority', icon: ShieldCheck },
  { id: 'vehicles', label: 'Vehicles', icon: Truck }, { id: 'directory', label: 'Locations & contacts', icon: MapPin },
  { id: 'payment', label: 'Payouts', icon: CreditCard },
  { id: 'team', label: 'Team', icon: Users }, { id: 'loads', label: 'Loads', icon: ClipboardList },
];
// Receivers and brokers: no review, no profile; their page is locations, contacts, team and loads
const LISTING_TABS: TabDef[] = [
  { id: 'directory', label: 'Locations & contacts', icon: MapPin }, { id: 'team', label: 'Team', icon: Users },
  { id: 'loads', label: 'Loads', icon: ClipboardList },
];
const TYPE_NAME: Record<string, string> = { carrier: 'Carrier', shipper: 'Shipper', factor: 'Factoring company', receiver: 'Receiver', broker: 'Broker' };

const CARRIER_BUSINESS: Section[] = [
  { title: 'Company', fields: [['company_name', 'Legal business name'], ['carrier_type', 'Carrier type'], ['rating', 'Rating'], ['total_deliveries', 'Deliveries']] },
  { title: 'Address', fields: [['street', 'Street'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP'], ['country', 'Country']] },
];
const CARRIER_COMPLIANCE: Section[] = [
  { title: 'Operating authority', fields: [['dot_number', 'DOT #'], ['dot_verified', 'DOT verified'], ['mc_number', 'MC #'], ['mc_verified', 'MC verified'], ['operating_authority_type', 'Authority type'], ['operating_authority_number', 'Authority #']] },
  { title: 'Auto liability insurance', fields: [['insurance_verified', 'Insurance verified'], ['auto_insurer_name', 'Insurer'], ['auto_policy_number', 'Policy #'], ['auto_coverage_amount', 'Coverage'], ['auto_expiry_date', 'Expires']] },
  { title: 'Cargo insurance', fields: [['cargo_insurer_name', 'Insurer'], ['cargo_policy_number', 'Policy #'], ['cargo_coverage_amount', 'Coverage'], ['cargo_expiry_date', 'Expires']] },
];
const SHIPPER_BUSINESS: Section[] = [
  { title: 'Company identity', fields: [
    ['company_name', 'Legal business name'], ['dba', 'DBA'], ['business_type', 'Business type'], ['industry', 'Industry'],
    ['ein', 'EIN'], ['ein_verified_at', 'EIN verified'], ['state_of_incorporation', 'State of incorporation'],
    ['year_established', 'Established'], ['employee_count', 'Employees'], ['verification_status', 'Profile status'],
  ] },
  { title: 'Contact', fields: [['business_phone', 'Business phone'], ['business_email', 'Business email'], ['website', 'Website'], ['phone', 'Owner phone'], ['whatsapp', 'WhatsApp']] },
  { title: 'Registered address', fields: [['biz_street', 'Street'], ['biz_city', 'City'], ['biz_state', 'State'], ['biz_zip', 'ZIP'], ['biz_country', 'Country']] },
  { title: 'Operating address', fields: [['ops_same_as_biz', 'Same as registered'], ['ops_street', 'Street'], ['ops_city', 'City'], ['ops_state', 'State'], ['ops_zip', 'ZIP'], ['ops_country', 'Country']] },
];
const SHIPPER_COMPLIANCE: Section[] = [
  { title: 'Certificate of insurance', fields: [['coi_url', 'File'], ['coi_expiry', 'Expires']] },
  { title: 'HazMat registration (PHMSA)', fields: [['hazmat_reg_url', 'File'], ['hazmat_reg_expiry', 'Expires']] },
  { title: 'HIPAA BAA', fields: [['hipaa_baa_url', 'File'], ['hipaa_baa_expiry', 'Expires']] },
  { title: 'Government', fields: [['sam_gov_number', 'SAM.gov #']] },
];

// ── Layout pieces ────────────────────────────────────────────────────────────

function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="flex items-start justify-between gap-3 border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]/40 px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-slate)]">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--color-text-faint)]">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Label / value grid. Empty values read "Not provided" so gaps are easy to spot. */
function Details({ data, fields, cols = 2 }: { data: Row; fields: [string, string][]; cols?: 1 | 2 | 3 }) {
  const grid = cols === 1 ? '' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <dl className={`grid grid-cols-1 gap-x-8 gap-y-4 ${grid}`}>
      {fields.map(([key, label]) => {
        const v = data[key];
        const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
        return (
          <div key={key} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-faint)]">{label}</dt>
            <dd className={`mt-1 text-sm ${empty ? 'italic text-[var(--color-text-faint)]' : 'font-medium text-[var(--color-text)]'}`}>
              {empty ? 'Not provided' : display(key, v)}
            </dd>
          </div>
        );
      })}
    </dl>
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
    <div className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-text-faint)]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[var(--color-slate)]">{value}</p>
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

export default function AdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [bgResult, setBgResult] = useState('');
  const [bgReference, setBgReference] = useState('');
  const [bgNotes, setBgNotes] = useState('');
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
    mutationFn: (action: 'approve' | 'reject') => api.post(`/api/v1/admin/companies/${id}/review`, { action, notes: notes || null }),
    onSuccess: (_, action) => { toast.success(action === 'approve' ? 'Company approved' : 'Company rejected'); setNotes(''); refresh(); },
    onError: (e: { response?: { data?: { error?: string; message?: string } } }) =>
      toast.error(e.response?.data?.error ?? e.response?.data?.message ?? 'Action failed'),
  });

  const background = useMutation({
    mutationFn: () => api.post(`/api/v1/admin/companies/${id}/background`, {
      result: bgResult, reference: bgReference || null, notes: bgNotes || null,
    }),
    onSuccess: () => { toast.success('Background check recorded'); setBgResult(''); setBgReference(''); setBgNotes(''); refresh(); },
    onError: () => toast.error('Could not record background check'),
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
  const isFactor  = c.type === 'factor';
  const isListing = c.type === 'receiver' || c.type === 'broker';
  const dir = (data as unknown as { directory?: { listed: boolean; listed_by: string | null; pending_claims: { id: number; as_type: string; user: { id: number; name: string; email: string } | null; created_at: string }[] } }).directory;
  const bgPassed = BACKGROUND_PASSED.includes(v.background_status);
  const act = data.activity;
  const ownerApproved = data.members.some((m) => m.role === 'owner' && (m.person_status === 'approved' || m.person_status === 'not_required'));
  const owner = c.owner as Row | null;
  const tabs = isFactor ? [] : isListing ? LISTING_TABS : isCarrier ? CARRIER_TABS : SHIPPER_TABS;
  const current = tabs.some((x) => x.id === tab) ? tab : (tabs[0]?.id ?? 'overview');
  const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]';
  const noProfile = <p className="text-sm italic text-[var(--color-text-faint)]">The owner hasn&apos;t filled in a profile yet.</p>;
  const initials = c.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const activeSub = t?.subscription.history.find((s) => s.status === 'active');

  // What still stands between this company and working on Shipmater
  const readiness: [string, boolean][] = (isFactor || isListing) ? [] : [
    ['Business details', !!(profile.company_name && (isCarrier ? profile.dot_number || profile.mc_number : profile.ein))],
    ['Background check clear', bgPassed],
    ...(isCarrier
      ? [['Owner approved', ownerApproved], ['Insurance verified', !!profile.insurance_verified], ['Payouts set up', t?.payment.payout_status === 'active' || t?.payment.payout_status === 'verified']] as [string, boolean][]
      : [['Payment method on file', (t?.payment_methods.length ?? 0) > 0], ['Subscription active', !!activeSub]] as [string, boolean][]),
    ['Company approved', v.status === 'approved'],
  ];
  const counts: Partial<Record<Tab, number>> = {
    team: data.members.length, compliance: data.documents.length, vehicles: t?.vehicles.length,
    loads: act.shipments ?? undefined, services: t ? t.services.length + t.certifications.length : undefined,
  };

  return (
    <div className="space-y-5">
      {back}

      {/* Header */}
      <section className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-slate)] text-lg font-bold text-white">{initials || '—'}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{c.name}</h1>
              {!isFactor && !isListing && <CompanyStatusBadge status={v.status} />}
              {dir?.listed && <span className="badge badge-muted">Listed by {dir.listed_by ?? 'another company'} · not on Shipmater yet</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)]">
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
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-cream-dark)] pt-4">
            {readiness.map(([label, done]) => (
              <span key={label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--color-cream)] text-[var(--color-text-muted)]'}`}>
                {done ? <CheckCircle2 size={13} /> : <Circle size={13} />}{label}
              </span>
            ))}
          </div>
        )}
      </section>

      {isFactor && (
        <Panel title="Company details" subtitle="Factoring companies don't need Shipmater approval. They confirm NOAs and loads themselves.">
          <Details data={c as Row} fields={[['org_name', 'Legal name'], ['tax_id', 'EIN'], ['phone', 'Phone'], ['email', 'Email'], ['website', 'Website'], ['address', 'Address']]} />
        </Panel>
      )}

      {/* Someone asked to take over this listed company */}
      {dir?.pending_claims && dir.pending_claims.length > 0 && (
        <Panel title="Waiting for approval" subtitle="These people signed up and asked to manage this company.">
          <div className="space-y-2">
            {dir.pending_claims.map((cl) => <ClaimDecision key={cl.id} claim={cl} orgName={c.name} onDone={() => qc.invalidateQueries({ queryKey: ['admin-company', id] })} />)}
          </div>
        </Panel>
      )}

      {/* Tabs */}
      {!isFactor && (
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
      {!isFactor && current === 'overview' && (<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Shipments" value={act.shipments ?? 0} />
          <Stat label="Active" value={act.active ?? 0} />
          <Stat label="Delivered" value={act.delivered ?? 0} />
          <Stat label={isCarrier ? 'Earned' : 'Spent'} value={formatCurrency(Number(act.value ?? 0))} />
          {isCarrier ? <Stat label="Offers" value={act.bids ?? 0} /> : <Stat label="Contracts" value={t?.contracts.length ?? 0} />}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title="Company approval" action={<CompanyStatusBadge status={v.status} />}
            subtitle={v.updated_at ? `${new Date(v.updated_at).toLocaleString()}${v.updated_by ? ` by ${v.updated_by}` : ''}` : 'Not reviewed yet'}>
            <div className="space-y-3">
              {v.notes && <p className="rounded-lg bg-[var(--color-cream)] px-3 py-2 text-sm text-[var(--color-text-muted)]">{v.notes}</p>}
              {!bgPassed && <Callout>Approval needs a clear company background check. Record the result in <strong>Company background check</strong>, then approve.</Callout>}
              {isCarrier && !ownerApproved && (
                <Callout>The owner must be approved as a person first. See the <button onClick={() => setTab('team')} className="font-semibold underline">Team</button> tab.</Callout>
              )}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000}
                placeholder="Notes (optional, kept on the record)" className={inputCls} />
              <div className="flex gap-2">
                {v.status !== 'approved' && (
                  <button onClick={() => review.mutate('approve')} disabled={review.isPending || !bgPassed || (isCarrier && !ownerApproved)}
                    className="btn btn-navy disabled:opacity-50">Approve company</button>
                )}
                {v.status !== 'rejected' && (
                  <button onClick={() => review.mutate('reject')} disabled={review.isPending}
                    className="btn border border-red-200 bg-red-50 text-red-700 disabled:opacity-50">Reject</button>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Company background check" action={<BackgroundBadge status={v.background_status} />}
            subtitle={v.background_checked_at ? `Recorded ${new Date(v.background_checked_at).toLocaleString()}` : 'No result recorded'}>
            <div className="space-y-3">
              {(v.background_reference || v.background_notes) && (
                <div className="rounded-lg bg-[var(--color-cream)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
                  {v.background_reference && <p>Reference: <span className="font-medium text-[var(--color-text)]">{v.background_reference}</span></p>}
                  {v.background_notes && <p>{v.background_notes}</p>}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select value={bgResult} onChange={(e) => setBgResult(e.target.value)} aria-label="Background result" className={inputCls}>
                  <option value="">Record result…</option>
                  {BACKGROUND_RESULTS.filter((r) => r.value !== 'not_started').map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <input value={bgReference} onChange={(e) => setBgReference(e.target.value)} placeholder="Report / reference #" className={inputCls} />
              </div>
              <input value={bgNotes} onChange={(e) => setBgNotes(e.target.value)} placeholder="Notes (optional)" className={inputCls} />
              <button onClick={() => background.mutate()} disabled={!bgResult || background.isPending} className="btn btn-navy disabled:opacity-50">
                Save result
              </button>
            </div>
          </Panel>
        </div>
      </>)}

      {/* Business */}
      {current === 'business' && !isFactor && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {!data.company_profile ? <Panel title="Business">{noProfile}</Panel> : (isCarrier ? CARRIER_BUSINESS : SHIPPER_BUSINESS).map((sec) => (
            <Panel key={sec.title} title={sec.title}><Details data={profile} fields={sec.fields} /></Panel>
          ))}
          <Panel title="Company record" subtitle="How the company is stored in Shipmater">
            <Details data={c as Row} fields={[['org_name', 'Company name'], ['plan', 'Plan'], ['status', 'Account status'], ['created_at', 'Created']]} />
          </Panel>
        </div>
      )}

      {/* Services */}
      {current === 'services' && t && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title={isCarrier ? 'What they transport' : 'What they ship'} subtitle="Used to match carriers and filter searches">
            <Pills items={t.services} empty="No service types selected yet." />
          </Panel>
          {isCarrier ? (
            <Panel title="Certifications"><Pills items={t.certifications} empty="No certifications selected yet." /></Panel>
          ) : (
            <Panel title="Shipment defaults" subtitle="Pre-filled on new shipments">
              <Details data={profile} cols={1} fields={[['preferred_categories', 'Preferred categories'], ['default_pickup_contact_name', 'Pickup contact'], ['default_pickup_contact_phone', 'Pickup phone'], ['internal_ref_format', 'Reference format']]} />
            </Panel>
          )}
        </div>
      )}

      {/* Compliance */}
      {current === 'compliance' && !isFactor && (<>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {!data.company_profile ? <Panel title="Compliance">{noProfile}</Panel> : (isCarrier ? CARRIER_COMPLIANCE : SHIPPER_COMPLIANCE).map((sec) => (
            <Panel key={sec.title} title={sec.title}><Details data={profile} fields={sec.fields} /></Panel>
          ))}
        </div>
        <Panel title="Documents" subtitle={`${data.documents.length} uploaded`}>
          <Table rows={data.documents} empty="No documents uploaded."
            columns={[['type', 'Type'], ['name', 'Name'], ['expiry_date', 'Expires'], ['verified_at', 'Verified'], ['created_at', 'Uploaded'], ['url', 'File']]} />
        </Panel>
      </>)}

      {/* Vehicles */}
      {current === 'vehicles' && t && (
        <Panel title="Vehicles" subtitle={`${t.vehicles.length} on file`}>
          <Table rows={t.vehicles} empty="No vehicles added."
            columns={[['type', 'Type'], ['year', 'Year'], ['make', 'Make'], ['model', 'Model'], ['license_plate', 'Plate'], ['license_plate_state', 'State'], ['max_payload', 'Max payload (lb)'], ['registration_expiry', 'Registration expires'], ['is_primary', 'Primary']]} />
        </Panel>
      )}

      {/* Payment */}
      {current === 'payment' && t && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title={isCarrier ? 'Payouts' : 'Paying for loads'} subtitle="Only names, last 4 digits and statuses. Account numbers and tokens stay with the payment provider.">
            <Details data={{ ...t.payment, bank_institution_name: profile.bank_institution_name, profile_bank_last4: profile.bank_last4, bank_connected_at: profile.bank_connected_at }}
              fields={isCarrier
                ? [['payout_status', 'Stripe payouts'], ['stripe_connected', 'Stripe account linked'], ['stripe_mode', 'Stripe mode'], ['legal_name', 'Legal name on Stripe'], ['business_structure', 'Business structure'], ['bank_name', 'Payout bank'], ['bank_last4', 'Account last 4'], ['commission_rate', 'Commission rate']]
                : [['stripe_customer', 'Stripe customer set up'], ['stripe_mode', 'Stripe mode'], ['bank_institution_name', 'Linked bank'], ['profile_bank_last4', 'Account last 4'], ['bank_connected_at', 'Bank linked'], ['commission_rate', 'Commission rate']]} />
          </Panel>
          <Panel title="Payment methods" subtitle={`${t.payment_methods.length} on file`}>
            <Table rows={t.payment_methods} empty="No payment methods on file."
              columns={[['type', 'Type'], ['brand', 'Brand / bank'], ['last4', 'Last 4'], ['expires', 'Expires'], ['is_default', 'Default'], ['created_at', 'Added']]} />
          </Panel>
        </div>
      )}

      {/* Subscription */}
      {current === 'subscription' && t && (
        <div className="space-y-5">
          {activeSub ? (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-teal)]/40 bg-[var(--color-teal-pale)] p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-teal)] text-white"><Zap size={18} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-slate)]">{formatCurrency(Number(activeSub.monthly_price ?? 0))} a month · {String(activeSub.tier ?? '').replace(/_/g, ' ')}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Renews {display('current_period_end', activeSub.current_period_end)}</p>
              </div>
              <span className="badge badge-success">Active</span>
            </div>
          ) : (
            <Callout>
              No active subscription. This company can&apos;t post new loads until the owner subscribes on their Subscription tab.
              {t.subscription.history[0] ? <> Last status: <strong>{String(t.subscription.history[0].status).replace(/_/g, ' ')}</strong>.</> : null}
            </Callout>
          )}
          <Panel title="Subscription history">
            <Table rows={t.subscription.history} empty="Never subscribed."
              columns={[['tier', 'Tier'], ['monthly_price', 'Monthly price'], ['status', 'Status'], ['started_at', 'Started'], ['current_period_end', 'Renews'], ['tier_review_at', 'Tier review']]} />
          </Panel>
        </div>
      )}

      {/* Notifications */}
      {current === 'notifications' && !isFactor && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {!data.company_profile ? <Panel title="Notifications">{noProfile}</Panel> : ([
            ['Email alerts', 'notif_email'], ['SMS alerts', 'notif_sms'], ['Extra recipients', 'notif_recipients'],
          ] as const).map(([title, key]) => (
            <Panel key={key} title={title}><Pills items={(profile[key] as string[]) ?? []} empty="None turned on." /></Panel>
          ))}
        </div>
      )}

      {/* Locations and contacts (admins may edit them) */}
      {current === 'directory' && <OrgProfile orgId={Number(c.id)} hideHeader />}

      {/* Team */}
      {(current === 'team' || isFactor) && (<>
        <Panel title="Members" subtitle={`${data.members.length} ${data.members.length === 1 ? 'person' : 'people'} · click a row to review the person`}
          action={<Link href={`/admin/people?type=${c.type}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-teal)] hover:underline">All people <ExternalLink size={12} /></Link>}>
          {data.members.length === 0 ? (
            <p className="text-sm italic text-[var(--color-text-faint)]">No members.</p>
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
          {isCarrier && <p className="mt-3 text-xs text-[var(--color-text-faint)]">The owner must be approved before the company can be.</p>}
        </Panel>
        {t && (
          <Panel title="Invitations not yet accepted" subtitle={`${t.invitations.length} open`}>
            <Table rows={t.invitations} empty="No open invitations."
              columns={[['email', 'Email'], ['role', 'Role'], ['state', 'Status'], ['created_at', 'Sent'], ['expires_at', 'Expires']]} />
          </Panel>
        )}
      </>)}

      {/* Loads */}
      {current === 'loads' && t && (<>
        <Panel title="Recent shipments" subtitle={`${act.shipments ?? 0} in total · latest 10`}>
          {data.recent_shipments.length === 0 ? <p className="text-sm italic text-[var(--color-text-faint)]">No shipments.</p> : (
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
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title="Contracts" subtitle={`${t.contracts.length} in total`}>
            <Table rows={t.contracts} empty="No contracts."
              columns={[['title', 'Title'], ['with', isCarrier ? 'Shipper' : 'Carrier'], ['status', 'Status'], ['rate', 'Rate'], ['valid_to', 'Valid to']]} />
          </Panel>
          <Panel title={isCarrier ? 'On preferred lists' : 'Preferred carriers'} subtitle={`${t.preferred.length} in total`}>
            <Table rows={t.preferred} empty="None."
              columns={[['with', isCarrier ? 'Shipper' : 'Carrier'], ['status', 'Status'], ['created_at', 'Added']]} />
          </Panel>
        </div>
        {!isCarrier && (
          <Panel title="Saved locations" subtitle={`${t.locations.length} in total`}>
            <Table rows={t.locations} empty="No saved locations."
              columns={[['name', 'Name'], ['type', 'Type'], ['city', 'City'], ['state', 'State'], ['contact_name', 'Contact'], ['is_default', 'Default'], ['usage_count', 'Used']]} />
          </Panel>
        )}
      </>)}
    </div>
  );
}
