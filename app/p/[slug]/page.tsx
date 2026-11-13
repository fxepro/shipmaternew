'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Briefcase, CheckCircle, Copy, Lock, Mail, MapPin, Phone, ShieldCheck, Truck, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Exp { id: number; title: string; company_name: string; employment_type_label: string | null; location: string | null; start_date: string; end_date: string | null; current: boolean; description: string | null; verified: boolean }
interface Cert { name: string; type: string; issuer: string | null; issued: string | null; expires: string | null; verified_by: string }
interface VItem { key: string; label: string; passed: boolean; result: string; date: string | null; note: string | null }
interface Profile {
  slug: string; name: string; initials: string; headline: string | null; roles: string[]; location: string | null;
  company: { name: string; role: string } | null; member_since: string | null; open_to_work: boolean; available_from: string | null; about: string | null;
  details: { cdl_class: string | null; cdl_state: string | null; endorsements: string[]; years: number | null; equipment: string[]; haul_types: string[]; team_ok: boolean };
  driving: boolean; experiences: Exp[]; certifications: Cert[]; verification: { level: 'basic' | 'complete' | null; items: VItem[] };
  contact: { email: string; phone: string | null } | null; contact_hidden: boolean; visibility: string; is_self: boolean; edit_path: string | null;
}

type Tab = 'overview' | 'experience' | 'certifications' | 'verification';
const month = (ym: string | null) => ym ? new Date(ym + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
const span = (e: Exp) => {
  const start = new Date(e.start_date + '-01T00:00:00');
  const end = e.end_date ? new Date(e.end_date + '-01T00:00:00') : new Date();
  const m = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1);
  const y = Math.floor(m / 12), r = m % 12;
  return [y && `${y} yr${y > 1 ? 's' : ''}`, r && `${r} mo`].filter(Boolean).join(' ');
};

/**
 * A person's public profile: what a company needs to hire them. Results of checks show as a result and a date;
 * documents, licence numbers, report details and downloads are never on this page. Contact details need a signed-in company.
 */
