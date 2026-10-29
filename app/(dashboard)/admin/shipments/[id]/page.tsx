'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusPill } from '@/components/shipments/StatusPill';
import { formatCurrency } from '@/lib/utils';
import type { ShipmentStatus } from '@/types/shipment';

type Row = Record<string, unknown>;

interface ShipmentDetail {
  shipment: Row;
  organization: Row | null;
  service_type: Row | null;
  shipper: Row | null;
  carrier: Row | null;
  receiver: Row | null;
  contract: Row | null;
  bids: Row[];
  transactions: Row[];
  gps: { count: number; latest: Row | null; pings: Row[] };
}

// Shipment columns grouped for display. Anything not listed still appears under "All fields".
const SECTIONS: { title: string; fields: [string, string][] }[] = [
  {
    title: 'Overview',
    fields: [
      ['id', 'Shipment ID'], ['status', 'Status'], ['job_type', 'Job type'], ['tracking_token', 'Tracking token'],
      ['created_at', 'Created'], ['updated_at', 'Last updated'],
    ],
  },
  {
    title: 'Cargo',
    fields: [
      ['item_description', 'Description'], ['item_category', 'Category'], ['weight_lbs', 'Weight (lbs)'],
      ['handling_requirements', 'Handling'], ['required_cert_keys', 'Required certifications'], ['special_notes', 'Special notes'],
    ],
  },
  {
    title: 'Pickup',
    fields: [
      ['pickup_address', 'Address'], ['pickup_city', 'City'], ['pickup_state', 'State'],
      ['pickup_date', 'Date'], ['pickup_time_window', 'Time window'],
      ['pickup_contact_name', 'Contact'], ['pickup_contact_phone', 'Contact phone'],
      ['pickup_lat', 'Latitude'], ['pickup_lng', 'Longitude'],
    ],
  },
  {
    title: 'Delivery',
    fields: [
      ['delivery_address', 'Address'], ['delivery_city', 'City'], ['delivery_state', 'State'],
      ['delivery_date', 'Date'], ['delivery_time_window', 'Time window'],
      ['delivery_contact_name', 'Contact'], ['delivery_contact_phone', 'Contact phone'],
      ['delivered_at', 'Delivered at'], ['delivery_photo_url', 'Proof of delivery photo'],
      ['delivery_lat', 'Latitude'], ['delivery_lng', 'Longitude'],
    ],
  },
  {
    title: 'Route',
    fields: [['distance_miles', 'Distance (mi)'], ['estimated_duration_mins', 'Est. duration (min)']],
  },
  {
    title: 'Payment',
    fields: [
      ['agreed_cost', 'Agreed cost'], ['currency', 'Currency'], ['payment_status', 'Payment status'],
      ['platform_fee_cents', 'Platform fee'], ['payment_intent_id', 'Stripe payment'], ['transfer_id', 'Stripe transfer'],
    ],
  },
];

const PARTY_FIELDS: [string, string][] = [
  ['name', 'Name'], ['company', 'Company'], ['email', 'Email'], ['phone', 'Phone'],
  ['verification_status', 'Verification'], ['dot_number', 'DOT #'], ['mc_number', 'MC #'],
  ['rating', 'Rating'], ['stripe_account_status', 'Stripe payouts'], ['id', 'User ID'],
];

