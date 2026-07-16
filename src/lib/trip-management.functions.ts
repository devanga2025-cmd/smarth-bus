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

function shortId(id: string) {
  return id ? id.slice(0, 8) : "";
}

function normalizeDriver(row: Row | undefined, id: string) {
  if (!row) return { id, name: `Driver ${shortId(id)}`, phone: "" };
  return {
    id: text(row.id) || id,
    name: labelFrom(
      row,
      ["name", "driver_name", "full_name", "login_name", "phone"],
      `Driver ${shortId(id)}`,
    ),
    phone: text(row.phone),
  };
}

function normalizeBus(row: Row | undefined, id: string) {
  if (!row) return { id, bus_number: `Bus ${shortId(id)}`, bus_name: "" };
  return {
    id: text(row.id) || id,
    bus_number: labelFrom(row, ["bus_number", "registration_number"], `Bus ${shortId(id)}`),
    bus_name: text(row.bus_name),
  };
}

function normalizeRoute(row: Row | undefined, id: string) {
  if (!row) return { id, route_name: `Route ${shortId(id)}` };
  return {
    id: text(row.id) || id,
    route_name: labelFrom(row, ["route_name", "name"], `Route ${shortId(id)}`),
  };
}

async function lookupByIds(table: "buses" | "drivers" | "routes", ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, Row>();

  const { data, error } = await supabaseAdmin.from(table).select("*").in("id", uniqueIds);
  if (error) throw new Error(error.message);

  return new Map(((data ?? []) as Row[]).map((row) => [text(row.id), row]));
}

export const adminListTrips = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("trips")
    .select("*")
    .order("scheduled_start_time", { ascending: false });

  if (error) throw new Error(error.message);

  const trips = (data ?? []) as Row[];
  const [routes, buses, drivers] = await Promise.all([
    lookupByIds(
      "routes",
      trips.map((trip) => text(trip.route_id)),
    ),
    lookupByIds(
      "buses",
      trips.map((trip) => text(trip.bus_id)),
    ),
    lookupByIds(
      "drivers",
      trips.map((trip) => text(trip.driver_id)),
    ),
  ]);

  return trips.map((trip) => {
    const routeId = text(trip.route_id);
    const busId = text(trip.bus_id);
    const driverId = text(trip.driver_id);

    return {
      id: text(trip.id),
      status: text(trip.status),
      scheduled_start_time: text(trip.scheduled_start_time),
      routes: normalizeRoute(routes.get(routeId), routeId),
      buses: normalizeBus(buses.get(busId), busId),
      drivers: normalizeDriver(drivers.get(driverId), driverId),
    };
  });
});

export const adminListTripOptions = createServerFn({ method: "GET" }).handler(async () => {
  const [routesResult, assignmentsResult] = await Promise.all([
    supabaseAdmin.from("routes").select("*").order("created_at", { ascending: false }),
    supabaseAdmin
      .from("bus_driver_assignments")
      .select("*")
      .eq("is_active", true)
      .order("assigned_at", { ascending: false }),
  ]);

  if (routesResult.error) throw new Error(routesResult.error.message);
  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);

  const assignments = (assignmentsResult.data ?? []) as Row[];
  const [buses, drivers] = await Promise.all([
    lookupByIds(
      "buses",
      assignments.map((assignment) => text(assignment.bus_id)),
    ),
    lookupByIds(
      "drivers",
      assignments.map((assignment) => text(assignment.driver_id)),
    ),
  ]);

  return {
    routes: ((routesResult.data ?? []) as Row[]).map((route) =>
      normalizeRoute(route, text(route.id)),
    ),
    assignments: assignments.map((assignment) => {
      const busId = text(assignment.bus_id);
      const driverId = text(assignment.driver_id);
      return {
        id: text(assignment.id),
        bus_id: busId,
        driver_id: driverId,
        buses: normalizeBus(buses.get(busId), busId),
        drivers: normalizeDriver(drivers.get(driverId), driverId),
      };
    }),
  };
});

export const adminCreateTrip = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        route_id: z.string().uuid(),
        bus_id: z.string().uuid(),
        driver_id: z.string().uuid(),
        scheduled_start_time: z.string().datetime(),
        expected_end_time: z.string().datetime().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("trips").insert({
      route_id: data.route_id,
      bus_id: data.bus_id,
      driver_id: data.driver_id,
      scheduled_start_time: data.scheduled_start_time,
      expected_end_time: data.expected_end_time,
      status: "scheduled",
    } as never);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTrip = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("trips").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
