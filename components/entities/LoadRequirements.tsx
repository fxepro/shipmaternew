'use client';

import { ChipPicker, useCatalog } from './catalog';

export interface Requirements {
  equipment_types: string[]; required_capabilities: string[]; hazmat: boolean;
  temp_min_f: number | null; temp_max_f: number | null;
}
export const EMPTY_REQUIREMENTS: Requirements = { equipment_types: [], required_capabilities: [], hazmat: false, temp_min_f: null, temp_max_f: null };

const COLD = ['reefer'];

/** What a load needs from the carrier. Used to match the load with carriers whose fleet fits. */
export function LoadRequirements({ value, onChange }: { value: Requirements; onChange: (v: Requirements) => void }) {
  const catalog = useCatalog();
  const set = <K extends keyof Requirements>(k: K, v: Requirements[K]) => onChange({ ...value, [k]: v });
  const cold = value.equipment_types.some((e) => COLD.includes(e));
  const num = (s: string) => (s === '' ? null : Number(s));
  const label = 'mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]';

  return (
    <div className="space-y-4">
      <div>
        <span className={label}>Equipment (any of these)</span>
        <ChipPicker items={catalog.equipment} value={value.equipment_types} onChange={(v) => set('equipment_types', v)} />
      </div>
      <div>
        <span className={label}>Must have</span>
        <ChipPicker items={catalog.features} value={value.required_capabilities.filter((k) => catalog.features.some((f) => f.key === k))}
          onChange={(v) => set('required_capabilities', [...v, ...value.required_capabilities.filter((k) => catalog.endorsements.some((e) => e.key === k))])} />
      </div>
      <div>
        <span className={label}>Driver endorsements</span>
        <ChipPicker items={catalog.endorsements} value={value.required_capabilities.filter((k) => catalog.endorsements.some((e) => e.key === k))}
          onChange={(v) => set('required_capabilities', [...value.required_capabilities.filter((k) => catalog.features.some((f) => f.key === k)), ...v])} />
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input type="checkbox" checked={value.hazmat} onChange={(e) => set('hazmat', e.target.checked)} className="h-4 w-4 accent-[var(--color-teal)]" />
          Hazardous materials
        </label>
        {(cold || value.temp_min_f !== null || value.temp_max_f !== null) && (
          <div className="flex items-end gap-2">
            <label className="text-xs text-[var(--color-text-muted)]">Temp. from (°F)
              <input type="number" value={value.temp_min_f ?? ''} onChange={(e) => set('temp_min_f', num(e.target.value))}
                className="mt-1 block w-24 rounded-lg border border-[var(--color-cream-dark)] px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-[var(--color-text-muted)]">to (°F)
              <input type="number" value={value.temp_max_f ?? ''} onChange={(e) => set('temp_max_f', num(e.target.value))}
                className="mt-1 block w-24 rounded-lg border border-[var(--color-cream-dark)] px-2 py-1.5 text-sm" />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
