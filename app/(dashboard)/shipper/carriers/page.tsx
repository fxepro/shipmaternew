'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { preferredCarrierApi, carrierApi, api, serviceTypeApi } from '@/lib/api';
import { ShipperCarrierChecks } from '@/components/background/ShipperCarrierChecks';
import {
  Truck, Star, Search, Hash, Plus, X, Shield,
  CheckCircle2, Clock, Package, ChevronRight, Trash2,
  Phone, Mail, Loader2, ChevronDown,
  Users, Building2, MapPin, Navigation,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Carrier {
  id: number;
  name: string;
  email: string;
  company_name: string;
  dot_number: string;
  mc_number: string;
  phone: string;
  carrier_type: string;
  verification_status: string;
  dot_verified: boolean;
  insurance_verified: boolean;
  hazmat_endorsement: boolean;
  tanker_endorsement: boolean;
  passenger_endorsement: boolean;
  rating: number;
  total_deliveries: number;
  member_since: string;
  avatar: string;
  service_types?: { key: string; name: string; icon: string }[];
  city?: string;
  state?: string;
  zip?: string;
  // preferred network extras
  carrierId?: number;
  completedTogether?: number;
  status?: 'active' | 'pending' | 'inactive';
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={11}
          className={i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-[var(--color-cream-dark)]'} />
      ))}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      <Shield size={10} /> Verified
    </span>
  );
}

function EndorsementTag({ label }: { label: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-[var(--color-teal-pale)] text-[var(--color-teal)] text-xs font-medium">
      {label}
    </span>
  );
}

// ── Carrier Drawer ─────────────────────────────────────────────────────────────

