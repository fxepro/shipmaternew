'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, XCircle, FileText, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserStatusBadge } from '@/components/admin/UserStatusBadge';
import { display } from '@/components/admin/DetailParts';
import { CompanyStatusBadge } from '@/components/admin/CompanyBadges';
import { PersonStatusBadge, ROLE_LABELS } from '@/components/admin/PersonBadges';
import { useCurrentUser } from '@/components/layout/PermissionsContext';
import { HeaderCard, initialsOf, memberSince } from '@/components/account/AccountHeader';
import { DataCard, SectionHeader, Pill, fmtDate, type DataRow } from '@/components/profile/DataCard';
import { PersonalCards, DrivingCards, type PersonProfile } from '@/components/profile/PersonCards';
import { CertificationsSection } from '@/components/people/CertificationsSection';
import { ProProfileCard } from '@/components/entities/ProProfileCard';
import { PROFILE_SECTIONS } from '@/lib/profile-sections';

interface ChecklistItem { key: string; label: string; required: boolean; group?: 'required' | 'recorded' | 'certification'; state: string; detail: string | null; credential_id?: number | null }
interface Credential {
  id: number; type: string; type_label: string; name: string | null; issuer: string | null; number: string | null;
  issuing_state: string | null; class: string | null; issued_at: string | null; expires_at: string | null;
  result: string | null; source: string; has_document: boolean; state: string; notes: string | null;
  verified_at: string | null; verified_by: string | null; verification_method?: string | null;
  ai: { status: string; reason?: string | null; name_score?: number | null; fields: Record<string, unknown> & { _flags?: string[]; holder_name?: string; number?: string; expiry_date?: string } | null } | null;
}
interface Membership {
  id: number; org_id: number; name: string; type: string; role: string; drives: boolean; status: string;
  joined_at: string | null; left_at: string | null; company_status: string | null;
}
interface Invitation { id: number; org_id: number; name: string; type: string; role: string; created_at: string; expires_at: string }
interface PersonDetail {
  person: { id: number; name: string; email: string | null; user_role: string; phone: string | null; account_status: string; created_at: string; last_sign_in_at: string | null };
  company: { id: number; name: string; type: string; verification_status: string } | null;
  company_type: string | null;
  role: string | null;
  checklist: { approval_required: boolean; items: ChecklistItem[]; required_total: number; required_met: number; ready: boolean };
  /** Every check and certification for all their current companies and roles */
  all_checks: ChecklistItem[];
  verification: {
    status: string; notes: string | null; reviewed_at: string | null; reviewed_by: string | null;
    background_status: string; background_reference: string | null; background_notes: string | null; background_checked_at: string | null;
  };
  identity: (Record<string, unknown> & { status: string; has_id_front: boolean; has_id_back: boolean; has_selfie: boolean; failure_reason: string | null }) | null;
  credentials: Credential[];
  cert_types: string[];
  companies: Membership[];
  invitations: Invitation[];
}

/** The person's own Profile sections, plus the companies they work and worked for */
type Section = 'identity' | 'driving' | 'certifications' | 'checks' | 'pro' | 'companies';
const SECTIONS: { id: Section; label: string; description: string }[] = [
  ...PROFILE_SECTIONS.me.map((d) => ({ id: d.id as Section, label: d.label, description: d.description.replace(/^Your /, 'Their ').replace(/ your /g, ' their ') })),
  { id: 'companies', label: 'Companies', description: 'Every company they work for now and worked for before, with their role and dates.' },
];
const TYPE_NAME: Record<string, string> = { carrier: 'Carrier', shipper: 'Shipper', broker: 'Broker', factor: 'Factor', receiver: 'Receiver', agency: 'Agency' };

type ApiError = { response?: { data?: { error?: string; message?: string } } };
const errorText = (e: ApiError, fallback: string) => e?.response?.data?.error ?? e?.response?.data?.message ?? fallback;
const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-base focus:outline-none focus:border-[var(--color-teal)]';

/** Officers see the identity record the API allows them, not the profile */
const IDENTITY_FIELDS: [string, string][] = [
  ['legal_first_name', 'Legal first name'], ['legal_middle_name', 'Middle name'], ['legal_last_name', 'Legal last name'], ['suffix', 'Suffix'],
  ['city', 'City'], ['state', 'State'], ['country', 'Country'], ['id_type', 'ID type'], ['id_issuing_state', 'Issuing state'],
  ['id_issuing_country', 'Issuing country'], ['id_expiry_date', 'Expires'], ['status', 'Status'], ['verification_method', 'Verified by method'], ['verified_at', 'Verified at'],
];

