'use client';

import { Fragment } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { NAV } from '@/components/layout/Sidebar';
import { BUTTON_PERMISSION, PAGE_PERMISSION, canDo, canSee, type Permissions } from '@/lib/permissions';

type CompanyType = 'carrier' | 'shipper' | 'factor' | 'receiver';

interface Props {
  type: CompanyType;
  roles: string[];
  roleLabel: Record<string, string>;
  /** Each role's level per action, including unsaved edits */
  permsFor: (role: string) => Permissions;
  /** Action key → its label in the matrix */
  actionLabel: (key: string) => string;
}

function Shown({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><Eye size={12} />Shown</span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-[var(--color-text-faint)]"><EyeOff size={12} />Hidden</span>
  );
}

/**
 * Roles & Permissions, Pages view: every sidebar page and gated button for one company type,
 * and whether each role sees it. Built from the same rules the sidebar uses (lib/permissions.ts).
 */
export function RolePagesTable({ type, roles, roleLabel, permsFor, actionLabel }: Props) {
  const perms = Object.fromEntries(roles.map((r) => [r, permsFor(r)]));
  const rule = (action: string, need: 'see' | 'do') =>
    `${actionLabel(action)} · ${need === 'do' ? 'needs Full' : 'any level but None'}`;

  const head = 'px-3 py-3 text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-sage-light)]';
  const groupRow = (label: string) => (
    <tr className="bg-[var(--color-cream)]">
      <td colSpan={roles.length + 2} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{label}</td>
    </tr>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-slate)]">
            <th className={`${head} pl-4 text-left`}>Page or button</th>
            <th className={`${head} text-left`}>Controlled by</th>
            {roles.map((r) => <th key={r} className={`${head} text-center`}>{roleLabel[r] ?? r}</th>)}
          </tr>
        </thead>
        <tbody>
          {(NAV[type] ?? []).map((section) => (
            <Fragment key={section.section}>
              {groupRow(`Sidebar: ${section.section}`)}
              {section.items.map((item) => {
                const r = PAGE_PERMISSION[item.href];
                const Icon = item.icon;
                return (
                  <tr key={item.href} className="border-b border-[var(--color-cream-dark)] bg-[var(--color-white)]">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2 text-[var(--color-text)]"><Icon size={14} className="text-[var(--color-text-faint)]" />{item.label}</span>
                      <span className="ml-2 text-xs text-[var(--color-text-faint)]">{item.href}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--color-text-muted)]">{r ? rule(r[0], r[1]) : 'Always shown'}</td>
                    {roles.map((role) => {
                      const on = !r || (r[1] === 'do' ? canDo(perms[role], r[0]) : canSee(perms[role], r[0]));
                      return <td key={role} className="px-3 py-2.5 text-center"><Shown on={on} /></td>;
                    })}
                  </tr>
                );
              })}
            </Fragment>
          ))}
          {groupRow('Buttons')}
          {BUTTON_PERMISSION[type].map(([label, action, need]) => (
            <tr key={label} className="border-b border-[var(--color-cream-dark)] last:border-b-0 bg-[var(--color-white)]">
              <td className="px-4 py-2.5 text-[var(--color-text)]">{label}</td>
              <td className="px-3 py-2.5 text-xs text-[var(--color-text-muted)]">{rule(action, need)}</td>
              {roles.map((role) => {
                const on = need === 'do' ? canDo(perms[role], action) : canSee(perms[role], action);
                return <td key={role} className="px-3 py-2.5 text-center"><Shown on={on} /></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
