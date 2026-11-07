/** The organizations directory (api DirectoryController / OrgDirectory) */

export type OrgType = 'shipper' | 'carrier' | 'factor' | 'receiver' | 'broker';
export type NotifyEvent = 'booked' | 'en_route' | 'arrived' | 'done';
export type NotifyChannel = 'email' | 'sms';
export type Notify = Record<NotifyEvent, NotifyChannel[]>;

export interface DirLocation {
  id: number;
  org_id: number;
  org_name?: string | null;
  org_type?: OrgType;
  source?: 'mine' | 'partner' | 'directory';
  name: string;
  visibility: 'public' | 'private';
  address: string;
  city: string;
  state?: string | null;
  zip: string;
  country?: string;
  lat?: number | null;
  lng?: number | null;
  operating_hours?: Record<string, string> | null;
  dock_doors?: number | null;
  appointment_required?: boolean;
  site_instructions?: string | null;
  notes?: string | null;
  is_default?: boolean;
  usage_count?: number;
}

export interface DirContact {
  id: number;
  org_id: number;
  location_id: number | null;
  user_id: number | null;
  name: string;
  title?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  is_primary: boolean;
  notes?: string | null;
  notify: Notify;
}

export interface DirOrgSummary {
  id: number;
  name: string;
  type: OrgType;
  /** Listed by another company; nobody from it has signed up */
  listed: boolean;
  listed_by: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  locations_count: number;
  contacts_count?: number | null;
  is_partner: boolean;
  is_mine: boolean;
  can_edit: boolean;
}

export interface DirOrg extends DirOrgSummary {
  street?: string | null;
  zip?: string | null;
  country?: string | null;
  claimed_at?: string | null;
  locations: DirLocation[];
  /** null when the viewer may not see contacts */
  contacts: DirContact[] | null;
  pending_claims: { id: number; as_type: string; user: { id: number; name: string; email: string } | null; created_at: string }[];
  events: Record<NotifyEvent, string>;
}

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  shipper: 'Shipper', carrier: 'Carrier', factor: 'Factor', receiver: 'Receiver', broker: 'Broker',
};

export const EVENT_LABEL: Record<NotifyEvent, string> = {
  booked: 'Carrier booked', en_route: 'On the way', arrived: 'Arrived', done: 'Picked up / delivered',
};
