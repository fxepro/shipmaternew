'use client';

/**
 * Forms for the organizations directory: a location (any company's site, no pickup/delivery type) and a contact
 * with the load updates they get. Used by the shipper's receivers, the receiver's own company page and admin.
 */

import { useState } from 'react';
import { X, Loader2, Mail, MessageSquare } from 'lucide-react';
import type { DirContact, DirLocation, Notify, NotifyChannel, NotifyEvent } from '@/types/directory';
import { EVENT_LABEL } from '@/types/directory';

export const inputCls = 'w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20';
export const labelCls = 'block mb-1.5 text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABEL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
export const EVENTS: NotifyEvent[] = ['booked', 'en_route', 'arrived', 'done'];
export const DEFAULT_NOTIFY: Notify = { booked: ['email'], en_route: ['email'], arrived: [], done: ['email'] };

/** API errors as one readable line */
export function apiError(e: unknown, fallback = 'Something went wrong.'): string {
  const d = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  const first = d?.errors ? Object.values(d.errors)[0]?.[0] : null;
  return first ?? d?.message ?? fallback;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-10" onMouseDown={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} rounded-2xl bg-[var(--color-white)] shadow-xl`}
        onMouseDown={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-cream-dark)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-cream)]" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--color-text-faint)]">{hint}</span>}
    </label>
  );
}

// ── Location ──────────────────────────────────────────────────────────────────

export type LocationInput = Omit<DirLocation, 'id' | 'org_id'>;

export function emptyLocation(): LocationInput {
  return { name: '', visibility: 'public', address: '', city: '', state: '', zip: '', country: 'US', operating_hours: null,
    dock_doors: null, appointment_required: false, site_instructions: '', notes: '', is_default: false };
}

/** The location fields (shared by the location dialog and the new-receiver form) */
export function LocationFields({ value, onChange, showDefault }: { value: LocationInput; onChange: (v: LocationInput) => void; showDefault?: boolean }) {
  const set = <K extends keyof LocationInput>(k: K, v: LocationInput[K]) => onChange({ ...value, [k]: v });
  const hours = value.operating_hours ?? {};
  return (
    <div className="space-y-4">
      <Field label="Location name *"><input className={inputCls} value={value.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Denver Distribution Center" /></Field>
      <Field label="Street address *"><input className={inputCls} value={value.address} onChange={e => set('address', e.target.value)} placeholder="5101 Oakland St" /></Field>
      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-3"><Field label="City *"><input className={inputCls} value={value.city} onChange={e => set('city', e.target.value)} /></Field></div>
        <div className="col-span-1"><Field label="State"><input className={inputCls} value={value.state ?? ''} onChange={e => set('state', e.target.value)} maxLength={50} /></Field></div>
        <div className="col-span-2"><Field label="ZIP *"><input className={inputCls} value={value.zip} onChange={e => set('zip', e.target.value)} /></Field></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dock doors"><input type="number" min={0} className={inputCls} value={value.dock_doors ?? ''} onChange={e => set('dock_doors', e.target.value === '' ? null : Number(e.target.value))} /></Field>
        <Field label="Who can see it" hint={value.visibility === 'public' ? 'Anyone on Shipmater can find it and put it on a load.' : 'Only your company.'}>
          <select className={inputCls} value={value.visibility} onChange={e => set('visibility', e.target.value as 'public' | 'private')}>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-teal)]" checked={!!value.appointment_required} onChange={e => set('appointment_required', e.target.checked)} />
        Appointment required
      </label>
      {showDefault && (
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-teal)]" checked={!!value.is_default} onChange={e => set('is_default', e.target.checked)} />
          Suggest this location first when building a load
        </label>
      )}
      <div>
        <span className={labelCls}>Receiving hours</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DAYS.map(d => (
            <label key={d} className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span className="w-8">{DAY_LABEL[d]}</span>
              <input className={`${inputCls} !py-1.5 !text-xs`} placeholder="06:00-14:00" value={hours[d] ?? ''}
                onChange={e => {
                  const next = { ...hours, [d]: e.target.value };
                  if (!e.target.value) delete next[d];
                  set('operating_hours', Object.keys(next).length ? next : null);
                }} />
            </label>
          ))}
        </div>
      </div>
      <Field label="Instructions for drivers"><textarea rows={2} className={inputCls} value={value.site_instructions ?? ''} onChange={e => set('site_instructions', e.target.value)} placeholder="Gate, check-in, dock rules" /></Field>
      <Field label="Notes"><textarea rows={2} className={inputCls} value={value.notes ?? ''} onChange={e => set('notes', e.target.value)} /></Field>
    </div>
  );
}

export function locationValid(l: LocationInput) {
  return !!(l.name.trim() && l.address.trim() && l.city.trim() && l.zip.trim());
}

export function LocationDialog({ initial, showDefault, onSave, onClose }: {
  initial?: DirLocation | null; showDefault?: boolean;
  onSave: (v: LocationInput) => Promise<unknown>; onClose: () => void;
}) {
  const [value, setValue] = useState<LocationInput>(initial ? { ...emptyLocation(), ...initial } : emptyLocation());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title={initial ? `Edit ${initial.name}` : 'Add location'} onClose={onClose}>
      <LocationFields value={value} onChange={setValue} showDefault={showDefault} />
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!locationValid(value) || busy}
          onClick={async () => { setBusy(true); setError(null); try { await onSave(value); onClose(); } catch (e) { setError(apiError(e)); } finally { setBusy(false); } }}>
          {busy && <Loader2 size={14} className="animate-spin" />} Save location
        </button>
      </div>
    </Modal>
  );
}

