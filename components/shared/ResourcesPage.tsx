'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Library, Clock, ChevronRight, ExternalLink, BookA } from 'lucide-react';
import { Definitions } from '@/components/resources/Definitions';
import { topicsFor, type ManualAudience, type ManualTopic, type ManualSubtopic } from '@/lib/resources/manual';
import {
  SHIPPER_PROFILE_TABS,
  SHIPPER_VERIFICATION_MATRIX,
  SHIPPER_REQUIREMENTS_MATRIX,
  SHIPPER_VALIDATION_BEHAVIOR_MATRIX,
  type GuideMatrix,
  type GuideSection,
} from '@/lib/resources/profile-guide';
import {
  CARRIER_PROFILE_TABS,
  CARRIER_VERIFICATION_MATRIX,
  CARRIER_REQUIREMENTS_MATRIX,
  CARRIER_VALIDATION_BEHAVIOR_MATRIX,
} from '@/lib/resources/carrier-profile-guide';

type ResourcesTab = 'manual' | 'definitions' | 'library';

function basePath(audience: ManualAudience) {
  return audience === 'shipper' ? '/shipper/resources' : '/carrier/resources';
}

function resolveGuide(guideKey: string | undefined) {
  if (guideKey === 'shipper-profile') {
    return {
      sections: SHIPPER_PROFILE_TABS,
      matrices: [
        SHIPPER_VALIDATION_BEHAVIOR_MATRIX,
        SHIPPER_VERIFICATION_MATRIX,
        SHIPPER_REQUIREMENTS_MATRIX,
      ],
    };
  }
  if (guideKey === 'carrier-profile') {
    return {
      sections: CARRIER_PROFILE_TABS,
      matrices: [
        CARRIER_VALIDATION_BEHAVIOR_MATRIX,
        CARRIER_VERIFICATION_MATRIX,
        CARRIER_REQUIREMENTS_MATRIX,
      ],
    };
  }
  return null;
}

/** Prefer explicit guideKey; fall back by audience + Account topic so tables always show. */
function guideKeyForTopic(audience: ManualAudience, topic: ManualTopic): string | undefined {
  const fromSub = topic.subtopics.find((s) => s.guideKey)?.guideKey;
  if (fromSub) return fromSub;
  if (topic.slug === 'account') {
    return audience === 'carrier' ? 'carrier-profile' : 'shipper-profile';
  }
  return undefined;
}

