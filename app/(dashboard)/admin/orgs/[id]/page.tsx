'use client';

import { useParams } from 'next/navigation';
import { OrgDetailView } from '@/components/admin/OrgDetailView';

export default function AdminOrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <OrgDetailView id={id} />;
}
