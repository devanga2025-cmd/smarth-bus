import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Row = Record<string, unknown>;

type RouteMatch = {
  routeId: string;
  fromOrder: number;
  toOrder: number;
  stopsBetween: number;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function label(row: Row | undefined, keys: string[], fallback: string) {
  if (!row) return fallback;
  for (const key of keys) {
    const value = text(row[key]).trim();
    if (value) return value;
  }
  return fallback;
}

async function lookup(table: "routes" | "buses" | "drivers", ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map<string, Row>();
  const { data, error } = await supabaseAdmin.from(table).select("*").in("id", unique);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as Row[]).map((row) => [text(row.id), row]));
}

export const passengerListStops = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("stops")
    .select("id,stop_name,latitude,longitude")
    .order("stop_name");

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const passengerSearchTrips = createServerFn({ method: "POST" })
  .inputValidator((raw) =>
    z
      .object({
        fromId: z.string().uuid(),
        toId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const routeStops = await supabaseAdmin
      .from("route_stops")
      .select("route_id, stop_id, stop_order")
      .in("stop_id", [data.fromId, data.toId]);

    if (routeStops.error) throw new Error(routeStops.error.message);

    const byRoute = new Map<string, { fromOrder?: number; toOrder?: number }>();
    for (const row of (routeStops.data ?? []) as Row[]) {
      const routeId = text(row.route_id);
      const stopId = text(row.stop_id);
      const current = byRoute.get(routeId) ?? {};
      if (stopId === data.fromId) current.fromOrder = Number(row.stop_order);
      if (stopId === data.toId) current.toOrder = Number(row.stop_order);
      byRoute.set(routeId, current);
    }

    const candidateMatches = Array.from(byRoute.entries())
      .filter(([, match]) => match.fromOrder != null && match.toOrder != null)
      .map(([routeId, match]) => ({
        routeId,
        fromOrder: match.fromOrder!,
        toOrder: match.toOrder!,
      }));

    if (candidateMatches.length === 0) return [];

    const stopCountsResult = await supabaseAdmin
      .from("route_stops")
      .select("route_id, stop_order")
      .in(
        "route_id",
        candidateMatches.map((match) => match.routeId),
      );

    if (stopCountsResult.error) throw new Error(stopCountsResult.error.message);

    const routeOrders = new Map<string, number[]>();
    for (const row of (stopCountsResult.data ?? []) as Row[]) {
      const routeId = text(row.route_id);
      const orders = routeOrders.get(routeId) ?? [];
      orders.push(Number(row.stop_order));
      routeOrders.set(routeId, orders);
    }

    const matches: RouteMatch[] = candidateMatches.map((match) => {
      const firstOrder = Math.min(match.fromOrder, match.toOrder);
      const lastOrder = Math.max(match.fromOrder, match.toOrder);
      return {
        ...match,
        stopsBetween: (routeOrders.get(match.routeId) ?? []).filter(
          (order) => order > firstOrder && order < lastOrder,
        ).length,
      };
    });

    const routeIds = matches.map((match) => match.routeId);
    const tripsResult = await supabaseAdmin
      .from("trips")
      .select("*")
      .in("route_id", routeIds)
      .in("status", ["scheduled", "active", "delayed"])
      .order("scheduled_start_time");

    if (tripsResult.error) throw new Error(tripsResult.error.message);

    const trips = (tripsResult.data ?? []) as Row[];
    const [routes, buses, drivers] = await Promise.all([
      lookup(
        "routes",
        trips.map((trip) => text(trip.route_id)),
      ),
      lookup(
        "buses",
        trips.map((trip) => text(trip.bus_id)),
      ),
      lookup(
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
        route_id: routeId,
        status: text(trip.status),
        scheduled_start_time: text(trip.scheduled_start_time),
        routes: { route_name: label(routes.get(routeId), ["route_name"], "Route") },
        buses: {
          bus_number: label(buses.get(busId), ["bus_number", "registration_number"], "Bus"),
          bus_name: label(buses.get(busId), ["bus_name"], ""),
        },
        drivers: { name: label(drivers.get(driverId), ["name", "login_name", "phone"], "Driver") },
        match: matches.find((match) => match.routeId === routeId)!,
      };
    });
  });
