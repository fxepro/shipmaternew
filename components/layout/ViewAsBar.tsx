'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Eye, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { setViewAs, type ViewCompany, type ViewType } from '@/lib/viewAs';

interface Match { id: number; name: string; mc_number: string | null; dot_number: string | null; ein: string | null; verification_status: string | null }

const NOUN: Record<ViewType, string> = { carrier: 'carrier', shipper: 'shipper' };
const VIEW: Record<ViewType, string> = { carrier: 'Carrier View', shipper: 'Shipper View' };

/**
 * Admin Console, Carrier View and Shipper View: the bar above the top bar where an admin searches
 * for the company to read as. Read-only; the API refuses every change while viewing.
 */
export function ViewAsBar({ type, current }: { type: ViewType; current: ViewCompany | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!current);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditing(!current); }, [current, type]);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (editing && current) input.current?.focus(); }, [editing, current]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (current && box.current && !box.current.contains(e.target as Node)) { setEditing(false); setQ(''); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [current]);

  const { data: matches = [], isFetching } = useQuery({
    queryKey: ['view-as-search', type, debounced],
    queryFn: () => api.get('/api/v1/admin/companies', { params: { type, q: debounced, limit: 10 } }).then((r) => r.data.data as Match[]),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });
  useEffect(() => { setActive(0); }, [matches]);

  function pick(m: Match) {
    setViewAs(type, { id: m.id, name: m.name, type });
    setQ(''); setDebounced(''); setEditing(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && matches[active]) { e.preventDefault(); pick(matches[active]); }
    if (e.key === 'Escape' && current) { setEditing(false); setQ(''); }
  }

  const showList = editing && debounced.length >= 2;

  return (
    <div
      className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 px-6 py-1.5 text-body-sm"
      style={{ background: 'var(--navy)', color: 'var(--on-dark)', fontFamily: 'var(--font-sans)' }}
    >
      <span className="inline-flex items-center gap-1.5 font-medium"><Eye size={14} />{VIEW[type]}</span>

      {editing ? (
        <div ref={box} className="relative w-full max-w-sm sm:w-80">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={`Search ${NOUN[type]}s by name, ${type === 'carrier' ? 'MC or DOT' : 'or EIN'}…`}
            aria-label={`Search ${NOUN[type]}s`}
            className="h-8 w-full rounded-md border-0 pl-8 pr-3 text-body-sm outline-none"
            style={{ background: 'var(--card)', color: 'var(--text)' }}
          />
          {showList && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 top-9 z-50 max-h-80 overflow-y-auto rounded-lg border py-1 shadow-lg"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              {matches.length === 0 && (
                <li className="px-3 py-2 text-[var(--text-faint)]">{isFetching ? 'Searching…' : `No ${NOUN[type]}s match “${debounced}”.`}</li>
              )}
              {matches.map((m, i) => (
                <li key={m.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(m)}
                    className="block w-full px-3 py-2 text-left"
                    style={{ background: i === active ? 'var(--bg)' : undefined }}
                  >
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="block truncate text-caption text-[var(--text-faint)]">
                      {[m.mc_number && `MC ${m.mc_number}`, m.dot_number && `DOT ${m.dot_number}`, m.ein && `EIN ${m.ein}`, m.verification_status].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : current && (
        <>
          <span>Viewing <strong className="font-semibold">{current.name}</strong></span>
          <span className="rounded px-1.5 py-0.5 text-caption" style={{ background: 'rgba(255,255,255,0.15)' }}>read-only</span>
          <button type="button" onClick={() => setEditing(true)} className="underline-offset-2 hover:underline">Change</button>
        </>
      )}

      <button
        type="button"
        onClick={() => router.push('/admin')}
        className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-white/10"
      >
        <X size={14} /> Exit
      </button>
    </div>
  );
}

/** Shown in place of a carrier or shipper page until the admin picks a company */
export function ViewAsEmpty({ type }: { type: ViewType }) {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <Search size={28} className="mx-auto text-[var(--text-faint)]" />
      <p className="mt-3 text-lg font-semibold text-[var(--text)]">Search for a {NOUN[type]} to view</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Use the search above to open this page as one {NOUN[type]}. You see what they see, read-only.
      </p>
    </div>
  );
}
