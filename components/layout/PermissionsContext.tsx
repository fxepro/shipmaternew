'use client';

import { createContext, useContext } from 'react';
import { canDo, canSee, type Permissions } from '@/lib/permissions';

const PermissionsContext = createContext<Permissions | undefined>(undefined);

/** Set by the dashboard layout from the signed-in person's /user response */
export const PermissionsProvider = PermissionsContext.Provider;

/** The signed-in person's role matrix: can.do('loads.bid'), can.see('money.payments') */
export function useCan() {
  const p = useContext(PermissionsContext);
  return { do: (action: string) => canDo(p, action), see: (action: string) => canSee(p, action), level: (action: string) => p?.[action] };
}
