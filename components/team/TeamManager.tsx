'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Send, UserMinus, X, Copy, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { orgApi } from '@/lib/api';
import { validateTeamInvite } from '@/lib/shipper-profile-validation';
import { PersonStatusBadge, ROLE_LABELS } from '@/components/admin/PersonBadges';

interface Member {
  id: number; user_id: number; name: string; email: string; role: string; is_owner: boolean;
  approval_required: boolean; person_status: string; required_met: number; required_total: number;
}
interface Invitation { id: number; email: string; role: string; expires_at: string; invite_url: string }

/** What each role can do (docs/people-types-and-checks.md) */
const ROLE_HELP: Record<string, string> = {
  staff:      'Staff — manages the account, team and settings',
  dispatcher: 'Dispatcher — finds loads, bids and assigns drivers',
  driver:     'Driver — moves the freight; needs Shipmater approval',
  viewer:     'Viewer — read-only',
};

const INVITE_ROLES: Record<'carrier' | 'shipper', string[]> = {
  carrier: ['driver', 'dispatcher', 'staff', 'viewer'],
  shipper: ['staff', 'viewer'],
};

const ROLE_COLORS: Record<string, string> = {
  owner:      'bg-purple-50 text-purple-700',
  staff:      'bg-blue-50 text-blue-700',
  dispatcher: 'bg-teal-50 text-[var(--color-teal)]',
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
export function TeamManager({ type }: { type: 'carrier' | 'shipper' }) {
  const qc = useQueryClient();
  const roles = INVITE_ROLES[type];
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(roles[0]);
  const [showInvite, setShowInvite] = useState(false);

  const { data: members = [], isLoading } = useQuery({ queryKey: ['org-members'], queryFn: () => orgApi.members().then((r) => r.data.data as Member[]) });
  const { data: invitations = [] } = useQuery({ queryKey: ['org-invitations'], queryFn: () => orgApi.invitations().then((r) => r.data.data as Invitation[]) });

  const invite = useMutation({
    mutationFn: () => orgApi.invite(inviteEmail, inviteRole),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
    onError: () => toast.error('Could not change role'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => orgApi.removeMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-members'] }),
    onError: () => toast.error('Could not remove member'),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => orgApi.cancelInvitation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-invitations'] }),
  });

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="card-head card-head-tint flex items-center justify-between gap-3 px-5 py-3">
          <p className="card-title">Team members ({members.length})</p>
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]">
            <Plus size={12} /> Invite
          </button>
        </div>
        <div className="card-body">
          {type === 'carrier' && (
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">
              Drivers sign up with their own login from your invite, then add their licence, medical card and ID.
              Shipmater approves each driver before they can be assigned a load.
            </p>
          )}
          {isLoading ? (
            <div className="skeleton h-28 rounded-xl" />
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-cream-dark)] px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-slate)] text-xs font-bold text-white">
                    {m.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-text)]">{m.name}</p>
                    <p className="truncate text-xs text-[var(--color-text-faint)]">{m.email}</p>
                  </div>
                  {m.approval_required && (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-faint)]">
                      {m.required_total > 0 && <span>{m.required_met}/{m.required_total} checks</span>}
                      <PersonStatusBadge status={m.person_status} />
                    </div>
                  )}
                  {m.is_owner ? (
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS.owner}`}>
                      <Crown size={10} /> Owner
                    </span>
                  ) : (
                    <select value={m.role} onChange={(e) => updateRole.mutate({ id: m.id, role: e.target.value })} aria-label={`Role for ${m.name}`}
                      className="rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-2.5 py-1 text-xs text-[var(--color-text)] focus:border-[var(--color-teal)] focus:outline-none">
                      {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  )}
                  {!m.is_owner && (
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
              <div key={inv.id} className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--color-cream-dark)] px-4 py-3">
                <Send size={14} className="shrink-0 text-[var(--color-text-faint)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--color-text)]">{inv.email}</p>
                  <p className="text-xs text-[var(--color-text-faint)]">{ROLE_LABELS[inv.role] ?? inv.role} · expires {inv.expires_at}</p>
                </div>
                <button onClick={() => copyLink(inv.invite_url)} title="Copy invite link"
                  className="flex items-center gap-1 text-xs font-medium text-[var(--color-teal)] hover:underline"><Copy size={12} /> Copy link</button>
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
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Email address</span>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@company.com" className="profile-input" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">Role</span>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="profile-select">
                  {roles.map((r) => <option key={r} value={r}>{ROLE_HELP[r]}</option>)}
                </select>
              </label>
              <p className="text-xs text-[var(--color-text-faint)]">They&apos;ll get an email with a link to create their own login. You can also copy the link and send it yourself.</p>
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
                disabled={!inviteEmail || invite.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-teal)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-teal-dark)] disabled:opacity-60">
                {invite.isPending ? <><Loader2 size={13} className="animate-spin" /> Sending…</> : <><Send size={13} /> Send invite</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
