import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const stopPayload = z.object({
  stop_name: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const routePayload = z.object({
  route_name: z.string().trim().min(1).max(160),
  stops: z.array(stopPayload).min(2),
  total_distance: z.number().nullable().optional(),
  estimated_duration: z.number().int().nullable().optional(),
  route_geometry: z.array(z.tuple([z.number(), z.number()])).default([]),
});

function isMissingRouteStopsTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("route_stops") &&
    (message.includes("Could not find the table") ||
      message.includes("Could not find the 'stop_id' column") ||
      message.includes("schema cache") ||
      message.includes("does not exist"))
  );
}

function routeSchemaMessage() {
  return "Route schema is incomplete. Run supabase/migrations/20260716190000_route_stops_stop_id_repair.sql in the Supabase SQL Editor, then wait a few seconds for Supabase to reload the schema cache.";
}

export const adminListRoutes = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("routes")
    .select("id,route_name,total_distance,estimated_duration,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
});

export const adminCreateRoute = createServerFn({ method: "POST" })
  .inputValidator((raw) => routePayload.parse(raw))
  .handler(async ({ data }) => {
    const routeName = data.route_name.trim();
    const existingRoute = await supabaseAdmin
      .from("routes")
      .select("id")
      .ilike("route_name", routeName)
      .maybeSingle();

    if (existingRoute.error) throw new Error(existingRoute.error.message);
    if (existingRoute.data) {
      throw new Error(`Route "${routeName}" already exists. Please use a different route name.`);
    }

    const stopInserts = await supabaseAdmin.from("stops").insert(data.stops).select("id");

    if (stopInserts.error) throw new Error(stopInserts.error.message);
    const insertedStops = stopInserts.data as { id: string }[];

    const routeInsert = await supabaseAdmin
      .from("routes")
      .insert({
        route_name: routeName,
        start_stop_id: insertedStops[0].id,
        end_stop_id: insertedStops[insertedStops.length - 1].id,
        total_distance: data.total_distance ?? null,
        estimated_duration: data.estimated_duration ?? null,
        route_geometry: data.route_geometry as never,
      } as never)
      .select("id")
      .single();

    if (routeInsert.error) {
      if (
        routeInsert.error.code === "23505" ||
        routeInsert.error.message.includes("routes_route_name_key")
      ) {
        throw new Error(`Route "${routeName}" already exists. Please use a different route name.`);
      }
      throw new Error(routeInsert.error.message);
    }
    const route = routeInsert.data as { id: string };

    const routeStops = insertedStops.map((stop, index) => ({
      route_id: route.id,
      stop_id: stop.id,
      stop_order: index + 1,
    }));

    const routeStopsInsert = await supabaseAdmin.from("route_stops").insert(routeStops);
    if (routeStopsInsert.error) {
      await supabaseAdmin.from("routes").delete().eq("id", route.id);
      await supabaseAdmin
        .from("stops")
        .delete()
        .in(
          "id",
          insertedStops.map((stop) => stop.id),
        );

      if (isMissingRouteStopsTable(routeStopsInsert.error)) {
        throw new Error(routeSchemaMessage());
      }
      throw new Error(routeStopsInsert.error.message);
    }

    return { id: route.id };
  });

export const adminDeleteRoute = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("routes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
