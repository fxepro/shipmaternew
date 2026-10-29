import { formatCurrency } from '@/lib/utils';

export type Row = Record<string, unknown>;

export function display(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return <span className="text-[var(--color-text-faint)]">—</span>;
  if (key === 'agreed_cost') return formatCurrency(Number(value));
  if (key === 'platform_fee_cents') return formatCurrency(Number(value) / 100);
  if (key === 'amount') return formatCurrency(Number(value));
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : <span className="text-[var(--color-text-faint)]">None</span>;
  if (typeof value === 'object') return <code className="text-xs break-all">{JSON.stringify(value)}</code>;
  const str = String(value);
  // Date-only columns serialize as midnight UTC; show the calendar date without a timezone shift
  const dateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})(T00:00:00(\.0+)?Z)?$/);
  if (dateOnly) return new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]).toLocaleDateString();
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return new Date(str).toLocaleString();
  if (key === 'status' || key.endsWith('_status')) return str.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  if (/^https?:\/\//.test(str)) return <a href={str} target="_blank" rel="noreferrer" className="text-[var(--color-teal)] underline break-all">Open</a>;
  return <span className="break-all">{str}</span>;
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <p className="border-b border-[var(--color-cream-dark)] px-5 py-3 text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{title}</p>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Fields({ data, fields, single }: { data: Row; fields: [string, string][]; single?: boolean }) {
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-3 ${single ? '' : 'sm:grid-cols-2'}`}>
      {fields.map(([key, label]) => (
        <div key={key} className="min-w-0">
          <dt className="text-xs text-[var(--color-text-faint)]">{label}</dt>
          <dd className="mt-0.5 text-sm text-[var(--color-text)]">{display(key, data[key])}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Table({ rows, columns, empty }: { rows: Row[]; columns: [string, string][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-[var(--color-text-muted)]">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-cream-dark)]">
            {columns.map(([, label]) => (
              <th key={label} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id ?? i)} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
              {columns.map(([key]) => (
                <td key={key} className="px-3 py-2 align-top text-[var(--color-text)]">{display(key, r[key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
