import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Row = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function labelFrom(row: Row | undefined, keys: string[], fallback: string) {
  if (!row) return fallback;
  for (const key of keys) {
    const value = text(row[key]).trim();
    if (value) return value;
  }
  return fallback;
}

function driverName(row: Row | undefined) {
  return labelFrom(
    row,
    ["name", "driver_name", "full_name", "login_name", "phone", "id"],
    "Driver",
  );
}

function normalizeBus(row: Row) {
  const id = text(row.id);
  return {
    id,
    bus_number: labelFrom(row, ["bus_number", "registration_number", "id"], "Bus"),
    bus_name: labelFrom(row, ["bus_name", "bus_type"], ""),
  };
}

function normalizeDriver(row: Row) {
  const id = text(row.id);
  return {
    id,
    name: driverName(row),
    phone: text(row.phone),
  };
}

function isMissingStatusColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("'status' column") ||
    message.includes("drivers.status does not exist") ||
    message.includes("Could not find the 'status' column")
  );
}

async function updateDriverStatus(driverId: string, status: "available" | "assigned") {
  const { error } = await supabaseAdmin
    .from("drivers")
    .update({ status } as never)
    .eq("id", driverId);

  if (error && !isMissingStatusColumn(error)) throw new Error(error.message);
}

export const adminListAssignmentData = createServerFn({ method: "GET" }).handler(async () => {
  const [busesResult, driversResult, assignmentsResult] = await Promise.all([
    supabaseAdmin.from("buses").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("drivers").select("*").order("created_at", { ascending: false }),
    supabaseAdmin
      .from("bus_driver_assignments")
      .select("*")
      .order("assigned_at", { ascending: false }),
  ]);

  if (busesResult.error) throw new Error(busesResult.error.message);
  if (driversResult.error) throw new Error(driversResult.error.message);
  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);

  const buses = ((busesResult.data ?? []) as Row[]).map(normalizeBus);
  const drivers = ((driversResult.data ?? []) as Row[]).map(normalizeDriver);
  const busById = new Map(buses.map((bus) => [bus.id, bus]));
  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));

  const assignments = ((assignmentsResult.data ?? []) as Row[]).map((assignment) => {
    const busId = text(assignment.bus_id);
    const driverId = text(assignment.driver_id);
    return {
      id: text(assignment.id),
      bus_id: busId,
      driver_id: driverId,
      assigned_at: text(assignment.assigned_at),
      unassigned_at: text(assignment.unassigned_at) || null,
      is_active: assignment.is_active === true,
      buses: busById.get(busId) ?? null,
      drivers: driverById.get(driverId) ?? {
        id: driverId,
        name: driverId || "Driver",
        phone: "",
      },
    };
  });

  return { buses, drivers, assignments };
});

export const adminCreateAssignment = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        bus_id: z.string().uuid(),
        driver_id: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("bus_driver_assignments").insert({
      bus_id: data.bus_id,
      driver_id: data.driver_id,
      is_active: true,
    } as never);

    if (error) throw new Error(error.message);

    const busUpdate = await supabaseAdmin
      .from("buses")
      .update({ status: "assigned" } as never)
      .eq("id", data.bus_id);
    if (busUpdate.error) throw new Error(busUpdate.error.message);

    await updateDriverStatus(data.driver_id, "assigned");
    return { ok: true };
  });

export const adminUnassignDriver = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        bus_id: z.string().uuid(),
        driver_id: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const assignmentUpdate = await supabaseAdmin
      .from("bus_driver_assignments")
      .update({
        is_active: false,
        unassigned_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (assignmentUpdate.error) throw new Error(assignmentUpdate.error.message);

    const busUpdate = await supabaseAdmin
      .from("buses")
      .update({ status: "available" } as never)
      .eq("id", data.bus_id);
    if (busUpdate.error) throw new Error(busUpdate.error.message);

    await updateDriverStatus(data.driver_id, "available");
    return { ok: true };
  });