function display(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return <span className="text-[var(--color-text-faint)]">—</span>;
  if (key === 'agreed_cost') return formatCurrency(Number(value));
  if (key === 'platform_fee_cents') return formatCurrency(Number(value) / 100);
  if (key === 'amount') return formatCurrency(Number(value));
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : <span className="text-[var(--color-text-faint)]">None</span>;
  if (typeof value === 'object') return <code className="text-xs break-all">{JSON.stringify(value)}</code>;
  const str = String(value);
  // Date-only columns serialize as midnight UTC; show the calendar date without a timezone shift
  const dateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})(T00:00:00(\.0+)?Z)?$/);
  if (dateOnly) return new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]).toLocaleDateString();
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return new Date(str).toLocaleString();
  if (key === 'status' || key.endsWith('_status')) return str.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  if (/^https?:\/\//.test(str)) return <a href={str} target="_blank" rel="noreferrer" className="text-[var(--color-teal)] underline break-all">Open</a>;
  return <span className="break-all">{str}</span>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <p className="border-b border-[var(--color-cream-dark)] px-5 py-3 text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{title}</p>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Fields({ data, fields, single }: { data: Row; fields: [string, string][]; single?: boolean }) {
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-3 ${single ? '' : 'sm:grid-cols-2'}`}>
      {fields.map(([key, label]) => (
        <div key={key} className="min-w-0">
          <dt className="text-xs text-[var(--color-text-faint)]">{label}</dt>
          <dd className="mt-0.5 text-sm text-[var(--color-text)]">{display(key, data[key])}</dd>
        </div>
      ))}
    </dl>
  );
}

function Table({ rows, columns, empty }: { rows: Row[]; columns: [string, string][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-[var(--color-text-muted)]">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-cream-dark)]">
            {columns.map(([, label]) => (
              <th key={label} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-text-faint)]">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id ?? i)} className="border-b border-[var(--color-cream-dark)] last:border-b-0">
              {columns.map(([key]) => (
                <td key={key} className="px-3 py-2 align-top text-[var(--color-text)]">{display(key, r[key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-shipment', id],
    queryFn: () => api.get(`/api/v1/admin/shipments/${id}`).then((r) => r.data.data as ShipmentDetail),
  });

  const back = (
    <Link href="/admin/shipments" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
      <ArrowLeft size={14} /> All shipments
    </Link>
  );

  if (isLoading) return <div className="space-y-4">{back}<div className="skeleton h-96 rounded-xl" /></div>;
  if (isError || !data) return <div className="space-y-4">{back}<EmptyState icon={Package} title="Shipment not found" /></div>;

  const s = data.shipment;
  const route = `${s.pickup_city ?? '—'}, ${s.pickup_state ?? ''} → ${s.delivery_city ?? '—'}, ${s.delivery_state ?? ''}`;

  return (
    <div className="space-y-5">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Shipment #{String(s.id)}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{String(s.item_description ?? '')} · {route}</p>
        </div>
        <StatusPill status={s.status as ShipmentStatus} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {SECTIONS.map((sec) => (
          <Card key={sec.title} title={sec.title}>
            <Fields data={s} fields={sec.fields} />
          </Card>
        ))}

        <Card title="Service & organization">
          <Fields
            data={{
              service: data.service_type?.name, service_category: data.service_type?.category,
              org: data.organization?.name, org_type: data.organization?.type,
              stripe_mode: data.organization?.stripe_mode, commission_rate: data.organization?.commission_rate,
            }}
            fields={[
              ['service', 'Service type'], ['service_category', 'Service category'],
              ['org', 'Organization'], ['org_type', 'Org type'],
              ['stripe_mode', 'Stripe mode'], ['commission_rate', 'Commission rate'],
            ]}
          />
        </Card>

        <Card title="Contract">
          {data.contract ? (
            <Fields
              data={data.contract}
              fields={[
                ['title', 'Title'], ['status', 'Status'], ['rate_type', 'Rate type'], ['rate', 'Rate'],
                ['fuel_surcharge', 'Fuel surcharge'], ['detention_rate', 'Detention rate'],
                ['payment_terms', 'Payment terms'], ['equipment_type', 'Equipment'],
                ['valid_from', 'Valid from'], ['valid_to', 'Valid to'],
              ]}
            />
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">Not under a contract.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {([['Shipper', data.shipper], ['Carrier', data.carrier], ['Receiver', data.receiver]] as const).map(([title, party]) => (
          <Card key={title} title={title}>
            {party ? <Fields single data={party} fields={PARTY_FIELDS.filter(([k]) => party[k] !== undefined)} /> : (
              <p className="text-sm text-[var(--color-text-muted)]">None assigned.</p>
            )}
          </Card>
        ))}
      </div>

      <Card title={`Bids (${data.bids.length})`}>
        <Table
          rows={data.bids}
          empty="No bids."
          columns={[
            ['carrier', 'Carrier'], ['amount', 'Amount'], ['status', 'Status'],
            ['estimated_pickup_date', 'Est. pickup'], ['estimated_delivery_date', 'Est. delivery'],
            ['note', 'Note'], ['created_at', 'Placed'],
          ]}
        />
      </Card>

      <Card title={`Transactions (${data.transactions.length})`}>
        <Table
          rows={data.transactions}
          empty="No transactions recorded."
          columns={[
            ['invoice_no', 'Invoice'], ['description', 'Description'], ['category', 'Category'],
            ['amount', 'Amount'], ['status', 'Status'], ['due_date', 'Due'], ['paid_at', 'Paid'],
          ]}
        />
      </Card>

      <Card title={`GPS pings (${data.gps.count}${data.gps.count > 50 ? ', latest 50 shown' : ''})`}>
        <Table
          rows={data.gps.pings}
          empty="No GPS pings."
          columns={[['pinged_at', 'Time'], ['lat', 'Latitude'], ['lng', 'Longitude'], ['speed', 'Speed'], ['eta', 'ETA']]}
        />
      </Card>

      <Card title="All fields">
        <button onClick={() => setShowAll((v) => !v)} className="text-sm font-medium text-[var(--color-teal)]">
          {showAll ? 'Hide' : `Show all ${Object.keys(s).length} shipment fields`}
        </button>
        {showAll && (
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {Object.entries(s).map(([key, value]) => (
              <div key={key} className="min-w-0 border-b border-[var(--color-cream-dark)] pb-2">
                <dt className="font-mono text-xs text-[var(--color-text-faint)]">{key}</dt>
                <dd className="mt-0.5 text-sm text-[var(--color-text)]">{key === 'route_polyline' && value ? `${String(value).length} chars` : display(key, value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </div>
  );
}
