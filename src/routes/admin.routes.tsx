import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { MapView } from "@/components/MapView";
import { fetchRoadRoute, geocodeSearch } from "@/lib/routing";
import { fmtDistance, fmtDuration } from "@/lib/format";
import { Plus, Trash2, ArrowUp, ArrowDown, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateRoute,
  adminDeleteRoute,
  adminListRoutes,
} from "@/lib/route-management.functions";

export const Route = createFileRoute("/admin/routes")({ component: RoutesPage });

interface Stop {
  id: string;
  stop_name: string;
  latitude: number;
  longitude: number;
}
interface RouteRow {
  id: string;
  route_name: string;
  total_distance: number | null;
  estimated_duration: number | null;
  created_at: string;
}
interface DraftStop {
  tempId: string;
  existingId?: string;
  stop_name: string;
  latitude: number;
  longitude: number;
}

function RoutesPage() {
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const listRoutesFn = useServerFn(adminListRoutes);
  const deleteRouteFn = useServerFn(adminDeleteRoute);
  const { data: routes = [] } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      return (await listRoutesFn()) as RouteRow[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await deleteRouteFn({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Route removed");
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Routes &amp; Stops</h1>
          <p className="text-muted-foreground text-sm">
            Draw routes on the map with real road paths.
          </p>
        </div>
        <button
          onClick={() => setEditorOpen(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> New route
        </button>
      </div>

      {routes.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🗺️</div>
          <div className="font-medium">No routes yet</div>
          <div className="text-sm text-muted-foreground mt-1">
            Create your first route to enable trip scheduling.
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map((r) => (
            <div key={r.id} className="bg-card border rounded-xl p-5">
              <div className="font-semibold">{r.route_name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {fmtDistance(r.total_distance)} · {fmtDuration(r.estimated_duration)}
              </div>
              <button
                onClick={() => {
                  if (confirm("Delete route?")) del.mutate(r.id);
                }}
                className="mt-4 text-xs text-destructive inline-flex items-center gap-1"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {editorOpen && <RouteEditor onClose={() => setEditorOpen(false)} />}
    </div>
  );
}

function RouteEditor({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const createRouteFn = useServerFn(adminCreateRoute);
  const [routeName, setRouteName] = useState("");
  const [stops, setStops] = useState<DraftStop[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{ name: string; lat: number; lng: number }[]>(
    [],
  );
  const [polyline, setPolyline] = useState<[number, number][]>([]);
  const [routeMeta, setRouteMeta] = useState<{ distance: number; duration: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // recompute road route whenever stops change
  useEffect(() => {
    if (stops.length < 2) {
      setPolyline([]);
      setRouteMeta(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await fetchRoadRoute(stops.map((s) => ({ lat: s.latitude, lng: s.longitude })));
      if (cancelled) return;
      if (r) {
        setPolyline(r.coordinates);
        setRouteMeta({ distance: r.distance, duration: r.duration });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stops]);

  const addStop = (lat: number, lng: number, name?: string) => {
    setStops((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        stop_name: name ?? `Stop ${prev.length + 1}`,
        latitude: lat,
        longitude: lng,
      },
    ]);
  };

  const runSearch = async () => {
    if (!searchQ.trim()) return;
    const r = await geocodeSearch(searchQ);
    setSearchResults(r);
  };

  const move = (idx: number, dir: -1 | 1) => {
    setStops((prev) => {
      const arr = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= arr.length) return arr;
      [arr[idx], arr[t]] = [arr[t], arr[idx]];
      return arr;
    });
  };

  const save = async () => {
    if (!routeName.trim()) {
      toast.error("Enter a route name");
      return;
    }
    if (stops.length < 2) {
      toast.error("Add at least 2 stops");
      return;
    }
    setSaving(true);
    try {
      // insert stops
      await createRouteFn({
        data: {
          route_name: routeName.trim(),
          stops: stops.map((s) => ({
            stop_name: s.stop_name,
            latitude: s.latitude,
            longitude: s.longitude,
          })),
          total_distance: routeMeta?.distance ?? null,
          estimated_duration: routeMeta ? Math.round(routeMeta.duration) : null,
          route_geometry: polyline,
        },
      });

      qc.invalidateQueries({ queryKey: ["routes"] });
      toast.success("Route saved");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const mapStops = useMemo(
    () =>
      stops.map((s, i) => ({
        id: s.tempId,
        name: s.stop_name,
        lat: s.latitude,
        lng: s.longitude,
        kind: (i === 0 ? "start" : i === stops.length - 1 ? "end" : "stop") as
          "start" | "end" | "stop",
      })),
    [stops],
  );

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="border-b p-4 flex items-center gap-3">
        <input
          value={routeName}
          onChange={(e) => setRouteName(e.target.value)}
          placeholder="Route name (e.g. City Center ↔ Airport)"
          className="flex-1 max-w-md px-3 py-2 rounded-lg border bg-background text-sm"
        />
        <div className="text-sm text-muted-foreground hidden md:block">
          {stops.length} stop{stops.length !== 1 ? "s" : ""} · {fmtDistance(routeMeta?.distance)} ·{" "}
          {fmtDuration(routeMeta?.duration)}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="ml-auto bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save route"}
        </button>
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="md:w-96 border-r flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="Search a place…"
                  className="w-full pl-7 pr-2 py-2 rounded-lg border bg-background text-sm"
                />
              </div>
              <button onClick={runSearch} className="px-3 py-2 rounded-lg bg-secondary text-sm">
                Go
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 bg-card border rounded-lg max-h-40 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      addStop(r.lat, r.lng, r.name.split(",")[0]);
                      setSearchResults([]);
                      setSearchQ("");
                    }}
                    className="w-full text-left p-2 text-xs hover:bg-muted border-b last:border-0"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              💡 Click on the map to add stops. Drag pins to adjust.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {stops.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">No stops yet.</div>
            )}
            {stops.map((s, i) => (
              <div key={s.tempId} className="bg-card border rounded-lg p-2 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
                  {i === 0 ? "A" : i === stops.length - 1 ? "B" : i}
                </div>
                <input
                  value={s.stop_name}
                  onChange={(e) =>
                    setStops((prev) =>
                      prev.map((p) =>
                        p.tempId === s.tempId ? { ...p, stop_name: e.target.value } : p,
                      ),
                    )
                  }
                  className="flex-1 min-w-0 px-2 py-1 rounded border bg-background text-xs"
                />
                <button
                  onClick={() => move(i, -1)}
                  className="p-1 hover:bg-muted rounded"
                  disabled={i === 0}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  className="p-1 hover:bg-muted rounded"
                  disabled={i === stops.length - 1}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  onClick={() => setStops((prev) => prev.filter((p) => p.tempId !== s.tempId))}
                  className="p-1 hover:bg-muted rounded text-destructive"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 relative">
          <MapView
            stops={mapStops}
            polyline={polyline}
            onMapClick={(lat, lng) => addStop(lat, lng)}
            onMarkerDrag={(id, lat, lng) =>
              setStops((prev) =>
                prev.map((p) => (p.tempId === id ? { ...p, latitude: lat, longitude: lng } : p)),
              )
            }
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
