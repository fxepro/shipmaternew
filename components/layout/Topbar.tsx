'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LogOut } from 'lucide-react';
import type { UserRole } from '@/types/user';

const ROLE_TITLE: Record<UserRole, string> = {
  shipper:  'Shipper Portal',
  broker:   'Broker Portal',
  carrier:  'Carrier Portal',
  receiver: 'My Deliveries',
  admin:    'Admin Console',
  factor:   'Factor Portal',
};

interface TopbarProps {
  role: UserRole;
  userName: string;
  onLogout: () => void;
}

export function Topbar({ role, userName, onLogout }: TopbarProps) {
  // The signed-in person; their name opens Profile (brokers use the shipper pages under /broker)
  const broker = (usePathname() ?? '').startsWith('/broker');
  const profileHref = role === 'admin' ? null : `/${broker ? 'broker' : role}/profile`;
  const Person = profileHref ? Link : 'div';
  return (
    <header
      className="flex h-14 items-center justify-between px-6"
      style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <p className="text-body font-medium" style={{ color: 'var(--navy)' }}>
        {ROLE_TITLE[role]}
      </p>
      <div className="flex items-center gap-2">
        <button
          className="relative transition-colors"
          style={{ color: 'var(--text-faint)' }}
          aria-label="Notifications"
        >
          <Bell size={17} />
        </button>
        <Person href={profileHref ?? ''} className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-[var(--border)]" title={profileHref ? 'Profile' : undefined}>
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption font-medium"
            style={{ background: 'var(--navy)', color: 'var(--on-dark)' }}
            aria-hidden="true"
          >
            {userName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')}
          </div>
          <span className="max-w-[220px] truncate text-body-sm font-medium" style={{ color: 'var(--navy)' }}>{userName}</span>
        </Person>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-body-sm font-medium transition-colors hover:bg-[var(--border)]"
          style={{ color: 'var(--text-faint)' }}
          aria-label="Log out"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </div>
    </header>
  );
}
