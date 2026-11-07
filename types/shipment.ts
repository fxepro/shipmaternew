/** A load (freight job) as the shipments endpoints return it: see api ShipmentResource */

export type ShipmentStatus =
  | 'draft'
  | 'pending'
  | 'assigned'
  | 'in_transit'
  | 'delivered'
  | 'disputed'
  | 'cancelled';

export type JobType = 'open' | 'contracted';

export interface GpsPingData {
  lat: number;
  lng: number;
  speed?: number;
  eta?: string;
  pinged_at: string;
}

export type StopType = 'pickup' | 'dropoff';

export interface ShipmentStop {
  id: number;
  location_id?: number | null;
  sequence: number;
  stop_type: StopType;
  name?: string | null;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number | null;
  lng?: number | null;
  scheduled_date?: string | null;
  time_window?: string | null;
  status: 'pending' | 'en_route' | 'arrived' | 'completed';
  completed_at?: string | null;
}

export interface Shipment {
  id: number;
  reference_number?: string | null;
  shipper_id?: number;
  carrier_id?: number | null;
  /** The status people see; job_status is the stored freight job status */
  status: ShipmentStatus;
  job_status?: 'draft' | 'posted' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
  job_type: JobType;
  contract_id?: number | null;
  tracking_token: string;

  // Item
  item_description: string;
  item_category?: string;
  weight_lbs?: number;
  handling_requirements?: string[];
  special_notes?: string;

  // Pickup
  pickup_address: string;
  pickup_city?: string;
  pickup_state?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  pickup_contact_name?: string;
  pickup_contact_phone?: string;
  pickup_date?: string;
  pickup_time_window?: string;

  // Delivery
  delivery_address: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_lat?: number;
  delivery_lng?: number;
  delivery_contact_name?: string;
  delivery_contact_phone?: string;
  delivery_date?: string;
  delivery_time_window?: string;
  delivered_at?: string;
  delivery_photo_url?: string;

  // Every stop in route order; pickup_* is the first pickup, delivery_* the last drop-off
  stops?: ShipmentStop[];
  stops_count?: number;

  // Route
  distance_miles?: number;
  estimated_duration_mins?: number;
  route_polyline?: string;

  // Cost
  agreed_cost?: number | null;
  payment_status?: string;

  // Parties
  shipper?: { id: number; name: string; email: string };
  carrier?: {
    id: number;
    name: string;
    email: string;
    carrier_profile?: {
      company_name?: string;
      dot_number?: string;
      dot_verified?: boolean;
      rating?: number;
      total_deliveries?: number;
    } | null;
  };
  receiver?: { id: number; name: string; email: string } | null;
  people?: { org_id: number | null; user_id: number; name?: string; role?: string }[];

  // GPS
  latest_ping?: GpsPingData | null;

  offers_count?: number | null;

  created_at: string;
  updated_at: string;
}
