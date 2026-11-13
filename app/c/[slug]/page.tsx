'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Copy, Globe, Lock, Mail, MapPin, MinusCircle, Phone, ShieldCheck, Star } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { MetricTiles, type Metric } from '@/components/entities/PerformancePanel';

interface VRow { key: string; label: string; passed: boolean; date: string | null }
interface Review { id: number; overall: number; comment: string | null; reviewer_org: string | null; created_at: string }
interface Company {
  slug: string; name: string; initials: string; logo_url: string | null; type: string; type_label: string; location: string | null;
  member_since: string | null; badges: string[]; limited: boolean; is_own: boolean;
  about?: string | null; company?: [string, string][]; authority?: [string, string, string | null][]; verification?: VRow[];
  reviews?: { average: number | null; count: number; items: Review[] };
  services?: { service_types: string[]; certifications: string[]; categories: string[]; equipment: string[] };
  performance?: Metric[];
  contact?: { email: string | null; phone: string | null; website: string | null }; edit_path?: string | null;
}
type Tab = 'overview' | 'authority' | 'verification' | 'reviews';

/**
 * A company's profile (demo/public-profiles.html). Companies signed in to Shipmater see all of it; anyone else sees
 * the name, location and badges. Verification is a result and a date only.
 */
export default function CompanyProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [c, setC] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    api.get(`/api/v1/public/companies/${encodeURIComponent(slug)}`)
      .then((r) => { setC(r.data.data); document.title = `${r.data.data.name} · Shipmater`; })
      .catch((e) => setError(e?.response?.data?.message ?? 'This profile isn\'t available.'));
  }, [slug]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); } catch { toast.error('Could not copy the link'); }
  };

  const tabs: [Tab, string][] = c && !c.limited ? [
    ['overview', 'Overview'],
    ...(c.authority?.length ? [['authority', 'Authority & insurance'] as [Tab, string]] : []),
    ['verification', 'Verification'],
    ['reviews', `Reviews${c.reviews?.count ? ` (${c.reviews.count})` : ''}`],
  ] : [];

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      <header className="bg-[var(--color-navy,#0A2E40)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-wider text-white">SHIPMATER</Link>
          <Link href="/login" className="text-sm font-semibold text-[#9ED8EC] hover:text-white">Sign in</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {error && (
          <div className="mx-auto mt-10 max-w-md rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-6 text-center">
            <Lock size={28} className="mx-auto mb-3 text-[var(--color-text-faint)]" />
            <p className="text-lg font-semibold text-[var(--color-text)]">Profile not available</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{error}</p>
          </div>
        )}

        {!c && !error && <div className="skeleton h-64 rounded-xl" />}

        {c && (
          <>
            {c.is_own && c.edit_path && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-teal)] bg-[var(--color-teal-pale)] px-4 py-2.5 text-sm text-[var(--color-text)]">
                <span>This is how other companies see your company.</span>
                <Link href={c.edit_path} className="font-semibold text-[var(--color-teal)] hover:underline">Edit</Link>
              </div>
            )}

            <section className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-5">
              <div className="flex flex-wrap items-start gap-4">
                {c.logo_url
                  ? <img src={c.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--color-navy,#0A2E40)] text-xl font-bold text-white">{c.initials}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">{c.name}</h1>
                    {c.badges.map((b) => (
                      <span key={b} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-teal-pale)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-teal)]"><ShieldCheck size={12} /> {b}</span>
                    ))}
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)]">
                    <span>{c.type_label}</span>
                    {c.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {c.location}</span>}
                    {c.member_since && <span>On Shipmater since {c.member_since}</span>}
                    {!c.limited && c.reviews?.average != null && c.reviews.count > 0 && <span className="inline-flex items-center gap-1"><Star size={13} className="fill-current text-amber-500" /> {c.reviews.average} ({c.reviews.count})</span>}
                  </p>
                </div>
                <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"><Copy size={14} /> Copy link</button>
              </div>
            </section>

            {c.limited ? (
              <div className="mx-auto mt-6 max-w-md rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-6 text-center">
                <Lock size={24} className="mx-auto mb-2 text-[var(--color-text-faint)]" />
                <p className="text-base font-semibold text-[var(--color-text)]">Sign in to see the full profile</p>
                <Link href={`/login?redirect=/c/${c.slug}`} className="mt-3 inline-block rounded-lg bg-[var(--color-teal)] px-4 py-2 text-sm font-semibold text-white">Sign in</Link>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_280px]">
                <div className="min-w-0">
                  <nav className="mb-3 flex flex-wrap gap-2">
                    {tabs.map(([k, l]) => (
                      <button key={k} onClick={() => setTab(k)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm ${tab === k ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)] font-semibold text-[var(--color-teal)]' : 'border-[var(--color-cream-dark)] bg-[var(--color-white)] text-[var(--color-text-muted)]'}`}>{l}</button>
                    ))}
                  </nav>

                  {tab === 'overview' && (
                    <div className="space-y-4">
                      <Card title="About">
                        <p className="whitespace-pre-line px-4 py-3 text-base text-[var(--color-text)]">{c.about || <span className="text-[var(--color-text-faint)]">Nothing written yet.</span>}</p>
                      </Card>
                      <Card title="Services">
                        <Rows rows={[
                          ['What it does', c.services?.categories.join(', ') || null],
                          ['Freight', c.services?.service_types.join(', ') || null],
                          ...(c.type === 'carrier' ? [['Equipment', c.services?.equipment.join(', ') || null] as [string, string | null]] : []),
                          ['Certifications', c.services?.certifications.join(', ') || null],
                        ]} />
                      </Card>
                      {!!c.performance?.length && (
                        <div>
                          <p className="card-title mb-2">Performance</p>
                          <MetricTiles metrics={c.performance} />
                        </div>
                      )}
                      <Card title="Company"><Rows rows={c.company ?? []} /></Card>
                    </div>
                  )}

                  {tab === 'authority' && (
                    <Card title="Authority & insurance">
                      <Rows rows={(c.authority ?? []).map(([l, v, d]) => [l, d ? `${v} · checked ${d}` : v])} />
                    </Card>
                  )}

                  {tab === 'verification' && (
                    <Card title="Verification">
                      <ul className="divide-y divide-[var(--color-cream-dark)]">
                        {(c.verification ?? []).map((v) => (
                          <li key={v.key} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {v.passed ? <CheckCircle size={16} className="shrink-0 text-[#1B9C6B]" /> : <MinusCircle size={16} className="shrink-0 text-[var(--color-text-faint)]" />}
                              <span className="text-base text-[var(--color-text)]">{v.label}</span>
                            </div>
                            <p className={`text-sm font-semibold ${v.passed ? 'text-[#1B9C6B]' : 'text-[var(--color-text-faint)]'}`}>{v.passed ? `Verified${v.date ? ` · ${v.date}` : ''}` : 'Not yet'}</p>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  {tab === 'reviews' && (
                    <Card title="Reviews">
                      {!c.reviews?.items.length ? <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">No reviews yet.</p> : (
                        <ul className="divide-y divide-[var(--color-cream-dark)]">
                          {c.reviews.items.map((r) => (
                            <li key={r.id} className="px-4 py-3">
                              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                                <span className="inline-flex items-center gap-0.5 text-amber-500">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} className={i < r.overall ? 'fill-current' : ''} />)}</span>
                                {r.reviewer_org}
                                <span className="font-normal text-[var(--color-text-faint)]">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                              </p>
                              {r.comment && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{r.comment}</p>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  )}
                </div>

                <aside className="space-y-4">
                  <Card title="Contact">
                    <div className="space-y-2 px-4 py-3 text-sm">
                      {c.contact?.email && <a href={`mailto:${c.contact.email}`} className="flex items-center gap-2 break-all text-[var(--color-teal)] hover:underline"><Mail size={14} /> {c.contact.email}</a>}
                      {c.contact?.phone && <a href={`tel:${c.contact.phone}`} className="flex items-center gap-2 text-[var(--color-teal)] hover:underline"><Phone size={14} /> {c.contact.phone}</a>}
                      {c.contact?.website && <a href={c.contact.website.startsWith('http') ? c.contact.website : `https://${c.contact.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 break-all text-[var(--color-teal)] hover:underline"><Globe size={14} /> {c.contact.website.replace(/^https?:\/\//, '')}</a>}
                      {!c.contact?.email && !c.contact?.phone && !c.contact?.website && <p className="text-[var(--color-text-faint)]">—</p>}
                    </div>
                  </Card>
                  <Card title="Checks at a glance">
                    <ul className="space-y-1.5 px-4 py-3 text-sm">
                      {(c.verification ?? []).filter((v) => v.passed).map((v) => (
                        <li key={v.key} className="flex items-center gap-2 text-[var(--color-text)]"><CheckCircle size={13} className="shrink-0 text-[#1B9C6B]" /> {v.label}</li>
                      ))}
                      {!(c.verification ?? []).some((v) => v.passed) && <li className="text-[var(--color-text-faint)]">None yet.</li>}
                    </ul>
                  </Card>
                </aside>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
      <header className="border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]/50 px-4 py-2"><p className="card-title">{title}</p></header>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, string | null][] }) {
  if (!rows.length) return <p className="px-4 py-3 text-sm text-[var(--color-text-faint)]">—</p>;
  return (
    <dl className="divide-y divide-[var(--color-cream-dark)]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[minmax(120px,38%)_1fr] gap-3 px-4 py-2">
          <dt className="pt-0.5 text-[13px] font-medium text-[var(--color-text-faint)]">{k}</dt>
          <dd className="text-base text-[var(--color-text)]">{v || <span className="text-[var(--color-text-faint)]">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
