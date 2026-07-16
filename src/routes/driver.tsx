import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapView, type MapStop } from "@/components/MapView";
import { StatusBadge } from "./admin.buses";
import { toast } from "sonner";
import { Play, Square, MapPin, Home, Loader2, LogOut, Eye, EyeOff, Download } from "lucide-react";
import { haversine } from "@/lib/routing";
import { fmtTime, fmtDistance, relativeTime } from "@/lib/format";
import { driverLogin, driverMe, driverLogout } from "@/lib/driver-auth.functions";
import { startTrip as startTripAction, endTrip as endTripAction } from "@/lib/trip-management";
import { startBrowserTracking, stopBrowserTracking } from "@/lib/location-tracking";

export const Route = createFileRoute("/driver")({ component: DriverPage });

interface TripFull {
  id: string;
  status: string;
  scheduled_start_time: string;
  actual_start_time: string | null;
  route_id: string;
  bus_id: string;
  driver_id: string;
  routes: { route_name: string; route_geometry: unknown } | null;
  buses: { bus_number: string; bus_name: string } | null;
  drivers: { name: string } | null;
}

type DriverSession = {
  id: string;
  name: string;
  login_name: string;
};

const DRIVER_SESSION_CACHE_KEY = "smartbus-driver-session";

function readCachedDriver() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRIVER_SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DriverSession>;
    if (!parsed.id || !parsed.name || !parsed.login_name) return null;
    return parsed as DriverSession;
  } catch {
    return null;
  }
}

function cacheDriver(driver: DriverSession | null) {
  if (typeof window === "undefined") return;
  if (!driver) {
    window.localStorage.removeItem(DRIVER_SESSION_CACHE_KEY);
    return;
  }
  window.localStorage.setItem(DRIVER_SESSION_CACHE_KEY, JSON.stringify(driver));
}

function DriverPage() {
  const qc = useQueryClient();
  const meFn = useServerFn(driverMe);
  const logoutFn = useServerFn(driverLogout);
  const [cachedDriver, setCachedDriver] = useState<DriverSession | null>(null);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["driver-me"],
    queryFn: async () => await meFn(),
    staleTime: 30_000,
  });

  useEffect(() => {
    setCachedDriver(readCachedDriver());
  }, []);

  useEffect(() => {
    if (me) {
      cacheDriver(me);
      setCachedDriver(me);
    }
  }, [me]);

  const logout = useMutation({
    mutationFn: async () => {
      await logoutFn();
    },
    onSuccess: () => {
      cacheDriver(null);
      setCachedDriver(null);
      qc.setQueryData(["driver-me"], null);
      qc.invalidateQueries();
      toast.success("Signed out");
    },
  });

  const activeDriver = me ?? cachedDriver;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-muted rounded-lg">
            <Home size={16} />
          </Link>
          <div className="flex-1">
            <div className="font-bold">Driver</div>
            <div className="text-[11px] text-muted-foreground">
              {activeDriver?.name ?? "Not signed in"}
            </div>
          </div>
          {activeDriver && (
            <button
              onClick={() => logout.mutate()}
              className="p-2 hover:bg-muted rounded-lg"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4">
        {meLoading && !activeDriver ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="animate-spin" />
          </div>
        ) : !activeDriver ? (
          <LoginCard
            onLoggedIn={(driver) => {
              cacheDriver(driver);
              setCachedDriver(driver);
              qc.setQueryData(["driver-me"], driver);
            }}
          />
        ) : (
          <DriverHome driverId={activeDriver.id} driverName={activeDriver.name} />
        )}
      </main>
    </div>
  );
}

