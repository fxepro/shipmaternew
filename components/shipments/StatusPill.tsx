import type { ShipmentStatus } from '@/types/shipment';

// Brand-blue states use badge variants; genuinely distinct status hues
// (amber/purple) stay as semantic Tailwind colors — they're not brand tokens.
const STATUS_STYLES: Record<ShipmentStatus, string> = {
  draft:      'badge-muted',
  pending:    'bg-amber-50 text-amber-700',
  assigned:   'badge-primary',
  in_transit: 'badge-info',
  delivered:  'badge-success',
  disputed:   'badge-danger',
  cancelled:  'badge-muted',
};

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  draft:      'Draft',
  pending:    'Open',
  assigned:   'Assigned',
  in_transit: 'In Transit',
  delivered:  'Delivered',
  disputed:   'Disputed',
  cancelled:  'Cancelled',
};

export function StatusPill({ status }: { status: ShipmentStatus }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? 'badge-muted'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
