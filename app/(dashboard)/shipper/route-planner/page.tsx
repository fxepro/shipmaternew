'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { usePortal } from '@/lib/portal';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, X, Navigation2, Clock, Ruler, ChevronDown,
  ChevronUp, Loader2, MapPin, GripVertical, RotateCcw, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { optimizeRoute, reorderBySequence } from '@/lib/route-optimize';
import {
  LocationSearch,
  formatLocationLine,
  type LocationOption,
} from '@/components/shipper/LocationSearch';
import { savePlannerHandoff, type PlannerStopRole } from '@/lib/route-planner-handoff';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stop {
  id: string;
  address: string;
  role: PlannerStopRole;
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
  zip?: string;
  resolved?: string;
  locationId?: number;
  locationName?: string;
  error?: boolean;
}

interface RouteLeg {
  fromLabel: string;
  toLabel: string;
  distance: number;
  duration: number;
}

interface RouteResult {
  legs: RouteLeg[];
  totalDistance: number;
  totalDuration: number;
  geometry: [number, number][];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDistance(m: number) {
  const mi = m * 0.000621371;
  return mi >= 1 ? `${mi.toFixed(1)} mi` : `${Math.round(m)} m`;
}

function fmtDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function markerLetter(index: number) {
  return String.fromCharCode(65 + index);
}

const US_STATES: Record<string, string> = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california',
  co: 'colorado', ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia',
  hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa',
  ks: 'kansas', ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland',
  ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi',
  mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'new hampshire',
  nj: 'new jersey', nm: 'new mexico', ny: 'new york', nc: 'north carolina',
  nd: 'north dakota', oh: 'ohio', ok: 'oklahoma', or: 'oregon', pa: 'pennsylvania',
  ri: 'rhode island', sc: 'south carolina', sd: 'south dakota', tn: 'tennessee',
  tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia', wa: 'washington',
  wv: 'west virginia', wi: 'wisconsin', wy: 'wyoming', dc: 'district of columbia',
};

/** Pull trailing US state from "city, CO" / "street, town, Colorado". */
function parseUsState(address: string): { abbr: string; name: string } | null {
  const cleaned = address.trim().replace(/\s*,?\s*(usa|u\.s\.a\.|united states)\s*$/i, '');
  const m = cleaned.match(/,\s*([A-Za-z]{2})\s*$/);
  if (m) {
    const abbr = m[1].toLowerCase();
    if (US_STATES[abbr]) return { abbr, name: US_STATES[abbr] };
  }
  const lower = cleaned.toLowerCase();
  for (const [abbr, name] of Object.entries(US_STATES)) {
    if (lower.endsWith(`, ${name}`) || lower.endsWith(` ${name}`)) {
      return { abbr, name };
    }
  }
  return null;
}

function resultInState(
  r: { display_name: string; address?: Record<string, string> },
  state: { abbr: string; name: string },
): boolean {
  const a = r.address;
  if (a) {
    const code = (a['ISO3166-2-lvl4'] || '').toLowerCase(); // e.g. us-co
    if (code === `us-${state.abbr}`) return true;
    const st = (a.state || a.state_code || '').toLowerCase();
    if (st === state.name || st === state.abbr) return true;
  }
  const d = r.display_name.toLowerCase();
  return d.includes(`, ${state.name},`) || d.includes(`, ${state.abbr.toUpperCase()},`)
    || d.endsWith(`, ${state.name}, united states`)
    || d.includes(`${state.name}, united states`);
}

const STATE_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATES).map(([abbr, name]) => [name, abbr.toUpperCase()]),
);

function stateAbbr(raw?: string): string {
  if (!raw) return '';
  const t = raw.trim();
  if (t.length === 2) return t.toUpperCase();
  return STATE_NAME_TO_ABBR[t.toLowerCase()] ?? t.slice(0, 10).toUpperCase();
}

function partsFromNominatim(addr?: Record<string, string>): {
  city: string; state: string; zip: string; street: string;
} {
  if (!addr) return { city: '', state: '', zip: '', street: '' };
  const city =
    addr.city || addr.town || addr.village || addr.hamlet ||
    addr.municipality || addr.suburb || addr.county || '';
  const state = stateAbbr(addr.state_code || addr.state);
  const zip = (addr.postcode || '').split(';')[0].trim();
  const street = [addr.house_number, addr.road].filter(Boolean).join(' ');
  return { city, state, zip, street };
}

