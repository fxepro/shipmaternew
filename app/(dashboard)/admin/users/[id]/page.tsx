'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserStatusBadge } from '@/components/admin/UserStatusBadge';
import { Card, Fields, Table, display, type Row } from '@/components/admin/DetailParts';
import { formatCurrency } from '@/lib/utils';

type AccountStatus = 'active' | 'paused' | 'deactivated';

interface UserDetail {
  account: Row;
  status: { status: AccountStatus; reason: string | null; changed_at: string | null; changed_by: string | null };
  current_org: Row | null;
  organizations: Row[];
  profile_type: 'carrier' | 'shipper' | null;
  profile: Row | null;
  documents: Row[];
  activity: Record<string, number>;
  recent_shipments: Row[];
}

const ACTIONS: { status: AccountStatus; label: string; explain: string; cls: string }[] = [
  { status: 'active',      label: 'Activate',   explain: 'Full access restored.',                                   cls: 'btn btn-navy' },
  { status: 'paused',      label: 'Pause',      explain: 'Read-only: can sign in and view, but cannot post, bid or change anything.', cls: 'btn bg-amber-50 text-amber-800 border border-amber-200' },
  { status: 'deactivated', label: 'Deactivate', explain: 'Signed out everywhere and cannot sign in.',               cls: 'btn bg-red-50 text-red-700 border border-red-200' },
];

