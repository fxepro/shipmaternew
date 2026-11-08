/**
 * The company role matrix on the frontend (Admin Console, Settings, Roles & Permissions).
 * The API enforces every rule; these helpers only hide what a person can't use.
 */
export type PermLevel = 'full' | 'view' | 'assigned' | 'self' | 'none';
export type Permissions = Record<string, PermLevel>;

/** No company (admins, receivers): the matrix doesn't apply */
const noMatrix = (p?: Permissions | null) => !p || Object.keys(p).length === 0;

/** May act: full, or on their own assigned loads or record */
export function canDo(p: Permissions | null | undefined, action: string): boolean {
  if (noMatrix(p)) return true;
  return ['full', 'assigned', 'self'].includes(p![action] ?? 'none');
}

/** May see: anything but none */
export function canSee(p: Permissions | null | undefined, action: string): boolean {
  if (noMatrix(p)) return true;
  return (p![action] ?? 'none') !== 'none';
}

/** Pages in the menus and the permission each needs: [action, 'see' | 'do'] */
export const PAGE_PERMISSION: Record<string, [string, 'see' | 'do']> = {
  // Shipper
  '/shipper/shipments':              ['loads.view', 'see'],
  '/shipper/route-planner':          ['loads.post', 'do'],
  '/shipper/tracking':               ['loads.view', 'see'],
  '/shipper/jobs/contracted/new':    ['loads.post', 'do'],
  '/shipper/jobs':                   ['loads.view', 'see'],
  '/shipper/jobs/offers':            ['loads.view', 'see'],
  '/shipper/jobs/contracted':        ['loads.view', 'see'],
  '/shipper/bids':                   ['loads.view', 'see'],
  '/shipper/carriers':               ['carriers.preferred', 'see'],
  '/shipper/contracts':              ['contracts.edit', 'see'],
  '/shipper/locations?type=pickup':  ['locations.manage', 'see'],
  '/shipper/locations':              ['locations.manage', 'see'],
  '/shipper/receivers':              ['locations.manage', 'see'],
  // Receiver
  '/receiver/shipments':             ['loads.view', 'see'],
  '/receiver/tracking':              ['loads.view', 'see'],
  '/receiver/company':               ['locations.manage', 'see'],
  '/receiver/team':                  ['team.manage', 'do'],
  '/shipper/payments':               ['money.payments', 'see'],
  '/shipper/factoring':              ['money.payments', 'see'],
  // Carrier
  '/carrier/jobs':                   ['loads.board', 'see'],
  '/carrier/my-jobs':                ['loads.view', 'see'],
  '/carrier/offers':                 ['loads.board', 'see'],
  '/carrier/earnings':               ['money.payments', 'see'],
  '/carrier/factoring':              ['money.factoring', 'do'],
  // Factor
  '/factor/factoring':               ['loads.view', 'see'],
  '/factor/payments':                ['loads.view', 'see'],
};

/** Buttons hidden by the matrix, by company type: [label, action, 'see' | 'do'] (keep in step with the pages that use useCan) */
export const BUTTON_PERMISSION: Record<'carrier' | 'shipper' | 'broker' | 'factor' | 'receiver', [string, string, 'see' | 'do'][]> = {
  carrier: [
    ['Browse Jobs (dashboard)',                  'loads.board',  'see'],
    ['Place Bid (load board)',                   'loads.bid',    'do'],
    ['Accept and Decline contracted offers',     'loads.accept', 'do'],
    ['Team: Invite, change role, remove',        'team.manage',  'do'],
  ],
  shipper: [
    ['New Shipment (dashboard, My Shipments)',   'loads.post',   'do'],
    ['New job (My Jobs, Contracted)',            'loads.post',   'do'],
    ['Edit draft (job page)',                    'loads.post',   'do'],
    ['Accept and Decline offers',                'loads.decide', 'do'],
    ['Team: Invite, change role, remove',        'team.manage',  'do'],
  ],
  broker: [
    ['New Shipment (dashboard, My Shipments)',   'loads.post',   'do'],
    ['New job (My Jobs, Contracted)',            'loads.post',   'do'],
    ['Edit draft (job page)',                    'loads.post',   'do'],
    ['Accept and Decline offers',                'loads.decide', 'do'],
    ['Team: Invite, change role, remove',        'team.manage',  'do'],
  ],
  factor: [
    ['Team: Invite, change role, remove',        'team.manage',  'do'],
  ],
  receiver: [
    ['Team: Invite, change role, remove',        'team.manage',  'do'],
    ['Locations: Add, edit, remove',             'locations.manage', 'do'],
    ['Contacts: Add, edit, notification settings', 'contacts.manage', 'do'],
  ],
};

/** Whether a menu link should show for these permissions */
export function canOpen(p: Permissions | null | undefined, href: string): boolean {
  // Broker pages are the shipper pages under /broker
  const rule = PAGE_PERMISSION[href] ?? PAGE_PERMISSION[href.replace(/^\/broker(?=\/|$)/, '/shipper')];
  if (!rule) return true;
  return rule[1] === 'do' ? canDo(p, rule[0]) : canSee(p, rule[0]);
}
