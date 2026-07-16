import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "./admin.buses";
import { fmtDistance, fmtTime, relativeTime } from "@/lib/format";
import { haversine } from "@/lib/routing";
import { ArrowLeftRight, Search, Home, MapPin, Radio } from "lucide-react";
import { passengerListStops, passengerSearchTrips } from "@/lib/passenger-search.functions";

export const Route = createFileRoute("/passenger")({ component: PassengerPage });

interface Stop {
  id: string;
  stop_name: string;
  latitude: number;
  longitude: number;
}

type PassengerTrip = {
  id: string;
  route_id: string;
  status: string;
  scheduled_start_time: string;
  routes: { route_name: string } | null;
  buses: { bus_number: string; bus_name: string } | null;
  drivers: { name: string } | null;
  match: { fromOrder: number; toOrder: number; stopsBetween: number };
};

function PassengerPage() {
  const [from, setFrom] = useState<Stop | null>(null);
  const [to, setTo] = useState<Stop | null>(null);
  const [searched, setSearched] = useState(false);
  const listStopsFn = useServerFn(passengerListStops);

  const { data: allStops = [], error } = useQuery({
    queryKey: ["all-stops"],
    queryFn: async () => (await listStopsFn()) as Stop[],
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-muted rounded-lg">
            <Home size={16} />
          </Link>
          <div>
            <div className="font-bold">Find your bus</div>
            <div className="text-[11px] text-muted-foreground">
              Search by boarding and destination stop
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        <div className="bg-card border rounded-2xl p-4 shadow-sm">
          <StopPicker label="From" stops={allStops} value={from} onChange={setFrom} />
          <div className="my-2 flex justify-center">
            <button
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              className="p-2 rounded-full hover:bg-muted"
            >
              <ArrowLeftRight size={16} />
            </button>
          </div>
          <StopPicker label="To" stops={allStops} value={to} onChange={setTo} />
          <button
            disabled={!from || !to || from.id === to.id}
            onClick={() => setSearched(true)}
            className="w-full mt-4 bg-primary text-primary-foreground py-3 rounded-xl font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Search size={16} /> Search buses
          </button>
        </div>

        {error && (
          <div className="mt-6 bg-card border rounded-2xl p-8 text-center">
            <div className="font-medium">Stops could not load</div>
            <div className="text-sm text-destructive mt-1">
              {error instanceof Error ? error.message : "Unable to load stops"}
            </div>
          </div>
        )}

        {!error && allStops.length === 0 && (
          <div className="mt-6 bg-card border rounded-2xl p-8 text-center">
            <div className="text-4xl mb-2">Map</div>
            <div className="font-medium">No stops available</div>
            <div className="text-sm text-muted-foreground mt-1">
              Ask an administrator to add routes and stops.
            </div>
          </div>
        )}

        {searched && from && to && <SearchResults from={from} to={to} />}
      </main>
    </div>
  );
}

function StopPicker({
  label,
  stops,
  value,
  onChange,
}: {
  label: string;
  stops: Stop[];
  value: Stop | null;
  onChange: (s: Stop | null) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = q.trim()
    ? stops.filter((s) => s.stop_name.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : stops.slice(0, 8);

  return (
    <div className="relative">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-background">
        <MapPin size={16} className="text-muted-foreground" />
        <input
          className="flex-1 bg-transparent outline-none text-sm"
          placeholder={value?.stop_name ?? "Choose a stop"}
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
        />
        {value && (
          <button
            onClick={() => {
              onChange(null);
              setQ("");
            }}
            className="text-xs text-muted-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-card border rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onChange(s);
                setQ("");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-0"
            >
              {s.stop_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResults({ from, to }: { from: Stop; to: Stop }) {
  const searchTripsFn = useServerFn(passengerSearchTrips);
  const {
    data: trips = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["passenger-search", from.id, to.id],
    refetchInterval: 5000,
    queryFn: async () =>
      (await searchTripsFn({ data: { fromId: from.id, toId: to.id } })) as PassengerTrip[],
  });

  if (isLoading) {
    return <div className="mt-6 text-center text-sm text-muted-foreground">Searching...</div>;
  }

  if (error) {
    return (
      <div className="mt-6 bg-card border rounded-2xl p-8 text-center">
        <div className="font-medium">Search failed</div>
        <div className="text-sm text-destructive mt-1">
          {error instanceof Error ? error.message : "Unable to search buses"}
        </div>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="mt-6 bg-card border rounded-2xl p-8 text-center">
        <div className="text-4xl mb-2">Search</div>
        <div className="font-medium">No matching buses</div>
        <div className="text-sm text-muted-foreground mt-1">
          No scheduled or running buses from {from.stop_name} to {to.stop_name} right now.
        </div>
      </div>
    );
  }

  const sorted = [...trips].sort((a, b) => {
    const rank = (s: string) => (s === "active" || s === "delayed" ? 0 : 1);
    const statusRank = rank(a.status) - rank(b.status);
    if (statusRank !== 0) return statusRank;
    return new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime();
  });

  return (
    <div className="mt-6 space-y-3">
      <div className="text-sm text-muted-foreground px-1">
        {sorted.length} bus{sorted.length !== 1 ? "es" : ""} found
      </div>
      {sorted.map((trip) => (
        <ResultCard key={trip.id} trip={trip} from={from} to={to} />
      ))}
    </div>
  );
}

function ResultCard({ trip: t, from, to }: { trip: PassengerTrip; from: Stop; to: Stop }) {
  const { data: latestLoc } = useQuery({
    queryKey: ["latest-loc", t.id],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_locations")
        .select("latitude,longitude,recorded_at,speed")
        .eq("trip_id", t.id)
        .order("recorded_at", { ascending: false })
        .limit(1);
      return (data?.[0] ?? null) as {
        latitude: number;
        longitude: number;
        recorded_at: string;
        speed: number | null;
      } | null;
    },
  });

  const distanceToBoard = latestLoc
    ? haversine(
        { lat: latestLoc.latitude, lng: latestLoc.longitude },
        { lat: from.latitude, lng: from.longitude },
      )
    : null;

  const stopsBetween = t.match.stopsBetween;
  const isActive = t.status === "active" || t.status === "delayed";
  let badge = "Scheduled";
  if (isActive && distanceToBoard != null)
    badge = distanceToBoard < 500 ? "Arriving soon" : "On the way";
  else if (t.status === "delayed") badge = "Delayed";
  else if (!latestLoc && isActive) badge = "Location unavailable";

  return (
    <div className="bg-card border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">
          {t.buses?.bus_number}{" "}
          <span className="text-muted-foreground font-normal">- {t.buses?.bus_name}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          {badge}
        </span>
      </div>
      <div className="text-xs text-muted-foreground mb-3">{t.routes?.route_name}</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Boarding:</span> {from.stop_name}
        </div>
        <div>
          <span className="text-muted-foreground">Destination:</span> {to.stop_name}
        </div>
        <div>
          <span className="text-muted-foreground">Driver:</span> {t.drivers?.name}
        </div>
        <div>
          <span className="text-muted-foreground">Departs:</span> {fmtTime(t.scheduled_start_time)}
        </div>
        <div>
          <span className="text-muted-foreground">Distance to bus:</span>{" "}
          {fmtDistance(distanceToBoard)}
        </div>
        <div>
          <span className="text-muted-foreground">Stops between:</span> {stopsBetween}
        </div>
        <div className="col-span-2">
          <span className="text-muted-foreground">Last seen:</span>{" "}
          {latestLoc ? relativeTime(latestLoc.recorded_at) : "-"} -{" "}
          <StatusBadge status={t.status} />
        </div>
      </div>
      <Link
        to="/track/$tripId"
        params={{ tripId: t.id }}
        search={{ from: from.id, to: to.id }}
        className="mt-3 w-full bg-primary text-primary-foreground py-2 rounded-xl font-medium text-sm inline-flex items-center justify-center gap-2"
      >
        <Radio size={14} /> Track bus live
      </Link>
    </div>
  );
}
