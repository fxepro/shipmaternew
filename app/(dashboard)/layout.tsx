'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { getUser, logout, AuthUnavailableError } from '@/lib/auth';
import { getTenantConfigClient, applyTenantBranding, resetTenantBranding } from '@/lib/tenant';
import type { User } from '@/types/user';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    getUser()
      .then((u) => {
        if (!u) { router.replace('/login'); return; }
        setUnreachable(false);
        setUser(u);

        // Apply branding from the sm_tenant cookie (set by middleware for custom/subdomain hosts).
        // Falls back to no branding on the main Shipmater domain.
        const tenant = getTenantConfigClient();
        if (tenant) applyTenantBranding(tenant);
      })
      .catch((e) => {
        if (!(e instanceof AuthUnavailableError)) throw e;
        // Server unreachable: stay signed in and keep trying
        setUnreachable(true);
        retryTimer = setTimeout(() => setAttempt((n) => n + 1), 10_000);
      });

    return () => clearTimeout(retryTimer);
  }, [router, attempt]);

  async function handleLogout() {
    resetTenantBranding();
    await logout();
    router.replace('/login');
  }

  if (!user && unreachable) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center" style={{ background: 'var(--bg)' }}>
        <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Can&apos;t reach Shipmater right now</p>
        <p className="max-w-sm text-sm" style={{ color: 'var(--text-muted)' }}>
          You&apos;re still signed in. We&apos;ll keep trying automatically.
        </p>
        <button onClick={() => setAttempt((n) => n + 1)} className="btn btn-navy mt-2">Try again now</button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const tenant     = getTenantConfigClient();
  const brandName  = tenant?.brand_name  ?? undefined;
  const logoUrl    = tenant?.logo_url_dark ?? undefined;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar
        role={user.role}
        isPlatformTenant={user.org?.is_platform_tenant ?? false}
        brandName={brandName}
        logoUrl={logoUrl}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar role={user.role} userName={user.name} onLogout={handleLogout} />
        <main className="flex-1 p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>
      <BottomTabBar role={user.role} />
    </div>
  );
}
