import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapView } from "@/components/MapView";
import { StatusBadge } from "./admin.buses";
import { relativeTime, fmtTime } from "@/lib/format";
import type { MapStop } from "@/components/MapView";

export const Route = createFileRoute("/admin/monitor")({ component: MonitorPage });

interface Trip { id: string; status: string; scheduled_start_time: string; actual_start_time: string | null; delay_minutes: number | null; routes: { id: string; route_name: string; route_geometry: unknown } | null; buses: { bus_number: string; bus_name: string } | null; drivers: { name: string; phone: string } | null; }
interface Location { latitude: number; longitude: number; speed: number | null; heading: number | null; recorded_at: string; }

function MonitorPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: trips = [] } = useQuery({
    queryKey: ["monitor-trips"],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase.from("trips")
        .select("*, routes(id,route_name,route_geometry), buses(bus_number,bus_name), drivers(name,phone)")
        .in("status", ["active", "delayed", "scheduled"])
        .order("actual_start_time", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as never as Trip[];
    },
  });

  useEffect(() => {
    if (!selectedId && trips.length > 0) setSelectedId(trips[0].id);
  }, [trips, selectedId]);

  const selected = trips.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold">Live Monitor</h1>
        <p className="text-muted-foreground text-sm">Real-time GPS tracking of active buses.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-card border rounded-xl overflow-hidden max-h-[70vh] overflow-y-auto">
          <div className="p-3 border-b text-xs font-semibold uppercase text-muted-foreground">{trips.length} active/scheduled</div>
          {trips.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No active trips</div>
          ) : (
            trips.map((t) => (
              <button key={t.id} onClick={() => setSelectedId(t.id)} className={`w-full text-left p-3 border-b hover:bg-muted transition ${selectedId === t.id ? "bg-muted" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">{t.buses?.bus_number}</div>
                  <StatusBadge status={t.status} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t.routes?.route_name}</div>
                <div className="text-xs text-muted-foreground">Driver: {t.drivers?.name}</div>
              </button>
            ))
          )}
        </div>

        <div className="md:col-span-2">
          {selected ? <TripDetail trip={selected} /> : <div className="bg-card border rounded-xl p-8 text-center text-sm text-muted-foreground">Select a trip to view details.</div>}
        </div>
      </div>
    </div>
  );
}

export function useLiveLocation(tripId: string | null) {
  const [loc, setLoc] = useState<Location | null>(null);

  useEffect(() => {
    if (!tripId) { setLoc(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("driver_locations").select("*").eq("trip_id", tripId).order("recorded_at", { ascending: false }).limit(1);
      if (!cancelled && data?.[0]) setLoc(data[0] as Location);
    })();

    const channel = supabase
      .channel(`trip-${tripId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "driver_locations", filter: `trip_id=eq.${tripId}` }, (payload) => {
        setLoc(payload.new as Location);
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [tripId]);

  return loc;
}

export function useTripStops(routeId: string | null) {
  return useQuery({
    queryKey: ["route-stops", routeId],
    enabled: !!routeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("route_stops").select("stop_order, stops(id,stop_name,latitude,longitude)").eq("route_id", routeId!).order("stop_order");
      if (error) throw error;
      return data as never as { stop_order: number; stops: { id: string; stop_name: string; latitude: number; longitude: number } }[];
    },
  });
}

function TripDetail({ trip }: { trip: Trip }) {
  const loc = useLiveLocation(trip.id);
  const { data: stops = [] } = useTripStops(trip.routes?.id ?? null);

  const polyline = (trip.routes?.route_geometry as [number, number][] | null) ?? [];
  const staleMinutes = loc ? (Date.now() - new Date(loc.recorded_at).getTime()) / 60000 : Infinity;
  const stale = staleMinutes > 1;

  const mapStops: MapStop[] = stops.map((s, i) => ({
    id: s.stops.id,
    name: s.stops.stop_name,
    lat: s.stops.latitude,
    lng: s.stops.longitude,
    kind: i === 0 ? "start" : i === stops.length - 1 ? "end" : "stop",
  }));

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Field label="Bus"><span className="font-medium">{trip.buses?.bus_number}</span></Field>
          <Field label="Driver">{trip.drivers?.name}</Field>
          <Field label="Phone">{trip.drivers?.phone}</Field>
          <Field label="Status"><StatusBadge status={trip.status} /></Field>
          <Field label="Route">{trip.routes?.route_name}</Field>
          <Field label="Scheduled">{fmtTime(trip.scheduled_start_time)}</Field>
          <Field label="Started">{trip.actual_start_time ? fmtTime(trip.actual_start_time) : "—"}</Field>
          <Field label="Speed">{loc?.speed != null ? `${(loc.speed * 3.6).toFixed(0)} km/h` : "—"}</Field>
        </div>
        <div className="mt-3 text-xs text-muted-foreground border-t pt-3">
          {loc ? (
            stale
              ? <span className="text-amber-600">Location signal weak · Last updated {relativeTime(loc.recorded_at)}</span>
              : <>Last updated {relativeTime(loc.recorded_at)}</>
          ) : trip.status === "scheduled" ? "Trip not started yet." : "Waiting for driver location…"}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden h-[500px]">
        <MapView
          stops={mapStops}
          polyline={polyline}
          bus={loc ? { lat: loc.latitude, lng: loc.longitude, heading: loc.heading ?? undefined } : null}
        />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div><div className="mt-0.5">{children}</div></div>;
}
