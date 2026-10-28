'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ChevronRight, ChevronLeft, Check, FileText, ClipboardList,
  Route, Send, Plus, X, Search, Loader2,
  Warehouse, Users, ChevronDown, Package, ArrowRight,
  Briefcase, Sparkles, CheckCircle2, AlertCircle, Clock,
  DollarSign, Receipt, Tag,
} from 'lucide-react';
import { contractApi, locationApi, freightJobApi } from '@/lib/api';
import { RouteMap, type RouteMapStop } from '@/components/RouteMap';
import { LocationSearch, type LocationOption } from '@/components/shipper/LocationSearch';
import { loadPlannerHandoff } from '@/lib/route-planner-handoff';

// ── Contract table helpers (mirror of Contracts page) ─────────────────────────

type ContractStatus = 'active' | 'pending' | 'expired' | 'draft';

interface ContractRow {
  id:             number;
  carrier:        string;
  carrierCompany: string;
  carrierAvatar:  string;
  rateType:       string;
  rate:           string;
  fuelSurcharge:  string;
  detentionRate:  string;
  freeTimeHrs:    number;
  paymentTerms:   string;
  equipmentType:  string;
  maxWeight:      string;
  coverage:       string;
  validTo:        string;
  status:         ContractStatus;
  optimizationMode?: string;
}

function toContractRow(r: any): ContractRow {
  return {
    id:             r.id,
    carrier:        r.carrier        ?? '',
    carrierCompany: r.carrierCompany ?? r.carrier_company ?? '',
    carrierAvatar:  r.carrier_avatar ?? '',
    rateType:       r.rate_type      ?? '',
    rate:           r.rate           ?? '',
    fuelSurcharge:  r.fuel_surcharge ?? '',
    detentionRate:  r.detention_rate ?? '',
    freeTimeHrs:    r.free_time_hrs  ?? 2,
    paymentTerms:   r.payment_terms  ?? '',
    equipmentType:  r.equipment_type ?? '',
    maxWeight:      r.max_weight     ?? '',
    coverage:       r.coverage       ?? '',
    validTo:        r.valid_to       ?? '',
    status:         r.status         ?? 'active',
    optimizationMode: r.optimization_mode,
  };
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const map = {
    active:  { cls: 'bg-emerald-50 text-emerald-700',  icon: CheckCircle2, label: 'Active'  },
    pending: { cls: 'bg-amber-50 text-amber-700',       icon: Clock,        label: 'Pending' },
    expired: { cls: 'bg-red-50 text-red-600',           icon: AlertCircle,  label: 'Expired' },
    draft:   { cls: 'bg-[var(--color-cream)] text-[var(--color-text-muted)]', icon: FileText, label: 'Draft' },
  };
  const { cls, icon: Icon, label } = map[status] ?? map.draft;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon size={10} /> {label}
    </span>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type JobType = 'open' | 'contracted' | null;


interface ManifestItem {
  localId:            string;
  description:        string;
  quantity:           number;
  unit:               string;
  weightLbs:          string;
  sku:                string;
  // Delivery — stored at item level, delivery stops auto-generated on submit
  deliveryLocationId: number | null;
  deliveryName:       string;
  deliveryAddress:    string;
  deliveryCity:       string;
  deliveryState:      string;
  deliveryZip:        string;
  deliveryLat:        number | null;
  deliveryLng:        number | null;
}

interface Stop {
  localId:             string;
  stopType:            'pickup';
  sequence:            number;
  locationId?:         number;
  name:                string;
  contactName:         string;
  contactPhone:        string;
  address:             string;
  city:                string;
  state:               string;
  zip:                 string;
  lat?:                number;
  lng?:                number;
  scheduledDate:       string;
  windowStart:         string;
  windowEnd:           string;
  weightLbs:           string;
  specialInstructions: string;
  items:               ManifestItem[];
}

const UNITS = ['pallet','box','piece','bag','drum','crate','other'];
function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Offer Terms ───────────────────────────────────────────────────────────────

interface QuoteTerms {
  preset:                  string | null;
  rate_type:               'flat' | 'per_mile' | 'hourly';
  require_fuel_surcharge:  boolean;
  require_detention_rate:  boolean;
  free_time_hrs:           number;
  require_equipment_type:  boolean;
  equipment_type_hint:     string;
  require_max_weight:      boolean;
  require_payment_terms:   boolean;
  payment_terms_hint:      string;
}

const QUOTE_PRESETS: { id: string; label: string; desc: string; defaults: Omit<QuoteTerms, 'preset'> }[] = [
  {
    id: 'standard_freight', label: 'Standard Freight', desc: 'Dry van, general cargo',
    defaults: { rate_type: 'per_mile', require_fuel_surcharge: true,  require_detention_rate: true,
      free_time_hrs: 2, require_equipment_type: false, equipment_type_hint: '',
      require_max_weight: false, require_payment_terms: true, payment_terms_hint: 'Net 30' },
  },
  {
    id: 'temperature_controlled', label: 'Temperature Controlled', desc: 'Refrigerated / frozen',
    defaults: { rate_type: 'per_mile', require_fuel_surcharge: true,  require_detention_rate: true,
      free_time_hrs: 2, require_equipment_type: true, equipment_type_hint: 'Reefer',
      require_max_weight: true, require_payment_terms: true, payment_terms_hint: 'Net 30' },
  },
  {
    id: 'heavy_equipment', label: 'Heavy Equipment', desc: 'Oversized / construction',
    defaults: { rate_type: 'flat', require_fuel_surcharge: true,  require_detention_rate: true,
      free_time_hrs: 4, require_equipment_type: true, equipment_type_hint: 'Lowboy / RGN',
      require_max_weight: true, require_payment_terms: true, payment_terms_hint: 'Net 30' },
  },
  {
    id: 'hazmat', label: 'Hazmat', desc: 'Hazardous materials',
    defaults: { rate_type: 'per_mile', require_fuel_surcharge: true,  require_detention_rate: true,
      free_time_hrs: 2, require_equipment_type: true, equipment_type_hint: 'Hazmat-certified',
      require_max_weight: false, require_payment_terms: true, payment_terms_hint: 'Net 30' },
  },
  {
    id: 'flatbed_open_deck', label: 'Flatbed / Open Deck', desc: 'Steel, lumber, machinery',
    defaults: { rate_type: 'per_mile', require_fuel_surcharge: true,  require_detention_rate: true,
      free_time_hrs: 2, require_equipment_type: true, equipment_type_hint: 'Flatbed',
      require_max_weight: true, require_payment_terms: false, payment_terms_hint: '' },
  },
  {
    id: 'expedited', label: 'Expedited', desc: 'Time-critical / express',
    defaults: { rate_type: 'flat', require_fuel_surcharge: false, require_detention_rate: false,
      free_time_hrs: 1, require_equipment_type: false, equipment_type_hint: '',
      require_max_weight: false, require_payment_terms: true, payment_terms_hint: 'Net 7' },
  },
];

const DEFAULT_TERMS: QuoteTerms = {
  preset: null, rate_type: 'per_mile',
  require_fuel_surcharge: true,  require_detention_rate: false, free_time_hrs: 2,
  require_equipment_type: false, equipment_type_hint:    '',
  require_max_weight:     false, require_payment_terms:  true,  payment_terms_hint: 'Net 30',
};

function TermsToggle({ checked, onChange, label, desc }: {
  checked:  boolean;
  onChange: (v: boolean) => void;
  label:    string;
  desc:     string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 w-full rounded-xl border px-3.5 py-3 text-left transition-all ${
        checked
          ? 'border-[var(--color-teal)] bg-[var(--color-white)]'
          : 'border-[var(--color-cream-dark)] bg-[var(--color-white)] opacity-60 hover:opacity-90'
      }`}
    >
      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
        checked ? 'border-[var(--color-teal)] bg-[var(--color-teal)]' : 'border-[var(--color-cream-dark)]'
      }`}>
        {checked && <Check size={10} className="text-white" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text)]">{label}</p>
        <p className="text-xs text-[var(--color-text-faint)]">{desc}</p>
      </div>
    </button>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────

const PLATFORM_FEE_RATE = 0.15;

interface BillingLine { label: string; detail: string; amount: number; }
interface BillingCalc {
  lines:      BillingLine[];
  total:      number;
  totalCents: number;
  breakdown:  Record<string, unknown>;
}

function parseMoney(s: string | number): number {
  if (typeof s === 'number') return s;
  return parseFloat(s.replace(/[$,]/g, '')) || 0;
}

function calcBilling(contract: ContractRow | null, job: any): BillingCalc | null {
  if (!contract || !job) return null;

  const rate        = parseMoney(contract.rate);
  const distMiles   = parseFloat(job.route_distance_miles) || 0;
  const durationHrs = (job.route_duration_minutes || 0) / 60;

  let baseAmount = 0;
  let baseDetail = '';

  if (contract.rateType === 'Per mile') {
    baseAmount = rate * distMiles;
    baseDetail = `$${rate.toFixed(2)}/mi × ${distMiles.toFixed(1)} mi`;
  } else if (contract.rateType === 'Flat rate') {
    baseAmount = rate;
    baseDetail = 'Flat rate';
  } else if (contract.rateType === 'Hourly') {
    baseAmount = rate * durationHrs;
    baseDetail = `$${rate.toFixed(2)}/hr × ${durationHrs.toFixed(1)} hrs`;
  }

  const fuelRate   = parseMoney(contract.fuelSurcharge);
  const fuelAmount = fuelRate > 0
    ? (contract.rateType === 'Per mile' ? fuelRate * distMiles : fuelRate)
    : 0;
  const fuelDetail = fuelRate > 0
    ? (contract.rateType === 'Per mile' ? `$${fuelRate.toFixed(2)}/mi × ${distMiles.toFixed(1)} mi` : 'Flat surcharge')
    : '';

  const sumOfCosts  = baseAmount + fuelAmount;
  const platformFee = PLATFORM_FEE_RATE * sumOfCosts;
  const total       = sumOfCosts + platformFee;

  const lines: BillingLine[] = [
    { label: 'Base charge', detail: '', amount: baseAmount },
    ...(fuelAmount > 0 ? [{ label: 'Fuel surcharge', detail: '', amount: fuelAmount }] : []),
    { label: 'Platform fee', detail: '', amount: platformFee },
  ];

  return {
    lines,
    total,
    totalCents: Math.round(total * 100),
    breakdown: {
      rate_type:         contract.rateType,
      rate,
      dist_miles:        distMiles,
      duration_hrs:      parseFloat(durationHrs.toFixed(2)),
      base_amount:       parseFloat(baseAmount.toFixed(2)),
      fuel_rate:         fuelRate,
      fuel_amount:       parseFloat(fuelAmount.toFixed(2)),
      platform_fee_rate: PLATFORM_FEE_RATE,
      platform_fee:      parseFloat(platformFee.toFixed(2)),
      total:             parseFloat(total.toFixed(2)),
    },
  };
}

function fmt(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function StepIndicator({ current, step3Label = 'Billing' }: { current: number; step3Label?: string }) {
  const STEPS = [
    { label: 'Contract',   icon: FileText      },
    { label: 'Build',      icon: ClipboardList },
    { label: 'Route',      icon: Route         },
    { label: step3Label,   icon: step3Label === 'Offer Terms' ? Tag : DollarSign },
    { label: 'Send',       icon: Send          },
  ];
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done   = i < current;
        const active = i === current;
        const Icon   = step.icon;
        return (
          <div key={i} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
              active ? 'bg-[var(--color-teal)] text-white shadow-sm' :
              done   ? 'bg-[var(--color-teal-pale)] text-[var(--color-teal)]' :
                       'text-[var(--color-text-faint)]'
            }`}>
              {done
                ? <Check size={14} />
                : <Icon size={14} className={active ? 'opacity-100' : 'opacity-50'} />
              }
              <span className="text-sm font-semibold">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight size={14} className="mx-1 text-[var(--color-text-faint)]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Time Picker ───────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + ':00');

function TimePicker({ value, onChange, variant }: {
  value:    string;
  onChange: (v: string) => void;
  variant:  'from' | 'to';
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect]  = useState<DOMRect | null>(null);
  const btnRef           = useRef<HTMLButtonElement>(null);

  const specialValue = variant === 'from' ? 'OPEN'  : 'CLOSE';
  const specialLabel = variant === 'from' ? 'Anytime after open' : 'Anytime before close';

  const displayValue = value === 'OPEN'  ? 'After open'   :
                       value === 'CLOSE' ? 'Before close' :
                       value             ? value          : null;

  const isSpecial = value === 'OPEN' || value === 'CLOSE';

  function toggle() {
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(o => !o);
  }

  function pick(v: string) { onChange(v); setOpen(false); }

  const dropdown = open && rect ? createPortal(
    <div
      style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: 220, zIndex: 9999 }}
      className="rounded-xl border border-[var(--color-cream-dark)] bg-white shadow-xl overflow-hidden"
    >
      {/* Special option */}
      <button
        onMouseDown={() => pick(specialValue)}
        className={`w-full px-4 py-2.5 text-left text-xs font-semibold border-b border-[var(--color-cream-dark)] transition-colors ${
          value === specialValue
            ? 'bg-[var(--color-teal)] text-white'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-cream)]'
        }`}
      >
        {specialLabel}
      </button>

      {/* Hour grid — 4 cols × 6 rows */}
      <div className="grid grid-cols-4 gap-px bg-[var(--color-cream-dark)] p-px">
        {HOURS.map(h => (
          <button
            key={h}
            onMouseDown={() => pick(h)}
            className={`py-2 text-xs font-semibold text-center transition-colors ${
              value === h
                ? 'bg-[var(--color-teal)] text-white'
                : 'bg-white hover:bg-[var(--color-teal-pale)] text-[var(--color-text)]'
            }`}
          >
            {h}
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors whitespace-nowrap ${
          isSpecial
            ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)] text-[var(--color-teal)] font-semibold'
            : displayValue
            ? 'border-[var(--color-cream-dark)] bg-[var(--color-white)] text-[var(--color-text)] font-semibold'
            : 'border-[var(--color-cream-dark)] bg-[var(--color-white)] text-[var(--color-text-faint)]'
        }`}
      >
        <Clock size={12} className={isSpecial ? 'text-[var(--color-teal)]' : 'text-[var(--color-text-faint)]'} />
        <span className="w-[72px] text-center text-xs">{displayValue ?? (variant === 'from' ? 'From' : 'To')}</span>
        <ChevronDown size={11} className="shrink-0 opacity-40" />
      </button>
      {dropdown}
    </>
  );
}

