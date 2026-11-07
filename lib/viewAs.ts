'use client';

import { useEffect, useState } from 'react';

/**
 * Admin Console, Carrier View and Shipper View: the company an admin is reading as.
 * One choice per view, kept in this browser. lib/api.ts sends it as X-View-As-Org on carrier and
 * shipper pages; the API honours it for platform admins only, read-only (App\Http\Middleware\ViewAsCompany).
 */
export type ViewType = 'carrier' | 'shipper';
export interface ViewCompany { id: number; name: string; type: ViewType }

const KEY = (t: ViewType) => `sm_view_as_${t}`;
const EVENT = 'sm-view-as';

/** Which view a page belongs to, from its path */
export function viewTypeFor(pathname: string): ViewType | null {
  if (pathname === '/carrier' || pathname.startsWith('/carrier/')) return 'carrier';
  if (pathname === '/shipper' || pathname.startsWith('/shipper/')) return 'shipper';
  return null;
}

export function getViewAs(type: ViewType): ViewCompany | null {
  try {
    const raw = localStorage.getItem(KEY(type));
    const v = raw ? (JSON.parse(raw) as ViewCompany) : null;
    return v && typeof v.id === 'number' ? v : null;
  } catch {
    return null;
  }
}

export function setViewAs(type: ViewType, company: ViewCompany | null): void {
  try {
    if (company) localStorage.setItem(KEY(type), JSON.stringify(company));
    else localStorage.removeItem(KEY(type));
  } catch { /* storage unavailable: the choice lasts until reload */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Forget both choices (on sign-out) */
export function clearViewAs(): void {
  try {
    localStorage.removeItem(KEY('carrier'));
    localStorage.removeItem(KEY('shipper'));
  } catch { /* ignore */ }
}

/** The company chosen for a view, updating when it changes */
export function useViewAs(type: ViewType | null): ViewCompany | null {
  const [v, setV] = useState<ViewCompany | null>(null);
  useEffect(() => {
    const read = () => setV(type ? getViewAs(type) : null);
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener('storage', read);
    return () => { window.removeEventListener(EVENT, read); window.removeEventListener('storage', read); };
  }, [type]);
  return v;
}

/** The header to send for the current page, if an admin has chosen a company for it */
export function viewAsHeader(): string | null {
  if (typeof window === 'undefined') return null;
  const type = viewTypeFor(window.location.pathname);
  return type ? String(getViewAs(type)?.id ?? '') || null : null;
}
