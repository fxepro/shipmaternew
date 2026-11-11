'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { DEFINITIONS, type Definition, type Portal } from '@/lib/resources/definitions';
import { usePortal } from '@/lib/portal';

/** Resources → Definitions: the platform's vocabulary, grouped, searchable, with the industry term beside each */
export function Definitions({ portal }: { portal: Portal }) {
  const [q, setQ] = useState('');
  const to = usePortal();

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return DEFINITIONS;
    const hit = (d: Definition) => [d.term, d.short, d.detail, d.industry, d.replaces].some((s) => s?.toLowerCase().includes(needle));
    return DEFINITIONS.map((g) => ({ ...g, terms: g.terms.filter(hit) })).filter((g) => g.terms.length);
  }, [q]);
  const total = DEFINITIONS.reduce((n, g) => n + g.terms.length, 0);
  const shown = groups.reduce((n, g) => n + g.terms.length, 0);

  return (
    <div className="space-y-10">
      {/* Masthead */}
      <header className="border-b border-[var(--color-cream-dark)] pb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-teal)]">Definitions</p>
        <h2 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-4xl">The words Shipmater uses</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-text-muted)]">
          Each term as it works on the platform, the name the rest of the industry uses for it, and where to find it.
          Pages, statuses and documents all use these words, and nothing else.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="relative block w-full max-w-sm">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a term, e.g. tender or POD"
              className="w-full rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-teal)]" />
          </label>
          <span className="text-xs tabular-nums text-[var(--color-text-faint)]">{q ? `${shown} of ${total}` : `${total} terms`}</span>
        </div>
        {!q && (
          <nav className="mt-5 flex flex-wrap gap-2" aria-label="Groups">
            {DEFINITIONS.map((g, i) => (
              <a key={g.id} href={`#${g.id}`}
                className="rounded-full border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]">
                <span className="mr-1.5 tabular-nums text-[var(--color-text-faint)]">{String(i + 1).padStart(2, '0')}</span>{g.title}
              </a>
            ))}
          </nav>
        )}
      </header>

      {groups.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">No term matches “{q}”.</p>}

      {groups.map((g) => {
        const n = DEFINITIONS.findIndex((x) => x.id === g.id) + 1;
        return (
          <section key={g.id} id={g.id} className="scroll-mt-6">
            <div className="grid gap-2 sm:grid-cols-[72px_minmax(0,1fr)]">
              <p className="text-3xl font-light tabular-nums text-[var(--color-teal)]">{String(n).padStart(2, '0')}</p>
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">{g.title}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]">{g.intro}</p>
              </div>
            </div>

            <dl className="mt-5 overflow-hidden rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
              {g.terms.map((d, i) => {
                const href = d.where?.[portal];
                return (
                  <div key={d.term} className={`grid gap-x-8 gap-y-2 px-5 py-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:px-6 ${i ? 'border-t border-[var(--color-cream-dark)]' : ''}`}>
                    <dt className="flex flex-wrap items-start gap-2">
                      <span className="text-base font-semibold text-[var(--color-text)]">{d.term}</span>
                      {d.status === 'planned' && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Planned</span>
                      )}
                    </dt>
                    <dd className="min-w-0 space-y-2">
                      <p className="text-[15px] leading-relaxed text-[var(--color-text)]">{d.short}</p>
                      {d.detail && <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{d.detail}</p>}
                      {(d.industry || d.replaces || href) && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs">
                          {d.industry && (
                            <span className="text-[var(--color-text-faint)]">Industry <span className="ml-1 rounded-md bg-[var(--color-cream)] px-1.5 py-0.5 font-medium text-[var(--color-text-muted)]">{d.industry}</span></span>
                          )}
                          {d.replaces && (
                            <span className="text-[var(--color-text-faint)]">Was <span className="ml-1 font-medium text-[var(--color-text-faint)] line-through decoration-[var(--color-text-faint)]">{d.replaces}</span></span>
                          )}
                          {href && (
                            <Link href={portal === 'shipper' ? to(href) : href} className="inline-flex items-center gap-0.5 font-semibold text-[var(--color-teal)] hover:underline">
                              Open <ArrowUpRight size={12} />
                            </Link>
                          )}
                        </div>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
