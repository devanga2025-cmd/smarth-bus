import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "./admin.buses";
import {
  adminCreateTrip,
  adminDeleteTrip,
  adminListTripOptions,
  adminListTrips,
} from "@/lib/trip-management.functions";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/trips")({ component: TripsPage });

type TripRow = {
  id: string;
  status: string;
  scheduled_start_time: string;
  routes: { id: string; route_name: string } | null;
  buses: { id: string; bus_number: string; bus_name: string } | null;
  drivers: { id: string; name: string; phone: string } | null;
};

function TripsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const listTrips = useServerFn(adminListTrips);
  const deleteTrip = useServerFn(adminDeleteTrip);

  const { data: trips = [] } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => (await listTrips()) as TripRow[],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await deleteTrip({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Trips</h1>
          <p className="text-muted-foreground text-sm">Schedule and monitor trips.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus size={16} /> New trip
        </button>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {trips.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">No trips</div>
            <div className="font-medium">No trips scheduled</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Route</th>
                <th className="p-3 font-medium">Bus</th>
                <th className="p-3 font-medium">Driver</th>
                <th className="p-3 font-medium">Scheduled</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => (
                <tr key={trip.id} className="border-t">
                  <td className="p-3 font-medium">{trip.routes?.route_name}</td>
                  <td className="p-3">{trip.buses?.bus_number}</td>
                  <td className="p-3">{trip.drivers?.name}</td>
                  <td className="p-3 text-muted-foreground">
                    {fmtDateTime(trip.scheduled_start_time)}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={trip.status} />
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm("Delete trip?")) del.mutate(trip.id);
                      }}
                      className="p-2 hover:bg-muted rounded text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && <NewTripDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewTripDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const listTripOptions = useServerFn(adminListTripOptions);
  const createTrip = useServerFn(adminCreateTrip);
  const [routeId, setRouteId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 30 * 60000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [endWhen, setEndWhen] = useState("");

  const { data, error, isLoading } = useQuery({
    queryKey: ["trip-options"],
    queryFn: () => listTripOptions(),
  });

  const routes = data?.routes ?? [];
  const assignments = data?.assignments ?? [];

  const create = useMutation({
    mutationFn: async () => {
      if (!routeId || !assignmentId || !when) throw new Error("Fill all required fields");
      const assignment = assignments.find((item) => item.id === assignmentId);
      if (!assignment) throw new Error("Invalid assignment");
      await createTrip({
        data: {
          route_id: routeId,
          bus_id: assignment.bus_id,
          driver_id: assignment.driver_id,
          scheduled_start_time: new Date(when).toISOString(),
          expected_end_time: endWhen ? new Date(endWhen).toISOString() : null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Trip scheduled");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="bg-card rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">New trip</h3>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <div className="text-xs font-medium mb-1">Route *</div>
            <select value={routeId} onChange={(e) => setRouteId(e.target.value)} className="inp">
              <option value="">
                {isLoading
                  ? "Loading routes..."
                  : routes.length === 0
                    ? "No routes found"
                    : "Select route..."}
              </option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.route_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium mb-1">Bus &amp; Driver (active assignment) *</div>
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              className="inp"
            >
              <option value="">
                {isLoading
                  ? "Loading assignments..."
                  : assignments.length === 0
                    ? "No active assignments found"
                    : "Select assignment..."}
              </option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.buses?.bus_number} - {assignment.drivers?.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-medium mb-1">Scheduled start *</div>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="inp"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium mb-1">Expected end</div>
            <input
              type="datetime-local"
              value={endWhen}
              onChange={(e) => setEndWhen(e.target.value)}
              className="inp"
            />
          </label>
        </div>
        {error && <div className="text-sm text-destructive mt-3">{error.message}</div>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {create.isPending ? "Creating..." : "Create"}
          </button>
        </div>
        <style>{`.inp{width:100%;padding:.5rem .75rem;border-radius:.5rem;border:1px solid var(--color-border);background:var(--color-background);font-size:.875rem}`}</style>
      </div>
    </div>
  );
}
