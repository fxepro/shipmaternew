'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { payoutsApi } from '@/lib/api';

/**
 * Payout account setup shared by carriers (Personal, Business, Financial tabs) and factors (Company, Finance tabs).
 * Everything Stripe needs is collected here and sent once (api StripeOnboarding). Bank numbers go straight
 * to Stripe through Stripe.js; Shipmater keeps only the token, bank name, routing number and last 4.
 */

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PK ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK) : null;

export type PayoutArea = 'person' | 'business' | 'bank' | 'stripe';

interface Owner { first_name: string; last_name: string; email: string; percent_ownership: number | string }
interface Representative { first_name: string; last_name: string; email: string; phone: string; dob: string; street: string; city: string; state: string; zip: string; has_ssn?: boolean }
interface Business {
  business_structure: string | null; legal_name: string | null; tax_id: string | null;
  street: string | null; city: string | null; state: string | null; zip: string | null; phone: string | null;
  website: string | null; statement_descriptor: string | null;
  representative_title: string | null; representative_ownership: number | null; owners_confirmed: boolean;
  owners: Owner[]; representative: Representative | null;
}
interface StripeItem { area: PayoutArea; label: string; reason: string | null }
export interface PayoutSetupData {
  kind: 'carrier' | 'factor';
  structures: Record<string, string>;
  with_owners: string[];
  business: Business;
  bank: { bank_name: string | null; last4: string; routing_number: string; holder_name: string; holder_type: string; pending: boolean } | null;
  missing: { area: PayoutArea; field: string; label: string }[];
  stripe: { status: 'not_connected' | 'action_needed' | 'reviewing' | 'verified' | 'rejected'; connected: boolean; items: StripeItem[]; reviewing: string[]; submitted_at: string | null };
}

const STRUCTURE_HINT: Record<string, string> = {
  individual: 'You work under your own name, with no business entity or EIN.',
  sole_proprietorship: 'Your own business with a business name and EIN, not an LLC.',
  single_member_llc: 'An LLC with one owner.',
  multi_member_llc: 'An LLC with two or more owners.',
  private_corporation: 'An incorporated company (Inc. or Corp.).',
  private_partnership: 'A business owned by two or more partners.',
};

function errorMessage(e: unknown): string {
  const d = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return d?.error ?? d?.message ?? 'Something went wrong';
}

export function usePayoutSetup() {
  return useQuery({ queryKey: ['payout-setup'], queryFn: () => payoutsApi.setup().then((r) => r.data.data as PayoutSetupData), retry: false });
}

// ── Small form pieces ─────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20';

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">
      {children}{required && <span className="text-red-500 font-bold" aria-hidden="true"> *</span>}
    </p>
  );
}

function Input({ label, value, onChange, required, placeholder, type = 'text', hint, inputMode, maxLength, className }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; type?: string;
  hint?: string; inputMode?: 'numeric' | 'text' | 'email' | 'tel'; maxLength?: number; className?: string;
}) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode}
        maxLength={maxLength} aria-required={required || undefined} className={inputCls} />
      {hint && <p className="mt-1 text-[13px] text-[var(--color-text-faint)]">{hint}</p>}
    </div>
  );
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-base font-semibold text-[var(--color-text)]">{title}</p>
        {note && <p className="mt-0.5 text-[13px] text-[var(--color-text-faint)]">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function SaveButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="flex justify-end border-t border-[var(--color-cream-dark)] pt-4">
      <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-5 py-2.5 text-base font-semibold text-white hover:bg-[var(--color-teal-light)] disabled:opacity-60">
        {pending && <Loader2 size={13} className="animate-spin" />} {label}
      </button>
    </div>
  );
}

/** Uppercase letters, numbers and spaces, 22 characters at most: what Stripe allows on card statements */
function descriptorFrom(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 22);
}

// ── Business details ──────────────────────────────────────────────────────────

/**
 * How the business is set up, with the fields Stripe asks for that setup.
 * `home` lets a carrier copy the Personal tab's address and phone; factors also name their representative here.
 */
