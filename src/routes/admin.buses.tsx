import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Tables, Constants, Enums } from "@/integrations/supabase/types";
import { Plus, Search, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateBus,
  adminDeleteBus,
  adminListBuses,
  adminUpdateBus,
} from "@/lib/bus-management.functions";

export const Route = createFileRoute("/admin/buses")({ component: BusesPage });

type Bus = Tables<"buses">; // Use the generated type for the 'buses' table

// Derive STATUSES directly from the generated Constants for consistency
const STATUSES = Constants.public.Enums.bus_status;

function BusesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Bus> | null>(null);
  const listBusesFn = useServerFn(adminListBuses);
  const createBusFn = useServerFn(adminCreateBus);
  const updateBusFn = useServerFn(adminUpdateBus);
  const deleteBusFn = useServerFn(adminDeleteBus);

  const { data: buses = [], isLoading } = useQuery({
    queryKey: ["buses"],
    queryFn: async () => {
      return (await listBusesFn()) as Bus[];
    },
  });

  const save = useMutation({
    mutationFn: async (b: Partial<Bus>) => {
      const payload = {
        bus_number: b.bus_number!,
        registration_number: b.registration_number!,
        bus_name: b.bus_name!,
        bus_type: b.bus_type || null,
        capacity: b.capacity ?? 40,
        status: b.status ?? "available",
        is_active: b.is_active ?? true,
      };

      if (b.id) {
        await updateBusFn({ data: { id: b.id, ...payload } });
      } else {
        await createBusFn({ data: payload });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buses"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteBusFn({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buses"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = buses.filter((b) => {
    const q = search.toLowerCase();
    const matches =
      !q ||
      b.bus_number.toLowerCase().includes(q) ||
      b.bus_name.toLowerCase().includes(q) ||
      b.registration_number.toLowerCase().includes(q);
    const s = statusFilter === "all" || b.status === statusFilter;
    return matches && s;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Buses</h1>
          <p className="text-muted-foreground text-sm">
            {buses.length} bus{buses.length !== 1 ? "es" : ""} in fleet
          </p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> Add bus
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bus number, name, reg…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🚌</div>
            <div className="font-medium">No buses available</div>
            <div className="text-sm text-muted-foreground mt-1">
              Add your first bus to get started.
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">Bus #</th>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Reg</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Capacity</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Active</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-3 font-mono">{b.bus_number}</td>
                  <td className="p-3">{b.bus_name}</td>
                  <td className="p-3 text-muted-foreground">{b.registration_number}</td>
                  <td className="p-3 text-muted-foreground">{b.bus_type ?? "—"}</td>
                  <td className="p-3">{b.capacity}</td>
                  <td className="p-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="p-3">{b.is_active ? "Yes" : "No"}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(b)} className="p-2 hover:bg-muted rounded">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Remove this bus?")) remove.mutate(b.id);
                        }}
                        className="p-2 hover:bg-muted rounded text-destructive"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <BusDialog
          value={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => save.mutate(v)}
          saving={save.isPending}
        />
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    available: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    offline: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    maintenance: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    on_trip: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    scheduled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    delayed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    completed: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-muted"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function BusDialog({
  value,
  onClose,
  onSave,
  saving,
}: {
  value: Partial<Bus>;
  onClose: () => void;
  onSave: (v: Partial<Bus>) => void;
  saving: boolean;
}) {
  const [f, setF] = useState<Partial<Bus>>({
    bus_number: "",
    registration_number: "",
    bus_name: "",
    bus_type: "",
    capacity: 40,
    status: "available",
    is_active: true,
    ...value,
  });
  const submit = () => {
    if (!f.bus_number || !f.registration_number || !f.bus_name) {
      toast.error("Fill required fields");
      return;
    }
    onSave(f);
  };
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="bg-card rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{value.id ? "Edit" : "Add"} bus</h3>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Bus number *">
            <input
              value={f.bus_number ?? ""}
              onChange={(e) => setF({ ...f, bus_number: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Bus name *">
            <input
              value={f.bus_name ?? ""}
              onChange={(e) => setF({ ...f, bus_name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Registration *">
            <input
              value={f.registration_number ?? ""}
              onChange={(e) => setF({ ...f, registration_number: e.target.value })}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <input
                value={f.bus_type ?? ""}
                onChange={(e) => setF({ ...f, bus_type: e.target.value })}
                className="input"
                placeholder="AC, Non-AC…"
              />
            </Field>
            <Field label="Capacity">
              <input
                type="number"
                value={f.capacity ?? 40}
                onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={f.status}
                onChange={(e) => setF({ ...f, status: e.target.value as Enums<"bus_status"> })}
                className="input"
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Active">
              <select
                value={f.is_active ? "yes" : "no"}
                onChange={(e) => setF({ ...f, is_active: e.target.value === "yes" })}
                className="input"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <style>{`.input{width:100%;padding:.5rem .75rem;border-radius:.5rem;border:1px solid var(--color-border);background:var(--color-background);font-size:.875rem}`}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium mb-1">{label}</div>
      {children}
    </label>
  );
}
