'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  LocateFixed,
  Play,
  Pause,
  RotateCcw,
  Bike,
  Store,
  MapPin,
} from 'lucide-react';
import type { OrderRecord } from '@/lib/db/models';

interface WaypointNode {
  lat: number;
  lng: number;
  streetLabel: string;
}

const RESTAURANT_ROUTES: Record<string, WaypointNode[]> = {
  rest_1: [
    { lat: 37.7662, lng: -122.4218, streetLabel: 'Forno Di Pietra · 420 Valencia St (Mission)' },
    { lat: 37.7681, lng: -122.4195, streetLabel: '16th St & Mission Corridor' },
    { lat: 37.7705, lng: -122.4152, streetLabel: 'Division St Bikeway' },
    { lat: 37.7728, lng: -122.4104, streetLabel: '8th St & Brannan Crossing' },
    { lat: 37.7746, lng: -122.4058, streetLabel: 'Townsend St Tech Hub' },
    { lat: 37.7759, lng: -122.4018, streetLabel: '4th St & King Approach' },
    { lat: 37.7768, lng: -122.3982, streetLabel: 'Customer Dropoff · 742 Evergreen Terrace' },
  ],
  rest_2: [
    { lat: 37.7852, lng: -122.4058, streetLabel: 'Zaffran Royal Handi · 785 Market St (SoMa)' },
    { lat: 37.7835, lng: -122.4038, streetLabel: '4th St & Mission Junction' },
    { lat: 37.7814, lng: -122.4019, streetLabel: 'Howard St & Moscone West' },
    { lat: 37.7795, lng: -122.4002, streetLabel: 'Harrison St Overpass' },
    { lat: 37.7781, lng: -122.3991, streetLabel: 'Bryant St & 4th Ave' },
    { lat: 37.7768, lng: -122.3982, streetLabel: 'Customer Dropoff · 742 Evergreen Terrace' },
  ],
  rest_3: [
    { lat: 37.8005, lng: -122.4108, streetLabel: 'Ironclad Smash Grill · 1120 Columbus Ave' },
    { lat: 37.7962, lng: -122.4068, streetLabel: 'Broadway & Montgomery St' },
    { lat: 37.7908, lng: -122.4032, streetLabel: 'Financial District · Market St' },
    { lat: 37.7855, lng: -122.4012, streetLabel: '3rd St & Mission Crossing' },
    { lat: 37.7805, lng: -122.3995, streetLabel: 'Brannan St Express Lane' },
    { lat: 37.7768, lng: -122.3982, streetLabel: 'Customer Dropoff · 742 Evergreen Terrace' },
  ],
  rest_4: [
    { lat: 37.7895, lng: -122.4342, streetLabel: 'Atelier Cacao · 2150 Fillmore St' },
    { lat: 37.7868, lng: -122.4265, streetLabel: 'Geary Blvd & Gough St' },
    { lat: 37.7832, lng: -122.4184, streetLabel: 'Civic Center Plaza' },
    { lat: 37.7798, lng: -122.4102, streetLabel: '7th St & Folsom Corridor' },
    { lat: 37.7782, lng: -122.4035, streetLabel: '5th St & Brannan Square' },
    { lat: 37.7768, lng: -122.3982, streetLabel: 'Customer Dropoff · 742 Evergreen Terrace' },
  ],
};

function getInitialProgressForStatus(status: OrderRecord['status']): number {
  switch (status) {
    case 'placed':
    case 'accepted':
    case 'preparing':
    case 'ready_for_pickup':
      return 0;
    case 'picked_up':
      return 0.18;
    case 'out_for_delivery':
      return 0.56;
    case 'delivered':
      return 1;
    case 'cancelled':
      return 0;
    default:
      return 0.5;
  }
}

function interpolateRoutePosition(
  waypoints: WaypointNode[],
  progress: number
): {
  lat: number;
  lng: number;
  currentWaypointLabel: string;
  traveledPath: [number, number][];
  remainingPath: [number, number][];
} {
  const clamped = Math.max(0, Math.min(1, progress));
  if (waypoints.length < 2) {
    const pt = waypoints[0] || { lat: 37.7768, lng: -122.3982, streetLabel: 'San Francisco' };
    return {
      lat: pt.lat,
      lng: pt.lng,
      currentWaypointLabel: pt.streetLabel,
      traveledPath: [[pt.lat, pt.lng]],
      remainingPath: [[pt.lat, pt.lng]],
    };
  }

  const totalSegments = waypoints.length - 1;
  const exactIndex = clamped * totalSegments;
  const segIndex = Math.min(totalSegments - 1, Math.floor(exactIndex));
  const segFraction = exactIndex - segIndex;

  const startNode = waypoints[segIndex];
  const endNode = waypoints[segIndex + 1];

  const lat = startNode.lat + (endNode.lat - startNode.lat) * segFraction;
  const lng = startNode.lng + (endNode.lng - startNode.lng) * segFraction;

  const traveledPath: [number, number][] = waypoints
    .slice(0, segIndex + 1)
    .map((w) => [w.lat, w.lng]);
  traveledPath.push([lat, lng]);

  const remainingPath: [number, number][] = [[lat, lng]];
  waypoints.slice(segIndex + 1).forEach((w) => {
    remainingPath.push([w.lat, w.lng]);
  });

  const labelIdx = Math.min(waypoints.length - 1, Math.round(exactIndex));
  return {
    lat,
    lng,
    currentWaypointLabel: waypoints[labelIdx].streetLabel,
    traveledPath,
    remainingPath,
  };
}