function LoginCard({ onLoggedIn }: { onLoggedIn: (driver: DriverSession) => void }) {
  const [loginName, setLoginName] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pending, setPending] = useState(false);
  const loginFn = useServerFn(driverLogin);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim()) return toast.error("Enter your login name");
    if (!/^\d{4}$/.test(pin)) return toast.error("PIN must be 4 digits");
    setPending(true);
    try {
      const driver = await loginFn({ data: { login_name: loginName.trim(), pin } });
      toast.success("Signed in");
      onLoggedIn(driver);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-card border rounded-2xl p-6 max-w-sm mx-auto mt-8">
      <div className="text-center mb-5">
        <div className="text-4xl mb-2">🚌</div>
        <h2 className="text-xl font-bold">Driver sign in</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Use the login name and 4-digit PIN issued by your administrator.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <div className="text-xs font-medium mb-1">Login name</div>
          <input
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={loginName}
            onChange={(e) => setLoginName(e.target.value.toLowerCase())}
            placeholder="ramesh.kumar"
            className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm font-mono"
          />
        </label>
        <label className="block">
          <div className="text-xs font-medium mb-1">4-digit PIN</div>
          <div className="relative">
            <input
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              maxLength={4}
              autoComplete="one-time-code"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="w-full px-3 py-2.5 pr-10 rounded-lg border bg-background text-center text-lg tracking-[0.5em] font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
            >
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-primary text-primary-foreground font-medium py-2.5 rounded-lg disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="border-t mt-5 pt-4 text-center">
        <button disabled className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Download size={14} /> Download Driver App (coming soon)
        </button>
        <div className="text-[11px] text-muted-foreground mt-2">
          Android build instructions in <code>DRIVER_APP_BUILD.md</code>.
        </div>
      </div>
    </div>
  );
}

function DriverHome({ driverId, driverName }: { driverId: string; driverName: string }) {
  const {
    data: trip,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["driver-trip", driverId],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, routes(route_name,route_geometry), buses(bus_number,bus_name), drivers(name)")
        .eq("driver_id", driverId)
        .in("status", ["scheduled", "active", "delayed"])
        .order("scheduled_start_time", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as TripFull | null;
    },
  });

  const { data: stops = [] } = useQuery({
    queryKey: ["driver-stops", trip?.route_id],
    enabled: !!trip?.route_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_stops")
        .select("stop_order, stops(id,stop_name,latitude,longitude)")
        .eq("route_id", trip!.route_id)
        .order("stop_order");
      if (error) throw error;
      return data as never as {
        stop_order: number;
        stops: { id: string; stop_name: string; latitude: number; longitude: number };
      }[];
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (error) {
    return (
      <div className="bg-card border rounded-2xl p-6 text-center">
        <div className="font-semibold">Driver page could not load</div>
        <div className="text-sm text-destructive mt-2">
          {error instanceof Error ? error.message : "Unable to load assigned trip"}
        </div>
      </div>
    );
  }
  if (!trip) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center">
        <div className="text-5xl mb-3">🚌</div>
        <div className="font-semibold">Welcome, {driverName}</div>
        <div className="text-sm text-muted-foreground mt-1">
          No trip has been assigned by the administrator.
        </div>
      </div>
    );
  }
  return <TripPanel trip={trip} stops={stops} />;
}

