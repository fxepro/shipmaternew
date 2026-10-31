'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Radio, User, Users, BarChart2, FileSignature } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/user';

const TABS: Record<UserRole, { label: string; href: string; icon: React.ElementType }[]> = {
  shipper: [
    { label: 'Home',      href: '/shipper',           icon: LayoutDashboard },
    { label: 'Shipments', href: '/shipper/shipments', icon: Package         },
    { label: 'Bids',      href: '/shipper/bids',      icon: Radio           },
    { label: 'Account',   href: '/shipper/payments',  icon: User            },
  ],
  carrier: [
    { label: 'Home',    href: '/carrier',         icon: LayoutDashboard },
    { label: 'Jobs',    href: '/carrier/jobs',    icon: Package         },
    { label: 'My Jobs', href: '/carrier/my-jobs', icon: Radio           },
    { label: 'Account', href: '/carrier/profile', icon: User            },
  ],
  factor: [
    { label: 'Home',    href: '/factor',         icon: LayoutDashboard },
    { label: 'Factoring', href: '/factor/factoring', icon: FileSignature },
    { label: 'Account', href: '/factor/profile', icon: User            },
  ],
  receiver: [
    { label: 'Home',       href: '/receiver',           icon: LayoutDashboard },
    { label: 'Deliveries', href: '/receiver/shipments', icon: Package         },
    { label: 'Account',    href: '/receiver',           icon: User            },
  ],
  admin: [
    { label: 'Console',  href: '/admin',           icon: BarChart2       },
    { label: 'Ships',    href: '/admin/shipments', icon: Package         },
    { label: 'Users',    href: '/admin/users',     icon: Users           },
    { label: 'Shipper',  href: '/shipper',         icon: LayoutDashboard },
  ],
};

export function BottomTabBar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const tabs = TABS[role];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex"
      style={{
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {tabs.filter((t) => t.label).map((tab) => {
        const isActive =
          pathname === tab.href || (tab.href !== `/${role}` && pathname.startsWith(tab.href));
        return (
          <Link
            key={tab.href + tab.label}
            href={tab.href}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-fine font-medium transition-colors"
            style={{ color: isActive ? 'var(--navy)' : 'var(--text-faint)' }}
          >
            <tab.icon size={18} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
