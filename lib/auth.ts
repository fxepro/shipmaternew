import { authApi, setStoredToken, clearStoredToken, getStoredToken } from './api';
import { getDemoUser, clearDemoUser } from './demo';
import { queryClient } from './queryClient';
import type { User } from '@/types/user';

/** Clear demo leftovers + React Query cache whenever a real session starts or ends. */
export function resetClientSession(): void {
  clearDemoUser();
  queryClient.clear();
}

/** Thrown when the API can't be reached; the stored session is kept so the user stays signed in. */
export class AuthUnavailableError extends Error {
  constructor(public status?: number) {
    super('Could not reach the server to confirm your session.');
  }
}

const ME_RETRY_DELAYS_MS = [1000, 2500];

export async function getUser(): Promise<User | null> {
  // Real token takes priority — if a Sanctum token is stored, use it.
  // Demo mode is only a fallback when there is no real session.
  const token = getStoredToken();

  if (token) {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await authApi.me();
        const user = res.data.data as User;
        // Stale demo cookie must not outlive a real login
        clearDemoUser();
        console.log('[auth] me() OK – user:', user?.email, 'role:', user?.role);
        return user;
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;

        // Only an explicit 401 means the session is gone; sign out and fall through to demo mode
        if (status === 401) {
          clearStoredToken();
          break;
        }

        // Network errors, timeouts and 5xx are temporary: keep the token and retry
        console.error('[auth] me() FAILED – status:', status, e);
        if (attempt >= ME_RETRY_DELAYS_MS.length) throw new AuthUnavailableError(status);
        await new Promise((r) => setTimeout(r, ME_RETRY_DELAYS_MS[attempt]));
      }
    }
  }

  const demoUser = getDemoUser();
  if (demoUser) {
    console.log('[auth] demo mode – user:', demoUser.email);
    return demoUser;
  }

  return null;
}

export async function login(email: string, password: string): Promise<User> {
  console.log('[auth] login attempt for', email);
  const res = await authApi.login({ email, password });
  console.log('[auth] login raw response:', res.data);
  const { token, data } = res.data as { token: string; data: User };
  console.log('[auth] token received:', token ? `${token.slice(0, 30)}…` : 'MISSING');
  if (!token) {
    throw new Error('Login succeeded but no token was returned.');
  }
  resetClientSession();
  setStoredToken(token);
  console.log('[auth] token stored. Reading back:', getStoredToken()?.slice(0, 30));
  return data;
}

/** Persist a register/login token and wipe prior user/demo cache. */
export function establishSession(token: string): void {
  if (!token || token === 'undefined' || token === 'null') {
    throw new Error('No auth token returned.');
  }
  resetClientSession();
  setStoredToken(token);
}

export async function logout(): Promise<void> {
  try { await authApi.logout(); } catch { /* ignore */ }
  clearStoredToken();
  resetClientSession();
  console.log('[auth] logged out – token cleared');
}

export function getRolePath(role: string, orgType?: string): string {
  // Org type takes priority over legacy role
  if (orgType === 'carrier') return '/carrier';
  if (orgType === 'shipper') return '/shipper';

  // Fallback to legacy role
  switch (role) {
    case 'carrier':  return '/carrier';
    case 'receiver': return '/receiver';
    case 'admin':    return '/admin';
    default:         return '/shipper';
  }
}
