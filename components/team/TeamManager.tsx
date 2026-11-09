'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Send, UserMinus, X, Copy, Plus, Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { orgApi } from '@/lib/api';
import { validateTeamInvite } from '@/lib/shipper-profile-validation';
import { PersonStatusBadge, ROLE_LABELS } from '@/components/admin/PersonBadges';
import { useCan } from '@/components/layout/PermissionsContext';

interface Member {
  id: number; user_id: number; name: string; email: string; role: string; is_owner: boolean;
  approval_required: boolean; person_status: string; required_met: number; required_total: number;
}
interface Invitation { id: number; email: string; role: string; expires_at: string; expired: boolean; invite_url: string }
/** A role this company can give; the list comes from the API (PersonChecks::ROLES) for the company's type */
interface RoleOption { value: string; label: string; help: string }

export type TeamType = 'carrier' | 'shipper' | 'broker' | 'factor' | 'receiver';

/** What the team page says about who joins, by company type */
const INTRO: Partial<Record<TeamType, string>> = {
  carrier: 'Drivers sign up with their own login from your invite, then add their licence, medical card and ID. Shipmater approves each driver before they can be assigned a load.',
  broker:  'Agents post loads for your customers, book carriers and manage carrier contracts. Staff also manage the team, payments and contracts.',
};

const ROLE_COLORS: Record<string, string> = {
  owner:      'bg-purple-50 text-purple-700',
  staff:      'bg-blue-50 text-blue-700',
  dispatcher: 'bg-teal-50 text-[var(--color-teal)]',
  agent:      'bg-indigo-50 text-indigo-700',
  driver:     'bg-amber-50 text-amber-700',
  viewer:     'bg-[var(--color-cream)] text-[var(--color-text-muted)]',
};

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Invite link copied');
  } catch {
    toast.error('Could not copy — select the link and copy it manually');
  }
}

