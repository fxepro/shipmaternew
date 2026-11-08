'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CatalogItem { key: string; name: string; kind?: string; group?: string; service_type_key?: string | null }
export interface Catalog {
  equipment: CatalogItem[]; features: CatalogItem[]; endorsements: CatalogItem[];
  categories: CatalogItem[]; pro_roles: CatalogItem[]; haul_types: CatalogItem[];
}

const EMPTY: Catalog = { equipment: [], features: [], endorsements: [], categories: [], pro_roles: [], haul_types: [] };

/** Equipment types, vehicle features, endorsements, company categories, pro roles. Changes rarely. */
export function useCatalog(): Catalog {
  const { data } = useQuery({
    queryKey: ['capabilities-catalog'],
    queryFn: () => api.get('/api/v1/capabilities').then((r) => r.data.data as Catalog),
    staleTime: 60 * 60 * 1000,
  });
  return data ?? EMPTY;
}

export function nameOf(items: CatalogItem[], key: string): string {
  return items.find((i) => i.key === key)?.name ?? key.replace(/_/g, ' ');
}

/** Toggle chips for a multi-select from a catalog */
export function ChipPicker({ items, value, onChange, disabled, grouped }: {
  items: CatalogItem[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean; grouped?: boolean;
}) {
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  const chip = (i: CatalogItem) => {
    const on = value.includes(i.key);
    return (
      <button key={i.key} type="button" disabled={disabled} onClick={() => toggle(i.key)} aria-pressed={on}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${on
          ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)] text-[var(--color-teal)]'
          : 'border-[var(--color-cream-dark)] bg-[var(--color-white)] text-[var(--color-text-muted)] hover:border-[var(--color-teal)]'}`}>
        {i.name}
      </button>
    );
  };
  if (!grouped) return <div className="flex flex-wrap gap-1.5">{items.map(chip)}</div>;
  const groups = Array.from(new Set(items.map((i) => i.group ?? '')));
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g}>
          {g && <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">{g}</p>}
          <div className="flex flex-wrap gap-1.5">{items.filter((i) => (i.group ?? '') === g).map(chip)}</div>
        </div>
      ))}
    </div>
  );
}
