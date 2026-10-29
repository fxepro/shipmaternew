'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserStatusBadge } from '@/components/admin/UserStatusBadge';
import { Card, Fields, Table, display, type Row } from '@/components/admin/DetailParts';
import { CompanyStatusBadge, BackgroundBadge, BACKGROUND_RESULTS, BACKGROUND_PASSED } from '@/components/admin/CompanyBadges';
import { PersonStatusBadge, ROLE_LABELS } from '@/components/admin/PersonBadges';
import { formatCurrency } from '@/lib/utils';

interface CompanyDetail {
  company: Row & { name: string; type: 'carrier' | 'shipper' };
  company_profile: Row | null;
  verification: {
    status: string; notes: string | null; updated_at: string | null; updated_by: string | null;
    background_status: string; background_reference: string | null; background_notes: string | null; background_checked_at: string | null;
  };
  documents: Row[];
  members: (Row & { user_id: number; name: string; role: string; account_status: string })[];
  activity: Record<string, number | null>;
  recent_shipments: Row[];
}

const CARRIER_FIELDS: { title: string; fields: [string, string][] }[] = [
  {
    title: 'Operating authority',
    fields: [
      ['company_name', 'Legal name'], ['carrier_type', 'Carrier type'],
      ['dot_number', 'DOT #'], ['dot_verified', 'DOT verified'], ['mc_number', 'MC #'], ['mc_verified', 'MC verified'],
      ['operating_authority_type', 'Authority type'], ['operating_authority_number', 'Authority #'],
      ['street', 'Street'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP'],
    ],
  },
  {
    title: 'Insurance & payouts',
    fields: [
      ['insurance_verified', 'Insurance verified'],
      ['auto_insurer_name', 'Auto liability insurer'], ['auto_policy_number', 'Auto policy #'],
      ['auto_coverage_amount', 'Auto coverage'], ['auto_expiry_date', 'Auto expiry'],
      ['cargo_insurer_name', 'Cargo insurer'], ['cargo_policy_number', 'Cargo policy #'],
      ['cargo_coverage_amount', 'Cargo coverage'], ['cargo_expiry_date', 'Cargo expiry'],
      ['stripe_account_status', 'Stripe payouts'], ['rating', 'Rating'], ['total_deliveries', 'Deliveries'],
    ],
  },
];

const SHIPPER_FIELDS: { title: string; fields: [string, string][] }[] = [
  {
    title: 'Business',
    fields: [
      ['company_name', 'Legal name'], ['dba', 'DBA'], ['business_type', 'Business type'], ['industry', 'Industry'],
      ['ein', 'EIN'], ['ein_verified_at', 'EIN verified'], ['state_of_incorporation', 'State of incorporation'],
      ['year_established', 'Established'], ['employee_count', 'Employees'], ['sam_gov_number', 'SAM.gov #'],
    ],
  },
  {
    title: 'Contact & billing',
    fields: [
      ['business_phone', 'Phone'], ['business_email', 'Email'], ['website', 'Website'],
      ['biz_street', 'Street'], ['biz_city', 'City'], ['biz_state', 'State'], ['biz_zip', 'ZIP'],
      ['coi_expiry', 'COI expiry'], ['bank_institution_name', 'Bank'], ['bank_last4', 'Bank last 4'], ['rating', 'Rating'],
    ],
  },
];

export default function AdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [bgResult, setBgResult] = useState('');
  const [bgReference, setBgReference] = useState('');
  const [bgNotes, setBgNotes] = useState('');

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

  if (isLoading) return <div className="space-y-4">{back}<div className="skeleton h-96 rounded-xl" /></div>;
  if (isError || !data) return <div className="space-y-4">{back}<EmptyState icon={Building2} title="Company not found" /></div>;

  const c = data.company;
  const v = data.verification;
  const isCarrier = c.type === 'carrier';
  const bgPassed = BACKGROUND_PASSED.includes(v.background_status);
  const act = data.activity;
  const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]';

  return (
    <div className="space-y-5">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{c.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {isCarrier ? 'Carrier company' : 'Shipper company'} · {data.members.length} member{data.members.length === 1 ? '' : 's'}
          </p>
        </div>
        <CompanyStatusBadge status={v.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Company approval">
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text)]">
              Status: <CompanyStatusBadge status={v.status} />
              {v.updated_at && <span className="text-[var(--color-text-muted)]"> · {new Date(v.updated_at).toLocaleString()}{v.updated_by ? ` by ${v.updated_by}` : ''}</span>}
            </p>
            {v.notes && <p className="text-sm text-[var(--color-text-muted)]">Notes: {v.notes}</p>}
            {!bgPassed && (
              <p className="text-sm text-amber-700">A clear company background check is required before approval.</p>
            )}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000}
              placeholder="Notes (optional, kept on the record)" className={inputCls} />
            <div className="flex gap-2">
              {v.status !== 'approved' && (
                <button onClick={() => review.mutate('approve')} disabled={review.isPending || !bgPassed}
                  className="btn btn-navy disabled:opacity-50">Approve company</button>
              )}
              {v.status !== 'rejected' && (
                <button onClick={() => review.mutate('reject')} disabled={review.isPending}
                  className="btn bg-red-50 text-red-700 border border-red-200 disabled:opacity-50">Reject</button>
              )}
            </div>
          </div>
        </Card>

        <Card title="Company background check">
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text)]">
              Result: <BackgroundBadge status={v.background_status} />
              {v.background_checked_at && <span className="text-[var(--color-text-muted)]"> · {new Date(v.background_checked_at).toLocaleString()}</span>}
            </p>
            {v.background_reference && <p className="text-sm text-[var(--color-text-muted)]">Reference: {v.background_reference}</p>}
            {v.background_notes && <p className="text-sm text-[var(--color-text-muted)]">Notes: {v.background_notes}</p>}
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
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ['Shipments', act.shipments],
          ['Active', act.active],
          ['Delivered', act.delivered],
          [isCarrier ? 'Earned (delivered)' : 'Spent (delivered)', formatCurrency(Number(act.value ?? 0))],
          ...(isCarrier ? [['Bids', act.bids]] : []),
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-4">
            <p className="text-xs text-[var(--color-text-faint)]">{label}</p>
            <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">{String(value ?? 0)}</p>
          </div>
        ))}
      </div>

      <Card title={`Members (${data.members.length})`}>
        {data.members.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No members.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-cream-dark)]">
                  {['Name', 'Email', 'Role', 'Account', 'Required checks', 'Person approval', 'Joined'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.user_id} onClick={() => router.push(`/admin/people/${m.user_id}`)}
                    className="cursor-pointer border-b border-[var(--color-cream-dark)] last:border-b-0 hover:bg-[var(--color-cream)]">
                    <td className="px-3 py-2 font-medium">{m.name}</td>
                    <td className="px-3 py-2">{display('email', m.email)}</td>
                    <td className="px-3 py-2">{ROLE_LABELS[m.role] ?? m.role}</td>
                    <td className="px-3 py-2"><UserStatusBadge status={m.account_status} /></td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">
                      {Number(m.required_total) > 0 ? `${m.required_met} of ${m.required_total}` : 'None'}
                    </td>
                    <td className="px-3 py-2"><PersonStatusBadge status={(m.person_status as string) ?? null} /></td>
                    <td className="px-3 py-2">{display('joined_at', m.joined_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-[var(--color-text-faint)]">
          Review people, their identity and credentials in <Link href={`/admin/people?type=${data.company.type}`} className="underline">People</Link>.
          {isCarrier && ' The owner must be approved before the company can be.'}
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {data.company_profile ? (isCarrier ? CARRIER_FIELDS : SHIPPER_FIELDS).map((sec) => (
          <Card key={sec.title} title={sec.title}>
            <Fields data={data.company_profile as Row} fields={sec.fields} />
          </Card>
        )) : (
          <Card title="Company profile"><p className="text-sm text-[var(--color-text-muted)]">The owner hasn&apos;t filled in a profile yet.</p></Card>
        )}
      </div>

      <Card title={`Documents (${data.documents.length})`}>
        <Table rows={data.documents} empty="No documents uploaded."
          columns={[['type', 'Type'], ['name', 'Name'], ['expiry_date', 'Expires'], ['verified_at', 'Verified'], ['created_at', 'Uploaded'], ['url', 'File']]} />
      </Card>

      <Card title="Recent shipments">
        {data.recent_shipments.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No shipments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-cream-dark)]">
                  {['#', 'Item', 'Route', 'Status', 'Cost', 'Created'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recent_shipments.map((s) => (
                  <tr key={String(s.id)} onClick={() => router.push(`/admin/shipments/${s.id}`)}
                    className="cursor-pointer border-b border-[var(--color-cream-dark)] last:border-b-0 hover:bg-[var(--color-cream)]">
                    <td className="px-3 py-2">{String(s.id)}</td>
                    <td className="px-3 py-2">{display('item', s.item)}</td>
                    <td className="px-3 py-2">{display('route', s.route)}</td>
                    <td className="px-3 py-2">{display('status', s.status)}</td>
                    <td className="px-3 py-2">{display('agreed_cost', s.agreed_cost)}</td>
                    <td className="px-3 py-2">{display('created_at', s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
