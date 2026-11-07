'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Warehouse, Users, X } from 'lucide-react';
import { locationApi } from '@/lib/api';

export interface LocationOption {
  id:            number;
  name:          string;
  address:       string;
  city:          string;
  state:         string;
  zip:           string;
  lat:           number | null;
  lng:           number | null;
  contact_name:  string | null;
  contact_phone: string | null;
  notes:         string | null;
  /** Whose location it is: yours, a receiver in your list, or another public one in the directory */
  org_name?:     string | null;
  source?:       'mine' | 'partner' | 'directory';
}

function toOption(r: any): LocationOption {
  return {
    id:            r.id,
    name:          r.name ?? '',
    address:       r.address ?? '',
    city:          r.city ?? '',
    state:         r.state ?? '',
    zip:           r.zip ?? '',
    lat:           r.lat != null ? Number(r.lat) : null,
    lng:           r.lng != null ? Number(r.lng) : null,
    contact_name:  r.contact_name ?? null,
    contact_phone: r.contact_phone ?? null,
    notes:         r.notes ?? null,
    org_name:      r.org_name ?? null,
    source:        r.source,
  };
}

export function formatLocationLine(loc: LocationOption) {
  return [loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(', ');
}

type LocationType = 'pickup' | 'delivery';

const SOURCE_LABEL = { mine: 'Your location', partner: 'In your list', directory: 'Directory' } as const;

/**
 * Location typeahead over every location a load can use: your own, your receivers' and brokers', and other companies'
 * public ones. A location can be a pickup or a dropoff; `type` only changes the icon and placeholder.
 * - chip mode (default): selected location shows as a chip (Create Job)
 * - freeText mode: keeps a normal input; DB hits appear as suggestions (Route Planner)
 */
export function LocationSearch({
  type,
  selectedName,
  onSelect,
  onClear,
  placeholder,
  mode = 'chip',
  value,
  onChange,
  onKeyDown,
  error,
  resolved,
  className,
}: {
  type:          LocationType;
  selectedName?: string;
  onSelect:      (loc: LocationOption) => void;
  onClear?:      () => void;
  placeholder?:  string;
  mode?:         'chip' | 'freeText';
  /** freeText: controlled input value */
  value?:        string;
  onChange?:     (v: string) => void;
  onKeyDown?:    (e: React.KeyboardEvent<HTMLInputElement>) => void;
  error?:        boolean;
  resolved?:     boolean;
  className?:    string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(false);
  const [rect,  setRect]    = useState<DOMRect | null>(null);
  const wrapRef             = useRef<HTMLDivElement>(null);

  const query = mode === 'freeText' ? (value ?? '') : search;

  const { data: res } = useQuery({
    queryKey: ['locations', 'usable', query.trim()],
    queryFn:  () => locationApi.usable(query.trim() || undefined),
    enabled:  open,
  });

  const locations: LocationOption[] = (res?.data?.data ?? []).map(toOption);

  function handleFocus() {
    setOpen(true);
    if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect());
  }

  function pick(loc: LocationOption) {
    onSelect(loc);
    setOpen(false);
    setSearch('');
  }

  // Chip mode — selected state
  if (mode === 'chip' && selectedName) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-teal)] bg-[var(--color-teal-pale)] px-3 py-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--color-teal)]">
          {type === 'pickup' ? <Warehouse size={10} className="text-white" /> : <Users size={10} className="text-white" />}
        </div>
        <span className="flex-1 truncate text-sm font-semibold text-[var(--color-teal)]">{selectedName}</span>
        {onClear && (
          <button type="button" onClick={onClear} className="shrink-0 rounded p-0.5 hover:bg-[var(--color-teal)]/20 transition-colors">
            <X size={12} className="text-[var(--color-teal)]" />
          </button>
        )}
      </div>
    );
  }

  const dropdown = open && locations.length > 0 && rect
    ? createPortal(
        <div
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 240), zIndex: 9999 }}
          className="rounded-xl border border-[var(--color-cream-dark)] bg-white shadow-xl max-h-52 overflow-y-auto"
        >
          {locations.map(loc => (
            <button
              key={loc.id}
              type="button"
              onMouseDown={() => pick(loc)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-cream)] transition-colors"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-teal-pale)] mt-0.5">
                {type === 'pickup' ? <Warehouse size={12} className="text-[var(--color-teal)]" /> : <Users size={12} className="text-[var(--color-teal)]" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                  {loc.org_name && loc.source !== 'mine' ? `${loc.org_name} · ` : ''}{loc.name}
                </p>
                <p className="text-xs text-[var(--color-text-faint)]">
                  {loc.address}, {loc.city}, {loc.state}
                  {loc.source && <span className="ml-1.5 text-[var(--color-text-muted)]">· {SOURCE_LABEL[loc.source]}</span>}
                </p>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  const inputValue = mode === 'freeText' ? (value ?? '') : search;

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] pointer-events-none" />
      <input
        value={inputValue}
        onChange={e => {
          if (mode === 'freeText') onChange?.(e.target.value);
          else setSearch(e.target.value);
          setOpen(true);
          if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect());
        }}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? (type === 'pickup' ? 'Search your locations or the directory…' : 'Search receivers, stores, warehouses…')}
        className={
          mode === 'freeText'
            ? [
                'w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none transition-colors',
                'bg-[var(--color-cream)] border',
                error
                  ? 'border-[var(--color-danger)] bg-red-50 text-[var(--color-danger)]'
                  : resolved
                    ? 'border-[var(--color-teal)] text-[var(--color-text)]'
                    : 'border-[var(--color-cream-dark)] text-[var(--color-text)]',
                'placeholder:text-[var(--color-text-faint)]',
                'focus:border-[var(--color-teal)]',
              ].join(' ')
            : 'w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] pl-9 pr-4 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none'
        }
      />
      {dropdown}
    </div>
  );
}