function CarrierDrawer({ carrier, onClose, showAddToNetwork }: {
  carrier: Carrier;
  onClose: () => void;
  showAddToNetwork?: boolean;
}) {
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: () => preferredCarrierApi.add({ dot_number: carrier.dot_number }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preferred-carriers'] });
      onClose();
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => preferredCarrierApi.remove(carrier.carrierId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preferred-carriers'] });
      onClose();
    },
  });

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-1/2 min-w-[520px] bg-[var(--color-cream)] shadow-2xl flex flex-col overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-cream-dark)] bg-[var(--color-white)]">
          <p className="text-base font-semibold text-[var(--color-text)]">Carrier profile</p>
          <button onClick={onClose} className="rounded-lg p-2 text-[var(--color-text-faint)] hover:bg-[var(--color-cream)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Identity */}
        <div className="p-6 border-b border-[var(--color-cream-dark)] bg-[var(--color-white)]">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-slate)] text-xl font-bold text-white">
              {carrier.avatar}
            </div>
            <div className="flex-1">
              <p className="text-xl font-bold text-[var(--color-text)]">{carrier.name}</p>
              {carrier.company_name && <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{carrier.company_name}</p>}
              <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
                {carrier.carrier_type === 'sole_proprietor' ? 'Owner-Operator' : 'Freight Company'} · Member since {carrier.member_since}
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Stars rating={carrier.rating} />
                <span className="text-xs text-[var(--color-text-faint)]">{carrier.rating.toFixed(1)} · {carrier.total_deliveries} deliveries</span>
                {carrier.verification_status === 'verified' && <VerifiedBadge />}
              </div>
            </div>
          </div>

          {/* Endorsements */}
          <div className="mt-4 flex gap-2 flex-wrap">
            {carrier.hazmat_endorsement    && <EndorsementTag label="HazMat" />}
            {carrier.tanker_endorsement    && <EndorsementTag label="Tanker" />}
            {carrier.passenger_endorsement && <EndorsementTag label="Passenger" />}
            {carrier.insurance_verified    && <EndorsementTag label="Insured" />}
            {carrier.dot_verified          && <EndorsementTag label="DOT Verified" />}
          </div>
        </div>

        {/* DOT / MC */}
        <div className="p-6 border-b border-[var(--color-cream-dark)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-3">Authority</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[var(--color-text-faint)]">DOT Number</p>
              <p className="font-mono text-sm font-medium text-[var(--color-text)]">{carrier.dot_number || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-faint)]">MC Number</p>
              <p className="font-mono text-sm font-medium text-[var(--color-text)]">{carrier.mc_number || '—'}</p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="p-6 border-b border-[var(--color-cream-dark)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-3">Contact</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Mail size={13} className="text-[var(--color-teal)]" />
              <span className="text-sm text-[var(--color-text)]">{carrier.email}</span>
            </div>
            {carrier.phone && (
              <div className="flex items-center gap-2">
                <Phone size={13} className="text-[var(--color-teal)]" />
                <span className="text-sm text-[var(--color-text)]">{carrier.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Background check levels: shared with shippers that have an active contract */}
        <ShipperCarrierChecks carrierUserId={carrier.carrierId ?? carrier.id} />

        {/* Stats */}
        <div className="p-6 border-b border-[var(--color-cream-dark)]">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[var(--color-cream)] p-4 text-center">
              <p className="text-2xl font-bold text-[var(--color-slate)]">{carrier.total_deliveries}</p>
              <p className="text-xs text-[var(--color-text-faint)] mt-1">Platform deliveries</p>
            </div>
            <div className="rounded-xl bg-[var(--color-cream)] p-4 text-center">
              <p className="text-2xl font-bold text-[var(--color-slate)]">{carrier.rating.toFixed(1)}</p>
              <p className="text-xs text-[var(--color-text-faint)] mt-1">Average rating</p>
            </div>
            {carrier.completedTogether !== undefined && (
              <div className="col-span-2 rounded-xl bg-[var(--color-teal-pale)] p-4 text-center">
                <p className="text-2xl font-bold text-[var(--color-teal)]">{carrier.completedTogether}</p>
                <p className="text-xs text-[var(--color-teal)] mt-1">Shipments with your business</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 space-y-2 mt-auto">
          <button className="w-full rounded-xl bg-[var(--color-teal)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-light)] transition-colors">
            Assign to shipment
          </button>
          <button className="w-full rounded-xl border border-[var(--color-cream-dark)] py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors">
            Create contract
          </button>
          {showAddToNetwork && (
            <button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending}
              className="w-full rounded-xl border border-[var(--color-teal)] py-2.5 text-sm font-semibold text-[var(--color-teal)] hover:bg-[var(--color-teal-pale)] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add to my network
            </button>
          )}
          {!showAddToNetwork && carrier.carrierId && (
            <button
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {removeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Remove from network
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Carrier Row ────────────────────────────────────────────────────────────────

function CarrierRow({ carrier, onClick }: { carrier: Carrier; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="border-b border-[var(--color-cream-dark)] last:border-0 hover:bg-[var(--color-cream)] transition-colors cursor-pointer"
    >
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-slate)] text-xs font-bold text-white">
            {carrier.avatar}
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text)]">{carrier.name}</p>
            <p className="text-xs text-[var(--color-text-faint)]">
              {carrier.company_name || (carrier.carrier_type === 'sole_proprietor' ? 'Owner-Operator' : 'Company')}
            </p>
          </div>
          {carrier.verification_status === 'verified' && (
            <span title="Verified"><Shield size={13} className="text-emerald-500 shrink-0" /></span>
          )}
        </div>
      </td>
      <td className="px-4 py-4">
        <p className="font-mono text-xs text-[var(--color-text)]">{carrier.dot_number || '—'}</p>
        <p className="font-mono text-xs text-[var(--color-text-faint)]">{carrier.mc_number || '—'}</p>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col gap-1">
          <Stars rating={carrier.rating} />
          <span className="text-xs text-[var(--color-text-faint)]">{carrier.rating.toFixed(1)}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-1.5">
          <Package size={12} className="text-[var(--color-teal)]" />
          <span className="text-sm font-semibold text-[var(--color-text)]">{carrier.total_deliveries}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex gap-1 flex-wrap">
          {carrier.service_types && carrier.service_types.length > 0
            ? carrier.service_types.slice(0, 3).map(t => (
                <span key={t.key} title={t.name}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-cream)] text-[var(--color-text-muted)] text-xs">
                  {t.icon} {t.name}
                </span>
              ))
            : (
              <>
                {carrier.hazmat_endorsement    && <EndorsementTag label="HazMat" />}
                {carrier.tanker_endorsement    && <EndorsementTag label="Tanker" />}
                {carrier.passenger_endorsement && <EndorsementTag label="Passenger" />}
                {!carrier.hazmat_endorsement && !carrier.tanker_endorsement && !carrier.passenger_endorsement && (
                  <span className="text-xs text-[var(--color-text-faint)]">—</span>
                )}
              </>
            )
          }
        </div>
      </td>
      <td className="px-4 py-4">
        <button onClick={e => { e.stopPropagation(); onClick(); }}
          className="rounded-lg border border-[var(--color-cream-dark)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors flex items-center gap-1">
          View <ChevronRight size={11} />
        </button>
      </td>
    </tr>
  );
}

