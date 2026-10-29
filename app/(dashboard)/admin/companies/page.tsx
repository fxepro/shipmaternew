'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CompanyList } from '@/components/admin/CompanyList';

function Companies() {
  const type = useSearchParams().get('type');
  return <CompanyList initialType={type === 'carrier' || type === 'shipper' ? type : 'all'} />;
}

export default function AdminCompaniesPage() {
  return (
    <Suspense>
      <Companies />
    </Suspense>
  );
}
