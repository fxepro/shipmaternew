'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Navigation, Truck, User } from 'lucide-react';
import { freightJobApi } from '@/lib/api';

// ── Types (freight job shape from API) ────────────────────────────────────────

type JobStop = {
  id: number;
  sequence: number;
  stop_type: 'pickup' | 'dropoff' | 'delivery';
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  status?: string;
};

type FreightJob = {
  id: number;
  title?: string | null;
  reference_number?: string | null;
  status: string;
  contract_id?: number | null;
  carrier?: {
    name?: string;
    carrier_profile?: { company_name?: string } | null;
    carrierProfile?: { company_name?: string } | null;
  } | null;
  contract?: {
    carrier?: {
      name?: string;
      carrier_profile?: { company_name?: string } | null;
      carrierProfile?: { company_name?: string } | null;
    } | null;
  } | null;
  stops?: JobStop[];
};

type GpsPing = { lat: number; lng: number; speed?: number | null; eta?: string | null; pinged_at?: string } | null;

const TRACKABLE = new Set(['posted', 'in_progress']);

const STATUS_LABEL: Record<string, string> = {
  posted:      'Dispatched',
  in_progress: 'In Progress',
};

function sortedStops(job: FreightJob): JobStop[] {
  return [...(job.stops ?? [])].sort((a, b) => {
    const ao = (a as any).optimized_sequence ?? a.sequence ?? 0;
    const bo = (b as any).optimized_sequence ?? b.sequence ?? 0;
    return ao - bo;
  });
}

function stopCity(s: JobStop): string {
  return s.city || s.name || s.address || 'Stop';
}

function routeLabel(job: FreightJob): string {
  const stops = sortedStops(job);
  if (stops.length === 0) return 'No route yet';
  if (stops.length === 1) return stopCity(stops[0]);
  return `${stopCity(stops[0])} → ${stopCity(stops[stops.length - 1])}`;
}

function jobTitle(job: FreightJob): string {
  return job.title?.trim() || job.reference_number?.trim() || `Job #${job.id}`;
}

function isPickup(stop: JobStop): boolean {
  return stop.stop_type === 'pickup';
}

function carrierName(job: FreightJob): string | null {
  const c = job.carrier ?? job.contract?.carrier;
  if (!c) return null;
  return c.carrier_profile?.company_name
    ?? c.carrierProfile?.company_name
    ?? c.name
    ?? null;
}

function stopsWithCoords(stops: JobStop[]): { lat: number; lng: number; stop: JobStop; index: number }[] {
  return stops
    .map((stop, index) => ({ stop, index, lat: stop.lat, lng: stop.lng }))
    .filter((s): s is { lat: number; lng: number; stop: JobStop; index: number } =>
      s.lat != null && s.lng != null && Number.isFinite(s.lat) && Number.isFinite(s.lng),
    );
}