/** Fallback when Nominatim omits structured fields: "Pueblo, CO" / "Street, City, ST 80107" */
function partsFromFreeText(address: string, hintState?: { abbr: string } | null): {
  city: string; state: string; zip: string;
} {
  const cleaned = address.trim().replace(/\s*,?\s*(usa|u\.s\.a\.|united states)\s*$/i, '');
  const zipM = cleaned.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  const zip = zipM?.[1] ?? '';
  const withoutZip = zipM ? cleaned.slice(0, zipM.index).replace(/[,\s]+$/, '') : cleaned;
  const stateM = withoutZip.match(/,\s*([A-Za-z]{2})$/);
  let state = stateM ? stateM[1].toUpperCase() : (hintState?.abbr.toUpperCase() ?? '');
  let rest = stateM ? withoutZip.slice(0, stateM.index).trim() : withoutZip;
  const bits = rest.split(',').map(s => s.trim()).filter(Boolean);
  const city = bits.length >= 2 ? bits[bits.length - 1] : (bits[0] ?? rest);
  if (!state && hintState) state = hintState.abbr.toUpperCase();
  return { city, state, zip };
}

async function geocode(address: string): Promise<{
  lat: number; lng: number; display: string;
  city: string; state: string; zip: string; street: string;
} | null> {
  try {
    const state = parseUsState(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=8&addressdetails=1&countrycodes=us`,
      { headers: { 'User-Agent': 'Shipmater/1.0 route-planner' } },
    );
    const data: Array<{
      lat: string;
      lon: string;
      display_name: string;
      type?: string;
      class?: string;
      addresstype?: string;
      importance?: number;
      name?: string;
      address?: Record<string, string>;
    }> = await res.json();
    if (!data.length) return null;

    const SETTLEMENT = new Set([
      'city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood',
      'neighborhood', 'locality', 'residential', 'house', 'building',
      'road', 'street',
    ]);
    const AVOID = new Set(['county', 'state', 'country', 'region']);

    const scored = data.map((r, i) => {
      const kind = (r.addresstype || r.type || '').toLowerCase();
      let score = (r.importance ?? 0) * 10 - i;
      if (SETTLEMENT.has(kind)) score += 100;
      if (AVOID.has(kind)) score -= 50;
      const name = (r.name || '').toLowerCase();
      if (name.endsWith(' county') || kind === 'county') score -= 40;
      if (state) {
        if (resultInState(r, state)) score += 500;
        else score -= 300;
      }
      return { r, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].r;
    const fromNom = partsFromNominatim(best.address);
    const fromText = partsFromFreeText(address, state);

    return {
      lat: parseFloat(best.lat),
      lng: parseFloat(best.lon),
      display: best.display_name,
      city: fromNom.city || fromText.city || best.name || 'Unknown',
      state: fromNom.state || fromText.state || 'NA',
      zip: fromNom.zip || fromText.zip || '00000',
      street: fromNom.street || '',
    };
  } catch {
    return null;
  }
}

async function fetchRoute(
  waypoints: { lat: number; lng: number; label: string }[],
): Promise<RouteResult> {
  const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Routing service unavailable');
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(`No route found (${data.code})`);

  const r = data.routes[0];
  return {
    totalDistance: r.distance,
    totalDuration: r.duration,
    geometry: r.geometry.coordinates as [number, number][],
    legs: r.legs.map((leg: any, i: number) => ({
      fromLabel: waypoints[i].label,
      toLabel: waypoints[i + 1].label,
      distance: leg.distance,
      duration: leg.duration,
    })),
  };
}

// ─── Map component ────────────────────────────────────────────────────────────

function RoutePlannerMap({
  stops,
  result,
}: {
  stops: Stop[];
  result: RouteResult | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const mapReadyRef = useRef(false);

  const latestStopsRef = useRef(stops);
  const latestResultRef = useRef(result);
  latestStopsRef.current = stops;
  latestResultRef.current = result;

  const applyUpdate = useCallback((ml: any) => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const geocodedStops = latestStopsRef.current.filter(s => s.lat !== undefined && s.lng !== undefined);
    const currentResult = latestResultRef.current;

    geocodedStops.forEach((stop, i) => {
      const letter = markerLetter(i);
      const isPickup = stop.role === 'pickup';
      const el = document.createElement('div');
      el.style.cssText = `
        width:32px;height:32px;border-radius:50%;
        background:${isPickup ? '#0F1923' : '#2A8C8A'};
        border:3px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:13px;font-weight:600;
        font-family:var(--font-body);cursor:default;
      `;
      el.textContent = letter;
      markersRef.current.push(new ml.Marker({ element: el }).setLngLat([stop.lng!, stop.lat!]).addTo(map));
    });

    const routeSource = map.getSource('route') as any;
    if (routeSource) {
      routeSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: currentResult ? currentResult.geometry : [],
        },
      });
    }

    if (geocodedStops.length >= 2) {
      const lngs = geocodedStops.map(s => s.lng!);
      const lats = geocodedStops.map(s => s.lat!);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 80, maxZoom: 12, duration: 800 },
      );
    } else if (geocodedStops.length === 1) {
      map.flyTo({ center: [geocodedStops[0].lng!, geocodedStops[0].lat!], zoom: 10 });
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('maplibre-gl').then(async (ml) => {
      await import('maplibre-gl/dist/maplibre-gl.css' as any);

      const map = new ml.Map({
        container: containerRef.current!,
        style: process.env.NEXT_PUBLIC_MAPTILER_KEY && process.env.NEXT_PUBLIC_MAPTILER_KEY !== 'your-maptiler-key'
          ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`
          : 'https://tiles.openfreemap.org/styles/liberty',
        center: [-98.5795, 39.8283],
        zoom: 3.5,
      });
      mapRef.current = map;

      map.on('load', () => {
        mapReadyRef.current = true;
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
        });
        map.addLayer({
          id: 'route-casing',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.5 },
          layout: { 'line-join': 'round', 'line-cap': 'round' },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#2A8C8A', 'line-width': 4, 'line-opacity': 0.9 },
          layout: { 'line-join': 'round', 'line-cap': 'round' },
        });
        applyUpdate(ml);
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
  }, [applyUpdate]);

  useEffect(() => {
    if (!mapReadyRef.current) return;
    import('maplibre-gl').then((ml) => applyUpdate(ml));
  }, [stops, result, applyUpdate]);

  return <div ref={containerRef} className="h-full w-full" />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

