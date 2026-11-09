'use client';

/**
 * One organization from the directory: its details, locations and contacts (with their load updates).
 * Editing follows the API (can_edit): a company's own people, and while it is only listed, the companies that keep it.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2, MapPin, Users, Pencil, Trash2, Plus, Phone, Mail, Globe, Lock, Star, CalendarClock, DoorOpen, Loader2, Info,
} from 'lucide-react';
import { directoryApi } from '@/lib/api';
import type { DirContact, DirLocation, DirOrg } from '@/types/directory';
import { ORG_TYPE_LABEL } from '@/types/directory';
import {
  ContactDialog, LocationDialog, Modal, Field, inputCls, apiError, notifySummary,
} from './DirectoryForms';

export function OrgTypeBadge({ type, listed }: { type: string; listed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="badge badge-primary">{ORG_TYPE_LABEL[type as keyof typeof ORG_TYPE_LABEL] ?? type}</span>
      {listed && <span className="badge badge-muted">Listed · not on Shipmater yet</span>}
    </span>
  );
}

export function OrgProfile({ orgId, readOnly, sections = ['details', 'locations', 'contacts'], headerActions, title, subtitle, hideHeader }: {
  orgId: number;
  /** Inside a page that already shows the company (admin) */
  hideHeader?: boolean;
  /** Page title instead of the company name (e.g. "Locations" on your own company) */
  title?: string;
  subtitle?: string;
  readOnly?: boolean;
  sections?: ('details' | 'locations' | 'contacts')[];
  headerActions?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const key = ['directory-org', orgId];
  const { data: org, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => directoryApi.get(orgId).then(r => r.data.data as DirOrg),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['partners'] }); qc.invalidateQueries({ queryKey: ['locations'] }); };

  const [editDetails, setEditDetails] = useState(false);
  const [locDialog, setLocDialog] = useState<DirLocation | 'new' | null>(null);
  const [contactDialog, setContactDialog] = useState<DirContact | 'new' | null>(null);

  if (isLoading) return <div className="space-y-4">{[0, 1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-[var(--color-cream)] animate-pulse" />)}</div>;
  if (isError || !org) return <p className="text-sm text-[var(--color-text-muted)]">This company couldn&apos;t be loaded.</p>;

  const canEdit = org.can_edit && !readOnly;
  const locName = (id: number | null) => (id ? org.locations.find(l => l.id === id)?.name ?? 'A location' : 'Whole company');

  const removeLocation = async (l: DirLocation) => {
    if (!confirm(`Remove ${l.name}?`)) return;
    try { await directoryApi.removeLocation(l.id); toast.success('Location removed.'); refresh(); } catch (e) { toast.error(apiError(e)); }
  };
  const removeContact = async (c: DirContact) => {
    if (!confirm(`Remove ${c.name}?`)) return;
    try { await directoryApi.removeContact(c.id); toast.success('Contact removed.'); refresh(); } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      {!hideHeader && <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{title ?? org.name}</h1>
            {!title && <OrgTypeBadge type={org.type} listed={org.listed} />}
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {subtitle ?? <>
              {[org.city, org.state].filter(Boolean).join(', ') || 'No address yet'}
              {org.listed && org.listed_by && <> · Listed by {org.listed_by}</>}
            </>}
          </p>
        </div>
        <div className="flex gap-2">{headerActions}</div>
      </div>}

      {org.listed && canEdit && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-cream)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
          <Info size={15} className="mt-0.5 shrink-0 text-[var(--color-teal)]" />
          Nobody from {org.name} has signed up yet, so companies that use it keep its details up to date. When someone from {org.name} signs up and claims it, only they can change it.
        </div>
      )}

      {/* Details */}
      {sections.includes('details') && (
        <section className="card card-body">
          <div className="mb-3 flex items-center justify-between">
            <p className="overline flex items-center gap-2"><Building2 size={14} /> Company</p>
            {canEdit && <button className="btn btn-ghost btn-sm" onClick={() => setEditDetails(true)}><Pencil size={13} /> Edit</button>}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-base sm:grid-cols-2">
            <Detail icon={Phone} label="Phone" value={org.phone} />
            <Detail icon={Mail} label="Email" value={org.email} />
            <Detail icon={Globe} label="Website" value={org.website} />
            <Detail icon={MapPin} label="Address" value={[org.street, org.city, org.state, org.zip].filter(Boolean).join(', ') || null} />
          </dl>
        </section>
      )}

      {/* Locations */}
      {sections.includes('locations') && (
        <section className="card card-body">
          <div className="mb-3 flex items-center justify-between">
            <p className="overline flex items-center gap-2"><MapPin size={14} /> Locations ({org.locations.length})</p>
            {canEdit && <button className="btn btn-outline btn-sm" onClick={() => setLocDialog('new')}><Plus size={13} /> Add location</button>}
          </div>
          {org.locations.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No locations yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-cream-dark)]">
              {org.locations.map(l => (
                <li key={l.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-base font-medium text-[var(--color-text)]">
                      {l.name}
                      {l.visibility === 'private' && <span className="badge badge-muted inline-flex items-center gap-1"><Lock size={10} /> Private</span>}
                      {l.is_default && <span className="badge badge-info">Suggested first</span>}
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)]">{l.address}{l.address.includes(l.city) ? '' : `, ${l.city}${l.state ? `, ${l.state}` : ''} ${l.zip}`}</p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--color-text-faint)]">
                      {l.dock_doors != null && <span className="inline-flex items-center gap-1"><DoorOpen size={11} /> {l.dock_doors} dock door{l.dock_doors === 1 ? '' : 's'}</span>}
                      {l.appointment_required && <span className="inline-flex items-center gap-1"><CalendarClock size={11} /> Appointment required</span>}
                      {l.operating_hours && Object.keys(l.operating_hours).length > 0 && <span>Hours: {hoursSummary(l.operating_hours)}</span>}
                    </p>
                    {l.site_instructions && <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{l.site_instructions}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <button className="btn btn-ghost btn-sm" aria-label={`Edit ${l.name}`} onClick={() => setLocDialog(l)}><Pencil size={13} /></button>
                      <button className="btn btn-ghost btn-sm" aria-label={`Remove ${l.name}`} onClick={() => removeLocation(l)}><Trash2 size={13} /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Contacts */}
      {sections.includes('contacts') && (
        <section className="card card-body">
          <div className="mb-3 flex items-center justify-between">
            <p className="overline flex items-center gap-2"><Users size={14} /> Contacts{org.contacts ? ` (${org.contacts.length})` : ''}</p>
            {canEdit && org.contacts && <button className="btn btn-outline btn-sm" onClick={() => setContactDialog('new')}><Plus size={13} /> Add contact</button>}
          </div>
          {org.contacts === null ? (
            <p className="text-sm text-[var(--color-text-muted)]">Add {org.name} to your list to see its contacts.</p>
          ) : org.contacts.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No contacts yet. Add the people who receive freight, such as the warehouse manager, and choose the load updates they get.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-cream-dark)]">
              {org.contacts.map(c => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-base font-medium text-[var(--color-text)]">
                      {c.name}
                      {c.is_primary && <span className="badge badge-success inline-flex items-center gap-1"><Star size={10} /> Main</span>}
                      {c.title && <span className="font-normal text-[var(--color-text-muted)]">· {c.title}</span>}
                    </p>
                    <p className="text-[13px] text-[var(--color-text-faint)]">{locName(c.location_id)}</p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)]">
                      {c.email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {c.email}</span>}
                      {c.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {c.phone}</span>}
                      {c.mobile && <span className="inline-flex items-center gap-1"><Phone size={12} /> {c.mobile} (mobile)</span>}
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--color-text-faint)]">{notifySummary(c.notify)}</p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <button className="btn btn-ghost btn-sm" aria-label={`Edit ${c.name}`} onClick={() => setContactDialog(c)}><Pencil size={13} /></button>
                      <button className="btn btn-ghost btn-sm" aria-label={`Remove ${c.name}`} onClick={() => removeContact(c)}><Trash2 size={13} /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editDetails && <DetailsDialog org={org} onClose={() => setEditDetails(false)} onSaved={refresh} />}
      {locDialog && (
        <LocationDialog
          initial={locDialog === 'new' ? null : locDialog}
          showDefault={org.is_mine}
          onClose={() => setLocDialog(null)}
          onSave={async v => {
            if (locDialog === 'new') await directoryApi.addLocation(org.id, v as Record<string, unknown>);
            else await directoryApi.updateLocation(locDialog.id, v as Record<string, unknown>);
            toast.success('Location saved.'); refresh();
          }}
        />
      )}
      {contactDialog && (
        <ContactDialog
          initial={contactDialog === 'new' ? null : contactDialog}
          locations={org.locations}
          onClose={() => setContactDialog(null)}
          onSave={async v => {
            if (contactDialog === 'new') await directoryApi.addContact(org.id, v as Record<string, unknown>);
            else await directoryApi.updateContact(contactDialog.id, v as Record<string, unknown>);
            toast.success('Contact saved.'); refresh();
          }}
        />
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="mt-0.5 shrink-0 text-[var(--color-text-faint)]" />
      <div><dt className="text-[13px] text-[var(--color-text-faint)]">{label}</dt><dd className="text-[var(--color-text)]">{value || '—'}</dd></div>
    </div>
  );
}

function hoursSummary(h: Record<string, string>) {
  const days = Object.keys(h);
  const same = days.every(d => h[d] === h[days[0]]);
  return same ? `${days.map(d => d[0].toUpperCase() + d.slice(1)).join(', ')} ${h[days[0]]}` : `${days.length} days set`;
}

function DetailsDialog({ org, onClose, onSaved }: { org: DirOrg; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ name: org.name, phone: org.phone ?? '', email: org.email ?? '', website: org.website ?? '',
    street: org.street ?? '', city: org.city ?? '', state: org.state ?? '', zip: org.zip ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <Modal title={`Edit ${org.name}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Company name *"><input className={inputCls} value={v.name} onChange={set('name')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input className={inputCls} value={v.phone} onChange={set('phone')} /></Field>
          <Field label="Email"><input type="email" className={inputCls} value={v.email} onChange={set('email')} /></Field>
        </div>
        <Field label="Website"><input className={inputCls} value={v.website} onChange={set('website')} /></Field>
        <Field label="Street"><input className={inputCls} value={v.street} onChange={set('street')} /></Field>
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3"><Field label="City"><input className={inputCls} value={v.city} onChange={set('city')} /></Field></div>
          <div className="col-span-1"><Field label="State"><input className={inputCls} value={v.state} onChange={set('state')} /></Field></div>
          <div className="col-span-2"><Field label="ZIP"><input className={inputCls} value={v.zip} onChange={set('zip')} /></Field></div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!v.name.trim() || busy} onClick={async () => {
          setBusy(true);
          try { await directoryApi.update(org.id, v); toast.success('Saved.'); onSaved(); onClose(); }
          catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
        }}>{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
      </div>
    </Modal>
  );
}