// ── Stop Card ─────────────────────────────────────────────────────────────────

function StopCard({ stop, onUpdate, onRemove, index, defaultDelivery }: {
  stop:             Stop;
  onUpdate:         (s: Stop) => void;
  onRemove:         () => void;
  index:            number;
  defaultDelivery?: LocationOption | null;
}) {
  const inputCls = 'w-full rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none';
  const labelCls = 'block mb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]';

  function set<K extends keyof Stop>(k: K, v: Stop[K]) { onUpdate({ ...stop, [k]: v }); }

  function addItem() {
    const d = defaultDelivery;
    onUpdate({ ...stop, items: [...stop.items, {
      localId: uid(), description: '', quantity: 1, unit: 'pallet', weightLbs: '', sku: '',
      deliveryLocationId: d?.id          ?? null,
      deliveryName:       d?.name        ?? '',
      deliveryAddress:    d?.address     ?? '',
      deliveryCity:       d?.city        ?? '',
      deliveryState:      d?.state       ?? '',
      deliveryZip:        d?.zip         ?? '',
      deliveryLat:        d?.lat         ?? null,
      deliveryLng:        d?.lng         ?? null,
    }]});
  }

  function updateItem(idx: number, patch: Partial<ManifestItem>) {
    onUpdate({ ...stop, items: stop.items.map((it, i) => i === idx ? { ...it, ...patch } : it) });
  }

  function removeItem(idx: number) {
    onUpdate({ ...stop, items: stop.items.filter((_, i) => i !== idx) });
  }

  function sameAsAbove(idx: number) {
    const prev = stop.items[idx - 1];
    if (!prev) return;
    updateItem(idx, {
      deliveryLocationId: prev.deliveryLocationId,
      deliveryName:       prev.deliveryName,
      deliveryAddress:    prev.deliveryAddress,
      deliveryCity:       prev.deliveryCity,
      deliveryState:      prev.deliveryState,
      deliveryZip:        prev.deliveryZip,
      deliveryLat:        prev.deliveryLat,
      deliveryLng:        prev.deliveryLng,
    });
  }

  return (
    <div className="rounded-xl border border-[var(--color-teal)] bg-[var(--color-white)]">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 rounded-t-xl bg-[var(--color-teal-pale)]">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-teal)] text-xs font-bold text-white">
            {index + 1}
          </div>
          <span className="text-sm font-semibold text-[var(--color-teal)]">Pickup</span>
          {stop.name && <span className="text-xs text-[var(--color-text-faint)]">— {stop.name}</span>}
        </div>
        <button onClick={onRemove} className="rounded-lg p-1 text-[var(--color-text-faint)] hover:text-red-500 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="px-5 pb-6 pt-4 space-y-4">

        {/* Pickup address + date + time — all one line */}
        <div className="flex items-end gap-2">

          {/* Location */}
          <div className="flex-1 min-w-0">
            <label className={labelCls}>Pickup address</label>
            <LocationSearch
              type="pickup"
              selectedName={
                stop.name
                  ? `${stop.name}${stop.city || stop.state ? ` · ${[stop.city, stop.state].filter(Boolean).join(', ')}` : ''}`
                  : (stop.address || undefined)
              }
              onSelect={loc => onUpdate({
                ...stop,
                locationId: loc.id, name: loc.name,
                address: loc.address, city: loc.city, state: loc.state, zip: loc.zip,
                lat: loc.lat ?? undefined, lng: loc.lng ?? undefined,
                contactName: loc.contact_name ?? '', contactPhone: loc.contact_phone ?? '',
              })}
              onClear={() => onUpdate({
                ...stop,
                locationId: undefined, name: '', address: '', city: '', state: '', zip: '',
                lat: undefined, lng: undefined,
              })}
            />          </div>

          {/* Date */}
          <div className="shrink-0">
            <label className={labelCls}>Date</label>
            <input type="date" value={stop.scheduledDate}
              onChange={e => set('scheduledDate', e.target.value)}
              className={inputCls + ' w-36'} />
          </div>

          {/* From time */}
          <div className="shrink-0">
            <label className={labelCls}>From</label>
            <TimePicker value={stop.windowStart} onChange={v => set('windowStart', v)} variant="from" />
          </div>

          {/* To time */}
          <div className="shrink-0">
            <label className={labelCls}>To</label>
            <TimePicker value={stop.windowEnd} onChange={v => set('windowEnd', v)} variant="to" />
          </div>

        </div>

        {/* Items */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">
              Manifest {stop.items.length > 0 && <span className="normal-case font-normal">({stop.items.length})</span>}
            </p>
            <button onClick={addItem}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)] hover:underline">
              <Plus size={11} /> Add
            </button>
          </div>

          <div className="rounded-lg border border-[var(--color-cream-dark)]">
          {stop.items.length === 0 ? (
            <div className="flex items-center justify-center h-16">
              <p className="text-xs text-[var(--color-text-faint)] italic">No items yet — add items to this pickup</p>
            </div>
          ) : (
            <div>

              {/* Table header */}
              <div className="flex items-center gap-0 bg-[var(--color-teal-pale)] border-b border-[var(--color-cream-dark)] px-4 py-3 rounded-t-lg">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Item</span>
                  <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Qty</span>
                  <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Unit</span>
                  <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Lbs</span>
                </div>
                <div className="w-px self-stretch bg-[var(--color-cream-dark)] mx-3" />
                <div className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Deliver to</div>
                <div className="w-6 shrink-0" />
              </div>

              {/* Item rows */}
              {stop.items.map((item, idx) => (
                <div key={item.localId}
                  className="flex items-center gap-0 px-4 py-3 border-b border-[var(--color-cream-dark)] last:border-0 bg-[var(--color-white)] hover:bg-[var(--color-cream)] transition-colors">

                  {/* Left half — item fields */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input value={item.description}
                      onChange={e => updateItem(idx, { description: e.target.value })}
                      placeholder="Description…" className="flex-1 min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-[var(--color-teal)] focus:bg-[var(--color-white)] focus:outline-none" />
                    <input type="number" min={1} value={item.quantity}
                      onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                      className="w-12 shrink-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-center focus:border-[var(--color-teal)] focus:bg-[var(--color-white)] focus:outline-none" />
                    <div className="relative w-20 shrink-0">
                      <select value={item.unit} onChange={e => updateItem(idx, { unit: e.target.value })}
                        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm appearance-none focus:border-[var(--color-teal)] focus:bg-[var(--color-white)] focus:outline-none pr-5">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
                    </div>
                    <input type="number" min={0} value={item.weightLbs}
                      onChange={e => updateItem(idx, { weightLbs: e.target.value })}
                      placeholder="0"
                      className="w-14 shrink-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm focus:border-[var(--color-teal)] focus:bg-[var(--color-white)] focus:outline-none" />
                  </div>

                  {/* Divider */}
                  <div className="w-px self-stretch bg-[var(--color-cream-dark)] mx-3" />

                  {/* Right half — delivery */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <LocationSearch
                        type="delivery"
                        selectedName={
                          item.deliveryName
                            ? `${item.deliveryName}${item.deliveryCity || item.deliveryState ? ` · ${[item.deliveryCity, item.deliveryState].filter(Boolean).join(', ')}` : ''}`
                            : (item.deliveryAddress || undefined)
                        }
                        onSelect={loc => updateItem(idx, {
                          deliveryLocationId: loc.id,
                          deliveryName:       loc.name,
                          deliveryAddress:    loc.address,
                          deliveryCity:       loc.city,
                          deliveryState:      loc.state,
                          deliveryZip:        loc.zip,
                          deliveryLat:        loc.lat ?? null,
                          deliveryLng:        loc.lng ?? null,
                        })}
                        onClear={() => updateItem(idx, {
                          deliveryLocationId: null, deliveryName: '', deliveryAddress: '',
                          deliveryCity: '', deliveryState: '', deliveryZip: '',
                          deliveryLat: null, deliveryLng: null,
                        })}
                      />                    </div>
                    {idx > 0 && !item.deliveryLocationId && stop.items[idx - 1]?.deliveryLocationId && (
                      <button onClick={() => sameAsAbove(idx)}
                        className="shrink-0 whitespace-nowrap rounded-md border border-[var(--color-cream-dark)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] transition-colors">
                        ↑ Same
                      </button>
                    )}
                  </div>

                  {/* Remove */}
                  <button onClick={() => removeItem(idx)}
                    className="ml-2 shrink-0 rounded-md p-1 text-[var(--color-text-faint)] hover:text-red-500 transition-colors">
                    <X size={13} />
                  </button>

                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Route Result ──────────────────────────────────────────────────────────────

function RouteResult({ job }: { job: any }) {
  if (!job?.stops) return null;
  const ordered = [...job.stops].sort(
    (a: any, b: any) => (a.optimized_sequence ?? a.sequence) - (b.optimized_sequence ?? b.sequence)
  );
  return (
    <div className="space-y-3">
      {/* Distance / duration stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--color-slate)]">{job.route_distance_miles?.toFixed(0) ?? '—'}</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">miles</p>
        </div>
        <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-4 text-center">
          <p className="text-2xl font-bold text-[var(--color-slate)]">
            {job.route_duration_minutes ? `${Math.floor(job.route_duration_minutes / 60)}h ${job.route_duration_minutes % 60}m` : '—'}
          </p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">est. drive time</p>
        </div>
      </div>

      {/* Stop list with items */}
      <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] overflow-hidden">
        {ordered.map((stop: any, i: number) => {
          const isPickup = stop.stop_type === 'pickup';
          return (
            <div key={stop.id} className={`px-4 py-3.5 ${i < ordered.length - 1 ? 'border-b border-[var(--color-cream-dark)]' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white mt-0.5 ${isPickup ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-slate)]'}`}>
                  {String.fromCharCode(65 + i)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text)] capitalize">
                      {isPickup ? 'Pickup' : 'Dropoff'}{stop.name ? ` — ${stop.name}` : ''}
                    </p>
                    {stop.window_start && (
                      <p className="shrink-0 text-xs text-[var(--color-text-faint)]">{stop.window_start} – {stop.window_end}</p>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-faint)] truncate mt-0.5">{stop.address}, {stop.city}, {stop.state}</p>
                  {stop.scheduled_date && (
                    <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
                      {new Date(stop.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  {/* Items on pickup stops */}
                  {isPickup && stop.pickup_items?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {stop.pickup_items.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-1.5 text-xs text-[var(--color-text-faint)]">
                          <Package size={10} className="shrink-0 text-[var(--color-teal)]" />
                          <span className="font-medium text-[var(--color-text-muted)]">{item.quantity}× {item.unit}</span>
                          <span>— {item.description}</span>
                          {item.delivery_stop && (
                            <>
                              <ArrowRight size={9} className="shrink-0" />
                              <span>{item.delivery_stop.name || `${item.delivery_stop.city}, ${item.delivery_stop.state}`}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export type CreateJobWizardMode = 'job' | 'shipment';

/**
 * job      — Create Job: open market (bidding) or contracted posting
 * shipment — New Shipment: no-bid dispatch under an existing carrier contract
 *            Select contract → Build → Route → Billing (confirm contract charge) → Send
 */
export function CreateJobWizard({ mode = 'job' }: { mode?: CreateJobWizardMode }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const editParam    = searchParams.get('edit');
  const editJobId    = editParam ? Number(editParam) : null;
  const isShipment   = mode === 'shipment';

  // Tracks whether we've pre-populated the wizard from an existing draft
  const editInitialized = useRef(false);
  const routePlannerInitialized = useRef(false);

  // Step 0 selections — shipment mode is always contracted (no open / bidding)
  const [jobType,       setJobType]       = useState<JobType>(isShipment ? 'contracted' : null);
  const [contractMode,  setContractMode]  = useState<'present' | 'new' | null>(isShipment ? 'present' : null);
  const [showContracts,  setShowContracts]  = useState(isShipment);
  const [contractSearch, setContractSearch] = useState('');

  // Step (0=Contract, 1=Build, 2=Route, 3=Send)
  const [step, setStep] = useState(0);

  // Contract
  const [contractId, setContractId] = useState<number | null>(null);

  // Step 1 – Build
  const [title,        setTitle]        = useState('');
  const [refNum,       setRefNum]        = useState('');
  const [instructions, setInstructions] = useState('');
  const [optimMode,    setOptimMode]    = useState<'shortest_route' | 'cluster_pickups'>('shortest_route');
  const [stops,        setStops]        = useState<Stop[]>([]);

  // Step 2 – Route
  const [createdJob,     setCreatedJob]     = useState<any>(null);
  const [optimised,      setOptimised]      = useState(false);
  const [routeGeometry,  setRouteGeometry]  = useState<[number, number][] | null>(null);

  // Step 3 – Offer Terms (open jobs only)
  const [quoteTerms, setQuoteTerms] = useState<QuoteTerms>(DEFAULT_TERMS);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: contractsRes, isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts', 'active'],
    queryFn:  () => contractApi.list({ status: 'active' }),
    // Load contracts when the table is open OR when editing a contracted job
    // (needed so selectedContract resolves at the Billing step).
    enabled:  showContracts || !!(editJobId && contractId),
  });

  // When editing an existing draft, fetch that job to pre-populate the wizard.
  const { data: editJobRes, isLoading: editJobLoading } = useQuery({
    queryKey: ['shipper-job', editJobId],
    queryFn:  () => freightJobApi.get(editJobId!),
    enabled:  !!editJobId,
    staleTime: Infinity,
  });

  // Default locations — pre-fetched on page load so they're ready when Build step opens
  const { data: defaultPickupRes,   isFetching: pickupFetching  } = useQuery({
    queryKey: ['locations', 'default', 'pickup'],
    queryFn:  () => locationApi.list({ type: 'pickup',   is_default: true }),
    staleTime: Infinity,
  });
  const { data: defaultDeliveryRes } = useQuery({
    queryKey: ['locations', 'default', 'delivery'],
    queryFn:  () => locationApi.list({ type: 'delivery', is_default: true }),
    staleTime: Infinity,
  });

  const defaultPickup:  LocationOption | null = defaultPickupRes?.data?.data?.[0]  ?? null;
  const defaultDelivery: LocationOption | null = defaultDeliveryRes?.data?.data?.[0] ?? null;

  const contracts: ContractRow[] = (contractsRes?.data?.data ?? []).map(toContractRow);

  const filteredContracts = useMemo(() => {
    if (!contractSearch.trim()) return contracts;
    const q = contractSearch.toLowerCase();
    return contracts.filter(c =>
      c.carrier.toLowerCase().includes(q) ||
      c.carrierCompany.toLowerCase().includes(q)
    );
  }, [contracts, contractSearch]);

  const selectedContract = contracts.find(c => c.id === contractId) ?? null;

  // ── Stop helpers ───────────────────────────────────────────────────────────

  function addStop() {
    const d = defaultPickup;
    setStops(prev => [...prev, {
      localId: uid(), stopType: 'pickup', sequence: prev.length + 1,
      locationId:   d?.id,
      name:         d?.name         ?? '',
      address:      d?.address      ?? '',
      city:         d?.city         ?? '',
      state:        d?.state        ?? '',
      zip:          d?.zip          ?? '',
      lat:          d?.lat          ?? undefined,
      lng:          d?.lng          ?? undefined,
      contactName:  d?.contact_name ?? '',
      contactPhone: d?.contact_phone ?? '',
      scheduledDate: '', windowStart: '', windowEnd: '', weightLbs: '', specialInstructions: '',
      items: [],
    }]);
  }

  function updateStop(localId: string, updated: Stop) {
    setStops(prev => prev.map(s => s.localId === localId ? updated : s));
  }

  function removeStop(localId: string) {
    setStops(prev => prev.filter(s => s.localId !== localId));
  }

  // ── Auto-init first pickup on Build step ───────────────────────────────────
  // Waits until the default-pickup query has resolved (pickupFetching = false)
  // so the stop is pre-filled with the default address if one exists.
  // Skipped in edit mode — stops are loaded from the existing draft instead.
  // Skipped when route-planner query params are present (handled below).
  useEffect(() => {
    if (step !== 1 || stops.length > 0 || pickupFetching || editJobId) return;
    if (searchParams.get('fromPlanner') === '1') return;
    if (searchParams.get('pickup') && searchParams.get('delivery')) return;
    const d = defaultPickup;
    setStops([{
      localId:             uid(),
      stopType:            'pickup',
      sequence:            1,
      locationId:          d?.id          ?? undefined,
      name:                d?.name        ?? '',
      address:             d?.address     ?? '',
      city:                d?.city        ?? '',
      state:               d?.state       ?? '',
      zip:                 d?.zip         ?? '',
      lat:                 d?.lat         ?? undefined,
      lng:                 d?.lng         ?? undefined,
      contactName:         d?.contact_name  ?? '',
      contactPhone:        d?.contact_phone ?? '',
      scheduledDate:       '',
      windowStart:         '',
      windowEnd:           '',
      weightLbs:           '',
      specialInstructions: '',
      items:               [],
    }]);
  }, [step, defaultPickup, pickupFetching, editJobId, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Route planner handoff (sessionStorage or ?pickup=&delivery=) ───────────
  useEffect(() => {
    if (routePlannerInitialized.current || editJobId) return;

    type Wp = {
      address: string;
      label?: string;
      lat: number;
      lng: number;
      city?: string;
      state?: string;
      zip?: string;
      name?: string | null;
      locationId?: number | null;
      role?: 'pickup' | 'delivery';
    };

    let waypoints: Wp[] = [];

    if (searchParams.get('fromPlanner') === '1') {
      const handoff = loadPlannerHandoff();
      if (handoff?.stops?.length) {
        waypoints = handoff.stops.map(s => ({ ...s }));
      }
    }

    if (waypoints.length < 2) {
      const raw = searchParams.get('waypoints');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length >= 2) waypoints = parsed;
        } catch { /* ignore */ }
      }
    }

    if (waypoints.length < 2) {
      const pickup = searchParams.get('pickup');
      const delivery = searchParams.get('delivery');
      if (!pickup || !delivery) return;
      const pLat = searchParams.get('pickupLat');
      const pLng = searchParams.get('pickupLng');
      const dLat = searchParams.get('deliveryLat');
      const dLng = searchParams.get('deliveryLng');
      waypoints = [
        { address: pickup,   lat: pLat ? Number(pLat) : 0, lng: pLng ? Number(pLng) : 0, role: 'pickup' },
        { address: delivery, lat: dLat ? Number(dLat) : 0, lng: dLng ? Number(dLng) : 0, role: 'delivery' },
      ];
    }

    routePlannerInitialized.current = true;

    if (!isShipment) {
      setJobType('open');
      setStep(1);
    }

    // Defaults: first pickup, rest delivery (or use explicit roles from planner)
    const normalized = waypoints.map((w, i) => ({
      ...w,
      role: w.role ?? (i === 0 ? 'pickup' as const : 'delivery' as const),
      label: w.label || w.name || w.address,
    }));

    const pickups = normalized.filter(w => w.role === 'pickup');
    const deliveries = normalized.filter(w => w.role === 'delivery');

    // Guarantee at least one pickup + use remaining as deliveries
    const primaryPickup = pickups[0] ?? normalized[0];
    const deliveryList = deliveries.length
      ? deliveries
      : normalized.filter(w => w !== primaryPickup);

    const toDeliveryItem = (dest: typeof normalized[0]): ManifestItem => ({
      localId:            uid(),
      description:        '',
      quantity:           1,
      unit:               'pallet',
      weightLbs:          '',
      sku:                '',
      deliveryLocationId: dest.locationId ?? null,
      deliveryName:       dest.name || dest.label || '',
      deliveryAddress:    dest.address,
      deliveryCity:       dest.city || '',
      deliveryState:      dest.state || '',
      deliveryZip:        dest.zip || '',
      deliveryLat:        dest.lat || null,
      deliveryLng:        dest.lng || null,
    });

    // One pickup card; every delivery is a manifest row (user fills item desc only)
    const primary: Stop = {
      localId:             uid(),
      stopType:            'pickup',
      sequence:            1,
      locationId:          primaryPickup.locationId ?? undefined,
      name:                primaryPickup.name || primaryPickup.label || '',
      address:             primaryPickup.address,
      city:                primaryPickup.city || '',
      state:               primaryPickup.state || '',
      zip:                 primaryPickup.zip || '',
      lat:                 primaryPickup.lat || undefined,
      lng:                 primaryPickup.lng || undefined,
      contactName:         '',
      contactPhone:        '',
      scheduledDate:       '',
      windowStart:         '',
      windowEnd:           '',
      weightLbs:           '',
      specialInstructions: '',
      items: deliveryList.map(toDeliveryItem),
    };

    // Extra pickups (if user tagged more than one) — empty manifest for now
    const extraPickups: Stop[] = pickups.slice(1).map((wp, i) => ({
      localId:             uid(),
      stopType:            'pickup' as const,
      sequence:            i + 2,
      locationId:          wp.locationId ?? undefined,
      name:                wp.name || wp.label || '',
      address:             wp.address,
      city:                wp.city || '',
      state:               wp.state || '',
      zip:                 wp.zip || '',
      lat:                 wp.lat || undefined,
      lng:                 wp.lng || undefined,
      contactName:         '',
      contactPhone:        '',
      scheduledDate:       '',
      windowStart:         '',
      windowEnd:           '',
      weightLbs:           '',
      specialInstructions: '',
      items:               [],
    }));

    setStops([primary, ...extraPickups]);
  }, [searchParams, editJobId, isShipment]);

  // ── Edit-mode: pre-populate wizard from existing draft ─────────────────────
  // Runs once when the edit job query resolves. Sets all wizard state fields
  // from the saved job and jumps to the step matching the job's completion state.
  useEffect(() => {
    const job = editJobRes?.data?.data;
    if (!job || editInitialized.current) return;
    editInitialized.current = true;

    const type: JobType = job.contract_id ? 'contracted' : 'open';
    setJobType(type);
    setContractId(job.contract_id ?? null);
    setTitle(job.title ?? '');
    setRefNum(job.reference_number ?? '');
    setInstructions(job.special_instructions ?? '');
    setOptimMode(job.optimization_mode ?? 'shortest_route');
    setCreatedJob(job);

    // Convert API pickup stops → local Stop[] format
    const pickupStops: Stop[] = (job.stops ?? [])
      .filter((s: any) => s.stop_type === 'pickup')
      .sort((a: any, b: any) => a.sequence - b.sequence)
      .map((s: any): Stop => ({
        localId:             uid(),
        stopType:            'pickup',
        sequence:            s.sequence,
        locationId:          s.location_id ?? undefined,
        name:                s.name ?? '',
        contactName:         s.contact_name ?? '',
        contactPhone:        s.contact_phone ?? '',
        address:             s.address ?? '',
        city:                s.city ?? '',
        state:               s.state ?? '',
        zip:                 s.zip ?? '',
        lat:                 s.lat ? parseFloat(s.lat) : undefined,
        lng:                 s.lng ? parseFloat(s.lng) : undefined,
        scheduledDate:       s.scheduled_date ?? '',
        windowStart:         s.window_start ?? '',
        windowEnd:           s.window_end ?? '',
        weightLbs:           String(s.weight_lbs ?? ''),
        specialInstructions: s.special_instructions ?? '',
        items: (s.pickup_items ?? []).map((item: any): ManifestItem => ({
          localId:            uid(),
          description:        item.description ?? '',
          quantity:           item.quantity ?? 1,
          unit:               item.unit ?? 'pallet',
          weightLbs:          String(item.weight_lbs ?? ''),
          sku:                item.sku ?? '',
          deliveryLocationId: item.delivery_stop?.location_id ?? null,
          deliveryName:       item.delivery_stop?.name ?? '',
          deliveryAddress:    item.delivery_stop?.address ?? '',
          deliveryCity:       item.delivery_stop?.city ?? '',
          deliveryState:      item.delivery_stop?.state ?? '',
          deliveryZip:        item.delivery_stop?.zip ?? '',
          deliveryLat:        item.delivery_stop?.lat ? parseFloat(item.delivery_stop.lat) : null,
          deliveryLng:        item.delivery_stop?.lng ? parseFloat(item.delivery_stop.lng) : null,
        })),
      }));

    setStops(pickupStops);

    // Load offer terms if present
    if (job.quote_requirements) {
      const qr = job.quote_requirements;
      setQuoteTerms({
        preset:                  qr.preset                 ?? null,
        rate_type:               qr.rate_type              ?? 'per_mile',
        require_fuel_surcharge:  qr.require_fuel_surcharge ?? false,
        require_detention_rate:  qr.require_detention_rate ?? false,
        free_time_hrs:           qr.free_time_hrs          ?? 2,
        require_equipment_type:  qr.require_equipment_type ?? false,
        equipment_type_hint:     qr.equipment_type_hint    ?? '',
        require_max_weight:      qr.require_max_weight     ?? false,
        require_payment_terms:   qr.require_payment_terms  ?? false,
        payment_terms_hint:      qr.payment_terms_hint     ?? '',
      });
    }

    // Jump to the step that matches the job's completion state:
    //   has billing saved          → Review & Send (step 4)
    //   contracted + route         → Billing (step 3)
    //   open + route + terms saved → Review & Send (step 4)
    //   open + route, no terms yet → Offer Terms (step 3)
    //   no route yet               → Build (step 1)
    if (job.cost_breakdown) {
      setOptimised(true);
      fetchRouteGeometry(job);
      setStep(4);
    } else if (job.route_distance_miles) {
      setOptimised(true);
      fetchRouteGeometry(job);
      setStep(type === 'open' && job.quote_requirements ? 4 : 3);
    } else {
      setStep(1);
    }
  }, [editJobRes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: () => {
      // Unique delivery destinations — address-book id OR free-text key
      type Deliv = {
        key: string;
        locationId: number | null;
        address: string; city: string; state: string; zip: string;
        lat: number | null; lng: number | null; name: string;
      };
      const deliveryLocMap = new Map<string, Deliv>();

      function deliveryKey(it: ManifestItem) {
        if (it.deliveryLocationId) return `loc:${it.deliveryLocationId}`;
        return `addr:${it.deliveryAddress}|${it.deliveryLat}|${it.deliveryLng}`;
      }

      for (const s of stops) {
        for (const it of s.items) {
          if (!it.deliveryAddress.trim()) continue;
          const key = deliveryKey(it);
          if (deliveryLocMap.has(key)) continue;
          deliveryLocMap.set(key, {
            key,
            locationId: it.deliveryLocationId,
            name:    it.deliveryName,
            address: it.deliveryAddress,
            city:    it.deliveryCity || 'Unknown',
            state:   (it.deliveryState || 'NA').slice(0, 10),
            zip:     it.deliveryZip || '00000',
            lat:     it.deliveryLat,
            lng:     it.deliveryLng,
          });
        }
      }

      const deliveryLocs  = Array.from(deliveryLocMap.values());
      const pickupCount   = stops.length;

      const deliverySeqFor = (key: string) => {
        const idx = deliveryLocs.findIndex(d => d.key === key);
        return idx >= 0 ? pickupCount + idx + 1 : null;
      };

      const pickupPayload = stops.map((s, i) => ({
        stop_type:            'pickup',
        sequence:             i + 1,
        location_id:          s.locationId ?? null,
        name:                 s.name || null,
        contact_name:         s.contactName || null,
        contact_phone:        s.contactPhone || null,
        address:              s.address,
        city:                 s.city || 'Unknown',
        state:                (s.state || 'NA').slice(0, 10),
        zip:                  s.zip || '00000',
        lat:                  s.lat ?? null,
        lng:                  s.lng ?? null,
        scheduled_date:       s.scheduledDate || null,
        window_start:         (s.windowStart && s.windowStart !== 'OPEN')  ? s.windowStart : null,
        window_end:           (s.windowEnd   && s.windowEnd   !== 'CLOSE') ? s.windowEnd   : null,
        weight_lbs:           null,
        special_instructions: s.specialInstructions || null,
        items: s.items
          .filter(it => it.deliveryAddress.trim())
          .map(it => {
            const seq = deliverySeqFor(deliveryKey(it));
            if (!seq) return null;
            return {
              delivery_stop_sequence: seq,
              description:            it.description.trim() || 'Freight',
              quantity:               it.quantity,
              unit:                   it.unit,
              weight_lbs:             it.weightLbs ? parseInt(it.weightLbs) : null,
              sku:                    it.sku || null,
            };
          })
          .filter((it): it is NonNullable<typeof it> => !!it),
      }));

      const deliveryPayload = deliveryLocs.map((d, i) => ({
        stop_type:            'dropoff',
        sequence:             pickupCount + i + 1,
        location_id:          d.locationId,
        name:                 d.name || null,
        contact_name:         null,
        contact_phone:        null,
        address:              d.address,
        city:                 d.city,
        state:                d.state,
        zip:                  d.zip,
        lat:                  d.lat,
        lng:                  d.lng,
        scheduled_date:       null,
        window_start:         null,
        window_end:           null,
        weight_lbs:           null,
        special_instructions: null,
        items:                undefined,
      }));

      return freightJobApi.create({
        contract_id:          jobType === 'contracted' ? contractId : null,
        title:                title || null,
        reference_number:     refNum || null,
        special_instructions: instructions || null,
        optimization_mode:    optimMode,
        stops:                [...pickupPayload, ...deliveryPayload],
      });
    },
    onSuccess: res => { setCreatedJob(res.data.data); setStep(2); },
  });

  async function fetchRouteGeometry(job: any) {
    const ordered = [...(job.stops ?? [])].sort(
      (a: any, b: any) => (a.optimized_sequence ?? a.sequence) - (b.optimized_sequence ?? b.sequence)
    );
    const coords = ordered
      .filter((s: any) => s.lat && s.lng)
      .map((s: any) => `${s.lng},${s.lat}`)
      .join(';');
    if (!coords) return;
    try {
      const res  = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
      const data = await res.json();
      if (data.code === 'Ok') setRouteGeometry(data.routes[0].geometry.coordinates);
    } catch { /* silently fail — map shows markers without line */ }
  }

  const optimiseMutation = useMutation({
    mutationFn: () => freightJobApi.optimise(createdJob.id),
    onSuccess:  res => {
      const job = res.data.data;
      setCreatedJob(job);
      setOptimised(true);
      fetchRouteGeometry(job);
    },
  });

  const billingMutation = useMutation({
    mutationFn: (payload: { payment_amount_cents: number; cost_breakdown: Record<string, unknown> }) =>
      freightJobApi.saveBilling(createdJob.id, payload),
    onSuccess: res => { setCreatedJob(res.data.data); setStep(4); },
  });

  const termsMutation = useMutation({
    mutationFn: () => freightJobApi.saveTerms(createdJob.id, { quote_requirements: quoteTerms as unknown as Record<string, unknown> }),
    onSuccess: res => { setCreatedJob(res.data.data); setStep(4); },
  });

  const postMutation = useMutation({
    mutationFn: () => freightJobApi.post(createdJob.id),
    onSuccess: res => {
      const posted = res.data.data;
      setCreatedJob(posted);
      // Route to the correct viewer based on whether a contract is attached
      const isCtd = !!posted.contract_id;
      router.push(isCtd
        ? `/shipper/jobs/contracted/${posted.id}`
        : `/shipper/jobs/${posted.id}`
      );
    },
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  // Open jobs can proceed without a contract; contracted / shipment need one selected
  const canProceedStep0 = jobType === 'open' || !!contractId;

  const inputCls = 'w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3.5 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]/20';
  const labelCls = 'block mb-1.5 text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]';

  // ── Render ─────────────────────────────────────────────────────────────────

  // Show skeleton while the edit draft is being fetched so the user never
  // sees a flash of the type-selection screen before jumping to the right step.
  if (editJobId && editJobLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-xl bg-[var(--color-cream)] animate-pulse" />
        <div className="flex gap-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-9 flex-1 rounded-xl bg-[var(--color-cream)] animate-pulse" />)}
        </div>
        <div className="h-64 rounded-2xl bg-[var(--color-cream)] animate-pulse" />
        <div className="h-48 rounded-2xl bg-[var(--color-cream)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="page-title">
          {editJobId
            ? 'Edit Draft Job'
            : isShipment
              ? 'New Shipment'
              : 'New Job'}
        </h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">
          {editJobId
            ? 'Continue building your saved draft and dispatch when ready'
            : isShipment
              ? 'Dispatch to a carrier under an existing contract — no bidding. Select contract → Build → Route → Billing → Send.'
              : 'Post to the open market for bids, or dispatch under an existing contract'}
        </p>
      </div>

      {/* Step indicator — always visible */}
      <StepIndicator current={step} step3Label={jobType === 'open' ? 'Offer Terms' : 'Billing'} />

      {/* ── Step 0: Contract ── */}
      {step === 0 && (
        <div className="space-y-4">

          {/* Tier 1: Open vs Contracted — Create Job only (shipment is contracted / no-bid) */}
          {!isShipment && (
          <div className="grid grid-cols-2 gap-4">

            {/* Open */}
            <button
              onClick={() => { setJobType('open'); setShowContracts(false); setContractId(null); }}
              className={`group rounded-2xl border-2 bg-[var(--color-white)] p-6 text-left transition-all hover:shadow-md ${
                jobType === 'open'
                  ? 'border-[var(--color-teal)] shadow-sm'
                  : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]'
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl mb-4 transition-colors ${
                jobType === 'open' ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-teal-pale)] group-hover:bg-[var(--color-teal)]'
              }`}>
                <Package size={22} className={jobType === 'open' ? 'text-white' : 'text-[var(--color-teal)] group-hover:text-white transition-colors'} />
              </div>
              <p className="text-base font-bold text-[var(--color-text)]">Open</p>
              <p className="mt-1 text-sm text-[var(--color-text-faint)] leading-snug">
                No existing agreement. Build the manifest and set a rate.
              </p>
            </button>

            {/* Contracted */}
            <button
              onClick={() => { setJobType('contracted'); }}
              className={`group rounded-2xl border-2 bg-[var(--color-white)] p-6 text-left transition-all hover:shadow-md ${
                jobType === 'contracted'
                  ? 'border-[var(--color-teal)] shadow-sm'
                  : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]'
              }`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl mb-4 transition-colors ${
                jobType === 'contracted' ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-teal-pale)] group-hover:bg-[var(--color-teal)]'
              }`}>
                <Briefcase size={22} className={jobType === 'contracted' ? 'text-white' : 'text-[var(--color-teal)] group-hover:text-white transition-colors'} />
              </div>
              <p className="text-base font-bold text-[var(--color-text)]">Contracted</p>
              <p className="mt-1 text-sm text-[var(--color-text-faint)] leading-snug">
                Dispatch directly to a carrier you have an agreement with.
              </p>
            </button>

          </div>
          )}

          {isShipment && (
            <div className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-5 py-4">
              <p className="text-sm font-semibold text-[var(--color-text)]">Select a contract</p>
              <p className="mt-1 text-sm text-[var(--color-text-faint)]">
                Shipments use an existing carrier relationship. Charge is confirmed from that contract — no bidding.
              </p>
            </div>
          )}

          {/* Tier 2: Present Contract vs New Contract — Create Job contracted path only */}
          {!isShipment && jobType === 'contracted' && (
            <div className="grid grid-cols-2 gap-4">

              {/* Present Contract */}
              <button
                onClick={() => { setContractMode('present'); setShowContracts(true); }}
                className={`group rounded-2xl border-2 bg-[var(--color-white)] p-6 text-left transition-all hover:shadow-md ${
                  contractMode === 'present'
                    ? 'border-[var(--color-teal)] shadow-sm'
                    : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]'
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl mb-4 transition-colors ${
                  contractMode === 'present' ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-teal-pale)] group-hover:bg-[var(--color-teal)]'
                }`}>
                  <FileText size={22} className={contractMode === 'present' ? 'text-white' : 'text-[var(--color-teal)] group-hover:text-white transition-colors'} />
                </div>
                <p className="text-base font-bold text-[var(--color-text)]">Present Contract</p>
                <p className="mt-1 text-sm text-[var(--color-text-faint)] leading-snug">
                  Use an existing carrier contract. Rate and terms are already agreed.
                </p>
                <div className={`mt-4 flex items-center gap-1 text-sm font-semibold text-[var(--color-teal)] transition-opacity ${
                  contractMode === 'present' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  Select contract <ArrowRight size={14} />
                </div>
              </button>

              {/* New Contract */}
              <button
                onClick={() => { setContractMode('new'); setShowContracts(false); }}
                className={`group rounded-2xl border-2 bg-[var(--color-white)] p-6 text-left transition-all hover:shadow-md ${
                  contractMode === 'new'
                    ? 'border-[var(--color-slate)] shadow-sm'
                    : 'border-[var(--color-cream-dark)] hover:border-[var(--color-slate)]'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-cream)] group-hover:bg-[var(--color-slate)] transition-colors mb-4">
                  <Sparkles size={22} className="text-[var(--color-text-muted)] group-hover:text-white transition-colors" />
                </div>
                <p className="text-base font-bold text-[var(--color-text)]">New Contract</p>
                <p className="mt-1 text-sm text-[var(--color-text-faint)] leading-snug">
                  Set up a new carrier agreement first, then create jobs against it.
                </p>
                <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                  Go to Contracts <ArrowRight size={14} />
                </div>
              </button>

            </div>
          )}

          {/* Contract table — expands when Present Contract selected */}
          {showContracts && (
            <div className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] overflow-hidden">

              {/* Search bar */}
              <div className="border-b border-[var(--color-cream-dark)] px-4 py-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
                  <input
                    type="text"
                    placeholder="Search by carrier or company…"
                    value={contractSearch}
                    onChange={e => setContractSearch(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-cream)] py-2 pl-8 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-teal)] focus:outline-none"
                  />
                </div>
              </div>

              {contractsLoading ? (
                <div className="divide-y divide-[var(--color-cream-dark)]">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                      <div className="h-8 w-8 rounded-lg bg-[var(--color-cream-dark)]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-36 rounded bg-[var(--color-cream-dark)]" />
                        <div className="h-3 w-24 rounded bg-[var(--color-cream)]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredContracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText size={28} className="text-[var(--color-cream-dark)] mb-2" />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {contractSearch ? 'No contracts match your search' : 'No active contracts'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-teal-pale)]">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">Carrier</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">Equipment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">Coverage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">Valid to</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContracts.map(c => (
                      <tr
                        key={c.id}
                        onClick={() => setContractId(c.id)}
                        className={`border-b border-[var(--color-cream-dark)] last:border-0 cursor-pointer transition-colors ${
                          contractId === c.id
                            ? 'bg-[var(--color-teal-pale)]'
                            : 'hover:bg-[var(--color-cream)]'
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${contractId === c.id ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-slate)]'}`}>
                              {c.carrierAvatar || c.carrier.slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-[var(--color-text)]">{c.carrier}</p>
                              <p className="text-xs text-[var(--color-text-faint)]">{c.carrierCompany}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-[var(--color-slate)]">{c.rate}</p>
                          <p className="text-xs text-[var(--color-text-faint)]">{c.rateType}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-[var(--color-text)]">{c.equipmentType}</p>
                          {c.maxWeight && <p className="text-xs text-[var(--color-text-faint)]">{c.maxWeight} lbs max</p>}
                        </td>
                        <td className="px-4 py-3.5 text-[var(--color-text)]">{c.coverage}</td>
                        <td className="px-4 py-3.5 text-[var(--color-text)]">{c.validTo}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={c.status} />
                            {contractId === c.id && <Check size={14} className="text-[var(--color-teal)]" />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Bottom nav — step 0 */}
          <div className="flex justify-end pt-2">
            <button onClick={() => setStep(1)} disabled={!canProceedStep0}
              className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all ${
                canProceedStep0
                  ? 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)] shadow-sm'
                  : 'bg-[var(--color-cream-dark)] text-[var(--color-text-faint)] cursor-not-allowed'
              }`}>
              Next: Build manifest <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Steps 1–3 ── */}
      {step >= 1 && (
        <>
          {/* ── Step 1: Build ── */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Contract / job type banner */}
              <div className="flex items-center gap-3 rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-4 py-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${jobType === 'contracted' ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-slate)]'}`}>
                  {jobType === 'contracted' ? <FileText size={13} className="text-white" /> : <Package size={13} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--color-text-faint)]">{isShipment ? 'Carrier contract' : 'Job type'}</p>
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {jobType === 'contracted' && selectedContract
                      ? `${isShipment ? '' : 'Contracted · '}${selectedContract.carrier} — ${selectedContract.carrierCompany}`
                      : 'Open · bidding'}
                  </p>
                </div>
                {/* Hide "Change" in edit mode — the type is locked to the existing job */}
                {!editJobId && (
                  <button onClick={() => setStep(0)} className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-teal)] transition-colors">
                    Change
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-5 space-y-4">
                <h2 className="text-base font-semibold text-[var(--color-text)]">Job details</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Title <span className="normal-case font-normal opacity-60">optional</span></label>
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekly Chicago run" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Reference # <span className="normal-case font-normal opacity-60">optional</span></label>
                    <input value={refNum} onChange={e => setRefNum(e.target.value)} placeholder="ORD-1234" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Special instructions <span className="normal-case font-normal opacity-60">optional</span></label>
                  <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                    rows={2} placeholder="Fragile cargo, call ahead at each stop…" className={`${inputCls} resize-none`} />
                </div>
              </div>

              {/* Pickups */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[var(--color-text)]">
                    Pickups <span className="ml-1 text-sm font-normal text-[var(--color-text-faint)]">({stops.length})</span>
                  </h2>
                  <button onClick={() => addStop()}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--color-teal)] px-3 py-1.5 text-sm font-semibold text-[var(--color-teal)] hover:bg-[var(--color-teal-pale)] transition-colors">
                    <Plus size={13} /> Add pickup
                  </button>
                </div>
                {stops.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[var(--color-cream-dark)] py-6 text-center">
                    <p className="text-sm text-[var(--color-text-faint)]">No pickups yet — add your first pickup above</p>
                  </div>
                )}
                {stops.map((stop, i) => (
                  <StopCard key={stop.localId} stop={stop} index={i}
                    defaultDelivery={defaultDelivery}
                    onUpdate={s => updateStop(stop.localId, s)} onRemove={() => removeStop(stop.localId)} />
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                {/* In edit mode: go back to the job view page instead of type-selection */}
                <button
                  onClick={() => editJobId
                    ? router.push(jobType === 'contracted'
                        ? `/shipper/jobs/contracted/${editJobId}`
                        : `/shipper/jobs/${editJobId}`)
                    : setStep(0)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                  <ChevronLeft size={15} /> {editJobId ? 'Back to job' : 'Prev'}
                </button>
                {/* In edit mode: job already exists — skip createMutation and go straight to Route */}
                <button
                  onClick={() => createdJob ? setStep(2) : createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all ${
                    !createMutation.isPending
                      ? 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)] shadow-sm'
                      : 'bg-[var(--color-cream-dark)] text-[var(--color-text-faint)] cursor-not-allowed'
                  }`}>
                  {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                  Next: Plan route <ChevronRight size={15} />
                </button>
              </div>
              <div className="h-48" />
            </div>
          )}

          {/* ── Step 3: Route ── */}
          {step === 2 && (() => {
            const orderedStops = createdJob
              ? [...(createdJob.stops ?? [])].sort(
                  (a: any, b: any) => (a.optimized_sequence ?? a.sequence) - (b.optimized_sequence ?? b.sequence)
                )
              : [];
            const mapStops: RouteMapStop[] = orderedStops
              .filter((s: any) => s.lat && s.lng)
              .map((s: any, i: number) => ({
                lat: parseFloat(s.lat), lng: parseFloat(s.lng),
                stopType: s.stop_type as 'pickup' | 'dropoff',
                label: String.fromCharCode(65 + i),
              }));

            return (
              <div className="space-y-5">

                {/* Controls row */}
                <div className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <span className="text-sm font-semibold text-[var(--color-text)]">Optimisation</span>
                      {([
                        { value: 'shortest_route',  label: 'Shortest Route'  },
                        { value: 'cluster_pickups', label: 'Cluster Pickups' },
                      ] as const).map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="radio" name="optimMode" value={opt.value}
                            checked={optimMode === opt.value}
                            onChange={() => { setOptimMode(opt.value); setOptimised(false); setRouteGeometry(null); }}
                            className="accent-[var(--color-teal)] w-4 h-4"
                          />
                          <span className="text-sm text-[var(--color-text)]">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() => { setOptimised(false); setRouteGeometry(null); optimiseMutation.mutate(); }}
                      disabled={optimiseMutation.isPending}
                      className="flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] shadow-sm transition-colors disabled:opacity-60">
                      {optimiseMutation.isPending
                        ? <><Loader2 size={14} className="animate-spin" /> Calculating…</>
                        : <><Route size={14} /> Calculate route</>
                      }
                    </button>
                  </div>
                </div>

                {/* 40 / 60 — stop list + map */}
                {optimised && createdJob && (
                  <div className="rounded-2xl border border-[var(--color-cream-dark)] overflow-hidden flex" style={{ height: '540px' }}>

                    {/* Left 40% — ordered stop list */}
                    <div className="flex flex-col border-r border-[var(--color-cream-dark)] bg-[var(--color-white)]" style={{ width: '40%' }}>

                      {/* Summary strip */}
                      <div className="shrink-0 flex items-center gap-6 px-5 py-4 bg-[var(--color-teal-pale)] border-b border-[var(--color-cream-dark)]">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Distance</p>
                          <p className="text-xl font-bold text-[var(--color-slate)]">{createdJob.route_distance_miles?.toFixed(0)} mi</p>
                        </div>
                        {createdJob.route_duration_minutes && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Est. drive</p>
                            <p className="text-xl font-bold text-[var(--color-slate)]">
                              {Math.floor(createdJob.route_duration_minutes / 60)}h {createdJob.route_duration_minutes % 60}m
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Stops</p>
                          <p className="text-xl font-bold text-[var(--color-slate)]">{orderedStops.length}</p>
                        </div>
                      </div>

                      {/* Stop list */}
                      <div className="flex-1 overflow-y-auto py-2">
                        {orderedStops.map((stop: any, i: number) => (
                          <div key={stop.id} className="relative flex items-start gap-3 px-5 py-3">
                            {i < orderedStops.length - 1 && (
                              <div className="absolute left-[34px] top-[40px] bottom-0 w-px bg-[var(--color-cream-dark)]" />
                            )}
                            <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                              stop.stop_type === 'pickup' ? 'bg-[var(--color-slate)]' : 'bg-[var(--color-teal)]'
                            }`}>
                              {String.fromCharCode(65 + i)}
                            </div>
                            <div className="min-w-0 pt-0.5">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{stop.stop_type}</p>
                              <p className="text-sm font-semibold text-[var(--color-text)]">
                                {stop.name || `${stop.city}, ${stop.state}`}
                              </p>
                              <p className="text-xs text-[var(--color-text-faint)] truncate">{stop.city}, {stop.state} · {stop.address}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right 60% — map */}
                    <div className="flex-1">
                      <RouteMap stops={mapStops} geometry={routeGeometry ?? undefined} className="h-full w-full" />
                    </div>

                  </div>
                )}

                {/* Prev / Next */}
                <div className="flex items-center justify-between">
                  <button onClick={() => { setStep(1); setOptimised(false); setRouteGeometry(null); }}
                    className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                    <ChevronLeft size={15} /> Prev
                  </button>
                  <button onClick={() => setStep(3)} disabled={!optimised}
                    className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all ${
                      optimised
                        ? 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)] shadow-sm'
                        : 'bg-[var(--color-cream-dark)] text-[var(--color-text-faint)] cursor-not-allowed'
                    }`}>
                    {jobType === 'open' ? 'Next: Offer Terms' : 'Next: Billing'} <ChevronRight size={15} />
                  </button>
                </div>

              </div>
            );
          })()}

          {/* ── Step 3: Offer Terms (open) or Billing (contracted) ── */}
          {step === 3 && createdJob && (() => {
            // ── Open jobs: Offer Terms ────────────────────────────────────────
            if (jobType === 'open') {
              const inputSm = 'w-full rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-1.5 text-sm focus:border-[var(--color-teal)] focus:outline-none';
              return (
                <div className="space-y-5">

                  <div className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] overflow-hidden">

                    {/* Card header */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-teal)]">
                        <Tag size={14} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--color-text)]">Offer Terms</p>
                        <p className="text-xs text-[var(--color-text-faint)]">Define what carriers must quote on for this job</p>
                      </div>
                    </div>

                    <div className="p-5 space-y-6">

                      {/* Preset grid */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)] mb-3">Choose a preset</p>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                          {QUOTE_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setQuoteTerms({ ...preset.defaults, preset: preset.id })}
                              className={`rounded-xl border-2 p-3.5 text-left transition-all ${
                                quoteTerms.preset === preset.id
                                  ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]'
                                  : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]/50 hover:bg-[var(--color-cream)]'
                              }`}
                            >
                              <p className={`text-sm font-bold leading-snug ${quoteTerms.preset === preset.id ? 'text-[var(--color-teal)]' : 'text-[var(--color-text)]'}`}>
                                {preset.label}
                              </p>
                              <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5 leading-snug">{preset.desc}</p>
                              {quoteTerms.preset === preset.id && (
                                <div className="mt-2 flex items-center gap-1 text-[var(--color-teal)]">
                                  <Check size={11} />
                                  <span className="text-[10px] font-semibold">Selected</span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Terms customizer */}
                      <div className="rounded-xl border border-[var(--color-cream-dark)] p-4 space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">Customize terms</p>

                        {/* Rate type */}
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)] mb-2">Rate type</p>
                          <div className="flex gap-2">
                            {([
                              { value: 'flat',     label: 'Flat'     },
                              { value: 'per_mile', label: 'Per Mile' },
                              { value: 'hourly',   label: 'Hourly'   },
                            ] as const).map(rt => (
                              <button key={rt.value} type="button"
                                onClick={() => setQuoteTerms(prev => ({ ...prev, rate_type: rt.value }))}
                                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                                  quoteTerms.rate_type === rt.value
                                    ? 'border-[var(--color-teal)] bg-[var(--color-teal)] text-white'
                                    : 'border-[var(--color-cream-dark)] bg-[var(--color-white)] text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]'
                                }`}>
                                {rt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Toggle fields */}
                        <div className="space-y-2">
                          <TermsToggle
                            checked={quoteTerms.require_fuel_surcharge}
                            onChange={v => setQuoteTerms(prev => ({ ...prev, require_fuel_surcharge: v }))}
                            label="Fuel surcharge"
                            desc="Carrier must quote a fuel surcharge amount"
                          />
                          <TermsToggle
                            checked={quoteTerms.require_detention_rate}
                            onChange={v => setQuoteTerms(prev => ({ ...prev, require_detention_rate: v }))}
                            label="Detention rate"
                            desc="Carrier must quote detention rate and free time"
                          />
                          {quoteTerms.require_detention_rate && (
                            <div className="ml-7 flex items-center gap-2 mt-1">
                              <label className="text-xs text-[var(--color-text-faint)] whitespace-nowrap">Free time hours:</label>
                              <input type="number" min={0} max={24}
                                value={quoteTerms.free_time_hrs}
                                onChange={e => setQuoteTerms(prev => ({ ...prev, free_time_hrs: parseInt(e.target.value) || 0 }))}
                                className="w-16 rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-2 py-1 text-sm text-center focus:border-[var(--color-teal)] focus:outline-none" />
                            </div>
                          )}
                          <TermsToggle
                            checked={quoteTerms.require_equipment_type}
                            onChange={v => setQuoteTerms(prev => ({ ...prev, require_equipment_type: v }))}
                            label="Equipment type"
                            desc="Carrier must specify the equipment type they'll use"
                          />
                          {quoteTerms.require_equipment_type && (
                            <div className="ml-7 mt-1">
                              <input type="text"
                                value={quoteTerms.equipment_type_hint}
                                onChange={e => setQuoteTerms(prev => ({ ...prev, equipment_type_hint: e.target.value }))}
                                placeholder="Hint shown to carriers, e.g. Reefer, Flatbed…"
                                className={inputSm} />
                            </div>
                          )}
                          <TermsToggle
                            checked={quoteTerms.require_max_weight}
                            onChange={v => setQuoteTerms(prev => ({ ...prev, require_max_weight: v }))}
                            label="Max weight capacity"
                            desc="Carrier must state their maximum payload capacity"
                          />
                          <TermsToggle
                            checked={quoteTerms.require_payment_terms}
                            onChange={v => setQuoteTerms(prev => ({ ...prev, require_payment_terms: v }))}
                            label="Payment terms"
                            desc="Carrier must specify their required payment terms"
                          />
                          {quoteTerms.require_payment_terms && (
                            <div className="ml-7 mt-1">
                              <input type="text"
                                value={quoteTerms.payment_terms_hint}
                                onChange={e => setQuoteTerms(prev => ({ ...prev, payment_terms_hint: e.target.value }))}
                                placeholder="Default suggestion, e.g. Net 30"
                                className={inputSm} />
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Prev / Confirm */}
                  <div className="flex items-center justify-between">
                    <button onClick={() => setStep(2)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                      <ChevronLeft size={15} /> Prev
                    </button>
                    <button
                      onClick={() => termsMutation.mutate()}
                      disabled={termsMutation.isPending}
                      className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all ${
                        !termsMutation.isPending
                          ? 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)] shadow-sm'
                          : 'bg-[var(--color-cream-dark)] text-[var(--color-text-faint)] cursor-not-allowed'
                      }`}>
                      {termsMutation.isPending
                        ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
                        : <>Confirm &amp; Review <ChevronRight size={15} /></>
                      }
                    </button>
                  </div>
                </div>
              );
            }

            const billing = calcBilling(selectedContract, createdJob);
            return (
              <div className="space-y-5">

                <div className="grid grid-cols-5 gap-5">

                  {/* Left 3/5 — cost breakdown */}
                  <div className="col-span-3 rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] overflow-hidden">

                    {/* Header */}
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-teal)]">
                        <Receipt size={14} className="text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--color-text)]">Cost Breakdown</p>
                        <p className="text-xs text-[var(--color-text-faint)]">Calculated from contract terms</p>
                      </div>
                    </div>

                    {billing ? (
                      <div className="px-6 py-5 space-y-0">

                        {/* Line items */}
                        {billing.lines.map((line, i) => (
                          <div key={i} className={`flex items-start justify-between py-3.5 ${
                            i < billing.lines.length - 1 ? 'border-b border-[var(--color-cream-dark)]' : ''
                          }`}>
                            <p className="text-sm font-semibold text-[var(--color-text)]">{line.label}</p>
                            <p className="text-sm font-semibold text-[var(--color-text)] tabular-nums shrink-0 ml-4">
                              {fmt(line.amount)}
                            </p>
                          </div>
                        ))}

                        {/* Total */}
                        <div className="flex items-center justify-between pt-4 mt-1 border-t-2 border-[var(--color-slate)]">
                          <p className="text-base font-bold text-[var(--color-slate)]">Total</p>
                          <p className="text-xl font-bold text-[var(--color-slate)] tabular-nums">{fmt(billing.total)}</p>
                        </div>

                      </div>
                    ) : (
                      <div className="px-6 py-10 text-center">
                        <p className="text-sm text-[var(--color-text-faint)]">Route must be calculated before billing can be computed.</p>
                      </div>
                    )}

                  </div>

                  {/* Right 2/5 — contract snapshot */}
                  <div className="col-span-2 rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] overflow-hidden">

                    <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-slate)]">
                        <FileText size={14} className="text-white" />
                      </div>
                      <p className="text-sm font-bold text-[var(--color-text)]">Contract</p>
                    </div>

                    {selectedContract ? (
                      <div className="px-5 py-5 space-y-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Carrier</p>
                          <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5">{selectedContract.carrier}</p>
                          {selectedContract.carrierCompany && (
                            <p className="text-xs text-[var(--color-text-faint)]">{selectedContract.carrierCompany}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Rate type</p>
                            <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5">{selectedContract.rateType}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Rate</p>
                            <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5">{selectedContract.rate}</p>
                          </div>
                          {selectedContract.fuelSurcharge && parseMoney(selectedContract.fuelSurcharge) > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Fuel surcharge</p>
                              <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5">{selectedContract.fuelSurcharge}</p>
                            </div>
                          )}
                          {selectedContract.paymentTerms && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Payment</p>
                              <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5">{selectedContract.paymentTerms}</p>
                            </div>
                          )}
                          {selectedContract.equipmentType && (
                            <div className="col-span-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Equipment</p>
                              <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5">{selectedContract.equipmentType}</p>
                            </div>
                          )}
                        </div>
                        {/* Route summary */}
                        <div className="rounded-xl bg-[var(--color-cream)] px-4 py-3 space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Route summary</p>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--color-text-faint)]">Distance</span>
                            <span className="font-semibold text-[var(--color-text)]">{createdJob.route_distance_miles?.toFixed(1)} mi</span>
                          </div>
                          {createdJob.route_duration_minutes && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-[var(--color-text-faint)]">Est. drive</span>
                              <span className="font-semibold text-[var(--color-text)]">
                                {Math.floor(createdJob.route_duration_minutes / 60)}h {createdJob.route_duration_minutes % 60}m
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--color-text-faint)]">Stops</span>
                            <span className="font-semibold text-[var(--color-text)]">{createdJob.stops?.length ?? 0}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-5">
                        <p className="text-sm text-[var(--color-text-faint)]">No contract selected (Open job).</p>
                      </div>
                    )}

                  </div>
                </div>

                {/* Prev / Confirm */}
                <div className="flex items-center justify-between">
                  <button onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                    <ChevronLeft size={15} /> Prev
                  </button>
                  <button
                    onClick={() => billing && billingMutation.mutate({ payment_amount_cents: billing.totalCents, cost_breakdown: billing.breakdown })}
                    disabled={!billing || billingMutation.isPending}
                    className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all ${
                      billing && !billingMutation.isPending
                        ? 'bg-[var(--color-teal)] text-white hover:bg-[var(--color-teal-dark)] shadow-sm'
                        : 'bg-[var(--color-cream-dark)] text-[var(--color-text-faint)] cursor-not-allowed'
                    }`}>
                    {billingMutation.isPending
                      ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
                      : <>Confirm &amp; Review <ChevronRight size={15} /></>
                    }
                  </button>
                </div>

              </div>
            );
          })()}

          {/* ── Step 4: Review & Send ── */}
          {step === 4 && createdJob && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-6 space-y-5">
                <h2 className="text-base font-semibold text-[var(--color-text)]">Review & dispatch</h2>

                <div className="rounded-xl bg-[var(--color-cream)] p-4 space-y-3">
                  {jobType === 'contracted' ? (
                    <div className="flex items-center gap-3">
                      <FileText size={14} className="text-[var(--color-teal)]" />
                      <div>
                        <p className="text-xs text-[var(--color-text-faint)]">Contract</p>
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          {selectedContract?.carrier} · {selectedContract?.carrierCompany}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Tag size={14} className="text-[var(--color-teal)]" />
                      <div>
                        <p className="text-xs text-[var(--color-text-faint)]">Job type</p>
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          Open market · {createdJob.quote_requirements?.preset
                            ? QUOTE_PRESETS.find(p => p.id === createdJob.quote_requirements.preset)?.label ?? createdJob.quote_requirements.preset
                            : 'Custom terms'}
                        </p>
                      </div>
                    </div>
                  )}
                  {title && (
                    <div className="flex items-center gap-3">
                      <Package size={14} className="text-[var(--color-teal)]" />
                      <div>
                        <p className="text-xs text-[var(--color-text-faint)]">Job title</p>
                        <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Route size={14} className="text-[var(--color-teal)]" />
                    <div>
                      <p className="text-xs text-[var(--color-text-faint)]">Route</p>
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        {createdJob.route_distance_miles?.toFixed(0)} mi · {stops.length} pickup{stops.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {createdJob.payment_amount_cents != null && (
                    <div className="flex items-center gap-3">
                      <DollarSign size={14} className="text-[var(--color-teal)]" />
                      <div>
                        <p className="text-xs text-[var(--color-text-faint)]">Total quoted</p>
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          {fmt(createdJob.payment_amount_cents / 100)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Cost breakdown — from saved job data */}
                {createdJob.cost_breakdown && (() => {
                  const bd = createdJob.cost_breakdown;
                  const bLines = [
                    { label: 'Base charge', amount: bd.base_amount as number },
                    ...(bd.fuel_amount > 0 ? [{ label: 'Fuel surcharge', amount: bd.fuel_amount as number }] : []),
                    { label: 'Platform fee', amount: bd.platform_fee as number },
                  ];
                  return (
                    <div className="rounded-xl border border-[var(--color-cream-dark)] overflow-hidden">
                      <div className="px-4 py-2.5 bg-[var(--color-cream)] border-b border-[var(--color-cream-dark)]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Cost breakdown</p>
                      </div>
                      {bLines.map((l, i) => (
                        <div key={i} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i < bLines.length - 1 ? 'border-b border-[var(--color-cream-dark)]' : ''}`}>
                          <span className="text-[var(--color-text-muted)]">{l.label}</span>
                          <span className="font-semibold tabular-nums text-[var(--color-text)]">{fmt(l.amount)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-teal-pale)] border-t-2 border-[var(--color-teal)]">
                        <span className="text-sm font-bold text-[var(--color-teal)]">Total</span>
                        <span className="text-base font-bold tabular-nums text-[var(--color-teal)]">{fmt(bd.total as number)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Offer terms summary for open jobs */}
                {jobType === 'open' && createdJob.quote_requirements && (() => {
                  const qr = createdJob.quote_requirements;
                  const termLines: { label: string; value: string }[] = [
                    { label: 'Rate type', value: qr.rate_type === 'per_mile' ? 'Per Mile' : qr.rate_type === 'hourly' ? 'Hourly' : 'Flat Rate' },
                    ...(qr.require_fuel_surcharge  ? [{ label: 'Fuel surcharge',     value: 'Required' }] : []),
                    ...(qr.require_detention_rate  ? [{ label: 'Detention rate',     value: `Required · ${qr.free_time_hrs ?? 2}h free` }] : []),
                    ...(qr.require_equipment_type  ? [{ label: 'Equipment type',     value: qr.equipment_type_hint || 'Required' }] : []),
                    ...(qr.require_max_weight      ? [{ label: 'Max weight',         value: 'Required' }] : []),
                    ...(qr.require_payment_terms   ? [{ label: 'Payment terms',      value: qr.payment_terms_hint || 'Required' }] : []),
                  ];
                  return (
                    <div className="rounded-xl border border-[var(--color-cream-dark)] overflow-hidden">
                      <div className="px-4 py-2.5 bg-[var(--color-cream)] border-b border-[var(--color-cream-dark)]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">Offer terms carriers must provide</p>
                      </div>
                      {termLines.map((l, i) => (
                        <div key={i} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i < termLines.length - 1 ? 'border-b border-[var(--color-cream-dark)]' : ''}`}>
                          <span className="text-[var(--color-text-muted)]">{l.label}</span>
                          <span className="font-semibold text-[var(--color-text)]">{l.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <RouteResult job={createdJob} />

                {jobType === 'contracted' ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800">
                      <strong>Carrier will be notified immediately.</strong> No acceptance required — the existing contract covers this job.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[var(--color-teal)]/30 bg-[var(--color-teal-pale)] px-4 py-3">
                    <p className="text-sm text-[var(--color-teal)]">
                      <strong>Open market posting.</strong> Carriers will submit offers with the terms you defined. You review offers and accept the best one.
                    </p>
                  </div>
                )}
              </div>

              {createdJob.status === 'posted' ? (
                <div className="flex items-center justify-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Job dispatched</p>
                    <p className="text-xs text-emerald-600">Carrier has been notified. Redirecting…</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                    <ChevronLeft size={15} /> Prev
                  </button>
                  <button onClick={() => postMutation.mutate()} disabled={postMutation.isPending}
                    className="flex items-center gap-2 rounded-xl bg-[var(--color-teal)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] shadow-sm transition-colors disabled:opacity-60">
                    {postMutation.isPending
                      ? <><Loader2 size={13} className="animate-spin" /> Posting…</>
                      : <><Send size={15} /> {jobType === 'open' ? 'Post to market' : isShipment ? 'Send shipment' : 'Dispatch to carrier'}</>
                    }
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CreateJobWizard;
