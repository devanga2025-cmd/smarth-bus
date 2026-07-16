// OSRM public routing helper — draws routes along real roads.
export interface LatLng { lat: number; lng: number }

export interface RouteResult {
  coordinates: [number, number][]; // [lat, lng]
  distance: number; // meters
  duration: number; // seconds
}

export async function fetchRoadRoute(points: LatLng[]): Promise<RouteResult | null> {
  if (points.length < 2) return null;
  const coordStr = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) return null;
    const coords: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
    return { coordinates: coords, distance: route.distance, duration: route.duration };
  } catch {
    return null;
  }
}

export async function geocodeSearch(query: string): Promise<{ name: string; lat: number; lng: number }[]> {
  if (!query.trim()) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
  try {
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.map((r: { display_name: string; lat: string; lon: string }) => ({
      name: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  } catch {
    return [];
  }
}

export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
