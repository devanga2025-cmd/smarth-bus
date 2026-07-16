import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";

export interface MapStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind?: "start" | "end" | "stop" | "bus" | "user";
}

interface Props {
  center?: [number, number];
  zoom?: number;
  stops?: MapStop[];
  polyline?: [number, number][];
  bus?: { lat: number; lng: number; heading?: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerDrag?: (id: string, lat: number, lng: number) => void;
  className?: string;
  fitBounds?: boolean;
}

type LeafletModule = typeof Leaflet;

const colorFor = (kind?: string) => {
  switch (kind) {
    case "start":
      return "#16a34a";
    case "end":
      return "#dc2626";
    case "bus":
      return "#2563eb";
    case "user":
      return "#a855f7";
    default:
      return "#0ea5e9";
  }
};

const makeIcon = (L: LeafletModule, kind?: string, label?: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${colorFor(kind)};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;">${label ?? ""}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

function setupDefaultIcons(L: LeafletModule) {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

export function MapView({
  center = [20.5937, 78.9629],
  zoom = 5,
  stops = [],
  polyline,
  bus,
  onMapClick,
  onMarkerDrag,
  className,
  fitBounds = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layersRef = useRef<Leaflet.Layer[]>([]);
  const busMarkerRef = useRef<Leaflet.Marker | null>(null);
  const clickHandlerRef = useRef(onMapClick);
  const [mapReady, setMapReady] = useState(false);
  clickHandlerRef.current = onMapClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    let createdMap: Leaflet.Map | null = null;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;
      setupDefaultIcons(L);

      const map = L.map(containerRef.current, { center, zoom, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      map.on("click", (e) => clickHandlerRef.current?.(e.latlng.lat, e.latlng.lng));

      createdMap = map;
      mapRef.current = map;
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      createdMap?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    for (const layer of layersRef.current) map.removeLayer(layer);
    layersRef.current = [];

    if (polyline && polyline.length > 1) {
      const line = L.polyline(polyline, { color: "#2563eb", weight: 5, opacity: 0.75 }).addTo(map);
      layersRef.current.push(line);
    }

    stops.forEach((stop, index) => {
      const label = stop.kind === "start" ? "A" : stop.kind === "end" ? "B" : String(index);
      const marker = L.marker([stop.lat, stop.lng], {
        icon: makeIcon(L, stop.kind, label),
        draggable: !!onMarkerDrag,
      }).addTo(map);
      marker.bindTooltip(stop.name);
      if (onMarkerDrag) {
        marker.on("dragend", () => {
          const latLng = marker.getLatLng();
          onMarkerDrag(stop.id, latLng.lat, latLng.lng);
        });
      }
      layersRef.current.push(marker);
    });

    if (fitBounds) {
      const points: [number, number][] = [
        ...stops.map((stop) => [stop.lat, stop.lng] as [number, number]),
        ...(polyline ?? []),
      ];
      if (bus) points.push([bus.lat, bus.lng]);
      if (points.length > 0) {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
      }
    }
  }, [stops, polyline, fitBounds, onMarkerDrag, bus, mapReady]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    if (!bus) {
      if (busMarkerRef.current) {
        map.removeLayer(busMarkerRef.current);
        busMarkerRef.current = null;
      }
      return;
    }

    const icon = L.divIcon({
      className: "",
      html: `<div style="background:#2563eb;width:34px;height:34px;border-radius:50%;border:4px solid white;box-shadow:0 3px 10px rgba(37,99,235,.55);display:flex;align-items:center;justify-content:center;color:white;font-size:16px;transform:rotate(${bus.heading ?? 0}deg);">Bus</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    if (!busMarkerRef.current) {
      busMarkerRef.current = L.marker([bus.lat, bus.lng], { icon }).addTo(map);
      return;
    }

    busMarkerRef.current.setIcon(icon);
    const from = busMarkerRef.current.getLatLng();
    const to = L.latLng(bus.lat, bus.lng);
    const steps = 20;
    let step = 0;
    const dLat = (to.lat - from.lat) / steps;
    const dLng = (to.lng - from.lng) / steps;
    const marker = busMarkerRef.current;
    const interval = window.setInterval(() => {
      step += 1;
      marker.setLatLng([from.lat + dLat * step, from.lng + dLng * step]);
      if (step >= steps) window.clearInterval(interval);
    }, 30);

    return () => window.clearInterval(interval);
  }, [bus, mapReady]);

  return (
    <div
      ref={containerRef}
      className={className ?? "w-full h-full min-h-[400px] rounded-lg overflow-hidden"}
    />
  );
}
