'use client';

import { Fragment, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Eye, History, ListChecks, Lock, PanelLeft, RotateCcw, ShieldCheck, Truck, User, UserCog } from 'lucide-react';
import { RolePagesTable } from '@/components/admin/RolePagesTable';
import { toast } from 'sonner';
import { adminRoleApi } from '@/lib/api';

type CompanyType = 'carrier' | 'shipper' | 'factor';
type Level = 'full' | 'view' | 'assigned' | 'self' | 'none';

interface Action {
  key: string; group: string; label: string; levels: Level[];
  defaults: Record<string, Level>; values: Record<string, Level>; editable: Record<string, boolean>;
}
interface Matrix { type: CompanyType; roles: string[]; actions: Action[] }
interface Change {
  id: number; org_type: CompanyType; role: string; permission: string; label: string;
  old_level: Level; new_level: Level; created_at: string; changed_by: string | null;
}

const TYPES: { id: CompanyType; label: string }[] = [
  { id: 'carrier', label: 'Carrier' }, { id: 'shipper', label: 'Shipper' }, { id: 'factor', label: 'Factor' },
];
const ROLE_LABEL: Record<string, string> = { owner: 'Owner', staff: 'Staff', dispatcher: 'Dispatcher', driver: 'Driver', viewer: 'Viewer' };
const LEVEL: Record<Level, { label: string; icon: typeof Check | null; cls: string }> = {
  full:     { label: 'Full',     icon: Check, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  view:     { label: 'View',     icon: Eye,   cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  assigned: { label: 'Assigned', icon: Truck, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  self:     { label: 'Self',     icon: User,  cls: 'bg-[var(--color-cream)] text-[var(--color-text-muted)] border-[var(--color-cream-dark)]' },
  none:     { label: 'None',     icon: null,  cls: 'bg-transparent text-[var(--color-text-faint)] border-transparent' },
};
const LEVEL_HELP: Record<Level, string> = {
  full: 'Can do it', view: 'Read only', assigned: 'Only loads they are on', self: 'Their own record only', none: 'No access',
};

function Pill({ level }: { level: Level }) {
  const l = LEVEL[level];
  const Icon = l.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${l.cls}`}>
      {Icon && <Icon size={12} />}{l.label}
    </span>
  );
}

const when = (s: string) => new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Admin Console > Settings > Roles & Permissions */
function RolesAndPermissions() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const [tab, setTab] = useState<'company' | 'admin'>(params.get('tab') === 'admin' ? 'admin' : 'company');
  const initialType = params.get('type') as CompanyType | null;
  const [type, setType] = useState<CompanyType>(TYPES.some((t) => t.id === initialType) ? initialType! : 'carrier');
  // Unsaved edits: "role|action" => level
  const [edits, setEdits] = useState<Record<string, Level>>({});
  // Actions: edit the matrix. Pages: which sidebar pages and buttons each role sees.
  const [view, setView] = useState<'actions' | 'pages'>(params.get('view') === 'pages' ? 'pages' : 'actions');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-role-matrix'],
    queryFn: () => adminRoleApi.matrix().then((r) => r.data.data as { types: Record<CompanyType, Matrix>; changes: Change[] }),
  });

  useEffect(() => { setEdits({}); }, [type]);

  const matrix = data?.types[type];
  const groups = useMemo(() => {
    const out: [string, Action[]][] = [];
    for (const a of matrix?.actions ?? []) {
      const last = out[out.length - 1];
      if (last && last[0] === a.group) last[1].push(a); else out.push([a.group, [a]]);
    }
    return out;
  }, [matrix]);

  const changedFromDefault = (matrix?.actions ?? []).reduce(
    (n, a) => n + matrix!.roles.filter((r) => a.values[r] !== a.defaults[r]).length, 0);

  const onSaved = (msg: string) => (res: { data: { message: string; data: { matrix: Matrix; changes: Change[] } } }) => {
    qc.setQueryData(['admin-role-matrix'], (old: { types: Record<CompanyType, Matrix>; changes: Change[] } | undefined) =>
      old ? { types: { ...old.types, [type]: res.data.data.matrix }, changes: res.data.data.changes } : old);
    setEdits({});
    toast.success(res.data.message || msg);
  };
  const onError = (e: { response?: { data?: { error?: string } } }) => toast.error(e.response?.data?.error ?? "Couldn't save the changes.");

  const save = useMutation({
    mutationFn: () => adminRoleApi.update(type, Object.entries(edits).map(([k, level]) => {
      const [role, permission] = k.split('|');
      return { role, permission, level };
    })),
    onSuccess: onSaved('Saved.'), onError,
  });
  const reset = useMutation({ mutationFn: () => adminRoleApi.reset(type), onSuccess: onSaved('Reset to defaults.'), onError });

  const cycle = (a: Action, role: string) => {
    const k = `${role}|${a.key}`;
    const current = edits[k] ?? a.values[role];
    const levels = a.levels;
    const next = levels[(levels.indexOf(current) + 1) % levels.length];
    setEdits((e) => {
      const copy = { ...e };
      if (next === a.values[role]) delete copy[k]; else copy[k] = next;
      return copy;
    });
  };

  const pending = Object.keys(edits).length;
  const history = (data?.changes ?? []).filter((c) => c.org_type === type).slice(0, 15);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Roles &amp; Permissions</h1>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">
          What each role in a company may do. Changes apply to every company of that type.
        </p>
      </div>

      <nav role="tablist" className="flex gap-0.5 border-b border-[var(--color-cream-dark)]">
        {([['company', 'Company roles', Building2], ['admin', 'Admin roles', UserCog]] as const).map(([id, label, Icon]) => {
          const on = tab === id;
          return (
            <button key={id} role="tab" aria-selected={on} onClick={() => setTab(id)}
              className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                on ? 'border-[var(--color-teal)] text-[var(--color-slate)]' : 'border-transparent text-[var(--color-text-muted)] hover:border-[var(--color-cream-dark)] hover:text-[var(--color-text)]'
              }`}>
              <Icon size={15} className={on ? 'text-[var(--color-teal)]' : ''} />{label}
            </button>
          );
        })}
      </nav>

      {tab === 'admin' ? (
        <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-6">
          <div className="flex items-center gap-3">
            <div className="empty-icon !m-0"><ShieldCheck size={22} className="text-[var(--color-text-faint)]" /></div>
            <div>
              <p className="font-medium text-[var(--color-text)]">Not built yet</p>
              <p className="text-sm text-[var(--color-text-muted)]">Roles for Shipmater&apos;s own admin staff will go here: who can approve companies, move money and change settings, with a log of admin actions.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-0.5">
              {TYPES.map((t) => (
                <button key={t.id} onClick={() => {
                  if (pending && !window.confirm('Discard your unsaved changes?')) return;
                  setType(t.id);
                }}
                  className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${type === t.id ? 'bg-[var(--color-slate)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-0.5">
              {([['actions', 'Actions', ListChecks], ['pages', 'Pages', PanelLeft]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setView(id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === id ? 'bg-[var(--color-teal-pale)] text-[var(--color-teal-dark)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>
            <span className="text-sm text-[var(--color-text-muted)]">
              {changedFromDefault ?`${changedFromDefault} change${changedFromDefault === 1 ? '' : 's'} from the defaults` : 'Using the defaults'}
            </span>
            <button onClick={() => { if (window.confirm(`Reset every ${type} role to the defaults?`)) reset.mutate(); }}
              disabled={!changedFromDefault || reset.isPending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-teal)] disabled:opacity-50">
              <RotateCcw size={14} />Reset to defaults
            </button>
          </div>

          {view === 'pages' ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Every page in the {type} sidebar and every button the matrix hides, and whether each role sees it. Each one follows the action named beside it; change that action in Actions to change who sees it. Unsaved changes show here straight away.
            </p>
          ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)]">
            {(['full', 'view', 'assigned', 'self', 'none'] as Level[]).map((l) => (
              <span key={l} className="inline-flex items-center gap-1.5"><Pill level={l} />{LEVEL_HELP[l]}</span>
            ))}
            <span className="inline-flex items-center gap-1.5"><Lock size={12} />Fixed</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-teal)]" />Changed from default</span>
          </div>
          )}

          {isLoading || !matrix ? (
            <div className="skeleton h-96 rounded-xl" />
          ) : view === 'pages' ? (
            <RolePagesTable
              type={type}
              roles={matrix.roles}
              roleLabel={ROLE_LABEL}
              permsFor={(role) => Object.fromEntries(matrix.actions.map((a) => [a.key, edits[`${role}|${a.key}`] ?? a.values[role]]))}
              actionLabel={(key) => matrix.actions.find((a) => a.key === key)?.label ?? key}
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-slate)]">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-sage-light)]">Action</th>
                    {matrix.roles.map((r) => (
                      <th key={r} className="px-3 py-3 text-center text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-sage-light)]">
                        <span className="inline-flex items-center gap-1">{ROLE_LABEL[r] ?? r}{r === 'owner' && <Lock size={11} />}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(([group, actions]) => (
                    <Fragment key={group}>
                      <tr className="bg-[var(--color-cream)]">
                        <td colSpan={matrix.roles.length + 1} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{group}</td>
                      </tr>
                      {actions.map((a) => (
                        <tr key={a.key} className="border-b border-[var(--color-cream-dark)] last:border-b-0 bg-[var(--color-white)]">
                          <td className="px-4 py-2.5 text-[var(--color-text)]">{a.label}</td>
                          {matrix.roles.map((r) => {
                            const k = `${r}|${a.key}`;
                            const level = edits[k] ?? a.values[r];
                            const editing = k in edits;
                            const offDefault = level !== a.defaults[r];
                            if (!a.editable[r]) {
                              return (
                                <td key={r} className="px-3 py-2.5 text-center" title="Fixed">
                                  <span className="inline-flex items-center gap-1 opacity-60"><Pill level={level} /></span>
                                </td>
                              );
                            }
                            return (
                              <td key={r} className={`px-1.5 py-1.5 text-center ${editing ? 'bg-[var(--color-teal-pale)]' : ''}`}>
                                <button onClick={() => cycle(a, r)}
                                  title={`${ROLE_LABEL[r]}: ${LEVEL_HELP[level]}. Click to change. Default: ${LEVEL[a.defaults[r]].label}`}
                                  aria-label={`${a.label}, ${ROLE_LABEL[r]}: ${LEVEL[level].label}. Change`}
                                  className="relative inline-flex min-w-[84px] justify-center rounded-md px-1 py-1 hover:bg-[var(--color-cream)]">
                                  <Pill level={level} />
                                  {offDefault && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-teal)]" />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pending > 0 && (
            <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-xl border border-[var(--color-teal)] bg-[var(--color-white)] px-4 py-3 shadow-lg">
              <span className="text-sm font-medium text-[var(--color-text)]">{pending} unsaved change{pending === 1 ? '' : 's'}</span>
              <button onClick={() => setEdits({})} className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Discard</button>
              <button onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-navy disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
            <div className="flex items-center gap-2 border-b border-[var(--color-cream-dark)] px-4 py-3">
              <History size={15} className="text-[var(--color-text-faint)]" />
              <h2 className="text-sm font-semibold text-[var(--color-slate)]">Recent changes</h2>
            </div>
            {history.length === 0 ? (
              <p className="px-4 py-4 text-sm text-[var(--color-text-muted)]">No changes yet. Every {type} role is on its defaults.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-cream-dark)]">
                {history.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                    <span className="font-medium text-[var(--color-text)]">{ROLE_LABEL[c.role] ?? c.role}</span>
                    <span className="text-[var(--color-text-muted)]">{c.label}</span>
                    <span className="inline-flex items-center gap-1.5"><Pill level={c.old_level} /><span className="text-[var(--color-text-faint)]">→</span><Pill level={c.new_level} /></span>
                    <span className="ml-auto text-xs text-[var(--color-text-faint)]">{c.changed_by ?? 'Admin'} · {when(c.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-[var(--color-text-faint)]">
            The owner always has full access, and everyone manages their own identity and checks. Changes apply straight away: the API refuses anything a role can&apos;t do, and pages hide it.
          </p>
        </>
      )}
    </div>
  );
}

export default function AdminRolesPage() {
  return (
    <Suspense>
      <RolesAndPermissions />
    </Suspense>
  );
}
