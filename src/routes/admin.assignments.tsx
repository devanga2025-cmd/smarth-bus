import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Link2, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateAssignment,
  adminListAssignmentData,
  adminUnassignDriver,
} from "@/lib/assignment-management.functions";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/assignments")({
  component: AssignmentsPage,
});

type AssignmentRow = {
  id: string;
  bus_id: string;
  driver_id: string;
  assigned_at: string;
  unassigned_at: string | null;
  is_active: boolean;
  buses: { id: string; bus_number: string; bus_name: string } | null;
  drivers: { id: string; name: string; phone: string } | null;
};

function AssignmentsPage() {
  const qc = useQueryClient();
  const [busId, setBusId] = useState("");
  const [driverId, setDriverId] = useState("");
  const listAssignmentData = useServerFn(adminListAssignmentData);
  const createAssignment = useServerFn(adminCreateAssignment);
  const unassignDriver = useServerFn(adminUnassignDriver);

  const { data, error, isLoading } = useQuery({
    queryKey: ["assignment-data"],
    queryFn: () => listAssignmentData(),
  });

  const buses = data?.buses ?? [];
  const drivers = data?.drivers ?? [];
  const assignments = (data?.assignments ?? []) as AssignmentRow[];
  const activeBusIds = new Set(assignments.filter((a) => a.is_active).map((a) => a.bus_id));
  const activeDriverIds = new Set(assignments.filter((a) => a.is_active).map((a) => a.driver_id));

  const create = useMutation({
    mutationFn: async () => {
      if (!busId || !driverId) throw new Error("Select a bus and a driver");
      await createAssignment({ data: { bus_id: busId, driver_id: driverId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment-data"] });
      setBusId("");
      setDriverId("");
      toast.success("Assignment created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unassign = useMutation({
    mutationFn: async (assignment: { id: string; bus_id: string; driver_id: string }) => {
      await unassignDriver({ data: assignment });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment-data"] });
      toast.success("Unassigned");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Bus &amp; Driver Assignments</h1>
        <p className="text-muted-foreground text-sm">Assign one driver to one bus at a time.</p>
      </div>

      <div className="bg-card border rounded-xl p-5 mb-6">
        <div className="text-sm font-semibold mb-3">Create assignment</div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs mb-1">Bus</div>
            <select
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            >
              <option value="">
                {isLoading
                  ? "Loading buses..."
                  : buses.length === 0
                    ? "No buses found"
                    : "Select bus..."}
              </option>
              {buses
                .filter((bus) => !activeBusIds.has(bus.id))
                .map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.bus_number}
                    {bus.bus_name ? ` - ${bus.bus_name}` : ""}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs mb-1">Driver</div>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            >
              <option value="">
                {isLoading
                  ? "Loading drivers..."
                  : drivers.length === 0
                    ? "No drivers found"
                    : "Select driver..."}
              </option>
              {drivers
                .filter((driver) => !activeDriverIds.has(driver.id))
                .map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                    {driver.phone ? ` - ${driver.phone}` : ""}
                  </option>
                ))}
            </select>
          </div>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !busId || !driverId}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Plus size={16} /> Assign
          </button>
        </div>
        {error && <div className="text-sm text-destructive mt-3">{error.message}</div>}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-semibold">Assignment history</div>
        {assignments.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No assignments yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Bus</th>
                <th className="p-3 font-medium">Driver</th>
                <th className="p-3 font-medium">Assigned</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="border-t">
                  <td className="p-3">
                    <Link2 size={12} className="inline mr-1" />
                    {assignment.buses?.bus_number ?? assignment.bus_id}
                    {assignment.buses?.bus_name ? ` - ${assignment.buses.bus_name}` : ""}
                  </td>
                  <td className="p-3">{assignment.drivers?.name ?? assignment.driver_id}</td>
                  <td className="p-3 text-muted-foreground">
                    {fmtDateTime(assignment.assigned_at)}
                  </td>
                  <td className="p-3">
                    {assignment.is_active ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-muted-foreground">
                        Ended {fmtDateTime(assignment.unassigned_at)}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {assignment.is_active && (
                      <button
                        onClick={() => {
                          if (confirm("Unassign?")) {
                            unassign.mutate({
                              id: assignment.id,
                              bus_id: assignment.bus_id,
                              driver_id: assignment.driver_id,
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:bg-muted px-2 py-1 rounded"
                      >
                        <Unlink size={12} /> Unassign
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
