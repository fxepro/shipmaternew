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
import { Card, Fields, display, type Row } from '@/components/admin/DetailParts';
import { CompanyStatusBadge } from '@/components/admin/CompanyBadges';
import { CheckChip, PersonStatusBadge, ROLE_LABELS } from '@/components/admin/PersonBadges';

interface ChecklistItem { key: string; label: string; required: boolean; state: string; detail: string | null; credential_id?: number | null }
interface Credential {
  id: number; type: string; type_label: string; name: string | null; issuer: string | null; number: string | null;
  issuing_state: string | null; class: string | null; issued_at: string | null; expires_at: string | null;
  result: string | null; source: string; has_document: boolean; state: string; notes: string | null;
  verified_at: string | null; verified_by: string | null;
}
interface PersonDetail {
  person: { id: number; name: string; email: string; account_status: string; created_at: string };
  company: { id: number; name: string; type: string; verification_status: string } | null;
  company_type: string | null;
  role: string | null;
  checklist: { approval_required: boolean; items: ChecklistItem[]; required_total: number; required_met: number; ready: boolean };
  verification: {
    status: string; notes: string | null; reviewed_at: string | null; reviewed_by: string | null;
    background_status: string; background_reference: string | null; background_notes: string | null; background_checked_at: string | null;
  };
  identity: (Row & { status: string; has_id_front: boolean; has_id_back: boolean; has_selfie: boolean; failure_reason: string | null }) | null;
  credentials: Credential[];
}

type ApiError = { response?: { data?: { error?: string; message?: string } } };
const errorText = (e: ApiError, fallback: string) => e?.response?.data?.error ?? e?.response?.data?.message ?? fallback;

const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]';