function CarrierTable({ carriers, onSelect, isLoading, emptyMessage }: {
  carriers: Carrier[];
  onSelect: (c: Carrier) => void;
  isLoading: boolean;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] overflow-hidden">
      {isLoading ? (
        <div className="divide-y divide-[var(--color-cream-dark)]">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
              <div className="h-9 w-9 rounded-xl bg-[var(--color-cream-dark)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 rounded bg-[var(--color-cream-dark)]" />
                <div className="h-3 w-28 rounded bg-[var(--color-cream)]" />
              </div>
            </div>
          ))}
        </div>
      ) : carriers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Truck size={32} className="text-[var(--color-cream-dark)] mb-3" />
          <p className="text-sm font-medium text-[var(--color-text-muted)]">{emptyMessage}</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]">
              {['Carrier', 'DOT / MC', 'Rating', 'Deliveries', 'Endorsements', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)] first:px-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carriers.map(c => (
              <CarrierRow key={c.id} carrier={c} onClick={() => onSelect(c)} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Carrier Card (rich) ────────────────────────────────────────────────────────

function CarrierCard({ carrier, onClick }: { carrier: Carrier; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-2xl p-5 cursor-pointer hover:border-[var(--color-teal)]/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-xl bg-[var(--color-slate)] flex items-center justify-center text-sm font-bold text-white shrink-0">
          {carrier.avatar}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + verified */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[var(--color-text)]">{carrier.name}</p>
            {carrier.verification_status === 'verified' && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <Shield size={10} /> Verified
              </span>
            )}
          </div>

          {/* Company + location */}
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {carrier.company_name || 'Owner-Operator'}
          </p>
          {(carrier.city || carrier.state) && (
            <p className="text-xs text-[var(--color-text-faint)] flex items-center gap-1 mt-0.5">
              <MapPin size={10} />
              {[carrier.city, carrier.state].filter(Boolean).join(', ')}
            </p>
          )}

          {/* Rating + deliveries */}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={11} className={i <= Math.round(carrier.rating) ? 'text-amber-400 fill-amber-400' : 'text-[var(--color-cream-dark)]'} />
              ))}
              <span className="text-xs text-[var(--color-text-faint)] ml-0.5">{carrier.rating.toFixed(1)}</span>
            </span>
            <span className="text-xs text-[var(--color-text-faint)]">
              {carrier.total_deliveries} deliveries
            </span>
            <span className="text-xs text-[var(--color-text-faint)]">
              Since {carrier.member_since}
            </span>
          </div>

          {/* Service type badges */}
          {carrier.service_types && carrier.service_types.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {carrier.service_types.map(t => (
                <span key={t.key}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--color-cream)] text-[var(--color-text-muted)] text-xs font-medium">
                  {t.icon} {t.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <ChevronRight size={16} className="text-[var(--color-text-faint)] shrink-0 mt-1" />
      </div>
    </div>
  );
}

// ── Find Carriers tab ──────────────────────────────────────────────────────────

function FindCarriersTab({ onSelect }: { onSelect: (c: Carrier) => void }) {
  const [zip, setZip]               = useState('');
  const [distance, setDistance]     = useState('100');
  const [verified, setVerified]     = useState(false);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [openCats, setOpenCats]     = useState<Record<string, boolean>>({});

  // Load service categories for the hierarchical selector
  const { data: categories = [] } = useQuery({
    queryKey: ['service-types'],
    queryFn: () => serviceTypeApi.list().then(r => r.data.data),
  });

  const params: Record<string, any> = {
    sort: 'rating',
    ...(zip                    && { zip, distance_miles: distance }),
    ...(verified               && { verified: 1 }),
    ...(serviceTypes.length > 0 && { service_types: serviceTypes }),
  };

  const { data: res, isLoading } = useQuery({
    queryKey: ['carriers-search', params],
    queryFn:  () => api.get('/api/v1/carriers', { params }).then(r => r.data.data as Carrier[]),
  });

  const carriers = res ?? [];

  // Toggle a service type (sub-service key)
  function toggleServiceType(key: string) {
    setServiceTypes(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);
  }

  // Toggle all children of a category
  function toggleCategory(cat: any) {
    const keys = cat.children.map((c: any) => c.key);
    const allSelected = keys.every((k: string) => serviceTypes.includes(k));
    if (allSelected) {
      setServiceTypes(p => p.filter(k => !keys.includes(k)));
    } else {
      setServiceTypes(p => [...new Set([...p, ...keys])]);
    }
  }

  function categoryState(cat: any) {
    const keys = cat.children.map((c: any) => c.key);
    const count = keys.filter((k: string) => serviceTypes.includes(k)).length;
    if (count === 0)          return 'none';
    if (count === keys.length) return 'all';
    return 'partial';
  }

  return (
    <div className="flex gap-6 items-start">

      {/* ── Left: Filters (always visible) ──────────────────────────── */}
      <div className="w-72 shrink-0 space-y-5 sticky top-6">

        {/* Location */}
        <div className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Navigation size={14} className="text-[var(--color-teal)]" />
            <p className="text-sm font-semibold text-[var(--color-text)]">Location</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-muted)] mb-1.5">ZIP Code</p>
            <input
              type="text"
              value={zip}
              onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="e.g. 90210"
              maxLength={5}
              className="w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3.5 py-2.5 text-sm focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20"
            />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-muted)] mb-1.5">Radius</p>
            <div className="relative">
              <select
                value={distance}
                onChange={e => setDistance(e.target.value)}
                className="w-full appearance-none rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] pl-3.5 pr-8 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none"
              >
                <option value="25">Within 25 miles</option>
                <option value="50">Within 50 miles</option>
                <option value="100">Within 100 miles</option>
                <option value="250">Within 250 miles</option>
                <option value="500">Within 500 miles</option>
                <option value="">Any distance</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            </div>
          </div>
        </div>

        {/* Verified */}
        <div className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-2xl p-5">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-[var(--color-teal)]" />
              <span className="text-sm font-semibold text-[var(--color-text)]">Verified only</span>
            </div>
            <button
              role="switch"
              aria-checked={verified}
              onClick={() => setVerified(p => !p)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                verified ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-cream-dark)]'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${verified ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
          <p className="text-xs text-[var(--color-text-faint)] mt-2 ml-6">Only show carriers who have completed platform verification.</p>
        </div>

        {/* Service types */}
        <div className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-[var(--color-teal)]" />
              <p className="text-sm font-semibold text-[var(--color-text)]">Services</p>
            </div>
            {serviceTypes.length > 0 && (
              <button onClick={() => setServiceTypes([])} className="text-xs text-[var(--color-teal)] hover:underline">
                Clear
              </button>
            )}
          </div>
          {serviceTypes.length > 0 && (
            <p className="text-xs text-[var(--color-teal)] font-medium">{serviceTypes.length} selected</p>
          )}

          <div className="space-y-1">
            {(categories as any[]).map((cat: any) => {
              const state = categoryState(cat);
              const isOpen = !!openCats[cat.key];
              return (
                <div key={cat.key} className={`rounded-xl border transition-colors ${state !== 'none' ? 'border-[var(--color-teal)]/30 bg-[var(--color-teal)]/[0.02]' : 'border-transparent'}`}>
                  {/* Category row */}
                  <div className="flex items-center gap-2 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={state === 'all'}
                      ref={el => { if (el) el.indeterminate = state === 'partial'; }}
                      onChange={() => toggleCategory(cat)}
                      className="w-4 h-4 rounded accent-[var(--color-teal)] shrink-0 cursor-pointer"
                    />
                    <button type="button" onClick={() => setOpenCats(p => ({ ...p, [cat.key]: !p[cat.key] }))} className="flex items-center gap-2 flex-1 text-left min-w-0">
                      <span className="text-base leading-none">{cat.icon}</span>
                      <span className="text-sm font-medium text-[var(--color-text)] truncate">{cat.name}</span>
                      {state === 'partial' && (
                        <span className="text-xs text-[var(--color-teal)] shrink-0">
                          ({cat.children.filter((c: any) => serviceTypes.includes(c.key)).length}/{cat.children.length})
                        </span>
                      )}
                      <svg className={`ml-auto h-3.5 w-3.5 shrink-0 text-[var(--color-text-faint)] transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {/* Sub-services */}
                  {isOpen && (
                    <div className="pl-8 pr-2 pb-2 space-y-1.5">
                      {cat.children.map((child: any) => (
                        <label key={child.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={serviceTypes.includes(child.key)}
                            onChange={() => toggleServiceType(child.key)}
                            className="w-3.5 h-3.5 rounded accent-[var(--color-teal)] cursor-pointer shrink-0"
                          />
                          <span className="text-xs text-[var(--color-text-muted)]">{child.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Right: Results ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Results header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-text-muted)]">
            {isLoading ? 'Searching…' : `${carriers.length} carrier${carriers.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-2xl p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--color-cream-dark)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded bg-[var(--color-cream-dark)]" />
                    <div className="h-3 w-28 rounded bg-[var(--color-cream)]" />
                    <div className="h-3 w-56 rounded bg-[var(--color-cream)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && carriers.length === 0 && (
          <div className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-2xl p-12 text-center">
            <Truck size={32} className="mx-auto text-[var(--color-cream-dark)] mb-3" />
            <p className="text-sm font-semibold text-[var(--color-text)]">No carriers found</p>
            <p className="text-xs text-[var(--color-text-faint)] mt-1">Try broadening your location radius or adjusting your service filters.</p>
          </div>
        )}

        {/* Carrier cards */}
        {!isLoading && carriers.map(c => (
          <CarrierCard key={c.id} carrier={c} onClick={() => onSelect(c)} />
        ))}
      </div>
    </div>
  );
}

// ── My Network tab ─────────────────────────────────────────────────────────────

function MyNetworkTab({ onSelect, onAddCarrier }: {
  onSelect: (c: Carrier) => void;
  onAddCarrier: () => void;
}) {
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data: carriers = [], isLoading } = useQuery<Carrier[]>({
    queryKey: ['preferred-carriers'],
    queryFn: () => preferredCarrierApi.list().then(r =>
      (r.data.data as any[]).map((row: any) => ({
        id:                  row.id,
        carrierId:           row.carrier_id,
        name:                row.name ?? '',
        email:               row.email ?? '',
        company_name:        row.company ?? '',
        dot_number:          row.dot ?? '',
        mc_number:           row.mc ?? '',
        phone:               row.phone ?? '',
        carrier_type:        'sole_proprietor',
        verification_status: row.insurance_verified ? 'verified' : 'incomplete',
        dot_verified:        false,
        insurance_verified:  row.insurance_verified ?? false,
        hazmat_endorsement:  false,
        tanker_endorsement:  false,
        passenger_endorsement: false,
        rating:              row.rating ?? 0,
        total_deliveries:    row.reviews ?? 0,
        completedTogether:   row.completed_together ?? 0,
        member_since:        row.joined_date ?? '',
        status:              row.status ?? 'active',
        avatar:              row.avatar ?? '',
      }))
    ),
  });

  const stats = {
    total:    carriers.length,
    verified: carriers.filter(c => c.insurance_verified).length,
  };

  const filtered = carriers.filter(c =>
    [c.name, c.company_name, c.dot_number].some(f =>
      f.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total carriers',     value: stats.total,    icon: Truck,        color: 'text-[var(--color-teal)]', bg: 'bg-[var(--color-teal-pale)]' },
          { label: 'Insurance verified', value: stats.verified, icon: Shield,       color: 'text-emerald-600',         bg: 'bg-emerald-50'               },
          { label: 'Shipments together', value: carriers.reduce((s,c) => s + (c.completedTogether ?? 0), 0), icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-4 rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-slate)]">{value}</p>
              <p className="text-xs text-[var(--color-text-faint)]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, company, DOT…"
          className="w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] pl-10 pr-4 py-2.5 text-sm focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20"
        />
      </div>

      <CarrierTable
        carriers={filtered}
        onSelect={onSelect}
        isLoading={isLoading}
        emptyMessage={search ? 'No carriers match your search' : 'No carriers in your network yet'}
      />

      {/* Invite CTA */}
      <div className="rounded-2xl border border-dashed border-[var(--color-cream-dark)] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-cream)] text-[var(--color-teal)]">
            <Clock size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">Know a reliable carrier?</p>
            <p className="text-xs text-[var(--color-text-faint)]">Add them by DOT number or invite them to Shipmater.</p>
          </div>
        </div>
        <button
          onClick={onAddCarrier}
          className="shrink-0 flex items-center gap-1.5 rounded-xl border border-[var(--color-cream-dark)] px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors"
        >
          <Plus size={13} /> Add by DOT
        </button>
      </div>
    </div>
  );
}

