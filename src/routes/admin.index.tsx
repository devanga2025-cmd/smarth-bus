import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bus, Users, Radio, CheckCircle2, Clock, AlertTriangle, Wrench, CircleDot } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function useStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    refetchInterval: 5000,
    queryFn: async () => {
      const [buses, drivers, trips] = await Promise.all([
        supabase.from("buses").select("status,is_active"),
        supabase.from("drivers").select("status,is_active"),
        supabase.from("trips").select("status"),
      ]);
      const b = buses.data ?? [];
      const d = drivers.data ?? [];
      const t = trips.data ?? [];
      return {
        totalBuses: b.length,
        runningBuses: b.filter((x) => x.status === "running").length,
        offlineBuses: b.filter((x) => x.status === "offline").length,
        maintenanceBuses: b.filter((x) => x.status === "maintenance").length,
        totalDrivers: d.length,
        availableDrivers: d.filter((x) => x.status === "available" && x.is_active).length,
        activeTrips: t.filter((x) => x.status === "active").length,
        completedTrips: t.filter((x) => x.status === "completed").length,
        delayedTrips: t.filter((x) => x.status === "delayed").length,
      };
    },
  });
}

function Dashboard() {
  const { data, isLoading } = useStats();
  const stats = [
    { label: "Total buses", value: data?.totalBuses ?? 0, icon: Bus, color: "text-blue-600" },
    { label: "Running", value: data?.runningBuses ?? 0, icon: CircleDot, color: "text-green-600" },
    { label: "Offline", value: data?.offlineBuses ?? 0, icon: Radio, color: "text-slate-500" },
    { label: "Maintenance", value: data?.maintenanceBuses ?? 0, icon: Wrench, color: "text-amber-600" },
    { label: "Total drivers", value: data?.totalDrivers ?? 0, icon: Users, color: "text-purple-600" },
    { label: "Available drivers", value: data?.availableDrivers ?? 0, icon: CheckCircle2, color: "text-green-600" },
    { label: "Active trips", value: data?.activeTrips ?? 0, icon: Radio, color: "text-blue-600" },
    { label: "Completed trips", value: data?.completedTrips ?? 0, icon: CheckCircle2, color: "text-slate-600" },
    { label: "Delayed trips", value: data?.delayedTrips ?? 0, icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Live overview of your fleet.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${s.color}`}>
                <s.icon size={20} />
              </div>
            </div>
            <div className="text-3xl font-bold tabular-nums">{isLoading ? "…" : s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3"><Clock size={16} /><h3 className="font-semibold">Getting started</h3></div>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Create bus stops and a route on the map</li>
            <li>Add buses and drivers</li>
            <li>Assign a driver to a bus</li>
            <li>Schedule a trip</li>
            <li>Driver starts trip &amp; shares GPS</li>
            <li>Monitor live from the Live Monitor page</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
