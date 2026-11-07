'use client';

import { createContext, useContext } from 'react';
import { canDo, canSee, type Permissions } from '@/lib/permissions';
import type { User } from '@/types/user';

const PermissionsContext = createContext<Permissions | undefined>(undefined);

/** Set by the dashboard layout from the signed-in person's /user response */
export const PermissionsProvider = PermissionsContext.Provider;

const CurrentUserContext = createContext<User | null>(null);

/** Set by the dashboard layout: the signed-in person (or, in Carrier/Shipper View, the company being viewed) */
export const CurrentUserProvider = CurrentUserContext.Provider;

/** The signed-in person; user.org is their company */
export function useCurrentUser() {
  return useContext(CurrentUserContext);
}

/** The signed-in person's role matrix: can.do('loads.bid'), can.see('money.payments') */
export function useCan() {
  const p = useContext(PermissionsContext);
  return { do: (action: string) => canDo(p, action), see: (action: string) => canSee(p, action), level: (action: string) => p?.[action] };
}
