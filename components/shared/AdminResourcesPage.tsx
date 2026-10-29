'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Shield } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { ADMIN_TOPICS, type AdminManualTopic } from '@/lib/resources/admin-manual';

const BASE = '/admin/resources';

function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    getUser()
      .then((u) => {
        if (!u || u.role !== 'admin') {
          router.replace('/login');
          return;
        }
        setOk(true);
      })
      // Server unreachable: the dashboard layout shows the retry screen; stay signed in here
      .catch(() => {});
  }, [router]);

  if (!ok) {
    return (
      <div className="flex justify-center py-20">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return <>{children}</>;
}

function Shell({
  children,
  activeSlug,
}: {
  children: React.ReactNode;
  activeSlug?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
          Resources · Admin
        </p>
        <h1 className="mt-1 text-xl font-semibold text-[var(--color-text)]">Admin manual</h1>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">
          Technical setup for platform operators — mail, SMS, verification, and environment. Not shown to customers.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 lg:items-start">
        <aside className="hidden lg:block sticky top-6">
          <div className="rounded-xl border border-[var(--color-cream-dark)] bg-white overflow-hidden">
            <div className="card-head card-head-tint px-4 py-2.5 flex items-center gap-2">
              <Shield size={12} className="text-[var(--color-text-muted)]" />
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Admin
              </p>
            </div>
            <nav className="p-2">
              <Link
                href={BASE}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  !activeSlug
                    ? 'bg-[var(--color-teal-pale)] text-[var(--color-teal)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-cream)] hover:text-[var(--color-text)]'
                }`}
              >
                Overview
              </Link>
              {ADMIN_TOPICS.map((t) => {
                const on = t.slug === activeSlug;
                return (
                  <Link
                    key={t.slug}
                    href={`${BASE}/${t.slug}`}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      on
                        ? 'bg-[var(--color-teal-pale)] text-[var(--color-teal)] font-semibold'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-cream)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {t.title}
                  </Link>
                );
              })}
            </nav>
          </div>
          <p className="mt-3 px-1 text-[11px] text-[var(--color-text-faint)] leading-relaxed">
            Customer product guide:{' '}
            <Link href="/shipper/resources" className="text-[var(--color-teal)] hover:underline">
              Resources
            </Link>
          </p>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function AdminResourcesIndex() {
  return (
    <AdminGate>
      <Shell>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4">
          Operator-only. Do not put live passwords or API keys in this guide — use host secret stores.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ADMIN_TOPICS.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.slug}
                href={`${BASE}/${t.slug}`}
                className="group rounded-xl border border-[var(--color-cream-dark)] bg-white overflow-hidden hover:border-[var(--color-teal)] transition-colors flex flex-col"
              >
                <div className="card-head card-head-tint flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={16} className="shrink-0 text-[var(--color-text-muted)]" />
                    <h2 className="text-sm font-semibold text-[var(--color-text)] truncate">{t.title}</h2>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-[var(--color-text-faint)] group-hover:text-[var(--color-teal)]" />
                </div>
                <div className="px-5 py-4 space-y-3 flex-1">
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{t.summary}</p>
                  <ul className="list-disc pl-4 space-y-1 text-sm text-[var(--color-text)]">
                    {t.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              </Link>
            );
          })}
        </div>
      </Shell>
    </AdminGate>
  );
}

export function AdminResourcesTopic({ topic }: { topic: AdminManualTopic }) {
  const Icon = topic.icon;
  return (
    <AdminGate>
      <Shell activeSlug={topic.slug}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-faint)] mb-4">
          <Link href={BASE} className="hover:text-[var(--color-teal)]">Admin</Link>
          <ChevronRight size={12} />
          <span className="text-[var(--color-text-muted)]">{topic.title}</span>
        </div>

        <div className="rounded-xl border border-[var(--color-cream-dark)] bg-white overflow-hidden mb-4">
          <div className="card-head card-head-tint flex items-center gap-2.5 px-5 py-3">
            <Icon size={16} className="text-[var(--color-text-muted)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">{topic.title}</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{topic.summary}</p>
            <ul className="list-disc pl-4 space-y-1 text-sm text-[var(--color-text)]">
              {topic.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          {topic.sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="rounded-xl border border-[var(--color-cream-dark)] bg-white overflow-hidden"
            >
              <div className="card-head card-head-tint px-5 py-3">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">{s.title}</h3>
              </div>
              <div className="px-5 py-4 space-y-3 text-sm text-[var(--color-text)] leading-relaxed">
                {s.paragraphs.map((p, i) => (
                  <p key={i} className="text-[var(--color-text-muted)]">{p}</p>
                ))}
                {s.bullets && s.bullets.length > 0 && (
                  <ul className="list-disc pl-4 space-y-1">
                    {s.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                {s.code && (
                  <pre className="overflow-x-auto rounded-lg bg-[var(--color-cream)] border border-[var(--color-cream-dark)] p-3 text-xs font-mono text-[var(--color-text)] whitespace-pre">
                    {s.code}
                  </pre>
                )}
              </div>
            </section>
          ))}
        </div>
      </Shell>
    </AdminGate>
  );
}
