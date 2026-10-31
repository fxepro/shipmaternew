'use client';

import { Bell, LogOut } from 'lucide-react';
import type { UserRole } from '@/types/user';

const ROLE_TITLE: Record<UserRole, string> = {
  shipper:  'Shipper Portal',
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
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-caption font-medium"
          style={{ background: 'var(--navy)', color: 'var(--on-dark)' }}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
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
