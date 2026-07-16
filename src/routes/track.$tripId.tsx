import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapView, type MapStop } from "@/components/MapView";
import { useLiveLocation, useTripStops } from "./admin.monitor";
import { StatusBadge } from "./admin.buses";
import { fmtDistance, fmtTime, relativeTime } from "@/lib/format";
import { haversine } from "@/lib/routing";
import { ArrowLeft } from "lucide-react";
import { subscribeToTrip, unsubscribeFromTrip } from "@/lib/supabase-subscriptions";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/track/$tripId")({
  component: TrackPage,
  validateSearch: (s: Record<string, unknown>) => ({
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
  }),
});

function TrackPage() {
  const { tripId } = Route.useParams();
  const { from, to } = Route.useSearch();
  const [trip, setTrip] = useState<PublicActiveTrip | null>(null);

  useEffect(() => {
    // Initial fetch
    supabase.from("trips")
      .select("*, routes(id,route_name,route_geometry), buses(bus_number,bus_name), drivers(name,phone), stops!trips_current_stop_id_fkey(stop_name)")
      .eq("id", tripId)
      .single()
      .then(({ data, error }) => {
        if (error) console.error("Error fetching initial trip data:", error);
        else if (data) setTrip(data as PublicActiveTrip);
      });

    // Subscribe to real-time updates
    const channel = subscribeToTrip(tripId, (updatedTrip) => {
      setTrip(updatedTrip);
    });

    return () => {
      unsubscribeFromTrip(channel);
    };
  }, [tripId]);

  const routeId = trip?.route_id ?? null;
  const { data: stops = [] } = useTripStops(routeId);
  const loc = useLiveLocation(tripId);

  if (!trip) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;

  const t = trip as { status: string; scheduled_start_time: string; routes: { route_name: string; route_geometry: unknown } | null; buses: { bus_number: string } | null; drivers: { name: string } | null };
  const polyline = (t.routes?.route_geometry as [number, number][] | null) ?? [];
  // Note: The `stops` property on `t` (which is `trip`) is from `stops!trips_current_stop_id_fkey(stop_name)`
  const boardStop = from ? stops.find((s) => s.stops.id === from)?.stops : null;
  const destStop = to ? stops.find((s) => s.stops.id === to)?.stops : null;

  const mapStops: MapStop[] = stops.map((s, i) => {
    const isBoard = s.stops.id === from;
    const isDest = s.stops.id === to;
    return {
      id: s.stops.id,
      name: s.stops.stop_name + (isBoard ? " (Boarding)" : isDest ? " (Destination)" : ""),
      lat: s.stops.latitude,
      lng: s.stops.longitude,
      kind: isBoard || i === 0 ? "start" : isDest || i === stops.length - 1 ? "end" : "stop",
    };
  });

  const distToBoard = loc && boardStop ? haversine({ lat: loc.latitude, lng: loc.longitude }, { lat: boardStop.latitude, lng: boardStop.longitude }) : null;
  const eta = distToBoard != null && loc?.speed && loc.speed > 1 ? Math.round(distToBoard / loc.speed / 60) : null;
  const stale = loc ? (Date.now() - new Date(loc.recorded_at).getTime()) / 60000 > 1 : false;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-3xl mx-auto p-3 flex items-center gap-3">
          <Link to="/passenger" className="p-2 hover:bg-muted rounded-lg"><ArrowLeft size={16} /></Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{t.buses?.bus_number} · {t.routes?.route_name}</div>
            <div className="text-[11px] text-muted-foreground">Driver: {t.drivers?.name}</div>
          </div>
          <StatusBadge status={t.status} />
        </div>
      </header>

      <div className="flex-1 relative">
        <MapView
          stops={mapStops}
          polyline={polyline}
          bus={loc ? { lat: loc.latitude, lng: loc.longitude, heading: loc.heading ?? undefined } : null}
          className="w-full h-full min-h-[400px]"
        />
      </div>

      <div className="bg-card border-t p-4 max-w-3xl w-full mx-auto">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Field label="Departs">{fmtTime(t.scheduled_start_time)}</Field>
          <Field label="Speed">{loc?.speed != null ? `${(loc.speed * 3.6).toFixed(0)} km/h` : "—"}</Field>
          {boardStop && <Field label="Distance to boarding">{fmtDistance(distToBoard)}</Field>}
          {eta != null && <Field label="ETA to boarding">{eta} min</Field>}
          <Field label="Last update">
            {loc ? (stale ? <span className="text-amber-600">Weak signal · {relativeTime(loc.recorded_at)}</span> : relativeTime(loc.recorded_at)) : "Waiting for GPS…"}
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div><div className="mt-0.5">{children}</div></div>;
}
