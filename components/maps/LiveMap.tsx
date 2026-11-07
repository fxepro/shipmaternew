'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { getEcho } from '@/lib/echo';
import type { GpsCoordinates, GpsPingEvent } from '@/types/gps';
import { formatEta } from '@/lib/utils';

interface LiveMapProps {
  shipmentId: number;
  initialCoordinates: GpsCoordinates;
  pickupCoordinates: GpsCoordinates;
  deliveryCoordinates: GpsCoordinates;
  deliveryAddress: string;
  routePolyline?: number[][];   // [[lng, lat], ...] from OSRM — real road route
  eta?: string;
  className?: string;
  /**
   * When provided, subscribe to the PUBLIC channel `tracking.{trackingToken}`
   * (no auth needed — used by the public /track/[token] page).
   * When omitted, subscribe to the PRIVATE channel `load.{shipmentId}` (the freight job id)
   * (requires Sanctum auth — used by authenticated dashboards).
   */
  trackingToken?: string;
}

export function LiveMap({
  shipmentId,
  initialCoordinates,
  pickupCoordinates,
  deliveryCoordinates,
  routePolyline,
  eta,
  className = 'h-[400px] w-full rounded-xl overflow-hidden',
  trackingToken,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markerRef    = useRef<any>(null);
  const channelRef   = useRef<any>(null);

  const moveMarker = useCallback((lat: number, lng: number) => {
    markerRef.current?.setLngLat([lng, lat]);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let destroyed = false;

    (async () => {
      const ml = await import('maplibre-gl');
      await import('maplibre-gl/dist/maplibre-gl.css' as any);
      if (destroyed) return;

      const map = new ml.Map({
        container: containerRef.current!,
        style: process.env.NEXT_PUBLIC_MAPTILER_KEY &&
               process.env.NEXT_PUBLIC_MAPTILER_KEY !== 'your-maptiler-key'
          ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`
          : 'https://tiles.openfreemap.org/styles/liberty',
        center: [initialCoordinates.lng, initialCoordinates.lat],
        zoom: 8,
      });
      mapRef.current = map;

      map.on('load', () => {
        if (destroyed) return;

        // Route line — real road polyline if available, fallback to straight line
        const routeCoords: number[][] = routePolyline && routePolyline.length > 0
          ? routePolyline
          : [
              [pickupCoordinates.lng,   pickupCoordinates.lat],
              [initialCoordinates.lng,  initialCoordinates.lat],
              [deliveryCoordinates.lng, deliveryCoordinates.lat],
            ];

        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: routeCoords },
          },
        });
        map.addLayer({
          id: 'route', type: 'line', source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2A8C8A', 'line-width': 3, 'line-dasharray': [2, 2] },
        });

        // Fit bounds to full route
        const lngs = routeCoords.map(c => c[0]);
        const lats  = routeCoords.map(c => c[1]);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, maxZoom: 12, animate: false }
        );

        // ── Pickup pin (teal ring) ──────────────────────────────────────
        const pickupEl = document.createElement('div');
        pickupEl.style.cssText = `
          width:14px;height:14px;border-radius:50%;
          background:#2A8C8A;border:2.5px solid #fff;
          box-shadow:0 1px 4px rgba(0,0,0,0.3);
        `;
        new ml.Marker({ element: pickupEl })
          .setLngLat([pickupCoordinates.lng, pickupCoordinates.lat])
          .addTo(map);

        // ── Delivery pin (dark square-ish) ──────────────────────────────
        const deliveryEl = document.createElement('div');
        deliveryEl.style.cssText = `
          width:14px;height:14px;border-radius:3px;
          background:#0F1923;border:2.5px solid #fff;
          box-shadow:0 1px 4px rgba(0,0,0,0.3);
        `;
        new ml.Marker({ element: deliveryEl })
          .setLngLat([deliveryCoordinates.lng, deliveryCoordinates.lat])
          .addTo(map);

        // ── Live GPS marker (pulsing teal dot) ──────────────────────────
        const gpsEl = document.createElement('div');
        gpsEl.style.cssText = `
          width:18px;height:18px;border-radius:50%;
          background:#2A8C8A;border:3px solid #fff;
          box-shadow:0 0 0 5px rgba(42,140,138,0.25),0 1px 4px rgba(0,0,0,0.3);
          animation:pulse-gps 2s ease-in-out infinite;
        `;
        // Inject keyframe once
        if (!document.getElementById('gps-pulse-style')) {
          const style = document.createElement('style');
          style.id = 'gps-pulse-style';
          style.textContent = `
            @keyframes pulse-gps {
              0%,100% { box-shadow:0 0 0 5px rgba(42,140,138,0.25),0 1px 4px rgba(0,0,0,0.3); }
              50%      { box-shadow:0 0 0 10px rgba(42,140,138,0.1),0 1px 4px rgba(0,0,0,0.3); }
            }
          `;
          document.head.appendChild(style);
        }
        markerRef.current = new ml.Marker({ element: gpsEl })
          .setLngLat([initialCoordinates.lng, initialCoordinates.lat])
          .addTo(map);
      });

      // ── Subscribe to WebSocket channel ──────────────────────────────────
      try {
        const echoInstance = await getEcho();
        if (destroyed) return;

        // Use public channel for the public tracking page (no auth needed),
        // private channel for authenticated dashboards.
        const channel = trackingToken
          ? echoInstance.channel(`tracking.${trackingToken}`)
          : echoInstance.private(`load.${shipmentId}`);

        channelRef.current = channel;

        // broadcastAs() = 'GpsPingReceived' → listen with leading dot to bypass namespace
        channel.listen('.GpsPingReceived', (e: GpsPingEvent) => {
          moveMarker(e.lat, e.lng);
          if (e.state_crossed) {
            toast(`Carrier entered ${e.state_crossed}${e.eta ? ` · ETA ${formatEta(e.eta)}` : ''}`, {
              duration: 5000,
            });
          }
        });
      } catch (err) {
        console.warn('LiveMap: WebSocket connection failed', err);
      }
    })();

    return () => {
      destroyed = true;
      channelRef.current?.stopListening('.GpsPingReceived');
      mapRef.current?.remove();
      mapRef.current  = null;
      markerRef.current = null;
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId, trackingToken]);

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="h-full w-full" />

      {/* ETA badge */}
      {eta && (
        <div className="absolute right-3 top-3 rounded-lg bg-[var(--color-slate)] px-3 py-1.5 text-xs font-medium text-white shadow">
          ETA {formatEta(eta)}
        </div>
      )}

      {/* Live indicator dot */}
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-[var(--color-slate)]/80 px-2.5 py-1.5 text-xs font-medium text-white shadow">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-teal)] animate-pulse" />
        Live
      </div>
    </div>
  );
}