// ── Contact ───────────────────────────────────────────────────────────────────

export type ContactInput = Omit<DirContact, 'id' | 'org_id' | 'user_id'>;

export function emptyContact(): ContactInput {
  return { name: '', title: '', phone: '', mobile: '', email: '', location_id: null, is_primary: false, notes: '', notify: { ...DEFAULT_NOTIFY } };
}

/** Which updates the contact gets, by event and channel */
export function NotifyGrid({ value, onChange, hasEmail, hasMobile }: { value: Notify; onChange: (v: Notify) => void; hasEmail: boolean; hasMobile: boolean }) {
  const toggle = (e: NotifyEvent, c: NotifyChannel) => {
    const cur = value[e] ?? [];
    onChange({ ...value, [e]: cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c] });
  };
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-cream-dark)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-cream)] text-xs text-[var(--color-text-muted)]">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Load update</th>
            <th className="w-20 px-3 py-2 text-center font-semibold"><span className="inline-flex items-center gap-1"><Mail size={12} /> Email</span></th>
            <th className="w-20 px-3 py-2 text-center font-semibold"><span className="inline-flex items-center gap-1"><MessageSquare size={12} /> Text</span></th>
          </tr>
        </thead>
        <tbody>
          {EVENTS.map(e => (
            <tr key={e} className="border-t border-[var(--color-cream-dark)]">
              <td className="px-3 py-2 text-[var(--color-text)]">{EVENT_LABEL[e]}</td>
              {(['email', 'sms'] as NotifyChannel[]).map(c => (
                <td key={c} className="px-3 py-2 text-center">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-teal)]" aria-label={`${EVENT_LABEL[e]} by ${c === 'sms' ? 'text' : 'email'}`}
                    checked={(value[e] ?? []).includes(c)} onChange={() => toggle(e, c)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {(!hasEmail || !hasMobile) && (
        <p className="border-t border-[var(--color-cream-dark)] bg-[var(--color-cream)] px-3 py-2 text-xs text-[var(--color-text-faint)]">
          {!hasEmail && 'Add an email address for email updates. '}{!hasMobile && 'Add a mobile number for texts.'}
        </p>
      )}
    </div>
  );
}

export function ContactFields({ value, onChange, locations }: { value: ContactInput; onChange: (v: ContactInput) => void; locations: { id: number; name: string }[] }) {
  const set = <K extends keyof ContactInput>(k: K, v: ContactInput[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name *"><input className={inputCls} value={value.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="Title"><input className={inputCls} value={value.title ?? ''} onChange={e => set('title', e.target.value)} placeholder="Warehouse manager" /></Field>
      </div>
      <Field label="Location" hint="A contact for one location gets updates only for loads to or from it.">
        <select className={inputCls} value={value.location_id ?? ''} onChange={e => set('location_id', e.target.value ? Number(e.target.value) : null)}>
          <option value="">Whole company</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Email"><input type="email" className={inputCls} value={value.email ?? ''} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Phone"><input className={inputCls} value={value.phone ?? ''} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="Mobile (texts)"><input className={inputCls} value={value.mobile ?? ''} onChange={e => set('mobile', e.target.value)} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-teal)]" checked={value.is_primary} onChange={e => set('is_primary', e.target.checked)} />
        Main contact
      </label>
      <div>
        <span className={labelCls}>Load updates</span>
        <NotifyGrid value={value.notify} onChange={v => set('notify', v)} hasEmail={!!value.email} hasMobile={!!value.mobile} />
      </div>
      <Field label="Notes"><textarea rows={2} className={inputCls} value={value.notes ?? ''} onChange={e => set('notes', e.target.value)} /></Field>
    </div>
  );
}

export function ContactDialog({ initial, locations, onSave, onClose }: {
  initial?: DirContact | null; locations: { id: number; name: string }[];
  onSave: (v: ContactInput) => Promise<unknown>; onClose: () => void;
}) {
  const [value, setValue] = useState<ContactInput>(initial ? { ...emptyContact(), ...initial } : emptyContact());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title={initial ? `Edit ${initial.name}` : 'Add contact'} onClose={onClose}>
      <ContactFields value={value} onChange={setValue} locations={locations} />
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!value.name.trim() || busy}
          onClick={async () => { setBusy(true); setError(null); try { await onSave(value); onClose(); } catch (e) { setError(apiError(e)); } finally { setBusy(false); } }}>
          {busy && <Loader2 size={14} className="animate-spin" />} Save contact
        </button>
      </div>
    </Modal>
  );
}

/** Short summary of a contact's updates: "Email: booked, done · Text: on the way" */
export function notifySummary(n: Notify): string {
  const by = (c: NotifyChannel) => EVENTS.filter(e => (n[e] ?? []).includes(c)).map(e => EVENT_LABEL[e].toLowerCase());
  const parts = [['Email', by('email')], ['Text', by('sms')]].filter(([, l]) => (l as string[]).length)
    .map(([k, l]) => `${k}: ${(l as string[]).join(', ')}`);
  return parts.length ? parts.join(' · ') : 'No load updates';
}
