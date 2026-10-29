'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Upload, Pencil, Trash2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { myChecksApi, kycApi } from '@/lib/api';
import { CheckChip, PersonStatusBadge, ROLE_LABELS } from '@/components/admin/PersonBadges';

interface ChecklistItem { key: string; label: string; required: boolean; state: string; detail: string | null }
interface Credential {
  id: number; type: string; type_label: string; name: string | null; issuer: string | null; number: string | null;
  issuing_state: string | null; class: string | null; issued_at: string | null; expires_at: string | null;
  result: string | null; source: string; has_document: boolean; state: string; verified_at: string | null;
}
type Identity = Record<string, string | number | boolean | null>;
interface MyChecks {
  company: { id: number; name: string; type: string; verification_status: string } | null;
  company_type: 'carrier' | 'shipper' | null;
  role: string | null;
  checklist: { approval_required: boolean; items: ChecklistItem[]; required_total: number; required_met: number; ready: boolean };
  verification: { status: string; notes: string | null; background_status: string };
  identity: Identity | null;
  credentials: Credential[];
  credential_types: { value: string; label: string }[];
  background_required: boolean;
  identity_required: boolean;
  min_age: number | null;
}

type ApiError = { response?: { data?: { message?: string; error?: string; errors?: Record<string, string[]> } } };
const errorText = (e: ApiError, fallback: string) =>
  Object.values(e?.response?.data?.errors ?? {})[0]?.[0] ?? e?.response?.data?.error ?? e?.response?.data?.message ?? fallback;

const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]';
const labelCls = 'block text-xs font-medium text-[var(--color-text-muted)] mb-1';

const IDENTITY_TEXT_FIELDS: [string, string, string?][] = [
  ['legal_first_name', 'Legal first name'], ['legal_middle_name', 'Middle name'], ['legal_last_name', 'Legal last name'],
  ['suffix', 'Suffix'], ['date_of_birth', 'Date of birth', 'date'], ['phone', 'Phone', 'tel'],
  ['street', 'Street address'], ['unit', 'Apt / unit'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP'], ['country', 'Country (2-letter)'],
];

const ID_FIELDS: [string, string, string?][] = [
  ['id_issuing_state', 'Issuing state'], ['id_issuing_country', 'Issuing country (2-letter)'],
  ['id_issue_date', 'Issue date', 'date'], ['id_expiry_date', 'Expiry date', 'date'],
];

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head card-head-tint flex items-center justify-between gap-3 px-5 py-3">
        <p className="card-title">{title}</p>
        {aside}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

/** A person's own verification page: what their role needs, their identity record and credentials. */
export function MyVerification() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const { data, isLoading } = useQuery({
    queryKey: ['my-checks'],
    queryFn: () => myChecksApi.get().then((r) => r.data.data as MyChecks),
  });

  useEffect(() => {
    if (params.get('identity') === 'success') toast.success('Thanks — Stripe is confirming your ID. This page updates when it finishes.');
  }, [params]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['my-checks'] });

  if (isLoading) return <div className="skeleton h-96 rounded-xl" />;
  if (!data) return <p className="text-sm text-[var(--color-text-muted)]">Could not load your verification.</p>;

  const { checklist } = data;
  const roleLabel = data.role ? ROLE_LABELS[data.role] ?? data.role : 'member';
  const showIdentity = data.identity_required || (data.identity && data.identity.status !== 'not_started');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Verification</h1>
          <p className="mt-1 text-sm text-[var(--color-text-faint)]">
            You&apos;re {/^[aeiou]/i.test(roleLabel) ? 'an' : 'a'} {roleLabel}{data.company ? ` at ${data.company.name}` : ''}.
          </p>
        </div>
        {checklist.approval_required && <PersonStatusBadge status={data.verification.status} />}
      </div>

      <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-5 py-4 text-sm text-[var(--color-text-muted)]">
        {checklist.approval_required ? (
          <>
            <p>
              {data.role === 'driver'
                ? 'Drivers need verified identity, a clear background check, a valid CDL and DOT medical card, a clear Clearinghouse query and a clear driving record (MVR). Shipmater reviews these before you can be assigned loads.'
                : 'Owners need a verified identity before Shipmater can approve you and your company.'}
            </p>
            <p className="mt-2 font-medium text-[var(--color-text)]">
              {checklist.required_met} of {checklist.required_total} required items done
              {data.verification.status === 'approved' && ' — you’re approved.'}
              {data.verification.status === 'pending_review' && ' — waiting for Shipmater to review.'}
            </p>
            {data.verification.status === 'rejected' && data.verification.notes && (
              <p className="mt-2 text-[var(--color-danger)]">Not approved: {data.verification.notes}</p>
            )}
          </>
        ) : (
          <p>
            Your role doesn&apos;t need approval — you have access once your company is approved.
            {data.credential_types.length > 1 && ' You can keep your certifications on file here.'}
          </p>
        )}
      </div>

      {checklist.items.length > 0 && (
        <Section title="Checklist">
          <ul className="divide-y divide-[var(--color-cream-dark)]">
            {checklist.items.map((i) => (
              <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{i.label}</p>
                  <p className="text-xs text-[var(--color-text-faint)]">
                    {i.required ? 'Required' : 'Optional — kept on file'}{i.detail ? ` · ${i.detail}` : ''}
                  </p>
                </div>
                <CheckChip state={i.state} />
              </li>
            ))}
          </ul>
          {data.background_required && (
            <p className="mt-3 text-xs text-[var(--color-text-faint)]">
              Shipmater runs the background check and records the result; you&apos;ll get an email if anything is needed from you.
            </p>
          )}
        </Section>
      )}

      {showIdentity && <IdentitySection identity={data.identity} isCarrier={data.company_type === 'carrier'} onSaved={refresh} />}

      <CredentialsSection credentials={data.credentials} types={data.credential_types} onSaved={refresh} />
    </div>
  );
}

