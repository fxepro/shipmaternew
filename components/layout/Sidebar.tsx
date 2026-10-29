'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Package, DollarSign, User,
  Truck, BarChart2, Users, AlertTriangle, Route, MapPin, Building2, FileText,
  Briefcase, PlusCircle, Radio, ClipboardList, BookOpen, Warehouse, Palette,
  TrendingUp, Shield, Plus, Minus, CreditCard, Receipt, FileSignature, Plug,
  Settings, UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/user';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  section: string;
  items: NavItem[];
  /** Collapsed by default: only the first item shows, with a +/- toggle for the rest */
  collapsible?: boolean;
}

const NAV: Record<UserRole, NavSection[]> = {
  shipper: [
    {
      section: 'Overview',
      items: [{ label: 'Dashboard', href: '/shipper', icon: LayoutDashboard }],
    },
    {
      section: 'Shipments',
      items: [
        { label: 'My Shipments',  href: '/shipper/shipments',     icon: Package },
        { label: 'Route Planner', href: '/shipper/route-planner', icon: Route   },
        { label: 'Live Tracking', href: '/shipper/tracking',      icon: MapPin  },
      ],
    },
    {
      section: 'Jobs',
      items: [
        { label: 'Create Job',  href: '/shipper/jobs/contracted/new', icon: PlusCircle    },
        { label: 'My Jobs',     href: '/shipper/jobs',              icon: ClipboardList },
        { label: 'Offers',      href: '/shipper/jobs/offers',       icon: Radio         },
        { label: 'Contracted',  href: '/shipper/jobs/contracted',   icon: Briefcase     },
      ],
    },
    {
      section: 'Network',
      items: [
        { label: 'Carriers',            href: '/shipper/carriers',              icon: Truck     },
        { label: 'Contracts',           href: '/shipper/contracts',             icon: FileText  },
        { label: 'Pickup Addresses',    href: '/shipper/locations?type=pickup', icon: Warehouse },
        { label: 'Delivery Addresses',  href: '/shipper/locations',             icon: Users     },
      ],
    },
    {
      section: 'Financials',
      items: [{ label: 'Payments', href: '/shipper/payments', icon: DollarSign }],
    },
    {
      section: 'Reports',
      items: [{ label: 'Reports', href: '/shipper/reports', icon: BarChart2 }],
    },
    {
      section: 'Account',
      items: [{ label: 'Profile', href: '/shipper/profile', icon: User }],
    },
    {
      section: 'Resources',
      items: [{ label: 'Resources', href: '/shipper/resources', icon: BookOpen }],
    },
  ],
  carrier: [
    {
      section: 'Overview',
      items: [{ label: 'Dashboard', href: '/carrier', icon: LayoutDashboard }],
    },
    {
      section: 'Jobs',
      items: [
        { label: 'Available', href: '/carrier/jobs',    icon: Briefcase     },
        { label: 'My Jobs',   href: '/carrier/my-jobs', icon: ClipboardList },
        { label: 'Offers',    href: '/carrier/offers',  icon: Radio         },
      ],
    },
    {
      section: 'Financials',
      items: [{ label: 'Earnings', href: '/carrier/earnings', icon: DollarSign }],
    },
    {
      section: 'Reports',
      items: [{ label: 'Reports', href: '/carrier/reports', icon: BarChart2 }],
    },
    {
      section: 'Account',
      items: [{ label: 'Profile', href: '/carrier/profile', icon: User }],
    },
    {
      section: 'Resources',
      items: [{ label: 'Resources', href: '/carrier/resources', icon: BookOpen }],
    },
  ],
  receiver: [
    {
      section: 'Overview',
      items: [{ label: 'Dashboard', href: '/receiver', icon: LayoutDashboard }],
    },
    {
      section: 'Deliveries',
      items: [
        { label: 'My Deliveries', href: '/receiver/shipments', icon: Package },
        { label: 'Live Tracking', href: '/receiver/tracking',  icon: MapPin  },
      ],
    },
  ],
  admin: [
    {
      section: 'Console',
      items: [{ label: 'Overview', href: '/admin', icon: BarChart2 }],
    },
    {
      section: 'Operations',
      items: [
        { label: 'Shipments',        href: '/admin/shipments', icon: Package       },
        { label: 'Disputes',         href: '/admin/disputes',  icon: AlertTriangle },
        { label: 'Users',            href: '/admin/users',     icon: Users         },
      ],
    },
    {
      section: 'Onboarding & Compliance',
      items: [
        { label: 'Carrier Queue',    href: '/admin/carriers',  icon: Truck         },
        { label: 'Shipper Queue',    href: '/admin/shippers',  icon: Building2     },
        { label: 'NOAs / Factoring', href: '/admin/noas',      icon: FileSignature },
      ],
    },
    {
      section: 'Finance',
      items: [
        { label: 'Payments',    href: '/admin/payments',    icon: CreditCard },
        { label: 'Ledger',      href: '/admin/financials',  icon: TrendingUp },
        { label: 'Receivables', href: '/admin/receivables', icon: Receipt    },
      ],
    },
    {
      section: 'Organizations',
      items: [{ label: 'Organizations', href: '/admin/orgs', icon: Building2 }],
    },
    {
      section: 'Settings',
      items: [
        { label: 'Integrations',   href: '/admin/integrations', icon: Plug     },
        { label: 'Platform',       href: '/admin/settings',     icon: Settings },
        { label: 'Admins & Roles', href: '/admin/roles',        icon: UserCog  },
      ],
    },
    {
      section: 'Content',
      items: [
        { label: 'Blog',      href: '/admin/blog',      icon: BookOpen },
        { label: 'Resources', href: '/admin/resources', icon: Shield   },
      ],
    },
    {
      section: 'Shipper View',
      collapsible: true,
      items: [
        { label: 'Shipper View',     href: '/shipper',                     icon: LayoutDashboard },
        { label: 'My Shipments',     href: '/shipper/shipments',           icon: Package         },
        { label: 'Create Job',       href: '/shipper/jobs/contracted/new', icon: PlusCircle      },
        { label: 'My Jobs',          href: '/shipper/jobs',                icon: ClipboardList   },
        { label: 'Offers',           href: '/shipper/jobs/offers',         icon: Radio           },
        { label: 'Contracted',       href: '/shipper/jobs/contracted',     icon: Briefcase       },
        { label: 'Carriers',         href: '/shipper/carriers',            icon: Truck           },
        { label: 'Contracts',        href: '/shipper/contracts',           icon: FileText        },
        { label: 'Locations',        href: '/shipper/locations',           icon: Warehouse       },
        { label: 'Route Planner',    href: '/shipper/route-planner',       icon: Route           },
        { label: 'Live Tracking',    href: '/shipper/tracking',            icon: MapPin          },
        { label: 'Payments',         href: '/shipper/payments',            icon: DollarSign      },
        { label: 'Reports',          href: '/shipper/reports',             icon: BarChart2       },
        { label: 'Profile',          href: '/shipper/profile',             icon: User            },
        { label: 'Resources',        href: '/shipper/resources',           icon: BookOpen        },
      ],
    },
    {
      section: 'Carrier View',
      collapsible: true,
      items: [
        { label: 'Carrier View', href: '/carrier',           icon: LayoutDashboard },
        { label: 'Available',   href: '/carrier/jobs',      icon: Briefcase       },
        { label: 'My Jobs',     href: '/carrier/my-jobs',   icon: ClipboardList   },
        { label: 'Offers',      href: '/carrier/offers',    icon: Radio           },
        { label: 'Earnings',    href: '/carrier/earnings',  icon: DollarSign      },
        { label: 'Profile',     href: '/carrier/profile',   icon: User            },
        { label: 'Resources',   href: '/carrier/resources', icon: BookOpen        },
      ],
    },
  ],
};