// Grouped highlights per profile type. Every profile column also appears under "All profile fields".
const PROFILE_SECTIONS: Record<'carrier' | 'shipper', { title: string; fields: [string, string][] }[]> = {
  carrier: [
    {
      title: 'Carrier',
      fields: [
        ['company_name', 'Company'], ['carrier_type', 'Carrier type'], ['phone', 'Phone'],
        ['dot_number', 'DOT #'], ['dot_verified', 'DOT verified'], ['mc_number', 'MC #'], ['mc_verified', 'MC verified'],
        ['rating', 'Rating'], ['total_deliveries', 'Deliveries'],
      ],
    },
    {
      title: 'Verification & compliance',
      fields: [
        ['verification_status', 'Verification'], ['identity_verified', 'Identity verified'],
        ['background_check_status', 'Background check'], ['clearinghouse_query_status', 'Clearinghouse'],
        ['insurance_verified', 'Insurance verified'], ['cdl_class', 'CDL class'], ['cdl_expiry_date', 'CDL expiry'],
        ['dot_medical_expiry', 'DOT medical expiry'], ['onboarding_fee_paid', 'Onboarding fee paid'],
        ['stripe_account_status', 'Stripe payouts'],
      ],
    },
  ],
  shipper: [
    {
      title: 'Shipper',
      fields: [
        ['company_name', 'Company'], ['dba', 'DBA'], ['business_type', 'Business type'], ['industry', 'Industry'],
        ['business_phone', 'Business phone'], ['business_email', 'Business email'], ['website', 'Website'],
        ['rating', 'Rating'],
      ],
    },
    {
      title: 'Verification & billing',
      fields: [
        ['verification_status', 'Verification'], ['ein_verified_at', 'EIN verified'], ['email_verified_at', 'Email verified'],
        ['phone_verified_at', 'Phone verified'], ['coi_expiry', 'COI expiry'], ['bank_institution_name', 'Bank'],
        ['bank_last4', 'Bank last 4'], ['plaid_connected_at', 'Bank connected'],
      ],
    },
  ],
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => api.get(`/api/v1/admin/users/${id}`).then((r) => r.data.data as UserDetail),
  });

  const setStatus = useMutation({
    mutationFn: (status: AccountStatus) => api.put(`/api/v1/admin/users/${id}/status`, { status, reason: reason || null }),
    onSuccess: () => {
      setReason('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-user', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => setError(e.response?.data?.message ?? 'Could not update status.'),
  });

  const back = (
    <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
      <ArrowLeft size={14} /> All users
    </Link>
  );

  if (isLoading) return <div className="space-y-4">{back}<div className="skeleton h-96 rounded-xl" /></div>;
  if (isError || !data) return <div className="space-y-4">{back}<EmptyState icon={Users} title="User not found" /></div>;

  const a = data.account;
  const current = data.status.status;
  const act = data.activity;

  return (
    <div className="space-y-5">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{String(a.name)}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]"><span className="capitalize">{String(a.role)}</span> · {String(a.email)}</p>
        </div>
        <UserStatusBadge status={current} />
      </div>

      <Card title="Account status">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text)]">
            {current === 'active' && 'Active: full access.'}
            {current === 'paused' && 'Paused: read-only. The user can sign in and view, but cannot post, bid or change anything.'}
            {current === 'deactivated' && 'Deactivated: signed out and cannot sign in.'}
            {data.status.changed_at && (
              <span className="text-[var(--color-text-muted)]">
                {' '}Changed {new Date(data.status.changed_at).toLocaleString()}{data.status.changed_by ? ` by ${data.status.changed_by}` : ''}.
              </span>
            )}
          </p>
          {data.status.reason && <p className="text-sm text-[var(--color-text-muted)]">Reason: {data.status.reason}</p>}

          {a.role !== 'admin' && (
            <>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Reason (optional, kept on the record)"
                className="w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]"
              />
              <div className="flex flex-wrap gap-2">
                {ACTIONS.filter((x) => x.status !== current).map((x) => (
                  <button
                    key={x.status}
                    disabled={setStatus.isPending}
                    title={x.explain}
                    onClick={() => {
                      if (x.status === 'deactivated' && !confirm(`Deactivate ${a.name}? They will be signed out and unable to sign in.`)) return;
                      setStatus.mutate(x.status);
                    }}
                    className={`${x.cls} disabled:opacity-50`}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {a.role === 'admin' && <p className="text-sm text-[var(--color-text-muted)]">Admin accounts can't be paused or deactivated here.</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          ['Shipments (shipper)', act.shipments_as_shipper],
          ['Shipments (carrier)', act.shipments_as_carrier],
          ['Delivered', act.delivered],
          ['Bids', act.bids],
          ['Total spent', formatCurrency(act.total_spent ?? 0)],
          ['Total earned', formatCurrency(act.total_earned ?? 0)],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-4">
            <p className="text-xs text-[var(--color-text-faint)]">{label}</p>
            <p className="mt-1 text-lg font-semibold text-[var(--color-text)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Account">
          <Fields
            data={a}
            fields={[
              ['id', 'User ID'], ['role', 'Role'], ['email', 'Email'], ['email_verified_at', 'Email verified'],
              ['created_at', 'Joined'], ['updated_at', 'Last updated'], ['last_sign_in_at', 'Last sign-in'],
              ['stripe_customer_id', 'Stripe customer'],
            ]}
          />
        </Card>

        <Card title={`Organizations (${data.organizations.length})`}>
          {data.organizations.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Not a member of any organization.</p>
          ) : (
            <div className="space-y-4">
              {data.organizations.map((o) => (
                <Fields
                  key={String(o.id)}
                  data={o}
                  fields={[['name', 'Name'], ['type', 'Type'], ['role', 'Member role'], ['status', 'Membership status'], ['joined_at', 'Joined']]}
                />
              ))}
            </div>
          )}
        </Card>

        {data.profile_type && data.profile && PROFILE_SECTIONS[data.profile_type].map((sec) => (
          <Card key={sec.title} title={sec.title}>
            <Fields data={data.profile as Row} fields={sec.fields} />
          </Card>
        ))}
      </div>

      <Card title={`Documents (${data.documents.length})`}>
        <Table
          rows={data.documents}
          empty="No documents uploaded."
          columns={[['type', 'Type'], ['name', 'Name'], ['expiry_date', 'Expires'], ['verified_at', 'Verified'], ['created_at', 'Uploaded'], ['url', 'File']]}
        />
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
                  <tr key={String(s.id)} onClick={() => router.push(`/admin/shipments/${s.id}`)} className="cursor-pointer border-b border-[var(--color-cream-dark)] last:border-b-0 hover:bg-[var(--color-cream)]">
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

      {data.profile && (
        <Card title="All profile fields">
          <button onClick={() => setShowAll((v) => !v)} className="text-sm font-medium text-[var(--color-teal)]">
            {showAll ? 'Hide' : `Show all ${Object.keys(data.profile).length} profile fields`}
          </button>
          {showAll && (
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {Object.entries(data.profile).map(([key, value]) => (
                <div key={key} className="min-w-0 border-b border-[var(--color-cream-dark)] pb-2">
                  <dt className="font-mono text-xs text-[var(--color-text-faint)]">{key}</dt>
                  <dd className="mt-0.5 text-sm text-[var(--color-text)]">{display(key, value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      )}
    </div>
  );
}