export function BusinessDetailsForm({ home, personName }: {
  home?: { street: string; city: string; state: string; zip: string; phone: string };
  personName?: string;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = usePayoutSetup();
  const [f, setF] = useState<Business | null>(null);
  const [ssn, setSsn] = useState('');

  useEffect(() => {
    if (data && !f) {
      const b = data.business;
      setF({
        ...b,
        owners: b.owners ?? [],
        representative: data.kind === 'factor' ? (b.representative ?? { first_name: '', last_name: '', email: '', phone: '', dob: '', street: '', city: '', state: '', zip: '' }) : null,
      });
    }
  }, [data, f]);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => payoutsApi.business(body),
    onSuccess: (r) => { qc.setQueryData(['payout-setup'], r.data.data); setSsn(''); toast.success('Business details saved.'); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading || !data || !f) return <div className="skeleton h-64 rounded-xl" />;

  const structure = f.business_structure ?? '';
  const company = !!structure && structure !== 'individual';
  const withOwners = data.with_owners.includes(structure);
  const isFactor = data.kind === 'factor';
  const set = <K extends keyof Business>(k: K, v: Business[K]) => setF((p) => (p ? { ...p, [k]: v } : p));
  const setRep = (k: keyof Representative, v: string) => setF((p) => (p && p.representative ? { ...p, representative: { ...p.representative, [k]: v } } : p));
  const setOwner = (i: number, k: keyof Owner, v: string) => setF((p) => (p ? { ...p, owners: p.owners.map((o, j) => (j === i ? { ...o, [k]: v } : o)) } : p));
  const suggestedDescriptor = descriptorFrom(company ? (f.legal_name ?? '') : (personName ?? ''));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    save.mutate({
      ...f,
      statement_descriptor: f.statement_descriptor || suggestedDescriptor,
      owners: withOwners ? f.owners : [],
      representative: isFactor && f.representative ? { ...f.representative, ssn_last_4: ssn || null } : undefined,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title="How is your business set up?" note="Stripe asks for different details depending on this. Pick the one on your tax paperwork.">
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(data.structures).map(([id, label]) => (
            <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 ${structure === id ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]' : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]'}`}>
              <input type="radio" name="business_structure" checked={structure === id} onChange={() => set('business_structure', id)} className="mt-0.5 accent-[var(--color-teal)]" />
              <span>
                <span className="block text-base font-medium text-[var(--color-text)]">{label}</span>
                <span className="block text-[13px] text-[var(--color-text-faint)]">{STRUCTURE_HINT[id]}</span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      {isFactor && f.representative && (
        <Section title="Account representative" note="The person opening the payout account: an owner or officer who can sign for the company.">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First name" required value={f.representative.first_name} onChange={(v) => setRep('first_name', v)} />
            <Input label="Last name" required value={f.representative.last_name} onChange={(v) => setRep('last_name', v)} />
            <Input label="Email" required type="email" value={f.representative.email} onChange={(v) => setRep('email', v)} />
            <Input label="Phone" required type="tel" value={f.representative.phone} onChange={(v) => setRep('phone', v)} placeholder="(555) 555-0100" />
            <Input label="Date of birth" required type="date" value={f.representative.dob} onChange={(v) => setRep('dob', v)} />
            <Input label="Last 4 of SSN" required={!f.representative.has_ssn} inputMode="numeric" maxLength={4} value={ssn}
              onChange={(v) => setSsn(v.replace(/\D/g, ''))} placeholder={f.representative.has_ssn ? '•••• saved' : '1234'}
              hint={f.representative.has_ssn ? 'Saved. Leave blank to keep it.' : 'Stored encrypted. Stripe uses it to confirm identity.'} />
            <Input label="Home address" required className="col-span-2" value={f.representative.street} onChange={(v) => setRep('street', v)} />
            <Input label="City" required value={f.representative.city} onChange={(v) => setRep('city', v)} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="State" required maxLength={2} value={f.representative.state} onChange={(v) => setRep('state', v.toUpperCase())} placeholder="TX" />
              <Input label="ZIP" required inputMode="numeric" maxLength={10} value={f.representative.zip} onChange={(v) => setRep('zip', v)} />
            </div>
          </div>
        </Section>
      )}

      {company && (
        <Section title="Business details" note="As they appear on your IRS paperwork.">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Legal business name" required className="col-span-2" value={f.legal_name ?? ''} onChange={(v) => set('legal_name', v)} placeholder="Reyes Transport LLC" />
            <Input label="EIN" required value={f.tax_id ?? ''} onChange={(v) => set('tax_id', v.replace(/[^\d-]/g, ''))} placeholder="12-3456789" maxLength={10} inputMode="numeric" />
            <Input label="Business phone" required type="tel" value={f.phone ?? ''} onChange={(v) => set('phone', v)} placeholder="(555) 555-0100" />
          </div>
          {home && (
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <input type="checkbox" className="accent-[var(--color-teal)]"
                checked={!!f.street && f.street === home.street && f.city === home.city && f.zip === home.zip}
                onChange={(e) => e.target.checked && setF((p) => (p ? { ...p, street: home.street, city: home.city, state: home.state, zip: home.zip, phone: p.phone || home.phone } : p))} />
              Business address is my home address
            </label>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Business address" required className="col-span-2" value={f.street ?? ''} onChange={(v) => set('street', v)} />
            <Input label="City" required value={f.city ?? ''} onChange={(v) => set('city', v)} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="State" required maxLength={2} value={f.state ?? ''} onChange={(v) => set('state', v.toUpperCase())} placeholder="TX" />
              <Input label="ZIP" required inputMode="numeric" maxLength={10} value={f.zip ?? ''} onChange={(v) => set('zip', v)} />
            </div>
          </div>
        </Section>
      )}

      {withOwners && (
        <Section title="Ownership" note="Stripe needs everyone who owns 25% or more of the business.">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Your job title" required value={f.representative_title ?? ''} onChange={(v) => set('representative_title', v)} placeholder="Owner, President, Managing member" />
            <Input label="Your ownership %" required inputMode="numeric" value={f.representative_ownership == null ? '' : String(f.representative_ownership)}
              onChange={(v) => set('representative_ownership', v === '' ? null : Number(v.replace(/[^\d.]/g, '')))} placeholder="50" hint="Enter 0 if you don't own part of it." />
          </div>
          {f.owners.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1.3fr_90px_auto] items-end gap-3">
              <Input label={`Owner ${i + 1} first name`} required value={o.first_name} onChange={(v) => setOwner(i, 'first_name', v)} />
              <Input label="Last name" required value={o.last_name} onChange={(v) => setOwner(i, 'last_name', v)} />
              <Input label="Email" required type="email" value={o.email} onChange={(v) => setOwner(i, 'email', v)} />
              <Input label="Owns %" required inputMode="numeric" value={String(o.percent_ownership ?? '')} onChange={(v) => setOwner(i, 'percent_ownership', v.replace(/[^\d.]/g, ''))} />
              <button type="button" onClick={() => set('owners', f.owners.filter((_, j) => j !== i))} className="mb-2.5 text-[var(--color-text-faint)] hover:text-red-600" aria-label="Remove owner"><Trash2 size={15} /></button>
            </div>
          ))}
          {f.owners.length < 4 && (
            <button type="button" onClick={() => set('owners', [...f.owners, { first_name: '', last_name: '', email: '', percent_ownership: '' }])} className="flex items-center gap-1.5 text-base font-medium text-[var(--color-teal)]">
              <Plus size={14} /> Add an owner with 25% or more
            </button>
          )}
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <input type="checkbox" className="accent-[var(--color-teal)]" checked={f.owners_confirmed} onChange={(e) => set('owners_confirmed', e.target.checked)} />
            Everyone who owns 25% or more is listed (including me)<span className="text-red-500 font-bold" aria-hidden="true"> *</span>
          </label>
        </Section>
      )}

      {structure && (
        <Section title="How you appear to customers">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Card statement name" required value={f.statement_descriptor ?? ''} onChange={(v) => set('statement_descriptor', descriptorFrom(v))}
              placeholder={suggestedDescriptor || 'REYES TRANSPORT'} maxLength={22}
              hint={`What shippers see on their card statement. Stripe requires it to match your ${company ? 'business' : 'legal'} name${suggestedDescriptor ? `, e.g. ${suggestedDescriptor}` : ''}.`} />
            <Input label="Website" value={f.website ?? ''} onChange={(v) => set('website', v)} placeholder="Optional" hint="Leave blank if you don't have one." />
          </div>
        </Section>
      )}

      <SaveButton pending={save.isPending} label="Save business details" />
    </form>
  );
}

// ── Bank account ──────────────────────────────────────────────────────────────

/** The account payouts land in. Numbers go to Stripe directly and come back as a token. */
export function BankAccountForm() {
  const qc = useQueryClient();
  const { data } = usePayoutSetup();
  const [editing, setEditing] = useState(false);
  const [b, setB] = useState({ holder_name: '', holder_type: 'individual', routing: '', account: '', confirm: '' });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (data) setB((p) => ({ ...p, holder_type: data.business.business_structure && data.business.business_structure !== 'individual' ? 'company' : 'individual', holder_name: p.holder_name || data.business.legal_name || '' }));
  }, [data]);

  if (!data) return <div className="skeleton h-40 rounded-xl" />;
  // Once Stripe has the finished account, the bank is changed in Stripe's own payouts dashboard
  const locked = data.stripe.connected && ['verified', 'reviewing', 'rejected'].includes(data.stripe.status);
  const showForm = !data.bank || editing;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{9}$/.test(b.routing)) return toast.error('The routing number is 9 digits.');
    if (!/^\d{4,17}$/.test(b.account)) return toast.error('Check the account number.');
    if (b.account !== b.confirm) return toast.error("The account numbers don't match.");
    const stripe = await stripePromise;
    if (!stripe) return toast.error('Stripe is not configured on this site.');

    setPending(true);
    try {
      const { token, error } = await stripe.createToken('bank_account', {
        country: 'US', currency: 'usd', routing_number: b.routing, account_number: b.account,
        account_holder_name: b.holder_name, account_holder_type: b.holder_type as 'individual' | 'company',
      });
      if (error || !token?.bank_account) throw new Error(error?.message ?? 'Stripe could not read this bank account.');
      const r = await payoutsApi.bank({
        token: token.id, bank_name: token.bank_account.bank_name, last4: token.bank_account.last4,
        routing_number: token.bank_account.routing_number, holder_name: b.holder_name, holder_type: b.holder_type,
      });
      qc.setQueryData(['payout-setup'], r.data.data);
      setB((p) => ({ ...p, routing: '', account: '', confirm: '' }));
      setEditing(false);
      toast.success('Bank account saved.');
    } catch (err) {
      toast.error(err instanceof Error && !('response' in err) ? err.message : errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Section title="Bank account for payouts" note="Where your load payments are deposited. The numbers go straight to Stripe; Shipmater keeps only the last 4 digits.">
      {data.bank && !editing && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--color-cream-dark)] px-4 py-3">
          <div>
            <p className="text-base font-medium text-[var(--color-text)]">{data.bank.bank_name ?? 'Bank account'} •••• {data.bank.last4}</p>
            <p className="text-[13px] text-[var(--color-text-faint)]">{data.bank.holder_name} · routing {data.bank.routing_number}{data.bank.pending ? ' · sent to Stripe when you set up payouts' : ''}</p>
          </div>
          {!locked && <button type="button" onClick={() => setEditing(true)} className="text-base font-medium text-[var(--color-teal)]">Change</button>}
        </div>
      )}
      {locked && data.bank && <p className="text-[13px] text-[var(--color-text-faint)]">To change it now, use your Stripe payouts dashboard.</p>}

      {showForm && !locked && (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Account holder name" required value={b.holder_name} onChange={(v) => setB({ ...b, holder_name: v })} placeholder="Name on the account" />
            <div>
              <Label required>Account belongs to</Label>
              <select value={b.holder_type} onChange={(e) => setB({ ...b, holder_type: e.target.value })} className={inputCls}>
                <option value="individual">A person</option>
                <option value="company">A business</option>
              </select>
            </div>
            <Input label="Routing number" required inputMode="numeric" maxLength={9} value={b.routing} onChange={(v) => setB({ ...b, routing: v.replace(/\D/g, '') })} placeholder="9 digits" />
            <div />
            <Input label="Account number" required inputMode="numeric" maxLength={17} value={b.account} onChange={(v) => setB({ ...b, account: v.replace(/\D/g, '') })} />
            <Input label="Confirm account number" required inputMode="numeric" maxLength={17} value={b.confirm} onChange={(v) => setB({ ...b, confirm: v.replace(/\D/g, '') })} />
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-cream-dark)] pt-4">
            {editing && <button type="button" onClick={() => setEditing(false)} className="text-sm text-[var(--color-text-muted)]">Cancel</button>}
            <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-5 py-2.5 text-base font-semibold text-white hover:bg-[var(--color-teal-light)] disabled:opacity-60">
              {pending && <Loader2 size={13} className="animate-spin" />} Save bank account
            </button>
          </div>
        </form>
      )}
    </Section>
  );
}

// ── Checklist, Stripe's answer and the one button ─────────────────────────────

/**
 * What's done, what Stripe said, and "Set up payouts" at the bottom.
 * `tabs` names the tab each area lives on; `onGoTo` switches to it.
 */
export function PayoutStatus({ tabs, onGoTo }: { tabs: Record<Exclude<PayoutArea, 'stripe'>, { id: string; label: string }>; onGoTo: (tabId: string) => void }) {
  const { data } = usePayoutSetup();
  const [opening, setOpening] = useState(false);

  const groups = useMemo(() => {
    const out: { key: string; label: string; tab: { id: string; label: string }; missing: string[] }[] = [];
    if (!data) return out;
    (['person', 'business', 'bank'] as const).forEach((area) => {
      const tab = tabs[area];
      const existing = out.find((g) => g.tab.id === tab.id && g.key !== area);
      const missing = data.missing.filter((m) => m.area === area).map((m) => m.label);
      if (existing && area !== 'bank') existing.missing.push(...missing);
      else out.push({ key: area, label: area === 'person' ? (data.kind === 'factor' ? 'Representative' : 'Personal details') : area === 'business' ? 'Business details' : 'Bank account', tab, missing });
    });
    return out;
  }, [data, tabs]);

  if (!data) return <div className="skeleton h-40 rounded-xl" />;
  const s = data.stripe;
  const ready = data.missing.length === 0;
  const shipmaterItems = s.items.filter((i) => i.area !== 'stripe');
  const stripeItems = s.items.filter((i) => i.area === 'stripe');

  async function open() {
    setOpening(true);
    try {
      const r = await payoutsApi.submit();
      window.location.href = r.data.url;
    } catch (e) {
      toast.error(errorMessage(e));
      setOpening(false);
    }
  }

  const buttonLabel = !s.connected ? 'Set up payouts' : 'Continue on Stripe';
  const showButton = s.status === 'not_connected' || s.status === 'action_needed';

  return (
    <Section title="Payouts" note="When everything below is ready, Shipmater sends your details to Stripe in one go. Stripe then shows one page to check them and accept its terms.">
      <ul className="divide-y divide-[var(--color-cream-dark)] rounded-xl border border-[var(--color-cream-dark)]">
        {groups.map((g) => (
          <li key={g.key} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${g.missing.length ? 'border border-[var(--color-cream-dark)]' : 'bg-[var(--color-teal)] text-white'}`}>
                {!g.missing.length && <Check size={11} />}
              </span>
              <div>
                <p className="text-base text-[var(--color-text)]">{g.label}</p>
                {g.missing.length > 0 && <p className="text-[13px] text-[var(--color-text-faint)]">Still needed: {g.missing.join(', ')}</p>}
              </div>
            </div>
            {g.missing.length > 0 && <button type="button" onClick={() => onGoTo(g.tab.id)} className="shrink-0 text-[13px] font-medium text-[var(--color-teal)]">Go to {g.tab.label}</button>}
          </li>
        ))}
      </ul>

      {s.status === 'verified' && <p className="text-base text-[var(--color-text)]">Payouts are on. Paid loads are deposited to {data.bank ? `${data.bank.bank_name ?? 'your bank'} •••• ${data.bank.last4}` : 'your bank account'}.</p>}
      {s.status === 'reviewing' && <p className="text-sm text-[var(--color-text-muted)]">Stripe is checking your details{s.reviewing.length ? ` (${s.reviewing.join(', ').toLowerCase()})` : ''}. This usually takes a few minutes, and this page updates when it&apos;s done.</p>}
      {s.status === 'rejected' && <p className="text-sm text-[var(--color-text-muted)]">Stripe couldn&apos;t open this payout account. Contact Shipmater support and we&apos;ll help sort it out.</p>}
      {s.status === 'action_needed' && s.connected && (
        <div className="space-y-1 text-sm text-[var(--color-text-muted)]">
          {shipmaterItems.length > 0 && <p>Stripe asked about: {shipmaterItems.map((i) => `${i.label}${i.reason ? ` (${i.reason})` : ''}`).join(', ')}. Update {Array.from(new Set(shipmaterItems.map((i) => tabs[i.area as Exclude<PayoutArea, 'stripe'>].label))).join(' and ')}, then continue.</p>}
          {stripeItems.length > 0 && <p>To finish on Stripe: {stripeItems.map((i) => i.label).join(', ')}.</p>}
        </div>
      )}

      {showButton && (
        <div className="flex items-center justify-between gap-4 border-t border-[var(--color-cream-dark)] pt-4">
          <p className="text-[13px] text-[var(--color-text-faint)]">{ready ? 'Everything is ready.' : 'Finish the items above first.'}</p>
          <button type="button" onClick={open} disabled={!ready || opening}
            className="flex items-center gap-2 rounded-xl border border-[var(--color-teal)] px-4 py-2 text-sm font-medium text-[var(--color-teal)] hover:bg-[var(--color-teal-pale)] disabled:cursor-not-allowed disabled:border-[var(--color-cream-dark)] disabled:text-[var(--color-text-faint)]">
            {opening && <Loader2 size={13} className="animate-spin" />} {buttonLabel}
          </button>
        </div>
      )}
    </Section>
  );
}
