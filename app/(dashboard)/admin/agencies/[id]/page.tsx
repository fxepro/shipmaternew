'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { ComplianceItems, type ComplianceItem } from '@/components/compliance/ComplianceItems';
import { AgencyActivity } from '@/components/lawenforcement/AgencyActivity';
import { AGENCY_KIND, Pill, when } from '@/components/lawenforcement/shared';

type Values = Record<string, string | number | null>;
interface Detail {
  officer: Values & { id: number; name: string; agency_id: number };
  agency: Values & { id: number; name: string; owner: { id: number; name: string; email: string } | null };
  compliance: ComplianceItem[];
}
type Tab = 'personal' | 'agency' | 'activity';

const OFFICER_FIELDS: [string, string][] = [
  ['name', 'Name'], ['legal_name', 'Legal name'], ['email', 'Email'], ['phone', 'Phone'], ['role', 'Role'],
  ['badge_number', 'Badge or ID number'], ['title', 'Rank or title'], ['unit', 'Unit or post'], ['work_phone', 'Work phone'],
  ['created_at', 'Signed up'], ['last_login', 'Last sign-in'], ['searches_30d', 'Searches and views (30 days)'],
];
const SUPERVISOR_FIELDS: [string, string][] = [['supervisor_name', 'Name'], ['supervisor_email', 'Email'], ['supervisor_phone', 'Phone']];
const AGENCY_FIELDS: [string, string][] = [
  ['name', 'Agency name'], ['agency_kind', 'Type'], ['ori_number', 'ORI number'], ['jurisdiction', 'Jurisdiction'],
  ['phone', 'Main phone'], ['email', 'Email'], ['address', 'Address'], ['created_at', 'Signed up'],
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head card-head-tint px-5 py-3"><p className="card-title">{title}</p></div>
      <div className="card-body">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-[var(--color-cream-dark)]">
      {rows.map(([l, v]) => (
        <div key={l} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2 text-sm">
          <dt className="text-[var(--color-text-muted)]">{l}</dt>
          <dd className="break-words">{v === null || v === undefined || v === '' ? '—' : v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Approval({ d, refresh }: { d: Detail; refresh: () => void }) {
  const [notes, setNotes] = useState('');
  const [override, setOverride] = useState(false);
  const review = useMutation({
    mutationFn: (action: 'approve' | 'reject') => api.post(`/api/v1/admin/companies/${d.agency.id}/review`, { action, notes: notes || null, override: action === 'approve' && override }),
    onSuccess: (_, action) => { toast.success(action === 'approve' ? 'Agency approved' : 'Agency rejected'); setNotes(''); setOverride(false); refresh(); },
    onError: (e: { response?: { data?: { error?: string; message?: string; code?: string } } }) => {
      if (e.response?.data?.code === 'checks_not_passed' || e.response?.data?.code === 'owner_not_approved') setOverride(true);
      toast.error(e.response?.data?.error ?? e.response?.data?.message ?? 'Action failed');
    },
  });
  return (
    <Card title="Approval">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Pill value={String(d.agency.verification_status ?? 'pending')} />
          {d.agency.verification_updated_at && <span className="text-xs text-[var(--color-text-faint)]">{when(String(d.agency.verification_updated_at))}</span>}
        </div>
        {d.agency.verification_notes && <p className="text-sm text-[var(--color-text-muted)]">{d.agency.verification_notes}</p>}
        {override && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5" />
            Approve without every required check passed
          </label>
        )}
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="profile-input"
          placeholder={override ? 'Why are you approving without every required check passed? (required)' : 'Notes (optional, kept on the record)'} />
        <div className="flex gap-2">
          <button onClick={() => review.mutate('approve')} disabled={review.isPending || (override && !notes.trim())} className="btn btn-navy disabled:opacity-50">
            {override ? 'Approve anyway' : 'Approve agency'}
          </button>
          <button onClick={() => review.mutate('reject')} disabled={review.isPending}
            className="rounded-lg border border-[var(--color-cream-dark)] px-3 py-2 text-sm font-medium text-[var(--color-danger)] disabled:opacity-50">Reject</button>
        </div>
      </div>
    </Card>
  );
}

/** One officer: Personal, the Agency they work for, and their Activity */
export default function AdminOfficerPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('personal');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-agency', id],
    queryFn: () => api.get(`/api/v1/admin/agencies/${id}`).then((r) => r.data.data as Detail),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-agency', id] }); qc.invalidateQueries({ queryKey: ['admin-agencies'] }); };

  const back = (
    <Link href="/admin/agencies" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
      <ArrowLeft size={14} /> Officers
    </Link>
  );
  if (isLoading) return <div className="space-y-4">{back}<div className="skeleton h-96 rounded-xl" /></div>;
  if (isError || !data) return <div className="space-y-4">{back}<p className="text-sm text-[var(--color-text-muted)]">Officer not found.</p></div>;

  const o = data.officer;
  const a = data.agency;
  const officerValue = (k: string): React.ReactNode =>
    k === 'created_at' || k === 'last_login' ? (o[k] ? when(String(o[k])) : null)
    : k === 'role' ? <span className="capitalize">{o.role}</span>
    : o[k];
  const agencyValue = (k: string): React.ReactNode =>
    k === 'agency_kind' ? (a.agency_kind ? AGENCY_KIND[String(a.agency_kind)] ?? a.agency_kind : null)
    : k === 'address' ? [a.street, a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : k === 'created_at' ? when(String(a.created_at)) : a[k];

  return (
    <div className="space-y-5">
      {back}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">{o.name}</h1>
          {o.identity && <Pill value={String(o.identity)} />}
        </div>
        <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">
          {[o.title, o.badge_number].filter(Boolean).join(' · ')}{o.title || o.badge_number ? ' · ' : ''}{a.name}
        </p>
      </div>

      <div className="flex gap-2">
        {([['personal', 'Personal'], ['agency', 'Agency'], ['activity', 'Activity']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${tab === k ? 'bg-[var(--color-slate)] text-white' : 'border border-[var(--color-cream-dark)] bg-[var(--color-white)] text-[var(--color-text-muted)]'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'personal' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Officer">
            <Rows rows={OFFICER_FIELDS.map(([k, l]) => [l, officerValue(k)])} />
            <Link href={`/admin/people/${o.id}`} className="mt-3 inline-block text-sm font-medium text-[var(--color-teal)] hover:underline">Identity and account →</Link>
          </Card>
          <div className="space-y-4">
            <Card title="Supervisor"><Rows rows={SUPERVISOR_FIELDS.map(([k, l]) => [l, o[k]])} /></Card>
            <Card title="Identity">
              <Rows rows={[
                ['Status', o.identity ? <Pill value={String(o.identity)} /> : null],
                ['Verified', o.identity_verified_at ? when(String(o.identity_verified_at)) : null],
              ]} />
            </Card>
          </div>
        </div>
      )}

      {tab === 'agency' && (<>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Agency">
            <Rows rows={[
              ...AGENCY_FIELDS.map(([k, l]) => [l, agencyValue(k)] as [string, React.ReactNode]),
              ['Signed up by', a.owner ? <Link href={`/admin/agencies/${a.owner.id}`} className="text-[var(--color-teal)] hover:underline">{a.owner.name}</Link> : null],
              ['Officers', <Link key="o" href={`/admin/agencies?agency=${a.id}`} className="text-[var(--color-teal)] hover:underline">See every officer</Link>],
            ]} />
          </Card>
          <Approval d={data} refresh={refresh} />
        </div>
        <ComplianceItems variant="data" items={data.compliance}
          verifyUrl={(key) => `/api/v1/admin/companies/${a.id}/compliance/${key}/verify`}
          onChange={() => refresh()} />
      </>)}

      {tab === 'activity' && <AgencyActivity officerId={o.id} />}
    </div>
  );
}
