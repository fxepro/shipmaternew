'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserStatusBadge } from '@/components/admin/UserStatusBadge';

interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  org: { id: number; name: string; type: string } | null;
}

const ROLES = [
  { label: 'All roles', value: 'all' }, { label: 'Shipper', value: 'shipper' }, { label: 'Carrier', value: 'carrier' },
  { label: 'Receiver', value: 'receiver' }, { label: 'Admin', value: 'admin' },
];

const STATUSES = [
  { label: 'All', value: 'all' }, { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' }, { label: 'Deactivated', value: 'deactivated' },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-users', role, status],
    queryFn: () => api.get('/api/v1/admin/users', { params: { role, status } }),
  });

  const q = search.trim().toLowerCase();
  const users: AdminUserRow[] = (res?.data?.data ?? []).filter(
    (u: AdminUserRow) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-5">
      <h1 className="page-title">Users</h1>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="w-64 bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Filter by role"
          className="bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]"
        >
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <button key={s.value} onClick={() => setStatus(s.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${status === s.value ? 'bg-[var(--color-slate)] text-white' : 'bg-[var(--color-white)] border border-[var(--color-cream-dark)] text-[var(--color-text-muted)]'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-[var(--color-text-muted)]">{isLoading ? '' : `${users.length} user${users.length === 1 ? '' : 's'}`}</span>
      </div>

      {isLoading ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="No users match these filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-dark)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-cream-dark)] bg-[var(--color-slate)]">
                {['Name', 'Email', 'Role', 'Organization', 'Status', 'Joined', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-sage-light)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => router.push(`/admin/users/${u.id}`)}
                  className="cursor-pointer border-b border-[var(--color-cream-dark)] last:border-b-0 bg-[var(--color-white)] hover:bg-[var(--color-cream)] transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">{u.name}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{u.email}</td>
                  <td className="px-4 py-3 capitalize text-[var(--color-text-muted)]">{u.role}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{u.org?.name ?? '—'}</td>
                  <td className="px-4 py-3"><UserStatusBadge status={u.status} /></td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-[var(--color-teal)]">View</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
