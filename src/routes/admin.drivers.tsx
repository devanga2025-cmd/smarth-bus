import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client"; // Keep this import
import { Tables, Constants, Enums } from "@/integrations/supabase/types"; // Add these imports
import { Plus, Search, Trash2, Pencil, X, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "./admin.buses";
import {
  adminCreateDriver,
  adminUpdateDriver,
  adminDeleteDriver,
  adminResetDriverPin,
  adminListDrivers,
} from "@/lib/driver-auth.functions";
import {
  createDriverWithConfirmationSchema,
  normalizeDriverPhone,
  updateDriverSchema,
} from "@/lib/driver-schemas";

export const Route = createFileRoute("/admin/drivers")({ component: DriversPage });

type Driver = Tables<"drivers">; // Use the generated type for the 'drivers' table

// Derive STATUSES directly from the generated Constants for consistency
const STATUSES = Constants.public.Enums.driver_status;
const WEAK_PINS = new Set([
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "1234",
  "4321",
  "1212",
  "2121",
  "1122",
  "2211",
  "0123",
  "9876",
]);

function suggest(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function DriversPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Partial<Driver> | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const listFn = useServerFn(adminListDrivers);
  const createFn = useServerFn(adminCreateDriver);
  const updateFn = useServerFn(adminUpdateDriver);
  const deleteFn = useServerFn(adminDeleteDriver);
  const resetFn = useServerFn(adminResetDriverPin);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      return (await listFn()) as unknown as Driver[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["active-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bus_driver_assignments")
        .select("driver_id,bus_id,buses(bus_number)")
        .eq("is_active", true);
      if (error) throw error;
      return data as { driver_id: string; bus_id: string; buses: { bus_number: string } | null }[];
    },
  });

  const save = useMutation({
    mutationFn: async (d: Partial<Driver> & { pin?: string; pin_confirm?: string }) => {
      if (d.id) {
        await updateFn({
          data: {
            id: d.id,
            name: d.name!,
            login_name: d.login_name!,
            phone: d.phone!,
            licence_number: d.licence_number!,
            licence_expiry: d.licence_expiry ?? null,
            address: d.address ?? null,
            status: d.status!,
            is_active: !!d.is_active,
          },
        });
      } else {
        await createFn({
          data: {
            name: d.name!,
            login_name: d.login_name!,
            phone: d.phone!,
            licence_number: d.licence_number!,
            licence_expiry: d.licence_expiry ?? null,
            address: d.address ?? null,
            status: d.status ?? "available",
            is_active: d.is_active ?? true,
            pin: d.pin!,
            pin_confirm: d.pin_confirm!,
          },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteFn({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPin = useMutation({
    mutationFn: async (v: { id: string; pin: string; pin_confirm: string }) => {
      await resetFn({ data: v });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      setResettingId(null);
      toast.success("PIN reset. All sessions revoked.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = drivers.filter((d) => {
    const q = search.toLowerCase();
    const loginName = d.login_name ?? suggest(d.name);
    const m =
      !q ||
      d.name.toLowerCase().includes(q) ||
      loginName.toLowerCase().includes(q) ||
      d.phone.includes(q) ||
      d.licence_number.toLowerCase().includes(q);
    const s = statusFilter === "all" || d.status === statusFilter;
    return m && s;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Drivers</h1>
          <p className="text-muted-foreground text-sm">
            {drivers.length} driver{drivers.length !== 1 ? "s" : ""} · unique 4-digit PIN per driver
          </p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> Add driver
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
            placeholder="Search name, login, phone…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-background text-sm"
        >
          <option value="all">All</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">👤</div>
            <div className="font-medium">No drivers</div>
            <div className="text-sm text-muted-foreground mt-1">Add your first driver.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Login</th>
                  <th className="p-3 font-medium">Phone</th>
                  <th className="p-3 font-medium">Assigned bus</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Lock</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const assigned = assignments.find((a) => a.driver_id === d.id);
                  const locked = d.locked_until && new Date(d.locked_until) > new Date();
                  return (
                    <tr key={d.id} className="border-t">
                      <td className="p-3 font-medium">
                        {d.name}
                        {!d.is_active && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            inactive
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs">{d.login_name ?? suggest(d.name)}</td>
                      <td className="p-3 text-muted-foreground">{d.phone}</td>
                      <td className="p-3">
                        {assigned?.buses?.bus_number ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="p-3 text-xs">
                        {locked ? (
                          <span className="text-destructive">locked</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setResettingId(d.id)}
                            className="p-2 hover:bg-muted rounded"
                            title="Reset PIN"
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            onClick={() => setEditing(d)}
                            className="p-2 hover:bg-muted rounded"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${d.name}?`)) remove.mutate(d.id);
                            }}
                            className="p-2 hover:bg-muted rounded text-destructive"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <DriverDialog
          value={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => save.mutate(v)}
          saving={save.isPending}
        />
      )}
      {resettingId && (
        <ResetPinDialog
          onClose={() => setResettingId(null)}
          onSave={(pin, confirm) => resetPin.mutate({ id: resettingId, pin, pin_confirm: confirm })}
          saving={resetPin.isPending}
        />
      )}
    </div>
  );
}

function DriverDialog({
  value,
  onClose,
  onSave,
  saving,
}: {
  value: Partial<Driver>;
  onClose: () => void;
  onSave: (v: Partial<Driver> & { pin?: string; pin_confirm?: string }) => void;
  saving: boolean;
}) {
  const isNew = !value.id;
  const [f, setF] = useState<Partial<Driver>>({
    name: "",
    login_name: "",
    phone: "",
    licence_number: "",
    licence_expiry: null,
    address: "",
    status: "available",
    is_active: true,
    ...value,
  });
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [autoLogin, setAutoLogin] = useState(isNew);

  useEffect(() => {
    if (autoLogin && isNew) setF((x) => ({ ...x, login_name: suggest(x.name ?? "") }));
  }, [f.name, autoLogin, isNew]);

  const submit = () => {
    if (isNew) {
      const result = createDriverWithConfirmationSchema.safeParse({
        ...f,
        pin,
        pin_confirm: pinConfirm,
      });
      if (!result.success) return toast.error(result.error.issues[0]?.message ?? "Invalid driver");
      if (WEAK_PINS.has(pin)) return toast.error("Choose a less obvious PIN");
      onSave(result.data);
      return;
    }

    const result = updateDriverSchema.safeParse(f);
    if (!result.success) return toast.error(result.error.issues[0]?.message ?? "Invalid driver");
    onSave(result.data);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{isNew ? "Add" : "Edit"} driver</h3>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <F label="Full name *">
            <input
              value={f.name ?? ""}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              className="inp"
            />
          </F>
          <F label="Login name *">
            <input
              value={f.login_name ?? ""}
              onChange={(e) => {
                setAutoLogin(false);
                setF({ ...f, login_name: e.target.value.toLowerCase() });
              }}
              className="inp font-mono"
              placeholder="e.g. ramesh.kumar"
            />
            <div className="text-[11px] text-muted-foreground mt-1">
              Driver signs in with this + 4-digit PIN. Must be unique.
            </div>
          </F>
          <F label="Phone *">
            <input
              value={f.phone ?? ""}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
              onBlur={(e) => setF({ ...f, phone: normalizeDriverPhone(e.target.value) })}
              inputMode="tel"
              placeholder="9876543210"
              className="inp"
            />
            <div className="text-[11px] text-muted-foreground mt-1">
              Enter a 10-digit mobile number. +91 and spaces are cleaned automatically.
            </div>
          </F>
          <F label="Licence number *">
            <input
              value={f.licence_number ?? ""}
              onChange={(e) => setF({ ...f, licence_number: e.target.value })}
              className="inp"
            />
          </F>
          <F label="Licence expiry">
            <input
              type="date"
              value={f.licence_expiry ?? ""}
              onChange={(e) => setF({ ...f, licence_expiry: e.target.value })}
              className="inp"
            />
          </F>
          <F label="Address">
            <textarea
              value={f.address ?? ""}
              onChange={(e) => setF({ ...f, address: e.target.value })}
              className="inp"
              rows={2}
            />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Status">
              <select
                value={f.status}
                onChange={(e) => setF({ ...f, status: e.target.value as Enums<"driver_status"> })}
                className="inp"
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </F>
            <F label="Active">
              <select
                value={f.is_active ? "yes" : "no"}
                onChange={(e) => setF({ ...f, is_active: e.target.value === "yes" })}
                className="inp"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </F>
          </div>

          {isNew && (
            <>
              <div className="pt-2 border-t">
                <div className="text-xs font-semibold text-foreground mb-2">
                  4-digit PIN (required for login)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <F label="PIN *">
                    <div className="relative">
                      <input
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        maxLength={4}
                        pattern="\d{4}"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="inp pr-9 tracking-widest"
                        placeholder="4827"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </F>
                  <F label="Confirm PIN *">
                    <input
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      maxLength={4}
                      pattern="\d{4}"
                      value={pinConfirm}
                      onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="inp tracking-widest"
                      placeholder="4827"
                    />
                  </F>
                </div>
                <div className="text-[11px] text-muted-foreground mt-2">
                  Store the PIN somewhere safe — after saving it is hashed and cannot be viewed
                  again. Use “Reset PIN” to issue a new one.
                </div>
              </div>
            </>
          )}
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
        <style>{`.inp{width:100%;padding:.5rem .75rem;border-radius:.5rem;border:1px solid var(--color-border);background:var(--color-background);font-size:.875rem}`}</style>
      </div>
    </div>
  );
}

function ResetPinDialog({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (pin: string, confirm: string) => void;
  saving: boolean;
}) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="bg-card rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Reset driver PIN</h3>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <F label="New PIN *">
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="inp pr-9 tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </F>
          <F label="Confirm PIN *">
            <input
              type={show ? "text" : "password"}
              inputMode="numeric"
              maxLength={4}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="inp tracking-widest"
            />
          </F>
          <div className="text-[11px] text-muted-foreground">
            Resetting revokes all active driver sessions.
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!/^\d{4}$/.test(pin)) return toast.error("PIN must be 4 digits");
              if (WEAK_PINS.has(pin)) return toast.error("Choose a less obvious PIN");
              if (pin !== confirm) return toast.error("PINs do not match");
              onSave(pin, confirm);
            }}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Reset PIN"}
          </button>
        </div>
        <style>{`.inp{width:100%;padding:.5rem .75rem;border-radius:.5rem;border:1px solid var(--color-border);background:var(--color-background);font-size:.875rem}`}</style>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium mb-1">{label}</div>
      {children}
    </label>
  );
}