/** Team members and invitations for the current company. Each person joins with their own login. */
export function TeamManager({ type }: { type: TeamType }) {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const { data: team, isLoading } = useQuery({
    queryKey: ['org-team'],
    queryFn: () => orgApi.members().then((r) => ({ members: r.data.data as Member[], roles: (r.data.roles ?? []) as RoleOption[] })),
  });
  const members = team?.members ?? [];
  const roles = team?.roles ?? [];
  const label = (r: string) => roles.find((o) => o.value === r)?.label ?? ROLE_LABELS[r] ?? r;
  const refreshMembers = () => { qc.invalidateQueries({ queryKey: ['org-team'] }); qc.invalidateQueries({ queryKey: ['org-members'] }); };
  const openInvite = () => { setInviteRole(roles[0]?.value ?? ''); setShowInvite(true); };
  const can = useCan();
  const manage = can.do('team.manage');
  const { data: invitations = [] } = useQuery({ queryKey: ['org-invitations'], enabled: manage, queryFn: () => orgApi.invitations().then((r) => r.data.data as Invitation[]) });

  const invite = useMutation({
    mutationFn: () => orgApi.invite(inviteEmail.trim(), inviteRole),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['org-invitations'] });
      toast.success(`Invitation emailed to ${inviteEmail}`);
      const url = (res.data?.data as Invitation | undefined)?.invite_url;
      if (url) copyLink(url);
      setInviteEmail('');
      setShowInvite(false);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? 'Could not send invitation'),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => orgApi.updateMember(id, role),
    onSuccess: () => { refreshMembers(); toast.success('Role changed'); },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? 'Could not change role'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => orgApi.removeMember(id),
    onSuccess: () => { refreshMembers(); toast.success('Removed from the team'); },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? 'Could not remove member'),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => orgApi.cancelInvitation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-invitations'] }),
  });

  const resend = useMutation({
    mutationFn: (id: number) => orgApi.resendInvitation(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-invitations'] }); toast.success('Invitation sent again'); },
    onError: () => toast.error('Could not resend the invitation'),
  });

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="card-head card-head-tint flex items-center justify-between gap-3 px-5 py-3">
          <p className="card-title">Team members ({members.length})</p>
          {manage && roles.length > 0 && <button onClick={openInvite}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] px-3 py-1.5 text-[13px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]">
            <Plus size={12} /> Invite
          </button>}
        </div>
        <div className="card-body">
          {INTRO[type] && <p className="mb-4 text-sm text-[var(--color-text-muted)]">{INTRO[type]}</p>}
          {isLoading ? (
            <div className="skeleton h-28 rounded-xl" />
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-cream-dark)] px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-slate)] text-[13px] font-bold text-white">
                    {m.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-[var(--color-text)]">{m.name}</p>
                    <p className="truncate text-[13px] text-[var(--color-text-faint)]">{m.email}</p>
                  </div>
                  {m.approval_required && (
                    <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-faint)]">
                      {m.required_total > 0 && <span>{m.required_met}/{m.required_total} checks</span>}
                      <PersonStatusBadge status={m.person_status} />
                    </div>
                  )}
                  {m.is_owner ? (
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${ROLE_COLORS.owner}`}>
                      <Crown size={10} /> Owner
                    </span>
                  ) : !manage ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${ROLE_COLORS[m.role] ?? ''}`}>{label(m.role)}</span>
                  ) : (
                    <select value={m.role} disabled={updateRole.isPending} onChange={(e) => updateRole.mutate({ id: m.id, role: e.target.value })} aria-label={`Role for ${m.name}`}
                      className="rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-2.5 py-1 text-[13px] text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none">
                      {!roles.some((o) => o.value === m.role) && <option value={m.role}>{label(m.role)}</option>}
                      {roles.map((o) => <option key={o.value} value={o.value} title={o.help}>{o.label}</option>)}
                    </select>
                  )}
                  {!m.is_owner && manage && (
                    <button onClick={() => { if (confirm(`Remove ${m.name} from the team?`)) remove.mutate(m.id); }} disabled={remove.isPending}
                      title="Remove" className="text-[var(--color-text-faint)] hover:text-red-500"><UserMinus size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {invitations.length > 0 && (
        <section className="card">
          <div className="card-head card-head-tint px-5 py-3"><p className="card-title">Pending invitations</p></div>
          <div className="card-body space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--color-cream-dark)] px-4 py-3">
                <Send size={14} className="shrink-0 text-[var(--color-text-faint)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base text-[var(--color-text)]">{inv.email}</p>
                  <p className="text-[13px] text-[var(--color-text-faint)]">
                    {label(inv.role)} · {inv.expired ? <span className="text-red-600">expired {inv.expires_at}</span> : <>expires {inv.expires_at}</>}
                  </p>
                </div>
                <button onClick={() => resend.mutate(inv.id)} disabled={resend.isPending} title="Email the invitation again (7 more days)"
                  className="flex items-center gap-1 text-[13px] font-medium text-[var(--color-teal)] hover:underline disabled:opacity-60"><RotateCw size={12} /> Resend</button>
                {!inv.expired && <button onClick={() => copyLink(inv.invite_url)} title="Copy invite link"
                  className="flex items-center gap-1 text-[13px] font-medium text-[var(--color-teal)] hover:underline"><Copy size={12} /> Copy link</button>}
                <button onClick={() => cancel.mutate(inv.id)} disabled={cancel.isPending} title="Cancel invitation"
                  className="text-[var(--color-text-faint)] hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--color-white)] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--color-text)]">Invite to your team</h3>
              <button onClick={() => setShowInvite(false)} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">Email address</span>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@company.com" className="profile-input" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-[var(--color-text-muted)]">Role</span>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="profile-select">
                  {roles.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.help}</option>)}
                </select>
                {roles.find((o) => o.value === inviteRole)?.help && (
                  <span className="mt-1 block text-[13px] text-[var(--color-text-faint)]">{roles.find((o) => o.value === inviteRole)?.help}</span>
                )}
              </label>
              <p className="text-[13px] text-[var(--color-text-faint)]">They&apos;ll get an email with a link to create their own login. You can also copy the link and send it yourself.</p>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowInvite(false)}
                className="flex-1 rounded-xl border border-[var(--color-cream-dark)] py-2.5 text-sm font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)]">Cancel</button>
              <button
                onClick={() => {
                  const msg = validateTeamInvite(inviteEmail, inviteRole);
                  if (msg) { toast.error(msg); return; }
                  invite.mutate();
                }}
                disabled={!inviteEmail || !inviteRole || invite.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-teal)] py-2.5 text-base font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-60">
                {invite.isPending ? <><Loader2 size={13} className="animate-spin" /> Sending…</> : <><Send size={13} /> Send invite</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
