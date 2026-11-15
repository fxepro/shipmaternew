'use client';

import { Suspense } from 'react';
import { AgencyAccount } from '@/components/lawenforcement/AgencyAccount';

export default function AgencyProfilePage() {
  return <Suspense><AgencyAccount /></Suspense>;
}