export default function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    api.get(`/api/v1/public/people/${encodeURIComponent(slug)}`)
      .then((r) => { setP(r.data.data); document.title = `${r.data.data.name} · Shipmater`; })
      .catch((e) => setError({ code: e?.response?.data?.code ?? 'not_found', message: e?.response?.data?.message ?? 'This profile could not be found.' }));
  }, [slug]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); } catch { toast.error('Could not copy the link'); }
  };

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
            <p className="text-lg font-semibold text-[var(--color-text)]">{error.code === 'sign_in' ? 'Sign in to see this profile' : 'Profile not available'}</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{error.message}</p>
            {error.code === 'sign_in' && <Link href={`/login?redirect=/p/${slug}`} className="mt-4 inline-block rounded-lg bg-[var(--color-teal)] px-4 py-2 text-sm font-semibold text-white">Sign in</Link>}
          </div>
        )}

        {!p && !error && <div className="skeleton h-64 rounded-xl" />}

        {p && (
          <>
            {p.is_self && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-teal)] bg-[var(--color-teal-pale)] px-4 py-2.5 text-sm text-[var(--color-text)]">
                <span>This is how others see your profile. Who can open it: <b>{p.visibility === 'public' ? 'anyone with the link' : p.visibility === 'platform' ? 'companies on Shipmater' : 'only you'}</b>.</span>
                <Link href={p.edit_path ?? '/'} className="font-semibold text-[var(--color-teal)] hover:underline">Edit profile</Link>
              </div>
            )}

            {/* Header */}
            <section className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-navy,#0A2E40)] text-xl font-bold text-white">{p.initials}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">{p.name}</h1>
                    {p.verification.level && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-teal-pale)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-teal)]">
                        <ShieldCheck size={12} /> {p.verification.level === 'complete' ? 'Complete check' : 'Basic check'}
                      </span>
                    )}
                    {p.open_to_work && <span className="rounded-full bg-[#E4F6EE] px-2.5 py-0.5 text-xs font-semibold text-[#1B9C6B]">Open to work{p.available_from ? ` from ${new Date(p.available_from + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>}
                  </div>
                  {p.headline && <p className="mt-0.5 text-base text-[var(--color-text)]">{p.headline}</p>}
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)]">
                    {p.company && <span className="inline-flex items-center gap-1"><Briefcase size={13} /> {p.company.role}, {p.company.name}</span>}
                    {p.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {p.location}</span>}
                    {p.details.cdl_class && <span className="inline-flex items-center gap-1"><Truck size={13} /> CDL Class {p.details.cdl_class}</span>}
                    {p.member_since && <span>On Shipmater since {p.member_since}</span>}
                  </p>
                </div>
                <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"><Copy size={14} /> Copy link</button>
              </div>
            </section>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_280px]">
              <div className="min-w-0">
                <nav className="mb-3 flex flex-wrap gap-2">
                  {([['overview', 'Overview'], ['experience', `Experience${p.experiences.length ? ` (${p.experiences.length})` : ''}`],
                    ['certifications', `Certifications${p.certifications.length ? ` (${p.certifications.length})` : ''}`], ['verification', 'Verification']] as [Tab, string][]).map(([k, l]) => (
                    <button key={k} onClick={() => setTab(k)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm ${tab === k ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)] font-semibold text-[var(--color-teal)]' : 'border-[var(--color-cream-dark)] bg-[var(--color-white)] text-[var(--color-text-muted)]'}`}>{l}</button>
                  ))}
                </nav>

                {tab === 'overview' && (
                  <div className="space-y-4">
                    <Card title="About">
                      <p className="whitespace-pre-line px-4 py-3 text-base text-[var(--color-text)]">{p.about || <span className="text-[var(--color-text-faint)]">Nothing written yet.</span>}</p>
                    </Card>
                    {p.driving && <Card title="Driving">
                      <Rows rows={[
                        ['What they do', p.roles.join(', ')],
                        ['CDL', p.details.cdl_class ? `Class ${p.details.cdl_class}${p.details.cdl_state ? ` · ${p.details.cdl_state}` : ''}` : null],
                        ['Endorsements', p.details.endorsements.join(', ')],
                        ['Years of experience', p.details.years != null ? String(p.details.years) : null],
                        ['Equipment run', p.details.equipment.join(', ')],
                        ['Haul types', p.details.haul_types.join(', ')],
                        ['Team driving', p.details.team_ok ? 'Open to it' : null],
                      ]} />
                    </Card>}
                  </div>
                )}

                {tab === 'experience' && (
                  <Card title="Work history">
                    {p.experiences.length === 0 ? <Empty text="No work history yet." /> : (
                      <ul className="divide-y divide-[var(--color-cream-dark)]">
                        {p.experiences.map((e) => (
                          <li key={e.id} className="px-4 py-3">
                            <p className="text-base font-semibold text-[var(--color-text)]">{e.title}</p>
                            <p className="text-sm text-[var(--color-text)]">{e.company_name}
                              {e.verified && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-teal-pale)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-teal)]"><BadgeCheck size={11} /> On Shipmater</span>}
                            </p>
                            <p className="text-[13px] text-[var(--color-text-faint)]">{[`${month(e.start_date)} – ${e.current ? 'Present' : month(e.end_date)} · ${span(e)}`, e.employment_type_label, e.location].filter(Boolean).join(' · ')}</p>
                            {e.description && <p className="mt-1 whitespace-pre-line text-sm text-[var(--color-text-muted)]">{e.description}</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                )}

                {tab === 'certifications' && (
                  <Card title="Certifications">
                    {p.certifications.length === 0 ? <Empty text="No verified certifications yet." /> : (
                      <ul className="divide-y divide-[var(--color-cream-dark)]">
                        {p.certifications.map((c, i) => (
                          <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                            <div>
                              <p className="text-base font-semibold text-[var(--color-text)]">{c.name}</p>
                              <p className="text-[13px] text-[var(--color-text-faint)]">{[c.name !== c.type ? c.type : null, c.issuer, c.issued && `Issued ${c.issued}`, c.expires && `Valid through ${c.expires}`].filter(Boolean).join(' · ')}</p>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[#1B9C6B]"><CheckCircle size={13} /> {c.verified_by}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                )}

                {tab === 'verification' && (
                  <Card title="Verification" subtitle="Results only. Reports and their details are shared only with the person, and with companies they authorise.">
                    <ul className="divide-y divide-[var(--color-cream-dark)]">
                      {p.verification.items.map((v) => (
                        <li key={v.key} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {v.passed ? <CheckCircle size={16} className="shrink-0 text-[#1B9C6B]" /> : <MinusCircle size={16} className="shrink-0 text-[var(--color-text-faint)]" />}
                            <span className="text-base text-[var(--color-text)]">{v.label}</span>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${v.passed ? 'text-[#1B9C6B]' : 'text-[var(--color-text-faint)]'}`}>{v.result}{v.date ? ` · ${v.date}` : ''}</p>
                            {v.note && <p className="text-xs text-[var(--color-text-faint)]">{v.note}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>

              {/* Contact */}
              <aside className="space-y-4">
                <Card title="Contact">
                  {p.contact ? (
                    <div className="space-y-2 px-4 py-3 text-sm">
                      <a href={`mailto:${p.contact.email}`} className="flex items-center gap-2 text-[var(--color-teal)] hover:underline"><Mail size={14} /> {p.contact.email}</a>
                      {p.contact.phone && <a href={`tel:${p.contact.phone}`} className="flex items-center gap-2 text-[var(--color-teal)] hover:underline"><Phone size={14} /> {p.contact.phone}</a>}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                      <p>Contact details are shown to companies signed in to Shipmater.</p>
                      <Link href={`/login?redirect=/p/${p.slug}`} className="mt-2 inline-block rounded-lg bg-[var(--color-teal)] px-3 py-1.5 text-sm font-semibold text-white">Sign in to contact</Link>
                    </div>
                  )}
                </Card>
                <Card title="Checks at a glance">
                  <ul className="space-y-1.5 px-4 py-3 text-sm">
                    {p.verification.items.filter((v) => v.passed).map((v) => (
                      <li key={v.key} className="flex items-center gap-2 text-[var(--color-text)]"><CheckCircle size={13} className="shrink-0 text-[#1B9C6B]" /> {v.label}</li>
                    ))}
                    {!p.verification.items.some((v) => v.passed) && <li className="text-[var(--color-text-faint)]">No checks completed yet.</li>}
                  </ul>
                </Card>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
      <header className="border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]/50 px-4 py-2">
        <p className="card-title">{title}</p>
        {subtitle && <p className="text-[13px] text-[var(--color-text-faint)]">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, string | null][] }) {
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

const Empty = ({ text }: { text: string }) => <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">{text}</p>;
