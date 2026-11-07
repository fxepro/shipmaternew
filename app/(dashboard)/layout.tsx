'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { PermissionsProvider, CurrentUserProvider } from '@/components/layout/PermissionsContext';
import { ViewAsBar, ViewAsEmpty } from '@/components/layout/ViewAsBar';
import { authApi } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { clearViewAs, useViewAs, viewTypeFor } from '@/lib/viewAs';
import { getUser, logout, AuthUnavailableError } from '@/lib/auth';
import { getTenantConfigClient, applyTenantBranding, resetTenantBranding } from '@/lib/tenant';
import type { User } from '@/types/user';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  // Admin Console, Carrier View and Shipper View: the company the admin is reading as (lib/viewAs.ts)
  const viewType = user?.role === 'admin' ? viewTypeFor(pathname) : null;
  const viewAs = useViewAs(viewType);
  const viewKey = viewType ? `${viewType}:${viewAs?.id ?? 'none'}` : 'own';
  // A different company: drop every cached page so nothing from the last one shows
  const lastViewKey = useRef(viewKey);
  if (lastViewKey.current !== viewKey) {
    lastViewKey.current = viewKey;
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'view-as-search' });
  }
  // The viewed company's /user: its permissions (all view) hide the action buttons
  const { data: viewedUser } = useQuery({
    queryKey: ['view-as-user', viewKey],
    queryFn: () => authApi.me().then((r) => r.data.data as User),
    enabled: !!viewAs,
  });

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    getUser()
      .then((u) => {
        if (!u) { router.replace('/login'); return; }
        // Sign-up isn't finished until the email is verified
        if (u.email_verified === false) { router.replace('/verify-email'); return; }
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
    clearViewAs();
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
    <PermissionsProvider value={viewAs ? (viewedUser?.permissions ?? { _loading: 'view' }) : user.permissions}>
    <CurrentUserProvider value={viewAs ? (viewedUser ?? null) : user}>
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar
        role={user.role}
        isPlatformTenant={user.org?.is_platform_tenant ?? false}
        brandName={brandName}
        logoUrl={logoUrl}
        permissions={user.permissions}
      />
      <div className="flex flex-1 flex-col min-w-0">
        {viewType && <ViewAsBar type={viewType} current={viewAs} />}
        <Topbar role={user.role} userName={user.name} onLogout={handleLogout} />
        <main key={viewKey} className="flex-1 p-6 pb-24 md:pb-6">
          {viewType && !viewAs ? <ViewAsEmpty type={viewType} />
            : user.pending_claim && !user.org ? <PendingClaim claim={user.pending_claim} />
            : children}
        </main>
      </div>
      <BottomTabBar role={user.role} permissions={user.permissions} />
    </div>
    </CurrentUserProvider>
    </PermissionsProvider>
  );
}

/** Signed up to take over a listed company: nothing else opens until the claim is approved */
function PendingClaim({ claim }: { claim: NonNullable<User['pending_claim']> }) {
  const place = [claim.org?.city, claim.org?.state].filter(Boolean).join(', ');
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="page-title">Your claim is being reviewed</h1>
      <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        You asked to manage <strong>{claim.org?.name ?? 'a company'}</strong>{place ? ` (${place})` : ''} on Shipmater.
        Another business added it to the directory, so we check that you work there before handing it over.
      </p>
      <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        If your email address is one of its listed contacts, this happens as soon as your email is verified.
        Otherwise our team reviews it, usually within one business day, and we&apos;ll email you.
      </p>
    </div>
  );
}