interface OrderTrackingMapInnerProps {
  order: OrderRecord;
}

export default function OrderTrackingMapInner({ order }: OrderTrackingMapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const traveledLineRef = useRef<L.Polyline | null>(null);
  const remainingLineRef = useRef<L.Polyline | null>(null);

  const waypoints = useMemo(
    () => RESTAURANT_ROUTES[order.restaurantId] || RESTAURANT_ROUTES.rest_1,
    [order.restaurantId]
  );

  const [progress, setProgress] = useState<number>(() =>
    getInitialProgressForStatus(order.status)
  );
  const [isSimulating, setIsSimulating] = useState<boolean>(
    order.status === 'out_for_delivery' || order.status === 'picked_up'
  );
  const [followRider, setFollowRider] = useState<boolean>(false);

  // Sync progress when order status changes externally
  useEffect(() => {
    const target = getInitialProgressForStatus(order.status);
    const raf = window.requestAnimationFrame(() => {
      setProgress(target);
      setIsSimulating(order.status === 'out_for_delivery' || order.status === 'picked_up');
    });
    return () => window.cancelAnimationFrame(raf);
  }, [order.status]);

  // Continuous real-time GPS movement loop
  useEffect(() => {
    if (!isSimulating || order.status === 'cancelled') return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) {
          return 0.05;
        }
        return Number(Math.min(1, prev + 0.008).toFixed(4));
      });
    }, 180);

    return () => clearInterval(timer);
  }, [isSimulating, order.status]);

  const interpolated = useMemo(
    () => interpolateRoutePosition(waypoints, progress),
    [waypoints, progress]
  );

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const startPt = waypoints[0];
    const endPt = waypoints[waypoints.length - 1];

    const map = L.map(mapContainerRef.current, {
      center: [(startPt.lat + endPt.lat) / 2, (startPt.lng + endPt.lng) / 2],
      zoom: 14,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    // Restaurant Pickup Marker
    const restaurantIcon = L.divIcon({
      className: 'foodhub-leaflet-marker',
      html: `
        <div style="display:flex;align-items:center;gap:6px;background:#1C1917;color:#FFFFFF;padding:5px 10px;border-radius:999px;border:2px solid #FFFFFF;box-shadow:0 6px 16px rgba(0,0,0,0.28);font-family:monospace;font-size:11px;font-weight:700;white-space:nowrap;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#F97316;"></span>
          <span>Kitchen: ${order.restaurantName}</span>
        </div>
      `,
      iconSize: [180, 32],
      iconAnchor: [90, 16],
    });

    L.marker([startPt.lat, startPt.lng], { icon: restaurantIcon })
      .addTo(map)
      .bindPopup(
        `<strong>Pickup: ${order.restaurantName}</strong><br/>${startPt.streetLabel}<br/>Order #${order.orderNumber}`
      );

    // Customer Destination Marker
    const customerIcon = L.divIcon({
      className: 'foodhub-leaflet-marker',
      html: `
        <div style="display:flex;align-items:center;gap:6px;background:#15803D;color:#FFFFFF;padding:5px 10px;border-radius:999px;border:2px solid #FFFFFF;box-shadow:0 6px 16px rgba(0,0,0,0.28);font-family:monospace;font-size:11px;font-weight:700;white-space:nowrap;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#FFFFFF;"></span>
          <span>Customer: ${order.customerName}</span>
        </div>
      `,
      iconSize: [170, 32],
      iconAnchor: [85, 16],
    });

    L.marker([endPt.lat, endPt.lng], { icon: customerIcon })
      .addTo(map)
      .bindPopup(
        `<strong>Dropoff: ${order.customerName}</strong><br/>${order.addressSnapshot.street}, ${order.addressSnapshot.city}`
      );

    // Route Polylines
    const traveledPolyline = L.polyline(interpolated.traveledPath, {
      color: '#EA580C',
      weight: 5,
      opacity: 0.95,
    }).addTo(map);

    const remainingPolyline = L.polyline(interpolated.remainingPath, {
      color: '#57534E',
      weight: 4,
      opacity: 0.65,
      dashArray: '8, 8',
    }).addTo(map);

    // Delivery Partner Live Marker
    const riderIcon = L.divIcon({
      className: 'foodhub-leaflet-rider',
      html: `
        <div style="display:flex;align-items:center;gap:6px;background:#EA580C;color:#FFFFFF;padding:6px 12px;border-radius:999px;border:2.5px solid #FFFFFF;box-shadow:0 8px 20px rgba(234,88,12,0.45);font-family:monospace;font-size:11px;font-weight:800;white-space:nowrap;">
          <span>🛵 ${order.deliveryPartnerName || 'Rohan Verma'}</span>
        </div>
      `,
      iconSize: [150, 34],
      iconAnchor: [75, 17],
    });

    const riderMarker = L.marker([interpolated.lat, interpolated.lng], {
      icon: riderIcon,
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup(
        `<strong>Delivery Partner: ${order.deliveryPartnerName || 'Rohan Verma'}</strong><br/>Vehicle: Electric Bike (CA-EV-8842)<br/>Live Status: ${order.status.replace(/_/g, ' ').toUpperCase()}`
      );

    const bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [45, 45] });

    mapInstanceRef.current = map;
    riderMarkerRef.current = riderMarker;
    traveledLineRef.current = traveledPolyline;
    remainingLineRef.current = remainingPolyline;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  // Update Rider Marker & Polylines in real time as progress changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    riderMarkerRef.current?.setLatLng([interpolated.lat, interpolated.lng]);
    traveledLineRef.current?.setLatLngs(interpolated.traveledPath);
    remainingLineRef.current?.setLatLngs(interpolated.remainingPath);

    if (followRider) {
      mapInstanceRef.current.panTo([interpolated.lat, interpolated.lng], {
        animate: true,
        duration: 0.25,
      });
    }
  }, [interpolated, followRider]);

  const handleFitRoute = () => {
    if (!mapInstanceRef.current) return;
    const bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lng] as [number, number]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [45, 45] });
  };

  const remainingMiles = Math.max(0, (1 - progress) * 2.4).toFixed(2);
  const etaMinutes = Math.max(1, Math.ceil((1 - progress) * 14));
  const riderSpeedMph = isSimulating && progress < 1 ? '19.4 mph' : '0.0 mph';

  return (
    <div className="border border-stone-200 rounded-2xl overflow-hidden bg-stone-50">
      {/* Live GPS Telemetry Header */}
      <div className="bg-stone-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-600 text-white">
            <Bike className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
              <span className="font-bold text-white">
                Rider: {order.deliveryPartnerName || 'Rohan Verma'}
              </span>
              <span className="text-stone-400">·</span>
              <span className="text-orange-400">
                {progress >= 1
                  ? 'Arrived at Customer Location'
                  : `ETA ${etaMinutes} min (${remainingMiles} mi remaining)`}
              </span>
              <span className="text-stone-400">·</span>
              <span className="text-stone-300">{riderSpeedMph}</span>
            </div>
            <p className="text-[11px] text-stone-300 mt-0.5 font-mono truncate">
              Current Street Telemetry: {interpolated.currentWaypointLabel} (
              {interpolated.lat.toFixed(4)}° N, {Math.abs(interpolated.lng).toFixed(4)}° W)
            </p>
          </div>
        </div>

        {/* Interactive Map Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSimulating((s) => !s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
              isSimulating
                ? 'bg-orange-600 text-white'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
            }`}
          >
            {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimulating ? 'Live Movement: ON' : 'Simulate Movement'}</span>
          </button>

          <button
            type="button"
            onClick={() => setFollowRider((f) => !f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
              followRider
                ? 'bg-emerald-600 text-white'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
            }`}
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>{followRider ? 'Following Rider' : 'Lock Camera'}</span>
          </button>

          <button
            type="button"
            onClick={handleFitRoute}
            className="px-3 py-1.5 text-xs font-medium bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Fit Full Route</span>
          </button>

          <button
            type="button"
            onClick={() => setProgress(0)}
            title="Reset rider to restaurant pickup"
            className="p-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Leaflet.js Map Canvas */}
      <div
        ref={mapContainerRef}
        className="w-full h-[340px] sm:h-[380px] z-10 relative"
        aria-label={`Interactive Leaflet delivery tracking map for Order ${order.orderNumber}`}
      />

      {/* Interactive Route Progress Scrubber & Waypoints Footer */}
      <div className="px-4 py-3 bg-white border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-stone-600 min-w-0">
          <Store className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <span className="truncate font-medium text-stone-900">{order.restaurantName}</span>
          <span className="text-stone-400">→</span>
          <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span className="truncate font-medium text-stone-900">
            {order.addressSnapshot.street}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-mono text-stone-500 tabular-nums">
            Route Progress: {Math.round(progress * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(progress * 100)}
            onChange={(e) => {
              setIsSimulating(false);
              setProgress(Number(e.target.value) / 100);
            }}
            aria-label="Scrub delivery partner route position"
            className="w-28 accent-orange-600 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
