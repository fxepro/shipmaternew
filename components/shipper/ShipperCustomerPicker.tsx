'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface ShipperCustomer { orgId: number | null; name: string }

/**
 * Brokers: which shipper the load is for. Pick a shipper that is on Shipmater, or type the name of one that isn't.
 */
export function ShipperCustomerPicker({ value, onChange, inputCls, labelCls }: {
  value: ShipperCustomer; onChange: (v: ShipperCustomer) => void; inputCls: string; labelCls: string;
}) {
  const [matches, setMatches] = useState<{ id: number; name: string; city?: string | null; state?: string | null }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = value.name.trim();
    if (value.orgId || q.length < 2) { setMatches([]); return; }
    const t = setTimeout(() => {
      api.get('/api/v1/directory/orgs', { params: { type: 'shipper', q, limit: 8 } })
        .then((r) => setMatches(r.data?.data ?? []))
        .catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(t);
  }, [value.name, value.orgId]);

  return (
    <div className="relative">
      <label className={labelCls}>Shipper (your customer)</label>
      <input value={value.name} placeholder="Search shippers on Shipmater, or type the shipper's name"
        onChange={(e) => { onChange({ orgId: null, name: e.target.value }); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={inputCls} />
      <p className="mt-1 text-xs text-[var(--color-text-faint)]">
        {value.orgId ? 'On Shipmater: they can follow this load.' : value.name.trim() ? 'Not on Shipmater: the name is kept on the load.' : 'Required.'}
      </p>
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] shadow-lg">
          {matches.map((m) => (
            <li key={m.id}>
              <button type="button" onMouseDown={() => { onChange({ orgId: m.id, name: m.name }); setOpen(false); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-cream)]">
                {m.name}{m.city ? <span className="text-[var(--color-text-faint)]"> · {[m.city, m.state].filter(Boolean).join(', ')}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
