'use client';

/**
 * Admin, Claims: people who signed up and asked to manage a company another business listed.
 * A claim is approved automatically when the person's verified email is one of the company's listed contacts;
 * the rest wait here.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSignature } from 'lucide-react';
import { adminClaimApi } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { ClaimDecision } from '@/components/admin/ClaimDecision';

type Status = 'pending' | 'approved' | 'rejected' | 'all';

interface ClaimRow {
  id: number;
  status: string;
  as_type: string;
  method: string | null;
  note: string | null;
  org: { id: number; name: string; type: string; city: string | null; state: string | null; status: string } | null;
  user: { id: number; name: string; email: string } | null;
  email_is_contact: boolean;
  created_at: string;
  decided_at: string | null;
}

const STATUSES: Status[] = ['pending', 'approved', 'rejected', 'all'];

export default function AdminClaimsPage() {
  const [status, setStatus] = useState<Status>('pending');
  const qc = useQueryClient();
  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['admin-claims', status],
    queryFn: () => adminClaimApi.list(status).then(r => r.data.data as ClaimRow[]),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Claims</h1>
        <p className="mt-1 text-sm text-[var(--color-text-faint)]">
          People asking to manage a company that another business listed. Approving hands the company over: it becomes the type they
          signed up as, and only their team can change it afterwards. Claims from a listed contact&apos;s email are approved automatically.
        </p>
      </div>

      <div className="flex gap-2">
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${s === status
              ? 'bg-[var(--color-teal)] text-white'
              : 'border border-[var(--color-cream-dark)] bg-[var(--color-cream)] text-[var(--color-text-muted)]'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="skeleton h-48 rounded-xl" />
      ) : claims.length === 0 ? (
        <EmptyState icon={FileSignature} title={status === 'pending' ? 'No claims waiting' : 'No claims'} />
      ) : (
        <div className="space-y-4">
          {claims.map(c => (
            <div key={c.id} className="rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {c.org ? <Link href={`/admin/companies/${c.org.id}`} className="hover:underline">{c.org.name}</Link> : 'Removed company'}
                  {c.org && (c.org.city || c.org.state) && (
                    <span className="ml-2 font-normal text-[var(--color-text-muted)]">{[c.org.city, c.org.state].filter(Boolean).join(', ')}</span>
                  )}
                </p>
                <span className={`badge ${c.status === 'approved' ? 'badge-success' : c.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                  {c.status}{c.method === 'contact_email' ? ' · automatic' : ''}
                </span>
              </div>
              {c.status === 'pending' ? (
                <ClaimDecision
                  claim={c}
                  orgName={c.org?.name ?? 'this company'}
                  emailIsContact={c.email_is_contact}
                  onDone={() => qc.invalidateQueries({ queryKey: ['admin-claims'] })}
                />
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  {c.user?.name} ({c.user?.email}) · signed up as {c.as_type}
                  {c.decided_at ? ` · decided ${new Date(c.decided_at).toLocaleDateString()}` : ''}
                  {c.note ? ` · ${c.note}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