const CREDENTIAL_TYPES: [string, string][] = [
  ['cdl', 'Commercial driver license (CDL)'], ['dot_medical', 'DOT medical card'], ['clearinghouse', 'FMCSA Clearinghouse'],
  ['mvr', 'Motor vehicle record (MVR)'], ['drug_test', 'Drug test'], ['hazmat_endorsement', 'Hazmat endorsement'],
  ['tanker_endorsement', 'Tanker endorsement'], ['passenger_endorsement', 'Passenger endorsement'],
  ['dispatcher_certification', 'Dispatcher certification'], ['hazmat_shipper_training', 'Hazmat shipper training'], ['other', 'Other'],
];

/** Yellow asterisk on a data point the document reader couldn't match; hover shows what the document says */
const Flag = ({ c, field, read }: { c: Credential; field: string; read?: unknown }) =>
  !c.verified_at && c.ai?.fields?._flags?.includes(field)
    ? <span title={read ? `Document: ${String(read)}` : undefined} className="ml-0.5 cursor-help font-bold text-amber-500">*</span>
    : null;

/** Opens a private file through the authenticated API */
async function openFile(url: string) {
  const win = window.open('', '_blank');
  try {
    const res = await api.get(url, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(res.data as Blob);
    if (win) win.location.href = blobUrl; else window.open(blobUrl, '_blank');
  } catch {
    win?.close();
    toast.error('Could not open the file');
  }
}

function IdentityImage({ userId, kind, label, has }: { userId: number; kind: string; label: string; has: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!has) return;
    let url: string | null = null;
    api.get(`/api/v1/admin/people/${userId}/files/${kind}`, { responseType: 'blob' })
      .then((r) => { url = URL.createObjectURL(r.data as Blob); setSrc(url); })
      .catch(() => setSrc(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [userId, kind, has]);
  return (
    <div className="space-y-1">
      <p className="text-[13px] font-medium text-[var(--color-text-faint)]">{label}</p>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt={label} className="h-28 w-full rounded-lg border border-[var(--color-cream-dark)] object-cover" />
        : <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-[var(--color-cream-dark)] text-xs text-[var(--color-text-faint)]">{has ? 'Not available' : 'Not uploaded'}</div>}
    </div>
  );
}

/** A check's state as the same tag Companies uses */
const STATE_TAG: Record<string, ['good' | 'warn' | 'bad' | 'neutral', string]> = {
  met: ['good', 'Verified'], pending: ['warn', 'Pending'], missing: ['neutral', 'Not on file'], expired: ['bad', 'Expired'], failed: ['bad', 'Failed'],
};
const StateTag = ({ state }: { state: string }) => { const [tone, label] = STATE_TAG[state] ?? STATE_TAG.missing; return <Pill tone={tone}>{label}</Pill>; };

const btnTeal = 'inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:cursor-not-allowed disabled:bg-[var(--color-cream-dark)] disabled:text-[var(--color-text-faint)]';
const btnDanger = 'inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-semibold text-[var(--color-danger)] hover:bg-red-50 disabled:opacity-50';

export default function AdminPersonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>('identity');
  const [notes, setNotes] = useState('');
  const [bg, setBg] = useState({ result: '', reference: '', notes: '' });
  const [cred, setCred] = useState<Record<string, string>>({ type: '' });
  const [credFile, setCredFile] = useState<File | null>(null);
  // Law enforcement: read only, no documents, no date of birth or address (App\Support\LawEnforcement)
  const officer = useCurrentUser()?.role === 'agency';

  const { data, isLoading } = useQuery({
    queryKey: ['admin-person', id],
    queryFn: () => api.get(`/api/v1/admin/people/${id}`).then((r) => r.data.data as PersonDetail),
  });
  // The same profile the person sees on their own Profile page
  const { data: profile } = useQuery({
    queryKey: ['admin-person-profile', id],
    enabled: !officer,
    queryFn: () => api.get(`/api/v1/admin/people/${id}/profile`).then((r) => r.data.data as PersonProfile),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-person', id] });
    qc.invalidateQueries({ queryKey: ['admin-person-profile', id] });
    qc.invalidateQueries({ queryKey: ['admin-people'] });
  };

  const review = useMutation({
    mutationFn: (action: 'approve' | 'reject') => api.post(`/api/v1/admin/people/${id}/review`, { action, notes: notes || undefined }),
    onSuccess: (_, action) => { toast.success(action === 'approve' ? 'Person approved' : 'Person rejected'); setNotes(''); refresh(); },
    onError: (e: ApiError) => toast.error(errorText(e, 'Action failed')),
  });
  const identity = useMutation({
    mutationFn: (body: { result: 'verified' | 'failed'; reason?: string }) => api.post(`/api/v1/admin/people/${id}/identity`, body),
    onSuccess: () => { toast.success('Identity updated'); refresh(); },
    onError: (e: ApiError) => toast.error(errorText(e, 'Could not update identity')),
  });
  const background = useMutation({
    mutationFn: () => api.post(`/api/v1/admin/people/${id}/background`, { result: bg.result, reference: bg.reference || undefined, notes: bg.notes || undefined }),
    onSuccess: () => { toast.success('Background check recorded'); setBg({ result: '', reference: '', notes: '' }); refresh(); },
    onError: (e: ApiError) => toast.error(errorText(e, 'Could not record background check')),
  });
  const verifyCred = useMutation({
    mutationFn: (body: { credId: number; verified: boolean; result?: string }) =>
      api.post(`/api/v1/admin/people/credentials/${body.credId}/verify`, { verified: body.verified, result: body.result }),
    onSuccess: () => { toast.success('Credential updated'); refresh(); },
    onError: (e: ApiError) => toast.error(errorText(e, 'Could not update credential')),
  });
  const deleteCred = useMutation({
    mutationFn: (credId: number) => api.delete(`/api/v1/admin/people/credentials/${credId}`),
    onSuccess: () => { toast.success('Credential removed'); refresh(); },
    onError: (e: ApiError) => toast.error(errorText(e, 'Could not remove credential')),
  });
  const addCred = useMutation({
    mutationFn: () => {
      const form = new FormData();
      Object.entries(cred).forEach(([k, v]) => { if (v) form.append(k, v); });
      if (credFile) form.append('document', credFile);
      return api.post(`/api/v1/admin/people/${id}/credentials`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { toast.success('Credential added'); setCred({ type: '' }); setCredFile(null); refresh(); },
    onError: (e: ApiError) => toast.error(errorText(e, 'Could not add credential')),
  });

  if (isLoading) return <div className="w-[75%] min-w-[560px]"><div className="skeleton h-96 rounded-xl" /></div>;
  if (!data) return <EmptyState icon={User} title="Person not found" />;

  const { person, checklist, verification: v } = data;
  const isDriver = data.company_type === 'carrier' && (data.role === 'driver' || data.role === 'owner');
  const missing = checklist.items.filter((i) => i.required && i.state !== 'met').map((i) => i.label);
  const certSet = new Set(data.cert_types);
  const def = SECTIONS.find((s) => s.id === section)!;
  const roleLine = [data.role ? ROLE_LABELS[data.role] ?? data.role : null, data.company?.name].filter(Boolean).join(', ') || TYPE_NAME[person.user_role] || null;

  // Shipmater's own actions on each credential (the person's cards show what they entered)
  const credentialsCard = (
    <DataCard title={`Credentials on file (${data.credentials.length})`}>
      {data.credentials.length === 0 ? <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">None on file.</p> : (
        <ul className="divide-y divide-[var(--color-cream-dark)]">
          {data.credentials.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="text-base font-medium text-[var(--color-text)]">{c.name || c.type_label}<Flag c={c} field="name" read={c.ai?.fields?.holder_name} /><Flag c={c} field="document" /></p>
                <p className="text-[13px] text-[var(--color-text-faint)]">
                  {[c.number && <span key="n">{display('number', c.number)}<Flag c={c} field="number" read={c.ai?.fields?.number} /></span>, c.class && `Class ${c.class}`, c.issuing_state, c.issuer,
                    c.expires_at && <span key="e">Expires {fmtDate(c.expires_at)}<Flag c={c} field="expires_at" read={c.ai?.fields?.expiry_date} /></span>,
                    c.result && `Result ${c.result.replace(/_/g, ' ')}`].filter(Boolean).map((x, i) => <span key={i}>{i > 0 && ' · '}{x}</span>)}
                </p>
                <p className="text-xs text-[var(--color-text-faint)]">
                  From {c.source.replace(/_/g, ' ')}{c.verified_at ? ` · verified ${fmtDate(c.verified_at)}${c.verified_by ? ` by ${c.verified_by}` : ''}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 whitespace-nowrap">
                <StateTag state={c.state} />
                {!officer && <>
                  {c.has_document && <button onClick={() => openFile(`/api/v1/admin/people/credentials/${c.id}/file`)} title="Open document" className="text-[var(--color-text-faint)] hover:text-[var(--color-teal)]"><FileText size={14} /></button>}
                  {c.verified_at
                    ? <button onClick={() => verifyCred.mutate({ credId: c.id, verified: false })} disabled={verifyCred.isPending} className="text-sm font-medium text-[var(--color-text-muted)] hover:underline">Unverify</button>
                    : <button onClick={() => verifyCred.mutate({ credId: c.id, verified: true, result: ['mvr', 'clearinghouse', 'drug_test'].includes(c.type) && !c.result ? 'clear' : undefined })}
                        disabled={verifyCred.isPending} className="text-sm font-semibold text-[var(--color-teal)] hover:underline">Verify</button>}
                  {['mvr', 'clearinghouse', 'drug_test'].includes(c.type) && c.result !== 'failed' && (
                    <button onClick={() => verifyCred.mutate({ credId: c.id, verified: true, result: 'failed' })} disabled={verifyCred.isPending} className="text-sm font-medium text-[var(--color-danger)] hover:underline">Failed</button>
                  )}
                  <button onClick={() => { if (confirm(`Remove ${c.type_label}?`)) deleteCred.mutate(c.id); }} disabled={deleteCred.isPending}
                    title="Remove" className="text-[var(--color-text-faint)] hover:text-[var(--color-danger)]"><Trash2 size={14} /></button>
                </>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!officer && (
        <div className="space-y-2 border-t border-[var(--color-cream-dark)] px-4 py-3">
          <p className="text-[13px] font-medium text-[var(--color-text-faint)]">Add a credential (e.g. an MVR you pulled)</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select value={cred.type} onChange={(e) => setCred({ ...cred, type: e.target.value })} aria-label="Credential type" className={inputCls}>
              <option value="">Type…</option>
              {CREDENTIAL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input value={cred.number ?? ''} onChange={(e) => setCred({ ...cred, number: e.target.value })} placeholder="Number / reference" className={inputCls} />
            <input value={cred.issuer ?? ''} onChange={(e) => setCred({ ...cred, issuer: e.target.value })} placeholder="Issuer" className={inputCls} />
            <input type="date" value={cred.issued_at ?? ''} onChange={(e) => setCred({ ...cred, issued_at: e.target.value })} aria-label="Issued" className={inputCls} />
            <input type="date" value={cred.expires_at ?? ''} onChange={(e) => setCred({ ...cred, expires_at: e.target.value })} aria-label="Expires" className={inputCls} />
            <select value={cred.result ?? ''} onChange={(e) => setCred({ ...cred, result: e.target.value })} aria-label="Result" className={inputCls}>
              <option value="">Result (checks only)</option>
              <option value="clear">Clear</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="violations_found">Violations found</option>
            </select>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" onChange={(e) => setCredFile(e.target.files?.[0] ?? null)} className="text-sm sm:col-span-2" />
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <input type="checkbox" checked={cred.verified === '1'} onChange={(e) => setCred({ ...cred, verified: e.target.checked ? '1' : '' })} />
              Mark verified now
            </label>
          </div>
          <button onClick={() => addCred.mutate()} disabled={!cred.type || addCred.isPending} className={btnTeal}>Add credential</button>
        </div>
      )}
    </DataCard>
  );

  return (
    <div className="w-[75%] min-w-[560px] space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        <ArrowLeft size={14} /> Back
      </button>

      <HeaderCard initials={initialsOf(person.name)} title={person.name}
        lines={[roleLine, `Member since ${memberSince(person.created_at)}${person.last_sign_in_at ? ` · Last sign-in ${fmtDate(person.last_sign_in_at)}` : ''}`]}
        aside={
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2"><PersonStatusBadge status={v.status} /><UserStatusBadge status={person.account_status} /></div>
          </div>
        } />

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((d) => (
          <button key={d.id} onClick={() => setSection(d.id)}
            className={`rounded-full border px-3.5 py-1.5 text-[length:var(--text-nav)] font-medium transition-colors ${
              section === d.id
                ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)] text-[var(--color-teal)]'
                : 'border-[var(--color-cream-dark)] bg-[var(--color-white)] text-[var(--color-text-muted)] hover:border-[var(--color-teal)]'
            }`}>
            {d.label}
          </button>
        ))}
      </div>

      <div className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-xl p-8 space-y-6">
        <SectionHeader title={def.label} description={def.description} />

        {section === 'identity' && (officer
          ? <DataCard title="Identity" rows={data.identity ? IDENTITY_FIELDS.filter(([k]) => k in data.identity!).map(([k, l]) => [l, display(k, data.identity![k])] as DataRow) : [['Identity', 'Not entered']]} />
          : !profile ? <div className="skeleton h-64 rounded-xl" /> : (<>
            <PersonalCards profile={profile} />
            <DataCard title="Identity documents" subtitle={data.identity?.failure_reason ? `Failed: ${data.identity.failure_reason}` : undefined}>
              <div className="space-y-3 px-4 py-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <IdentityImage userId={person.id} kind="id_front" label="ID front" has={!!data.identity?.has_id_front} />
                  <IdentityImage userId={person.id} kind="id_back" label="ID back" has={!!data.identity?.has_id_back} />
                  <IdentityImage userId={person.id} kind="selfie" label="Selfie" has={!!data.identity?.has_selfie} />
                </div>
                {data.identity && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => identity.mutate({ result: 'verified' })} disabled={identity.isPending || data.identity.status === 'verified'} className={btnTeal}>Mark identity verified</button>
                    <button onClick={() => {
                      const reason = prompt('Why did identity verification fail? (shown to the person)');
                      if (reason === null) return;
                      identity.mutate({ result: 'failed', reason: reason || undefined });
                    }} disabled={identity.isPending} className={btnDanger}>Mark failed</button>
                  </div>
                )}
              </div>
            </DataCard>
          </>))}

        {section === 'driving' && (officer
          ? credentialsCard
          : !profile ? <div className="skeleton h-64 rounded-xl" /> : <div className="space-y-4"><DrivingCards profile={profile} /></div>)}

        {section === 'certifications' && (
          <CertificationsSection staff={{
            credentials: data.credentials.filter((c) => certSet.has(c.type)) as never,
            certTypes: data.cert_types.map((t) => ({ value: t, label: CREDENTIAL_TYPES.find(([k]) => k === t)?.[1] ?? t.replace(/_/g, ' ') })),
            fileUrl: (cid) => `/api/v1/admin/people/credentials/${cid}/file`,
          }} />
        )}

        {section === 'checks' && (<>
          <DataCard title="Approval" rows={checklist.approval_required ? [
            ['Status', <PersonStatusBadge key="s" status={v.status} />],
            ['Required checks', `${checklist.required_met} of ${checklist.required_total} done`],
            ['Still needed', missing.length ? missing.join(', ') : null],
            ['Last reviewed', v.reviewed_at ? `${fmtDate(v.reviewed_at)}${v.reviewed_by ? ` by ${v.reviewed_by}` : ''}` : null],
            ['Notes', v.notes],
            ...(data.company?.type === 'carrier' && data.company.verification_status !== 'approved' && data.role === 'owner'
              ? [['Company', <span key="c"><CompanyStatusBadge status={data.company.verification_status} /> Approve the owner here first, then the company.</span>]] as DataRow[] : []),
          ] : [['Approval', `${data.role ? ROLE_LABELS[data.role] ?? data.role : 'This role'}s at ${data.company_type ?? 'this'} companies don't need approval. They get access once their company is approved.`]]}>
            {checklist.approval_required && !officer && (
              <div className="space-y-2 border-t border-[var(--color-cream-dark)] px-4 py-3">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional, kept on the record)" rows={2} className={inputCls} />
                <div className="flex gap-2">
                  <button onClick={() => review.mutate('approve')} disabled={review.isPending || !checklist.ready || v.status === 'approved'}
                    title={checklist.ready ? 'Approve person' : 'Every required check must be done first'} className={btnTeal}><ShieldCheck size={14} /> Approve</button>
                  <button onClick={() => review.mutate('reject')} disabled={review.isPending || v.status === 'rejected'} className={btnDanger}><XCircle size={14} /> Reject</button>
                </div>
              </div>
            )}
          </DataCard>

          {([['required', 'Required checks', 'Must be done before approval.'], ['recorded', 'Recorded checks', 'Kept on file; not needed for approval.'],
            ['certification', 'Certifications', 'Certifications that fit their roles.']] as const).map(([group, title, subtitle]) => {
            const items = data.all_checks.filter((i) => (i.group ?? (i.required ? 'required' : 'recorded')) === group);
            return items.length > 0 && (
              <DataCard key={group} title={title} subtitle={subtitle} rows={items.map((i) => [i.label,
                <span key={i.key} className="inline-flex flex-wrap items-center gap-2">
                  <StateTag state={i.state} />
                  {i.detail && <span className="text-[13px] text-[var(--color-text-faint)]">{i.detail}</span>}
                  {!officer && i.credential_id && i.state !== 'met' && (
                    <button onClick={() => {
                      const c = data.credentials.find((x) => x.id === i.credential_id);
                      verifyCred.mutate({ credId: i.credential_id!, verified: true, result: c && ['mvr', 'clearinghouse', 'drug_test'].includes(c.type) && !c.result ? 'clear' : undefined });
                    }} disabled={verifyCred.isPending}
                      className="text-sm font-semibold text-[var(--color-teal)] hover:underline">Verify</button>
                  )}
                </span>] as DataRow)} />
            );
          })}

          {isDriver && (
            <DataCard title="Background check" rows={[
              ['Result', display('status', v.background_status)],
              ['Recorded', v.background_checked_at ? fmtDate(v.background_checked_at) : null],
              ['Reference', v.background_reference],
              ['Notes', v.background_notes],
            ]}>
              {!officer && (
                <div className="space-y-2 border-t border-[var(--color-cream-dark)] px-4 py-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <select value={bg.result} onChange={(e) => setBg({ ...bg, result: e.target.value })} aria-label="Background result" className={inputCls}>
                      <option value="">Record a result…</option>
                      <option value="pending">Pending</option>
                      <option value="clear">Clear</option>
                      <option value="consider">Consider (needs review)</option>
                      <option value="failed">Failed</option>
                    </select>
                    <input value={bg.reference} onChange={(e) => setBg({ ...bg, reference: e.target.value })} placeholder="Provider reference" className={inputCls} />
                    <input value={bg.notes} onChange={(e) => setBg({ ...bg, notes: e.target.value })} placeholder="Notes" className={inputCls} />
                  </div>
                  <button onClick={() => background.mutate()} disabled={!bg.result || background.isPending} className={btnTeal}>Save background result</button>
                </div>
              )}
            </DataCard>
          )}

          {!officer && credentialsCard}
        </>)}

        {section === 'pro' && <ProProfileCard userId={person.id} driving={data.company_type === 'carrier'} />}

        {section === 'companies' && (<>
          <DataCard title="Companies" rows={data.companies.length ? data.companies.map((m) => [
            m.name,
            <span key={m.id} className="inline-flex flex-wrap items-center gap-2">
              <Link href={m.type === 'agency' ? `/admin/agencies?agency=${m.org_id}` : `/admin/companies/${m.org_id}`} className="text-[var(--color-teal)] hover:underline">
                {TYPE_NAME[m.type] ?? m.type} · {ROLE_LABELS[m.role] ?? m.role}{m.drives && m.role !== 'driver' ? ', drives' : ''}
              </Link>
              <span className="text-[var(--color-text-muted)]">{fmtDate(m.joined_at) ?? '—'} – {m.left_at ? fmtDate(m.left_at) : 'present'}</span>
              {m.left_at ? <Pill>Left</Pill> : m.status === 'active' ? <Pill tone="good">Current</Pill> : <Pill tone="warn">{m.status}</Pill>}
            </span>,
          ] as DataRow) : [['Companies', 'Not a member of any company']]} />
          {!officer && data.invitations.length > 0 && (
            <DataCard title="Invited, not joined yet" rows={data.invitations.map((i) => [
              i.name,
              <span key={i.id}>{ROLE_LABELS[i.role] ?? i.role} · invited {fmtDate(i.created_at)} · expires {fmtDate(i.expires_at)}</span>,
            ] as DataRow)} />
          )}
        </>)}
      </div>
    </div>
  );
}
