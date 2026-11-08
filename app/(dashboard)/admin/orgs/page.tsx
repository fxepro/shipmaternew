'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CompanyList } from '@/components/admin/CompanyList';

function Organizations() {
  const type = useSearchParams().get('type');
  return <CompanyList scope="orgs" initialType={type === 'carrier' || type === 'shipper' || type === 'factor' || type === 'receiver' || type === 'broker' ? type : 'all'} />;
}

export default function AdminOrgsPage() {
  return (
    <Suspense>
      <Organizations />
    </Suspense>
  );
}