function IdentitySection({ identity, isCarrier, onSaved }: { identity: Identity | null; isCarrier: boolean; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [startingStripe, setStartingStripe] = useState(false);

  useEffect(() => {
    const next: Record<string, string> = {};
    [...IDENTITY_TEXT_FIELDS, ...ID_FIELDS].forEach(([k]) => { next[k] = identity?.[k] != null ? String(identity[k]) : ''; });
    next.id_type = identity?.id_type ? String(identity.id_type) : '';
    next.id_number = '';
    next.ssn_last4 = '';
    setForm(next);
  }, [identity]);

  const save = useMutation({
    mutationFn: (submit: boolean) => {
      const body: Record<string, unknown> = { submit };
      Object.entries(form).forEach(([k, v]) => { body[k] = v === '' ? null : v; });
      if (!form.id_number) delete body.id_number;
      if (!form.ssn_last4) delete body.ssn_last4;
      return myChecksApi.updateIdentity(body);
    },
    onSuccess: (_, submit) => { toast.success(submit ? 'Submitted for review' : 'Saved'); onSaved(); },
    onError: (e: ApiError) => toast.error(errorText(e, 'Could not save')),
  });

  const upload = useMutation({
    mutationFn: ({ kind, file }: { kind: string; file: File }) => myChecksApi.uploadIdentity(kind, file),
    onSuccess: () => { toast.success('Uploaded'); onSaved(); },
    onError: (e: ApiError) => toast.error(errorText(e, 'Upload failed')),
  });

  async function startStripe() {
    setStartingStripe(true);
    try {
      const res = await kycApi.startIdentitySession();
      window.location.href = res.data.url;
    } catch {
      toast.error('Could not start ID verification — try again');
      setStartingStripe(false);
    }
  }

  const status = String(identity?.status ?? 'not_started');
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Section
      title="Identity"
      aside={<CheckChip state={status === 'verified' ? 'met' : status === 'failed' ? 'failed' : ['submitted', 'pending'].includes(status) ? 'pending' : 'missing'}
        label={status === 'verified' ? 'Verified' : status === 'failed' ? 'Not verified' : ['submitted', 'pending'].includes(status) ? 'In review' : 'Not started'} />}
    >
      <div className="space-y-5">
        {identity?.failure_reason && <p className="text-sm text-[var(--color-danger)]">{String(identity.failure_reason)}</p>}

        {isCarrier && status !== 'verified' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--color-cream)] px-4 py-3">
            <p className="text-sm text-[var(--color-text-muted)]">Fastest: scan your ID and take a selfie with Stripe. Your details fill in automatically.</p>
            <button onClick={startStripe} disabled={startingStripe}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-teal)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-50">
              <ShieldCheck size={14} /> {startingStripe ? 'Opening…' : 'Verify with Stripe'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {IDENTITY_TEXT_FIELDS.map(([k, label, type]) => (
            <label key={k}><span className={labelCls}>{label}</span>
              <input type={type ?? 'text'} value={form[k] ?? ''} onChange={set(k)} className={inputCls} />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label><span className={labelCls}>ID type</span>
            <select value={form.id_type ?? ''} onChange={set('id_type')} className={inputCls}>
              <option value="">Choose…</option>
              <option value="driver_license">Driver license</option>
              <option value="passport">Passport</option>
              <option value="state_id">State ID</option>
              <option value="national_id">National ID</option>
            </select>
          </label>
          <label><span className={labelCls}>ID number {identity?.id_number_masked ? `(on file: ${identity.id_number_masked})` : ''}</span>
            <input value={form.id_number ?? ''} onChange={set('id_number')} placeholder={identity?.id_number_masked ? 'Leave blank to keep' : ''} autoComplete="off" className={inputCls} />
          </label>
          {ID_FIELDS.map(([k, label, type]) => (
            <label key={k}><span className={labelCls}>{label}</span>
              <input type={type ?? 'text'} value={form[k] ?? ''} onChange={set(k)} className={inputCls} />
            </label>
          ))}
          <label><span className={labelCls}>SSN last 4 {identity?.ssn_last4 ? `(on file: ${identity.ssn_last4})` : ''}</span>
            <input value={form.ssn_last4 ?? ''} onChange={set('ssn_last4')} inputMode="numeric" maxLength={4} autoComplete="off" className={inputCls} />
          </label>
        </div>
        <p className="text-xs text-[var(--color-text-faint)]">Your ID number is stored encrypted. We only ever show its last 4 digits, and we never store your full SSN.</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([['id_front', 'ID front', 'has_id_front'], ['id_back', 'ID back', 'has_id_back'], ['selfie', 'Selfie', 'has_selfie']] as const).map(([kind, label, flag]) => (
            <label key={kind} className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--color-cream-dark)] px-3 py-5 text-center hover:border-[var(--color-teal)]">
              <Upload size={16} className="text-[var(--color-text-faint)]" />
              <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
              <span className="text-xs text-[var(--color-text-faint)]">{identity?.[flag] ? 'Uploaded — click to replace' : 'Upload a photo'}</span>
              <input type="file" accept="image/*,.pdf" className="hidden" disabled={upload.isPending}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate({ kind, file: f }); e.target.value = ''; }} />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => save.mutate(false)} disabled={save.isPending}
            className="rounded-lg border border-[var(--color-cream-dark)] px-3 py-2 text-sm font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] disabled:opacity-50">
            Save
          </button>
          {['not_started', 'failed'].includes(status) && (
            <button onClick={() => save.mutate(true)} disabled={save.isPending}
              className="rounded-lg bg-[var(--color-teal)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-50">
              Save and submit for review
            </button>
          )}
        </div>
      </div>
    </Section>
  );
}