/** Fetch road geometry for N waypoints from OSRM */
async function fetchOsrmMulti(
  points: { lat: number; lng: number }[],
): Promise<[number, number][] | null> {
  if (points.length < 2) return null;
  try {
    const path = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const url =
      `https://router.project-osrm.org/route/v1/driving/${path}` +
      `?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const json = await res.json();
    const coords = json?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    return coords && coords.length > 1 ? coords : null;
  } catch {
    return null;
  }
}

function fitStops(map: any, points: { lat: number; lng: number }[], ping: GpsPing) {
  const pts: [number, number][] = points.map((p) => [p.lng, p.lat]);
  if (ping) pts.push([ping.lng, ping.lat]);
  if (pts.length === 0) return;
  if (pts.length === 1) {
    map.flyTo({ center: pts[0], zoom: 10, duration: 600 });
    return;
  }
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  map.fitBounds(
    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
    { padding: 110, maxZoom: 12, duration: 800 },
  );
}

// ── LiveMap (freight job routes) ──────────────────────────────────────────────

function LiveMap({ job, ping = null }: { job: FreightJob; ping?: GpsPing }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mlRef = useRef<any>(null);
  const truckRef = useRef<any>(null);
  const [routeState, setRouteState] = useState<'loading' | 'ready' | 'fallback' | 'none'>('loading');

  const stops = sortedStops(job);
  const coords = stopsWithCoords(stops);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const styleId = 'shipmater-live-map-css';
    if (!document.getElementById(styleId)) {
      const s = document.createElement('style');
      s.id = styleId;
      s.textContent = `
        @keyframes sm_ring  { 0%{transform:scale(.8);opacity:.8} 100%{transform:scale(2.4);opacity:0} }
        @keyframes sm_pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        .sm-truck-wrap { position:relative;width:44px;height:44px; }
        .sm-truck-ring { position:absolute;inset:0;border-radius:50%;
                         background:rgba(42,140,138,.3);
                         animation:sm_ring 2s ease-out infinite; }
        .sm-truck-body { position:absolute;inset:5px;border-radius:50%;
                         background:#2A8C8A;border:2.5px solid #fff;
                         display:flex;align-items:center;justify-content:center;
                         font-size:15px;
                         animation:sm_pulse 2s ease-in-out infinite;
                         box-shadow:0 3px 10px rgba(42,140,138,.55); }
      `;
      document.head.appendChild(s);
    }

    const defaultCenter: [number, number] = ping
      ? [ping.lng, ping.lat]
      : coords[0]
        ? [coords[0].lng, coords[0].lat]
        : [-98.5795, 39.8283];

    import('maplibre-gl').then(async (ml) => {
      await import('maplibre-gl/dist/maplibre-gl.css' as any);
      if (!containerRef.current) return;

      const map = new ml.Map({
        container: containerRef.current,
        style:
          process.env.NEXT_PUBLIC_MAPTILER_KEY &&
          process.env.NEXT_PUBLIC_MAPTILER_KEY !== 'your-maptiler-key'
            ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`
            : 'https://tiles.openfreemap.org/styles/liberty',
        center: defaultCenter,
        zoom: coords.length ? 7 : 4,
      });

      mapRef.current = map;
      mlRef.current = ml;

      map.on('load', async () => {
        const straight: [number, number][] = coords.map((c) => [c.lng, c.lat]);

        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: straight.length >= 2 ? straight : [] },
          },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#2A8C8A', 'line-width': 4, 'line-opacity': 0.85 },
        });

        const mkEl = (label: string, bg: string) => {
          const el = document.createElement('div');
          el.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none">
              <div style="background:${bg};color:#fff;padding:2px 8px;border-radius:5px;
                          font-size:11px;font-weight:700;white-space:nowrap;
                          font-family:system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.2)">${label}</div>
              <div style="width:11px;height:11px;border-radius:50%;background:${bg};
                          border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>
            </div>`;
          return el;
        };

        for (const { stop, lat, lng, index } of coords) {
          const pickup = isPickup(stop);
          const letter = String.fromCharCode(65 + index);
          const label = pickup ? `Pickup ${letter}` : `Delivery ${letter}`;
          const bg = pickup ? '#1B6B69' : '#0F1923';
          new ml.Marker({ element: mkEl(label, bg), anchor: 'bottom' })
            .setLngLat([lng, lat])
            .addTo(map);
        }

        if (ping) {
          const truckEl = document.createElement('div');
          truckEl.className = 'sm-truck-wrap';
          truckEl.innerHTML = `<div class="sm-truck-ring"></div><div class="sm-truck-body">🚚</div>`;
          truckRef.current = new ml.Marker({ element: truckEl, anchor: 'center' })
            .setLngLat([ping.lng, ping.lat])
            .addTo(map);
        }

        fitStops(map, coords, ping);

        if (coords.length >= 2) {
          setRouteState('loading');
          const road = await fetchOsrmMulti(coords);
          if (road && mapRef.current) {
            (map.getSource('route') as any)?.setData({
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: road },
            });
            setRouteState('ready');
          } else {
            setRouteState('fallback');
          }
        } else {
          setRouteState(coords.length ? 'none' : 'none');
        }
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      truckRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  // Move truck when GPS arrives (mobile integration)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ping || !map.isStyleLoaded()) return;
    if (truckRef.current) {
      truckRef.current.setLngLat([ping.lng, ping.lat]);
    } else if (mlRef.current) {
      const el = document.createElement('div');
      el.className = 'sm-truck-wrap';
      el.innerHTML = `<div class="sm-truck-ring"></div><div class="sm-truck-body">🚚</div>`;
      truckRef.current = new mlRef.current.Marker({ element: el, anchor: 'center' })
        .setLngLat([ping.lng, ping.lat])
        .addTo(map);
    }
  }, [ping?.lat, ping?.lng]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur-sm px-3 py-2 shadow-md pointer-events-none">
        <span className="text-sm font-semibold text-[var(--color-text)]">{jobTitle(job)}</span>
        <span className="rounded-full bg-[var(--color-teal-pale)] px-2 py-0.5 text-xs font-mono text-[var(--color-teal)]">
          {STATUS_LABEL[job.status] ?? job.status}
        </span>
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-none">
        {routeState === 'loading' && coords.length >= 2 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-white/85 backdrop-blur-sm px-2.5 py-1.5 shadow-sm">
            <div className="h-3 w-3 rounded-full border-2 border-[var(--color-teal)] border-t-transparent animate-spin" />
            <span className="text-xs text-[var(--color-text-faint)]">Loading route…</span>
          </div>
        )}
      </div>

      {!ping && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-md pointer-events-none">
          <div className="flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 shadow-lg border border-[var(--color-cream-dark)]">
            <Navigation size={16} className="shrink-0 text-[var(--color-text-faint)]" />
            <p className="text-xs text-[var(--color-text-muted)]">
              Live truck position appears when the carrier app sends GPS
            </p>
          </div>
        </div>
      )}

      {coords.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 pointer-events-none">
          <div className="rounded-2xl bg-white/95 px-8 py-6 text-center shadow-xl">
            <MapPin size={28} className="mx-auto mb-2 text-[var(--color-text-faint)]" />
            <p className="text-sm font-semibold text-[var(--color-text)]">No stop coordinates</p>
            <p className="mt-1 text-xs text-[var(--color-text-faint)]">This job’s stops need lat/lng to draw the route</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LiveTrackingPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: listRes, isLoading: listLoading } = useQuery({
    queryKey: ['shipper-freight-jobs-tracking'],
    queryFn: () => freightJobApi.shipperList({ type: 'contracted' }),
    refetchInterval: 30_000,
  });

  const allJobs: FreightJob[] = listRes?.data?.data ?? [];
  const active = allJobs.filter((j) => TRACKABLE.has(j.status));

  useEffect(() => {
    if (active.length > 0 && selectedId === null) setSelectedId(active[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length]);

  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['live-freight-job', selectedId],
    queryFn: () => freightJobApi.get(selectedId!),
    enabled: selectedId !== null,
    refetchInterval: 30_000,
  });

  const liveJob: FreightJob | undefined = detailRes?.data?.data ?? active.find((j) => j.id === selectedId);
  // GPS from mobile/carrier app — not wired yet
  const ping = null as GpsPing;

  return (
    <div className="-m-6 flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ════ LEFT PANEL ═══════════════════════════════════════════════ */}
      <div className="w-[380px] shrink-0 flex flex-col bg-[var(--color-cream)] border-r border-[var(--color-cream-dark)] overflow-hidden">

        <div className="shrink-0 border-b border-[var(--color-cream-dark)] bg-[var(--color-white)] px-5 py-4">
          <div className="flex items-center justify-between">
            <h1 className="page-title">Live Tracking</h1>
            {active.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-[var(--color-teal-pale)] px-2.5 py-1 text-xs font-bold text-[var(--color-teal)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-teal)] animate-pulse" />
                {active.length} active
              </div>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">
            Contracted jobs · GPS from carrier mobile
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 px-3 py-3">
          {listLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-[78px] rounded-xl bg-[var(--color-cream-dark)] animate-pulse" />
            ))
          ) : active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-teal-pale)]">
                <Truck size={22} className="text-[var(--color-teal)]" />
              </div>
              <p className="font-semibold text-[var(--color-text)]">No active jobs</p>
              <p className="mt-1 text-sm text-[var(--color-text-faint)] max-w-[220px]">
                Posted and in-progress jobs appear here with their routes
              </p>
            </div>
          ) : (
            active.map((j) => {
              const isSelected = j.id === selectedId;
              const carrier = carrierName(j);
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setSelectedId(j.id)}
                  className={`w-full text-left rounded-xl border transition-all ${
                    isSelected
                      ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)] shadow-sm'
                      : 'border-[var(--color-cream-dark)] bg-[var(--color-white)] hover:border-[var(--color-teal)]'
                  }`}
                >
                  <div className={`flex items-start gap-3 p-3.5 ${isSelected ? 'border-l-[3px] border-l-[var(--color-teal)] rounded-l-xl' : ''}`}>
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-teal-pale)] text-lg">
                      🚚
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text)] truncate">{jobTitle(j)}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-faint)] truncate">
                        {routeLabel(j)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-[var(--color-teal-pale)] border border-[var(--color-teal-light)] px-2 py-0.5 text-xs font-semibold text-[var(--color-teal)]">
                          {STATUS_LABEL[j.status] ?? j.status}
                        </span>
                        {j.contract_id && (
                          <span className="text-xs text-[var(--color-text-muted)]">Contract freight</span>
                        )}
                        {carrier && (
                          <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[120px]">{carrier}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {liveJob && (
          <div className="shrink-0 border-t border-[var(--color-cream-dark)] bg-[var(--color-white)] px-4 py-4 space-y-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin size={12} className="text-[var(--color-teal)]" />
                <span className="text-xs font-bold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">Route</span>
              </div>
              <div className="space-y-0 pl-1">
                {sortedStops(liveJob).length === 0 ? (
                  <p className="text-xs text-[var(--color-text-faint)]">No stops on this job</p>
                ) : (
                  sortedStops(liveJob).map((stop, i, arr) => (
                    <div key={stop.id}>
                      <div className="flex items-start gap-2">
                        <div
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                            isPickup(stop) ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-slate)]'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-faint)]">
                            {isPickup(stop) ? 'Pickup' : 'Delivery'} {String.fromCharCode(65 + i)}
                          </p>
                          <p className="text-xs text-[var(--color-text)] leading-relaxed">
                            {[stop.address, stop.city, stop.state, stop.zip].filter(Boolean).join(', ')
                              || stop.name
                              || '—'}
                          </p>
                        </div>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="ml-[3px] h-3 w-px bg-[var(--color-cream-dark)] my-0.5" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {ping ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-[var(--color-cream)] px-2 py-2.5 text-center">
                  <p className="text-xs text-[var(--color-text-faint)]">Speed</p>
                  <p className="mt-0.5 text-sm font-bold text-[var(--color-text)]">
                    {ping.speed != null ? `${ping.speed} mph` : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--color-cream)] px-2 py-2.5 text-center">
                  <p className="text-xs text-[var(--color-text-faint)]">ETA</p>
                  <p className="mt-0.5 text-sm font-bold text-[var(--color-text)]">{ping.eta ?? '—'}</p>
                </div>
                <div className="rounded-lg bg-[var(--color-cream)] px-2 py-2.5 text-center">
                  <p className="text-xs text-[var(--color-text-faint)]">Updated</p>
                  <p className="mt-0.5 text-sm font-bold text-[var(--color-text)]">
                    {ping.pinged_at
                      ? new Date(ping.pinged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-[var(--color-cream)] px-3 py-2.5 text-center">
                <p className="text-xs text-[var(--color-text-faint)]">
                  GPS from carrier mobile — not connected yet
                </p>
              </div>
            )}

            {carrierName(liveJob) && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-cream-dark)]">
                  <User size={14} className="text-[var(--color-text-muted)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-text)] truncate">{carrierName(liveJob)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════ MAP PANEL ════════════════════════════════════════════════ */}
      <div className="relative flex-1 bg-[var(--color-cream-dark)]">
        {selectedId && liveJob ? (
          <LiveMap key={selectedId} job={liveJob} ping={ping} />
        ) : !listLoading && active.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 text-6xl">🗺️</div>
            <p className="text-lg font-semibold text-[var(--color-text-muted)]">No active jobs to track</p>
            <p className="mt-1.5 text-sm text-[var(--color-text-faint)] max-w-sm">
              Dispatch a contracted job and its route will show here
            </p>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 rounded-full border-[3px] border-[var(--color-teal)] border-t-transparent animate-spin" />
              <p className="text-sm text-[var(--color-text-faint)]">
                {detailLoading ? 'Loading job…' : 'Loading map…'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