interface SidebarProps {
  role: UserRole;
  /** True when the user's org is a white-label platform tenant */
  isPlatformTenant?: boolean;
  /** Tenant's custom brand name — replaces "Shipmater" in the wordmark */
  brandName?: string;
  /** Tenant's logo URL for dark backgrounds */
  logoUrl?: string;
}

export function Sidebar({ role, isPlatformTenant, brandName, logoUrl }: SidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const baseSections = NAV[role] ?? [];
  // For platform tenants, inject Branding into the Account section
  const sections = isPlatformTenant && role === 'shipper'
    ? baseSections.map((s) =>
        s.section === 'Account'
          ? { ...s, items: [...s.items, { label: 'Branding', href: '/shipper/branding', icon: Palette }] }
          : s
      )
    : baseSections;

  const allItems = sections.flatMap((s) => s.items);

  return (
    <aside
      className="sidebar-scroll hidden md:flex flex-col w-[224px] shrink-0 h-screen sticky top-0 overflow-y-auto"
      style={{ background: 'var(--primary)', fontFamily: 'var(--font-sans)' }}
    >
      {/* Brand header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brandName ?? 'Logo'} className="h-7 object-contain" />
        ) : (
          <div className="flex items-center gap-2">
            {/* Icon placeholder when no logo */}
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'var(--on-dark)' }}
            >
              {(brandName ?? 'S').charAt(0).toUpperCase()}
            </div>
            <span
              style={{
                fontSize: 'var(--text-nav)', fontWeight: 500, color: 'var(--on-dark)',
                letterSpacing: '0.04em', lineHeight: 1.3,
              }}
            >
              {brandName ?? 'Shipmater'}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-2.5 space-y-2.5">
        {sections.map(({ section, items, collapsible }, idx) => {
          const isActive = (item: NavItem) =>
            pathname === item.href ||
            (item.href !== `/${role}` &&
              pathname.startsWith(item.href + '/') &&
              !allItems.some(
                (other) =>
                  other.href !== item.href &&
                  other.href.length > item.href.length &&
                  (pathname === other.href || pathname.startsWith(other.href + '/'))
              ));

          if (collapsible) {
            const [entry, ...rest] = items;
            const firstCollapsible = sections.findIndex((s) => s.collapsible) === idx;
            // Stay open while the admin is on one of this section's pages
            const open = expanded[section] ?? rest.some(isActive);
            return (
              <div key={section}>
                {firstCollapsible && <SectionLabel>Surrogate Views</SectionLabel>}
                <div className="flex items-center">
                  <div className="flex-1 min-w-0">
                    <NavLink item={entry} active={isActive(entry)} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => ({ ...e, [section]: !open }))}
                    aria-expanded={open}
                    aria-label={`${open ? 'Collapse' : 'Expand'} ${section}`}
                    className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-white/12"
                    style={{ color: 'var(--on-dark-muted)' }}
                  >
                    {open ? <Minus size={13} /> : <Plus size={13} />}
                  </button>
                </div>
                {open && (
                  <ul className="mt-0.5 ml-3 space-y-0 border-l pl-1.5" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                    {rest.map((item) => (
                      <li key={item.href}>
                        <NavLink item={item} active={isActive(item)} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }

          return (
            <div key={section}>
              <SectionLabel>{section}</SectionLabel>
              <ul className="space-y-0">
                {items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} active={isActive(item)} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-0.5 px-2 text-caption font-medium uppercase"
      style={{ letterSpacing: '0.08em', color: 'var(--on-dark-muted)', opacity: 0.75 }}
    >
      {children}
    </p>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 font-medium transition-colors',
        active ? 'shadow-sm' : 'hover:bg-white/12'
      )}
      style={{
        background: active ? 'var(--navy)' : 'transparent',
        color:      active ? 'var(--on-dark)' : 'var(--on-dark-muted)',
        fontSize: 'var(--text-nav)',
        fontWeight: 500,
      }}
    >
      <item.icon
        size={15}
        style={{ color: active ? '#FFFFFF' : 'var(--on-dark-muted)', opacity: active ? 1 : 0.85 }}
      />
      {item.label}
    </Link>
  );
}
