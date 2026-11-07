import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

/**
 * Read a date for display. A calendar day ("2026-11-10", or the same day sent as UTC midnight
 * "2026-11-10T00:00:00.000000Z") is read at local noon, so it doesn't show as the day before in US time zones.
 */
export function parseDay(date: string): Date {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.0+)?Z)?$/.exec(date);
  return new Date(m ? `${m[1]}T12:00:00` : date);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parseDay(date));
}

export function formatEta(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return 'Arrived';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
