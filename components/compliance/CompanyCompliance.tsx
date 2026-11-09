'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useCan } from '@/components/layout/PermissionsContext';
import { ComplianceItems, type ComplianceItem } from '@/components/compliance/ComplianceItems';

/**
 * The signed-in company's compliance items, from GET /api/v1/org/compliance.
 * Which items show, and whether each is required, optional or deferred, is set per company type
 * in Admin, Compliance; a change there shows here the next time the page loads.
 * Items kept as files or values can be added by roles that edit the company profile.
 */
export function CompanyCompliance({ note, variant }: { note?: string; variant?: 'cards' | 'rows' }) {
  const can = useCan();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['org-compliance'],
    queryFn: () => api.get('/api/v1/org/compliance').then((r) => r.data.data as ComplianceItem[]),
  });
  if (isLoading) return <div className="skeleton h-32 rounded-xl" />;
  return (
    <div className="space-y-3">
      {note && <p className="text-sm text-[var(--color-text-muted)]">{note}</p>}
      <ComplianceItems items={data ?? []} variant={variant}
        uploadUrl={can.do('company.profile') ? (key) => `/api/v1/org/compliance/${key}` : undefined}
        onChange={(items) => qc.setQueryData(['org-compliance'], items)} />
    </div>
  );
}