function GuideBody({ sections, matrices }: { sections: GuideSection[]; matrices: GuideMatrix[] }) {
  return (
    <div className="space-y-4">
      {/* Matrices first — tables are the lookup users need; tab cards follow */}
      {matrices.map((m) => (
        <section
          key={m.title}
          className="rounded-xl border border-[var(--color-cream-dark)] bg-white overflow-hidden"
        >
          <div className="card-head card-head-tint px-5 py-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">{m.title}</h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            {m.description && (
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{m.description}</p>
            )}
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[560px] text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-cream)]">
                    {m.columns.map((c) => (
                      <th
                        key={c}
                        className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-[var(--color-cream-dark)] last:border-0 align-top"
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className={`px-3 py-3 text-[var(--color-text)] ${
                            j === 0 ? 'font-semibold whitespace-nowrap' : 'text-[var(--color-text-muted)]'
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-6 rounded-xl border border-[var(--color-cream-dark)] bg-white overflow-hidden flex flex-col"
          >
            <div className="card-head card-head-tint px-5 py-3">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">{s.title}</h3>
            </div>
            <div className="px-5 py-4 space-y-3 flex-1">
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{s.summary}</p>
              <ul className="list-disc pl-4 space-y-1 text-sm text-[var(--color-text)]">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SubtopicCard({ sub }: { sub: ManualSubtopic }) {
  return (
    <div className="space-y-4">
      <section
        id={sub.id}
        className="scroll-mt-6 rounded-xl border border-[var(--color-cream-dark)] bg-white overflow-hidden flex flex-col"
      >
        <div className="card-head card-head-tint flex items-center justify-between gap-3 px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{sub.title}</h3>
          {sub.href && (
            <Link
              href={sub.href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)] hover:underline shrink-0"
            >
              Open <ExternalLink size={11} />
            </Link>
          )}
        </div>
        <div className="px-5 py-4 space-y-3 flex-1">
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{sub.summary}</p>
          <ul className="list-disc pl-4 space-y-1 text-sm text-[var(--color-text)]">
            {sub.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export function ResourcesIndex({ audience }: { audience: ManualAudience }) {
  const topics = topicsFor(audience);
  const base = basePath(audience);

  return (
    <ResourcesShell audience={audience} tab="manual">
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 lg:items-start">
        <ContentsNav audience={audience} topics={topics} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
          {topics.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.slug}
                href={`${base}/${t.slug}`}
                className="group rounded-xl border border-[var(--color-cream-dark)] bg-white overflow-hidden hover:border-[var(--color-teal)] transition-colors flex flex-col"
              >
                <div className="card-head card-head-tint flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={16} className="shrink-0 text-[var(--color-text-muted)]" />
                    <h2 className="text-sm font-semibold text-[var(--color-text)] truncate">{t.title}</h2>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-[var(--color-text-faint)] group-hover:text-[var(--color-teal)]" />
                </div>
                <div className="px-5 py-4 flex-1 space-y-3">
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    {t.summary}
                  </p>
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
      </div>
    </ResourcesShell>
  );
}

export function ResourcesTopicDetail({
  audience,
  topic,
}: {
  audience: ManualAudience;
  topic: ManualTopic;
}) {
  const topics = topicsFor(audience);
  const base = basePath(audience);
  const Icon = topic.icon;
  const guide = resolveGuide(guideKeyForTopic(audience, topic));
  const hasRichGuide = !!guide;

  return (
    <ResourcesShell audience={audience} tab="manual">
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 lg:items-start">
        <ContentsNav audience={audience} topics={topics} activeSlug={topic.slug} />

        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-faint)]">
            <Link href={base} className="hover:text-[var(--color-teal)]">Manual</Link>
            <ChevronRight size={12} />
            <span className="text-[var(--color-text-muted)]">{topic.title}</span>
          </div>

          <div className="rounded-xl border border-[var(--color-cream-dark)] bg-white overflow-hidden">
            <div className="card-head card-head-tint flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon size={16} className="shrink-0 text-[var(--color-text-muted)]" />
                <h2 className="text-sm font-semibold text-[var(--color-text)]">{topic.title}</h2>
              </div>
              {topic.href && (
                <Link
                  href={topic.href}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)] hover:underline shrink-0"
                >
                  Open <ExternalLink size={11} />
                </Link>
              )}
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                {topic.summary}
              </p>
              <ul className="list-disc pl-4 space-y-1 text-sm text-[var(--color-text)]">
                {topic.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </div>

          {guide && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--color-slate)] px-0.5">
                Validation &amp; requirements
              </h3>
              <GuideBody sections={guide.sections} matrices={guide.matrices} />
            </div>
          )}

          {topic.subtopics.length > 0 && (
            <div className={hasRichGuide ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
              {topic.subtopics.map((sub) =>
                sub.guideKey || hasRichGuide ? (
                  <SubtopicCard key={sub.id} sub={sub} />
                ) : (
                  <section
                    key={sub.id}
                    id={sub.id}
                    className="scroll-mt-6 rounded-xl border border-[var(--color-cream-dark)] bg-white overflow-hidden flex flex-col"
                  >
                    <div className="card-head card-head-tint flex items-center justify-between gap-3 px-5 py-3">
                      <h3 className="text-sm font-semibold text-[var(--color-text)]">{sub.title}</h3>
                      {sub.href && (
                        <Link
                          href={sub.href}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)] hover:underline shrink-0"
                        >
                          Open <ExternalLink size={11} />
                        </Link>
                      )}
                    </div>
                    <div className="px-5 py-4 space-y-3 flex-1">
                      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                        {sub.summary}
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-sm text-[var(--color-text)]">
                        {sub.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  </section>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </ResourcesShell>
  );
}

/** Resources → Definitions: the platform's vocabulary */
export function ResourcesDefinitions({ audience }: { audience: ManualAudience }) {
  return (
    <ResourcesShell audience={audience} tab="definitions">
      <Definitions portal={audience === 'carrier' ? 'carrier' : 'shipper'} />
    </ResourcesShell>
  );
}

export function ResourcesLibrary({ audience }: { audience: ManualAudience }) {
  return (
    <ResourcesShell audience={audience} tab="library">
      <div className="rounded-xl border border-dashed border-[var(--color-cream-dark)] bg-white px-6 py-20 text-center">
        <Library size={28} className="mx-auto text-[var(--color-text-faint)]" />
        <h2 className="mt-3 text-base font-semibold text-[var(--color-text)]">Library</h2>
        <p className="mt-1.5 mx-auto max-w-md text-sm text-[var(--color-text-faint)]">
          Reserved for future use — how-to guides, downloadable templates, training clips, and policy PDFs.
        </p>
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2.5 py-1">
          <Clock size={12} /> Coming later
        </p>
      </div>
    </ResourcesShell>
  );
}

function ContentsNav({
  audience,
  topics,
  activeSlug,
}: {
  audience: ManualAudience;
  topics: ManualTopic[];
  activeSlug?: string;
}) {
  const base = basePath(audience);
  return (
    <aside className="hidden lg:block sticky top-6">
      <div className="rounded-xl border border-[var(--color-cream-dark)] bg-white overflow-hidden">
        <div className="card-head card-head-tint px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Contents
          </p>
        </div>
        <nav className="p-2">
          {topics.map((t) => {
            const on = t.slug === activeSlug;
            return (
              <Link
                key={t.slug}
                href={`${base}/${t.slug}`}
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
    </aside>
  );
}

function ResourcesShell({
  audience,
  tab,
  children,
}: {
  audience: ManualAudience;
  tab: ResourcesTab;
  children: React.ReactNode;
}) {
  const base = basePath(audience);
  const pathname = usePathname();
  const onLibrary = pathname.endsWith('/library');
  const onDefinitions = pathname.endsWith('/definitions');
  const tabCls = (on: boolean) => `flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
    on ? 'bg-[var(--color-slate)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Resources</h1>
          <p className="mt-1 text-sm text-[var(--color-text-faint)]">
            Product guide for the {audience} workspace.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-cream)] p-1">
          <Link
            href={base}
            className={tabCls(tab === 'manual' && !onLibrary && !onDefinitions)}
          >
            <BookOpen size={14} /> Manual
          </Link>
          <Link href={`${base}/definitions`} className={tabCls(onDefinitions || tab === 'definitions')}>
            <BookA size={14} /> Definitions
          </Link>
          <Link
            href={`${base}/library`}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              onLibrary || tab === 'library'
                ? 'bg-[var(--color-slate)] text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <Library size={14} /> Library
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