// ── Add by DOT modal ───────────────────────────────────────────────────────────

function AddByDotModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [dot, setDot]     = useState('');
  const [preview, setPreview] = useState<Carrier | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (dot.length < 5) return;
    setLoading(true); setError(''); setPreview(null);
    try {
      const res = await api.get('/api/v1/carriers', { params: { dot } });
      const list = res.data.data as Carrier[];
      if (!list.length) { setError(`No carrier found for DOT# ${dot}`); }
      else setPreview(list[0]);
    } catch { setError('Search failed. Try again.'); }
    finally { setLoading(false); }
  };

  const addMutation = useMutation({
    mutationFn: () => preferredCarrierApi.add({ dot_number: dot }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['preferred-carriers'] }); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? 'Failed to add carrier'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--color-white)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--color-text)]">Add carrier by DOT</h3>
          <button onClick={onClose}><X size={18} className="text-[var(--color-text-faint)]" /></button>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">Enter the carrier's FMCSA DOT number.</p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Hash size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            <input value={dot} onChange={e => { setDot(e.target.value.replace(/\D/g,'')); setPreview(null); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="e.g. 3841922"
              className="w-full rounded-xl border border-[var(--color-cream-dark)] pl-9 pr-3.5 py-2.5 text-sm font-mono focus:border-[var(--color-teal)] focus:outline-none" />
          </div>
          <button onClick={search} disabled={dot.length < 5 || loading}
            className="rounded-xl bg-[var(--color-teal)] text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
            {loading ? <Loader2 size={14} className="animate-spin" /> : null} Search
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        {preview && (
          <div className="mt-4 rounded-xl border border-[var(--color-teal)] bg-[var(--color-teal-pale)] p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-slate)] flex items-center justify-center text-white text-sm font-bold">
                {preview.avatar}
              </div>
              <div>
                <p className="font-semibold text-sm text-[var(--color-text)]">{preview.name}</p>
                <p className="text-xs text-[var(--color-text-faint)]">DOT {preview.dot_number}</p>
              </div>
              {preview.verification_status === 'verified' && <VerifiedBadge />}
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--color-cream-dark)] py-2.5 text-sm font-semibold text-[var(--color-text-muted)]">
            Cancel
          </button>
          <button onClick={() => addMutation.mutate()} disabled={!preview || addMutation.isPending}
            className="flex-1 rounded-xl bg-[var(--color-teal)] text-white py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
            {addMutation.isPending && <Loader2 size={13} className="animate-spin" />}
            Add to network
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ShipperCarriersPage() {
  const [tab, setTab]       = useState<'network' | 'find'>('network');
  const [selected, setSelected] = useState<Carrier | null>(null);
  const [showAdd, setShowAdd]   = useState(false);

  const isFromNetwork = tab === 'network';

  return (
    <>
      {showAdd   && <AddByDotModal onClose={() => setShowAdd(false)} />}
      {selected  && (
        <CarrierDrawer
          carrier={selected}
          onClose={() => setSelected(null)}
          showAddToNetwork={!isFromNetwork}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title">
              Carriers
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">
              Manage your network or find and add new carriers
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-light)] shadow-sm transition-colors"
          >
            <Plus size={15} /> Add carrier
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--color-cream-dark)]">
          {([
            ['network', 'My Network',    Users],
            ['find',    'Find Carriers', Search],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-[var(--color-teal)] text-[var(--color-teal)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tab === 'network' && (
          <MyNetworkTab onSelect={setSelected} onAddCarrier={() => setShowAdd(true)} />
        )}
        {tab === 'find' && (
          <FindCarriersTab onSelect={setSelected} />
        )}
      </div>
    </>
  );
}
