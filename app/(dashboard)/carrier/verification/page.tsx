'use client';

import { Suspense } from 'react';
import { MyVerification } from '@/components/people/MyVerification';

export default function VerificationPage() {
  return (
    <Suspense>
      <MyVerification />
    </Suspense>
  );
}