let idCounter = 0;
function uid() { return `stop-${++idCounter}`; }

export default function RoutePlannerPage() {
  const to = usePortal();
  const router = useRouter();
  const [stops, setStops] = useState<Stop[]>([
    { id: uid(), address: '', role: 'pickup' },
    { id: uid(), address: '', role: 'delivery' },
  ]);
  const [planning, setPlanning] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [expandedLeg, setExpandedLeg] = useState<number | null>(null);
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function updateAddress(id: string, value: string) {
    setStops(prev => prev.map(s =>
      s.id === id
        ? {
            ...s,
            address: value,
            lat: undefined,
            lng: undefined,
            city: undefined,
            state: undefined,
            zip: undefined,
            resolved: undefined,
            locationId: undefined,
            locationName: undefined,
            error: false,
          }
        : s
    ));
    setResult(null);
  }

  function setRole(id: string, role: PlannerStopRole) {
    setStops(prev => prev.map(s => s.id === id ? { ...s, role } : s));
  }

  function selectLocation(id: string, loc: LocationOption) {
    const line = formatLocationLine(loc);
    setStops(prev => prev.map(s =>
      s.id === id
        ? {
            ...s,
            address: line,
            lat: loc.lat ?? undefined,
            lng: loc.lng ?? undefined,
            city: loc.city || undefined,
            state: loc.state || undefined,
            zip: loc.zip || undefined,
            resolved: loc.name || line,
            locationId: loc.id,
            locationName: loc.name,
            error: false,
          }
        : s
    ));
    setResult(null);
  }

  function addStop() {
    setStops(prev => [...prev, { id: uid(), address: '', role: 'delivery' }]);
    setResult(null);
  }

  function removeStop(id: string) {
    setStops(prev => {
      const next = prev.filter(s => s.id !== id);
      return next.length >= 2 ? next : prev;
    });
    setResult(null);
  }

  function reset() {
    setStops([
      { id: uid(), address: '', role: 'pickup' },
      { id: uid(), address: '', role: 'delivery' },
    ]);
    setResult(null);
  }

  function handleDragStart(i: number) { setDragSrc(i); }
  function handleDragOver(e: React.DragEvent, i: number) { e.preventDefault(); setDragOver(i); }
  function handleDrop(i: number) {
    if (dragSrc === null || dragSrc === i) { setDragSrc(null); setDragOver(null); return; }
    const next = [...stops];
    const [item] = next.splice(dragSrc, 1);
    next.splice(i, 0, item);
    setStops(next);
    setResult(null);
    setDragSrc(null);
    setDragOver(null);
  }
  function handleDragEnd() { setDragSrc(null); setDragOver(null); }

  function useInShipment() {
    const filled = stops.filter(s => s.address.trim() && s.lat != null && s.lng != null);
    if (filled.length < 2) {
      toast.error('Plan the route first.');
      return;
    }

    const pickups = filled.filter(s => s.role === 'pickup');
    const deliveries = filled.filter(s => s.role === 'delivery');
    if (pickups.length < 1) {
      toast.error('Tag at least one stop as Pickup.');
      return;
    }
    if (deliveries.length < 1) {
      toast.error('Tag at least one stop as Delivery.');
      return;
    }

    savePlannerHandoff({
      stops: filled.map(s => ({
        address: s.address,
        label: s.resolved ?? s.address,
        lat: s.lat!,
        lng: s.lng!,
        city: s.city || '',
        state: s.state || '',
        zip: s.zip || '',
        name: s.locationName ?? s.resolved ?? null,
        locationId: s.locationId ?? null,
        role: s.role,
      })),
      distanceM: result ? Math.round(result.totalDistance) : undefined,
      durationS: result ? Math.round(result.totalDuration) : undefined,
    });

    router.push(to('/shipper/shipments/new?fromPlanner=1'));
  }

  async function handlePlan() {
    const filled = stops.filter(s => s.address.trim().length > 0);
    if (filled.length < 2) {
      toast.error('Enter at least an origin and one destination.');
      return;
    }

    setPlanning(true);
    setResult(null);

    const geocoded: Stop[] = [];
    let anyFailed = false;

    for (const s of stops) {
      if (!s.address.trim()) continue;
      // Trust address-book coords; always re-geocode free-text (avoids stale wrong pins)
      if (s.locationId && s.lat != null && s.lng != null) {
        geocoded.push({ ...s, error: false });
        continue;
      }
      const geo = await geocode(s.address);
      if (!geo) {
        geocoded.push({ ...s, error: true, lat: undefined, lng: undefined });
        anyFailed = true;
        toast.error(`Address not found: "${s.address}"`);
      } else {
        geocoded.push({
          ...s,
          lat: geo.lat,
          lng: geo.lng,
          city: geo.city,
          state: geo.state,
          zip: geo.zip,
          // Prefer street line when Nominatim has one; keep user text otherwise
          address: geo.street || s.address,
          resolved: s.locationName ?? geo.display,
          error: false,
        });
      }
    }

    // Keep entry fields in the order the user typed — only update coords / errors
    const byId = new Map(geocoded.map(g => [g.id, g]));
    setStops(prev => prev.map(s => byId.get(s.id) ?? s));

    if (anyFailed) {
      setPlanning(false);
      return;
    }

    // Shortest route order for the result only (e.g. A→C→B). Entry list stays A, B, C.
    const letterById = new Map(
      geocoded.map((s, i) => [s.id, markerLetter(i)]),
    );
    const optim = optimizeRoute(
      geocoded.map(s => ({
        id: s.id,
        lat: s.lat!,
        lng: s.lng!,
        type: 'pickup' as const,
        required_pickups: [],
      })),
      'shortest_route',
    );
    const ordered = reorderBySequence(geocoded, optim.sequence);

    const waypoints = ordered.map(s => ({
      lat: s.lat!,
      lng: s.lng!,
      label: letterById.get(s.id) ?? '?',
    }));

    try {
      const route = await fetchRoute(waypoints);
      setResult(route);
      const path = waypoints.map(w => w.label).join(' → ');
      toast.success(
        `${path} · ${fmtDistance(route.totalDistance)} · ${fmtDuration(route.totalDuration)}`,
      );
    } catch (e: any) {
      toast.error(e.message ?? 'Route planning failed.');
    } finally {
      setPlanning(false);
    }
  }

  const canPlan = stops.filter(s => s.address.trim()).length >= 2;

  return (
    <div className="-m-6 flex h-[calc(100vh-56px)] overflow-hidden">

      <div className="flex w-[360px] shrink-0 flex-col border-r border-[var(--color-cream-dark)] bg-[var(--color-white)] overflow-hidden">

        <div className="px-5 pt-5 pb-4 border-b border-[var(--color-cream-dark)]">
          <div className="flex items-center justify-between">
            <h1 className="page-title">
              Route Planner
            </h1>
            {result && (
              <button onClick={reset} className="flex items-center gap-1 text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors">
                <RotateCcw size={11} /> Reset
              </button>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[var(--color-text-faint)]">
            Tag Pickup / Delivery, then Plan — shortest path keeps your labels
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {stops.map((stop, i) => {
            const isLast   = i === stops.length - 1;
            const letter   = markerLetter(i);
            const isDragging  = dragSrc === i;
            const isDropTarget = dragOver === i && dragSrc !== i;
            const isPickup = stop.role === 'pickup';

            return (
              <div
                key={stop.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'rounded-lg transition-all',
                  isDragging   && 'opacity-40',
                  isDropTarget && 'ring-2 ring-[var(--color-teal)] ring-offset-1',
                )}
              >
                <div className="flex items-start gap-2 group relative">
                  {!isLast && (
                    <div className="absolute left-[23px] top-[38px] h-[calc(100%+6px)] w-[2px] bg-[var(--color-cream-dark)] z-0" />
                  )}

                  <div className="shrink-0 pt-2 cursor-grab active:cursor-grabbing text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] transition-colors">
                    <GripVertical size={14} />
                  </div>

                  <div
                    className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
                    style={{ background: isPickup ? 'var(--color-slate)' : 'var(--color-teal)' }}
                  >
                    {letter}
                  </div>

                  <div className="flex-1 relative min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setRole(stop.id, 'pickup')}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
                          isPickup
                            ? 'bg-[var(--color-slate)] text-white'
                            : 'bg-[var(--color-cream)] text-[var(--color-text-faint)] hover:text-[var(--color-text)]',
                        )}
                      >
                        Pickup
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole(stop.id, 'delivery')}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
                          !isPickup
                            ? 'bg-[var(--color-teal)] text-white'
                            : 'bg-[var(--color-cream)] text-[var(--color-text-faint)] hover:text-[var(--color-text)]',
                        )}
                      >
                        Delivery
                      </button>
                      {stops.length > 2 && (
                        <button
                          onClick={() => removeStop(stop.id)}
                          className="ml-auto shrink-0 rounded-md p-1 text-[var(--color-text-faint)] hover:bg-[var(--color-cream-dark)] hover:text-[var(--color-danger)] transition-colors"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <LocationSearch
                      mode="freeText"
                      type={stop.role}
                      value={stop.address}
                      onChange={v => updateAddress(stop.id, v)}
                      onSelect={loc => selectLocation(stop.id, loc)}
                      onKeyDown={e => e.key === 'Enter' && handlePlan()}
                      placeholder={
                        isPickup
                          ? 'Search pickup or type address…'
                          : 'Search delivery or type address…'
                      }
                      error={!!stop.error}
                      resolved={!!stop.resolved && !stop.error}
                    />
                    {stop.resolved && !stop.error && (
                      <p className="truncate px-1 text-xs text-[var(--color-teal)]">
                        ✓ {stop.locationName
                          ? stop.locationName
                          : stop.resolved.split(',').slice(0, 2).join(',')}
                      </p>
                    )}
                    {stop.error && (
                      <p className="px-1 text-xs text-[var(--color-danger)]">Address not found</p>
                    )}
                  </div>
                </div>
                {!isLast && <div className="h-2" />}
              </div>
            );
          })}

          <div className="pt-3">
            <button
              onClick={addStop}
              disabled={stops.length >= 10}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--color-cream-dark)] px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] disabled:opacity-40 transition-colors"
            >
              <Plus size={13} /> Add another stop
            </button>
          </div>

          <div className="pt-3">
            <button
              onClick={handlePlan}
              disabled={!canPlan || planning}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-teal)] py-3 text-sm font-semibold text-white hover:bg-[var(--color-teal-light)] disabled:opacity-50 transition-colors shadow-sm"
            >
              {planning ? (
                <><Loader2 size={15} className="animate-spin" /> Optimising route…</>
              ) : (
                <><Navigation2 size={15} /> PLAN SHORTEST ROUTE</>
              )}
            </button>
            <p className="mt-2 text-center text-xs text-[var(--color-text-faint)]">
              Entry order stays put · result may be A→C→B
            </p>
          </div>

          {result && (
            <div className="pt-4 space-y-3">
              <div className="h-px bg-[var(--color-cream-dark)]" />

              <div className="rounded-xl bg-[var(--color-teal-pale)] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.07em] text-[var(--color-teal)] mb-2">Optimised path</p>
                <p className="text-sm font-semibold text-[var(--color-teal)] mb-3">
                  {[result.legs[0]?.fromLabel, ...result.legs.map(l => l.toLabel)].filter(Boolean).join(' → ')}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-teal)]">
                    <Ruler size={13} />
                    {fmtDistance(result.totalDistance)}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-teal)]">
                    <Clock size={13} />
                    {fmtDuration(result.totalDuration)}
                  </div>
                  <div className="text-sm text-[var(--color-teal)] opacity-70">
                    {result.legs.length} leg{result.legs.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {result.legs.map((leg, i) => (
                  <button
                    key={i}
                    onClick={() => setExpandedLeg(expandedLeg === i ? null : i)}
                    className="w-full rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-4 py-3 text-left hover:border-[var(--color-teal-light)] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-slate)] text-xs font-bold text-white">
                          {leg.fromLabel}
                        </div>
                        <span className="text-[var(--color-text-faint)] text-xs">→</span>
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-teal)] text-xs font-bold text-white">
                          {leg.toLabel}
                        </div>
                        <span className="truncate text-sm text-[var(--color-text-muted)]">
                          {fmtDistance(leg.distance)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm text-[var(--color-text-faint)]">{fmtDuration(leg.duration)}</span>
                        {expandedLeg === i ? <ChevronUp size={12} className="text-[var(--color-text-faint)]" /> : <ChevronDown size={12} className="text-[var(--color-text-faint)]" />}
                      </div>
                    </div>
                    {expandedLeg === i && (
                      <div className="mt-3 border-t border-[var(--color-cream-dark)] pt-3 space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--color-text-faint)]">Distance</span>
                          <span className="font-medium text-[var(--color-text)]">{fmtDistance(leg.distance)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--color-text-faint)]">Drive time</span>
                          <span className="font-medium text-[var(--color-text)]">{fmtDuration(leg.duration)}</span>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={useInShipment}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-slate)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-slate-80)] transition-colors shadow-sm"
              >
                <ArrowRight size={14} /> Use this route in a shipment
              </button>
              <p className="text-center text-xs text-[var(--color-text-faint)]">
                Prefills New Shipment: pickup + deliveries — you add the manifest
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="relative flex-1">
        <RoutePlannerMap stops={stops} result={result} />

        {!result && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-8">
            <div className="flex items-center gap-2 rounded-full bg-[var(--color-slate)]/80 px-4 py-2 backdrop-blur-sm">
              <MapPin size={13} className="text-[var(--color-teal-light)]" />
              <p className="text-sm text-white/80">Enter addresses and click <span className="font-semibold text-white">PLAN SHORTEST ROUTE</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
