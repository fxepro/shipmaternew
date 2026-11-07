'use client';

/**
 * Add a receiver (or broker) to your list: search the directory first, and if it isn't there, list it with its
 * first location and contact. Listing the same company twice is refused by the API (already_listed).
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Plus, Check, Loader2, MapPin, ArrowLeft } from 'lucide-react';
import { directoryApi, partnerApi } from '@/lib/api';
import type { DirOrgSummary } from '@/types/directory';
import {
  Modal, Field, inputCls, apiError, LocationFields, emptyLocation, locationValid, ContactFields, emptyContact,
  type LocationInput, type ContactInput,
} from './DirectoryForms';
import { OrgTypeBadge } from './OrgProfile';

export function AddOrgDialog({ relation = 'receiver', onClose, onAdded }: {
  relation?: 'receiver' | 'broker';
  onClose: () => void;
  onAdded: (orgId: number) => void;
}) {
  const noun = relation === 'broker' ? 'broker' : 'receiver';
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  // Receivers can be any company that takes deliveries; brokers are brokers
  const { data: results = [], isFetching } = useQuery({
    queryKey: ['directory-search', relation, debounced],
    queryFn: () => directoryApi.search({ q: debounced, type: relation === 'broker' ? 'broker' : 'all', limit: 15 }).then(r => r.data.data as DirOrgSummary[]),
    enabled: debounced.length >= 2,
  });

  const add = async (o: DirOrgSummary) => {
    setAdding(o.id);
    try { await partnerApi.add(o.id, relation); toast.success(`${o.name} added to your ${noun}s.`); onAdded(o.id); onClose(); }
    catch (e) { toast.error(apiError(e)); } finally { setAdding(null); }
  };

  if (mode === 'create') return <CreateOrg relation={relation} initialName={q} onBack={() => setMode('search')} onClose={onClose} onAdded={onAdded} />;

  return (
    <Modal title={`Add a ${noun}`} onClose={onClose} wide>
      <p className="mb-3 text-sm text-[var(--color-text-muted)]">
        Search the Shipmater directory by company, location or city. Companies other shippers have already added are here too.
      </p>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
        <input autoFocus className={`${inputCls} pl-9`} placeholder="e.g. King Soopers, Sprouts, Boulder" value={q} onChange={e => setQ(e.target.value)} />
        {isFetching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-text-faint)]" />}
      </div>

      <div className="mt-4 max-h-[50vh] overflow-y-auto">
        {debounced.length < 2 ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-faint)]">Type at least two letters.</p>
        ) : results.length === 0 && !isFetching ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">Nothing matches &ldquo;{debounced}&rdquo;.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-cream-dark)]">
            {results.filter(o => !o.is_mine).map(o => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-text)]">{o.name} <OrgTypeBadge type={o.type} listed={o.listed} /></p>
                  <p className="text-xs text-[var(--color-text-faint)]">
                    <MapPin size={10} className="mr-1 inline" />
                    {[o.city, o.state].filter(Boolean).join(', ') || 'No address'} · {o.locations_count} location{o.locations_count === 1 ? '' : 's'}
                  </p>
                </div>
                {o.is_partner ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)]"><Check size={13} /> In your list</span>
                ) : (
                  <button className="btn btn-outline btn-sm" disabled={adding === o.id} onClick={() => add(o)}>
                    {adding === o.id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Add
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-cream-dark)] pt-4">
        <p className="text-sm text-[var(--color-text-muted)]">Not in the directory?</p>
        <button className="btn btn-primary btn-sm" onClick={() => setMode('create')}><Plus size={13} /> Add a new {noun}</button>
      </div>
    </Modal>
  );
}

function CreateOrg({ relation, initialName, onBack, onClose, onAdded }: {
  relation: 'receiver' | 'broker'; initialName: string; onBack: () => void; onClose: () => void; onAdded: (id: number) => void;
}) {
  const noun = relation === 'broker' ? 'broker' : 'receiver';
  const [org, setOrg] = useState({ name: initialName, phone: '', email: '', website: '', city: '', state: '' });
  const [withLocation, setWithLocation] = useState(relation === 'receiver');
  const [loc, setLoc] = useState<LocationInput>(emptyLocation());
  const [withContact, setWithContact] = useState(true);
  const [contact, setContact] = useState<ContactInput>(emptyContact());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<DirOrgSummary | null>(null);
  const set = (k: keyof typeof org) => (e: React.ChangeEvent<HTMLInputElement>) => setOrg({ ...org, [k]: e.target.value });

  const valid = org.name.trim() && (!withLocation || locationValid(loc)) && (!withContact || contact.name.trim());

  const save = async () => {
    setBusy(true); setError(null); setExisting(null);
    try {
      const res = await directoryApi.create({
        type: relation, ...org,
        city: org.city || (withLocation ? loc.city : ''), state: org.state || (withLocation ? loc.state : ''),
        locations: withLocation ? [loc] : [],
        contacts: withContact ? [{ ...contact, location_id: undefined, location_index: withLocation && contact.location_id === -1 ? 0 : undefined }] : [],
      });
      toast.success(`${org.name} listed and added to your ${noun}s.`);
      onAdded(res.data.data.id); onClose();
    } catch (e) {
      const d = (e as { response?: { status?: number; data?: { code?: string; org?: DirOrgSummary } } }).response;
      if (d?.status === 409 && d.data?.org) setExisting(d.data.org);
      setError(apiError(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`Add a new ${noun}`} onClose={onClose} wide>
      <button className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]" onClick={onBack}><ArrowLeft size={14} /> Back to search</button>
      <p className="mb-4 text-sm text-[var(--color-text-muted)]">
        This adds the company to the Shipmater directory so you and other shippers can deliver to it. If someone from it signs up later, they can claim it.
      </p>

      <div className="space-y-4">
        <Field label="Company name *"><input className={inputCls} value={org.name} onChange={set('name')} placeholder="e.g. King Soopers (Kroger)" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Main phone"><input className={inputCls} value={org.phone} onChange={set('phone')} /></Field>
          <Field label="Main email"><input type="email" className={inputCls} value={org.email} onChange={set('email')} /></Field>
        </div>

        <label className="flex items-center gap-2 pt-2 text-sm font-semibold text-[var(--color-text)]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-teal)]" checked={withLocation} onChange={e => setWithLocation(e.target.checked)} />
          Add its first location
        </label>
        {withLocation && <div className="rounded-xl border border-[var(--color-cream-dark)] p-4"><LocationFields value={loc} onChange={setLoc} /></div>}

        <label className="flex items-center gap-2 pt-2 text-sm font-semibold text-[var(--color-text)]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-teal)]" checked={withContact} onChange={e => setWithContact(e.target.checked)} />
          Add a contact, such as the warehouse manager
        </label>
        {withContact && (
          <div className="rounded-xl border border-[var(--color-cream-dark)] p-4">
            {/* -1 stands for the location being added in this form */}
            <ContactFields value={contact} onChange={setContact} locations={withLocation && loc.name ? [{ id: -1, name: loc.name }] : []} />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          {existing && !existing.is_partner && (
            <button className="btn btn-outline btn-sm ml-3" onClick={async () => {
              try { await partnerApi.add(existing.id, relation); toast.success(`${existing.name} added to your ${noun}s.`); onAdded(existing.id); onClose(); }
              catch (e) { toast.error(apiError(e)); }
            }}><Plus size={13} /> Add {existing.name}</button>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!valid || busy} onClick={save}>{busy && <Loader2 size={14} className="animate-spin" />} Add {noun}</button>
      </div>
    </Modal>
  );
}