const IDENTITY_FIELDS: [string, string][] = [
  ['legal_first_name', 'Legal first name'], ['legal_middle_name', 'Middle name'], ['legal_last_name', 'Legal last name'], ['suffix', 'Suffix'],
  ['date_of_birth', 'Date of birth'], ['age', 'Age'], ['phone', 'Phone'], ['ssn_last4', 'SSN (last 4)'],
  ['street', 'Street'], ['unit', 'Unit'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP'], ['country', 'Country'],
  ['id_type', 'ID type'], ['id_number_masked', 'ID number'], ['id_issuing_state', 'Issuing state'], ['id_issuing_country', 'Issuing country'],
  ['id_issue_date', 'Issued'], ['id_expiry_date', 'Expires'],
  ['verification_method', 'Verified by method'], ['provider_reference', 'Provider reference'], ['verified_at', 'Verified at'], ['verified_by', 'Verified by'],
];

const CREDENTIAL_TYPES: [string, string][] = [
  ['cdl', 'Commercial driver license (CDL)'], ['dot_medical', 'DOT medical card'], ['clearinghouse', 'FMCSA Clearinghouse'],
  ['mvr', 'Motor vehicle record (MVR)'], ['drug_test', 'Drug test'], ['hazmat_endorsement', 'Hazmat endorsement'],
  ['tanker_endorsement', 'Tanker endorsement'], ['passenger_endorsement', 'Passenger endorsement'],
  ['dispatcher_certification', 'Dispatcher certification'], ['hazmat_shipper_training', 'Hazmat shipper training'], ['other', 'Other'],
];

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

function IdentityImage({ userId, kind, label }: { userId: number; kind: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    api.get(`/api/v1/admin/people/${userId}/files/${kind}`, { responseType: 'blob' })
      .then((r) => { url = URL.createObjectURL(r.data as Blob); setSrc(url); })
      .catch(() => setSrc(null));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [userId, kind]);

  return (
    <div className="space-y-1">
      <p className="text-xs text-[var(--color-text-faint)]">{label}</p>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt={label} className="h-32 w-full rounded-lg border border-[var(--color-cream-dark)] object-cover" />
        : <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[var(--color-cream-dark)] text-xs text-[var(--color-text-faint)]">Not available</div>}
    </div>
  );
}

export default function AdminPersonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [bg, setBg] = useState({ result: '', reference: '', notes: '' });
  const [cred, setCred] = useState<Record<string, string>>({ type: '' });
  const [credFile, setCredFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-person', id],
    queryFn: () => api.get(`/api/v1/admin/people/${id}`).then((r) => r.data.data as PersonDetail),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-person', id] });
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
    mutationFn: () => api.post(`/api/v1/admin/people/${id}/background`, {
      result: bg.result, reference: bg.reference || undefined, notes: bg.notes || undefined,
    }),
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

  if (isLoading) return <div className="skeleton h-96 rounded-xl" />;
  if (!data) return <EmptyState icon={User} title="Person not found" />;

  const { person, checklist, verification: v } = data;
  const isDriver = data.company_type === 'carrier' && data.role === 'driver';
  const missing = checklist.items.filter((i) => i.required && i.state !== 'met').map((i) => i.label);

  return (
    <div className="space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{person.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-faint)]">
            {person.email} · {data.role ? ROLE_LABELS[data.role] ?? data.role : 'No role'}
            {data.company && <> at <Link href={`/admin/companies/${data.company.id}`} className="text-[var(--color-teal)] hover:underline">{data.company.name}</Link></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UserStatusBadge status={person.account_status} />
          <PersonStatusBadge status={v.status} />
          <Link href={`/admin/users/${person.id}`} className="text-sm font-medium text-[var(--color-teal)] hover:underline">Account →</Link>
        </div>
      </div>

      {/* Approval */}
      <Card title="Person approval">
        {!checklist.approval_required ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {data.role ? ROLE_LABELS[data.role] : 'This role'}s at {data.company_type ?? 'this'} companies don&apos;t need approval.
            They get access once their company is approved. Any certifications below are recorded only.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <PersonStatusBadge status={v.status} />
              <span className="text-[var(--color-text-muted)]">{checklist.required_met} of {checklist.required_total} required checks done</span>
              {v.reviewed_at && <span className="text-xs text-[var(--color-text-faint)]">· Last reviewed {new Date(v.reviewed_at).toLocaleString()}{v.reviewed_by ? ` by ${v.reviewed_by}` : ''}</span>}
            </div>
            {v.notes && <p className="text-sm text-[var(--color-text-muted)]">Notes: {v.notes}</p>}
            {data.company?.type === 'carrier' && data.company.verification_status !== 'approved' && data.role === 'owner' && (
              <p className="text-xs text-[var(--color-text-faint)]">
                Company status: <CompanyStatusBadge status={data.company.verification_status} /> — approve the owner here first, then the company.
              </p>
            )}
            {missing.length > 0 && <p className="text-sm text-amber-700">Still needed: {missing.join(', ')}.</p>}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional, kept on the record)" rows={2} className={inputCls} />
            <div className="flex gap-2">
              <button
                onClick={() => review.mutate('approve')}
                disabled={review.isPending || !checklist.ready || v.status === 'approved'}
                title={checklist.ready ? 'Approve person' : 'Every required check must be done first'}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--color-teal)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:cursor-not-allowed disabled:bg-[var(--color-cream-dark)] disabled:text-[var(--color-text-faint)]"
              >
                <ShieldCheck size={14} /> Approve
              </button>
              <button
                onClick={() => review.mutate('reject')}
                disabled={review.isPending || v.status === 'rejected'}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-danger)] px-3 py-2 text-sm font-semibold text-[var(--color-danger)] hover:bg-red-50 disabled:opacity-50"
              >
                <XCircle size={14} /> Reject
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Checklist */}
      <Card title="Checks for this role">
        {checklist.items.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Nothing is required or recorded for this role.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-cream-dark)]">
            {checklist.items.map((i) => (
              <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{i.label}</p>
                  <p className="text-xs text-[var(--color-text-faint)]">{i.required ? 'Required for approval' : 'Recorded only'}{i.detail ? ` · ${i.detail}` : ''}</p>
                </div>
                <CheckChip state={i.state} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Identity */}
      <Card title="Identity record">
        {!data.identity ? (
          <p className="text-sm text-[var(--color-text-muted)]">No identity details entered yet.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              Status: <span className="font-medium">{display('status', data.identity.status)}</span>
              {data.identity.failure_reason && <span className="text-[var(--color-danger)]">· {data.identity.failure_reason}</span>}
            </div>
            <Fields data={data.identity} fields={IDENTITY_FIELDS} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {data.identity.has_id_front ? <IdentityImage userId={person.id} kind="id_front" label="ID front" /> : <IdentityPlaceholder label="ID front" />}
              {data.identity.has_id_back ? <IdentityImage userId={person.id} kind="id_back" label="ID back" /> : <IdentityPlaceholder label="ID back" />}
              {data.identity.has_selfie ? <IdentityImage userId={person.id} kind="selfie" label="Selfie" /> : <IdentityPlaceholder label="Selfie" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => identity.mutate({ result: 'verified' })}
                disabled={identity.isPending || data.identity.status === 'verified'}
                className="rounded-lg bg-[var(--color-teal)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:cursor-not-allowed disabled:bg-[var(--color-cream-dark)] disabled:text-[var(--color-text-faint)]"
              >
                Mark identity verified
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Why did identity verification fail? (shown to the person)');
                  if (reason === null) return;
                  identity.mutate({ result: 'failed', reason: reason || undefined });
                }}
                disabled={identity.isPending}
                className="rounded-lg border border-[var(--color-danger)] px-3 py-2 text-sm font-semibold text-[var(--color-danger)] hover:bg-red-50 disabled:opacity-50"
              >
                Mark failed
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Background (drivers only) */}
      {isDriver && (
        <Card title="Background check">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              Result: <span className="font-medium">{display('status', v.background_status)}</span>
              {v.background_checked_at && <span className="text-xs text-[var(--color-text-faint)]">· Recorded {new Date(v.background_checked_at).toLocaleString()}</span>}
              {v.background_reference && <span className="text-xs text-[var(--color-text-faint)]">· Ref {v.background_reference}</span>}
            </div>
            {v.background_notes && <p className="text-sm text-[var(--color-text-muted)]">{v.background_notes}</p>}
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
            <button
              onClick={() => background.mutate()}
              disabled={!bg.result || background.isPending}
              className="rounded-lg bg-[var(--color-navy,#0A2E40)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save background result
            </button>
          </div>
        </Card>
      )}

      {/* Credentials */}
      <Card title={`Credentials and certifications (${data.credentials.length})`}>
        <div className="space-y-5">
          {data.credentials.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">None on file.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-cream-dark)]">
                    {['Credential', 'Number', 'Issued', 'Expires', 'Result', 'State', 'Verified', ''].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.credentials.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--color-cream-dark)] last:border-b-0 align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium">{c.type_label}</p>
                        <p className="text-xs text-[var(--color-text-faint)]">
                          {[c.name !== c.type_label ? c.name : null, c.issuer, c.class && `Class ${c.class}`, c.issuing_state].filter(Boolean).join(' · ') || '—'}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-faint)]">From {c.source.replace(/_/g, ' ')}</p>
                      </td>
                      <td className="px-3 py-2">{display('number', c.number)}</td>
                      <td className="px-3 py-2">{display('issued_at', c.issued_at)}</td>
                      <td className="px-3 py-2">{display('expires_at', c.expires_at)}</td>
                      <td className="px-3 py-2">{display('result_status', c.result)}</td>
                      <td className="px-3 py-2"><CheckChip state={c.state} /></td>
                      <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                        {c.verified_at ? <>{new Date(c.verified_at).toLocaleDateString()}{c.verified_by ? ` · ${c.verified_by}` : ''}</> : 'No'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          {c.has_document && (
                            <button onClick={() => openFile(`/api/v1/admin/people/credentials/${c.id}/file`)} title="Open document"
                              className="text-[var(--color-teal)] hover:underline"><FileText size={14} /></button>
                          )}
                          {c.verified_at ? (
                            <button onClick={() => verifyCred.mutate({ credId: c.id, verified: false })} disabled={verifyCred.isPending}
                              className="text-xs font-medium text-[var(--color-text-muted)] hover:underline">Unverify</button>
                          ) : (
                            <button onClick={() => verifyCred.mutate({ credId: c.id, verified: true, result: ['mvr', 'clearinghouse', 'drug_test'].includes(c.type) && !c.result ? 'clear' : undefined })}
                              disabled={verifyCred.isPending}
                              className="text-xs font-semibold text-[var(--color-teal)] hover:underline">Verify</button>
                          )}
                          {['mvr', 'clearinghouse', 'drug_test'].includes(c.type) && c.result !== 'failed' && (
                            <button onClick={() => verifyCred.mutate({ credId: c.id, verified: true, result: 'failed' })} disabled={verifyCred.isPending}
                              className="text-xs font-medium text-[var(--color-danger)] hover:underline">Failed</button>
                          )}
                          <button onClick={() => { if (confirm(`Remove ${c.type_label}?`)) deleteCred.mutate(c.id); }} disabled={deleteCred.isPending}
                            title="Remove" className="text-[var(--color-text-faint)] hover:text-[var(--color-danger)]"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-lg border border-dashed border-[var(--color-cream-dark)] p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Add a credential (e.g. an MVR you pulled)</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select value={cred.type} onChange={(e) => setCred({ ...cred, type: e.target.value })} aria-label="Credential type" className={inputCls}>
                <option value="">Type…</option>
                {CREDENTIAL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input value={cred.number ?? ''} onChange={(e) => setCred({ ...cred, number: e.target.value })} placeholder="Number / reference" className={inputCls} />
              <input value={cred.issuer ?? ''} onChange={(e) => setCred({ ...cred, issuer: e.target.value })} placeholder="Issuer" className={inputCls} />
              <label className="text-xs text-[var(--color-text-faint)]">Issued
                <input type="date" value={cred.issued_at ?? ''} onChange={(e) => setCred({ ...cred, issued_at: e.target.value })} className={inputCls} />
              </label>
              <label className="text-xs text-[var(--color-text-faint)]">Expires
                <input type="date" value={cred.expires_at ?? ''} onChange={(e) => setCred({ ...cred, expires_at: e.target.value })} className={inputCls} />
              </label>
              <label className="text-xs text-[var(--color-text-faint)]">Result (checks only)
                <select value={cred.result ?? ''} onChange={(e) => setCred({ ...cred, result: e.target.value })} className={inputCls}>
                  <option value="">—</option>
                  <option value="clear">Clear</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="violations_found">Violations found</option>
                </select>
              </label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" onChange={(e) => setCredFile(e.target.files?.[0] ?? null)}
                className="text-sm sm:col-span-2" />
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <input type="checkbox" checked={cred.verified === '1'} onChange={(e) => setCred({ ...cred, verified: e.target.checked ? '1' : '' })} />
                Mark verified now
              </label>
            </div>
            <button
              onClick={() => addCred.mutate()}
              disabled={!cred.type || addCred.isPending}
              className="mt-3 rounded-lg bg-[var(--color-teal)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-50"
            >
              Add credential
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function IdentityPlaceholder({ label }: { label: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-[var(--color-text-faint)]">{label}</p>
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[var(--color-cream-dark)] text-xs text-[var(--color-text-faint)]">Not uploaded</div>
    </div>
  );
}