const EMPTY_CRED = { type: '', name: '', issuer: '', number: '', issuing_state: '', class: '', issued_at: '', expires_at: '' };

function CredentialsSection({ credentials, types, onSaved }: { credentials: Credential[]; types: { value: string; label: string }[]; onSaved: () => void }) {
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY_CRED);
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) data.append(k, v); });
      if (file) data.append('document', file);
      return myChecksApi.saveCredential(data, editing === 'new' ? undefined : (editing ?? undefined));
    },
    onSuccess: () => { toast.success('Saved — Shipmater will verify it'); setEditing(null); setForm(EMPTY_CRED); setFile(null); onSaved(); },
    onError: (e: ApiError) => toast.error(errorText(e, 'Could not save')),
  });

  const remove = useMutation({
    mutationFn: (id: number) => myChecksApi.deleteCredential(id),
    onSuccess: () => { toast.success('Removed'); onSaved(); },
    onError: (e: ApiError) => toast.error(errorText(e, 'Could not remove')),
  });

  function edit(c: Credential) {
    setEditing(c.id);
    setFile(null);
    setForm({
      type: c.type, name: c.name ?? '', issuer: c.issuer ?? '', number: c.number ?? '', issuing_state: c.issuing_state ?? '',
      class: c.class ?? '', issued_at: c.issued_at ?? '', expires_at: c.expires_at ?? '',
    });
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Section
      title="Licences and certifications"
      aside={editing === null && (
        <button onClick={() => { setEditing('new'); setForm(EMPTY_CRED); setFile(null); }}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]">
          <Plus size={12} /> Add
        </button>
      )}
    >
      <div className="space-y-4">
        {credentials.length === 0 && editing === null && <p className="text-sm text-[var(--color-text-muted)]">Nothing on file yet.</p>}

        {credentials.length > 0 && (
          <ul className="divide-y divide-[var(--color-cream-dark)]">
            {credentials.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{c.type_label}</p>
                  <p className="text-xs text-[var(--color-text-faint)]">
                    {[c.number, c.class && `Class ${c.class}`, c.issuing_state, c.expires_at && `Expires ${c.expires_at}`, c.has_document && 'Document uploaded']
                      .filter(Boolean).join(' · ') || 'No details'}
                    {c.source === 'carrier_profile' && ' · From your profile'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CheckChip state={c.state} label={c.state === 'met' ? 'Verified' : c.state === 'pending' ? 'Awaiting review' : undefined} />
                  {c.source === 'self' && (
                    <button onClick={() => edit(c)} title="Edit" className="text-[var(--color-text-faint)] hover:text-[var(--color-teal)]"><Pencil size={14} /></button>
                  )}
                  {c.source === 'carrier_profile' && (
                    <Link href="/carrier/profile" className="text-xs text-[var(--color-teal)] hover:underline">Edit in profile</Link>
                  )}
                  {!c.verified_at && c.source === 'self' && (
                    <button onClick={() => { if (confirm(`Remove ${c.type_label}?`)) remove.mutate(c.id); }} title="Remove"
                      className="text-[var(--color-text-faint)] hover:text-[var(--color-danger)]"><Trash2 size={14} /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {editing !== null && (
          <div className="rounded-lg border border-[var(--color-cream-dark)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text)]">{editing === 'new' ? 'Add a licence or certification' : 'Edit'}</p>
              <button onClick={() => setEditing(null)} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label><span className={labelCls}>Type</span>
                <select value={form.type} onChange={set('type')} className={inputCls} disabled={editing !== 'new'}>
                  <option value="">Choose…</option>
                  {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label><span className={labelCls}>Name (optional)</span><input value={form.name} onChange={set('name')} className={inputCls} /></label>
              <label><span className={labelCls}>Issued by</span><input value={form.issuer} onChange={set('issuer')} className={inputCls} /></label>
              <label><span className={labelCls}>Number</span><input value={form.number} onChange={set('number')} className={inputCls} /></label>
              <label><span className={labelCls}>Issuing state</span><input value={form.issuing_state} onChange={set('issuing_state')} className={inputCls} /></label>
              {form.type === 'cdl' && (
                <label><span className={labelCls}>Class</span>
                  <select value={form.class} onChange={set('class')} className={inputCls}>
                    <option value="">—</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
                  </select>
                </label>
              )}
              <label><span className={labelCls}>Issued</span><input type="date" value={form.issued_at} onChange={set('issued_at')} className={inputCls} /></label>
              <label><span className={labelCls}>Expires</span><input type="date" value={form.expires_at} onChange={set('expires_at')} className={inputCls} /></label>
              <label><span className={labelCls}>Document (photo or PDF)</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
              </label>
            </div>
            <button onClick={() => save.mutate()} disabled={!form.type || save.isPending}
              className="mt-3 rounded-lg bg-[var(--color-teal)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-50">
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </Section>
  );
}