function TripPanel({
  trip,
  stops,
}: {
  trip: TripFull;
  stops: {
    stop_order: number;
    stops: { id: string; stop_name: string; latitude: number; longitude: number };
  }[];
}) {
  const qc = useQueryClient();
  const startTripFn = useServerFn(startTripAction);
  const endTripFn = useServerFn(endTripAction);
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [gpsRequested, setGpsRequested] = useState(false);

  const polyline = (trip.routes?.route_geometry as [number, number][] | null) ?? [];
  const mapStops: MapStop[] = stops.map((s, i) => ({
    id: s.stops.id,
    name: s.stops.stop_name,
    lat: s.stops.latitude,
    lng: s.stops.longitude,
    kind: i === 0 ? "start" : i === stops.length - 1 ? "end" : "stop",
  }));

  const isActive = trip.status === "active" || trip.status === "delayed";

  const start = useMutation({
    mutationFn: async () => {
      // Start GPS tracking before attempting to start the trip
      setGpsRequested(true);
      startBrowserTracking({
        tripId: trip.id,
        driverId: trip.driver_id,
        busId: trip.bus_id,
        onLocation: (position) => {
          setPos(position);
          setGpsError(null);
          setTracking(true);
        },
        onError: (error) => {
          setGpsError(error.message);
          setTracking(false);
          toast.error(`GPS: ${error.message}`);
        },
      });
      // Use the centralized startTripAction
      await startTripFn({
        data: {
          tripId: trip.id,
          busId: trip.bus_id,
          driverId: trip.driver_id,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Trip started");
    },
    onError: (e: Error) => {
      stopBrowserTracking();
      setTracking(false);
      toast.error(e.message);
    },
  });

  const end = useMutation({
    mutationFn: async () => {
      // Stop GPS tracking
      stopBrowserTracking();
      await endTripFn({
        data: {
          tripId: trip.id,
          busId: trip.bus_id,
          driverId: trip.driver_id,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Trip completed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Effect to manage GPS tracking based on trip status
  useEffect(() => {
    if (isActive) {
      // If trip is active, ensure tracking is started
      setGpsRequested(true);
      startBrowserTracking({
        tripId: trip.id,
        driverId: trip.driver_id,
        busId: trip.bus_id,
        onLocation: (position) => {
          setPos(position);
          setGpsError(null);
          setTracking(true);
        },
        onError: (error) => {
          setGpsError(error.message);
          setTracking(false);
          toast.error(`GPS: ${error.message}`);
        },
      });
    } else {
      // If trip is not active, stop tracking and reset state
      stopBrowserTracking();
      setTracking(false);
      setGpsRequested(false);
      setPos(null);
      setGpsError(null);
    }
    // Cleanup function to stop tracking when component unmounts or dependencies change
    return () => stopBrowserTracking();
  }, [isActive, trip.id, trip.driver_id, trip.bus_id]);

  const currentLatLng = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
  let nextStop = stops[0]?.stops ?? null;
  let nearestIdx = 0;
  if (currentLatLng && stops.length > 0) {
    let minDist = Infinity;
    stops.forEach((s, i) => {
      const d = haversine(currentLatLng, { lat: s.stops.latitude, lng: s.stops.longitude });
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    });
    const nextIdx = minDist < 100 ? Math.min(nearestIdx + 1, stops.length - 1) : nearestIdx;
    nextStop = stops[nextIdx]?.stops ?? null;
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-muted-foreground">Assigned trip</div>
            <div className="font-semibold text-lg">
              {trip.buses?.bus_number} — {trip.buses?.bus_name}
            </div>
          </div>
          <StatusBadge status={trip.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Fld label="Route">{trip.routes?.route_name}</Fld>
          <Fld label="Scheduled">{fmtTime(trip.scheduled_start_time)}</Fld>
          <Fld label="Started">
            {trip.actual_start_time ? fmtTime(trip.actual_start_time) : "—"}
          </Fld>
          <Fld label="Stops">{stops.length}</Fld>
        </div>

        <div className="mt-4 flex gap-2">
          {trip.status === "scheduled" && (
            <button
              onClick={() => start.mutate()}
              disabled={start.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Play size={18} /> Start trip
            </button>
          )}
          {isActive && (
            <button
              onClick={() => {
                if (confirm("End trip?")) end.mutate();
              }}
              disabled={end.isPending}
              className="flex-1 bg-destructive text-destructive-foreground font-medium py-3 rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Square size={18} /> End trip
            </button>
          )}
        </div>

        {gpsError && (
          <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
            GPS: {gpsError} — please enable location permission in your browser to start the trip.
          </div>
        )}
        {isActive && !gpsError && (
          <div className="mt-3 text-xs text-muted-foreground">
            {pos ? (
              <>
                📍 GPS accuracy ±{Math.round(pos.coords.accuracy)}m ·{" "}
                {relativeTime(new Date(pos.timestamp))} · Speed{" "}
                {pos.coords.speed != null ? `${(pos.coords.speed * 3.6).toFixed(0)} km/h` : "—"}
              </>
            ) : (
              "Waiting for GPS signal…"
            )}
          </div>
        )}
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden h-[400px]">
        <MapView
          stops={mapStops}
          polyline={polyline}
          bus={
            pos
              ? {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  heading: pos.coords.heading ?? undefined,
                }
              : null
          }
        />
      </div>

      {isActive && nextStop && (
        <div className="bg-card border rounded-2xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Next stop</div>
          <div className="flex items-center gap-2 font-medium">
            <MapPin size={16} className="text-primary" /> {nextStop.stop_name}
          </div>
          {currentLatLng && (
            <div className="text-xs text-muted-foreground mt-1">
              {fmtDistance(
                haversine(currentLatLng, { lat: nextStop.latitude, lng: nextStop.longitude }),
              )}{" "}
              away
            </div>
          )}
        </div>
      )}

      <div className="bg-card border rounded-2xl p-4">
        <div className="text-xs text-muted-foreground mb-2">All stops</div>
        <ol className="space-y-1 text-sm">
          {stops.map((s, i) => (
            <li
              key={s.stops.id}
              className={`flex items-center gap-2 ${i < nearestIdx ? "text-muted-foreground line-through" : i === nearestIdx ? "font-semibold text-primary" : ""}`}
            >
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px]">
                {i + 1}
              </span>
              {s.stops.stop_name}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
