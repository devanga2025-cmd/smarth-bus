import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const tripActionPayload = z.object({
  tripId: z.string().uuid(),
  busId: z.string().uuid(),
  driverId: z.string().uuid(),
});

async function updateBusStatus(busId: string, status: "available" | "assigned") {
  const { error } = await supabaseAdmin
    .from("buses")
    .update({ status } as never)
    .eq("id", busId);

  if (error) throw new Error(`Unable to update bus status: ${error.message}`);
}

async function updateDriverStatus(driverId: string, status: "available" | "on_trip") {
  const { error } = await supabaseAdmin
    .from("drivers")
    .update({ status } as never)
    .eq("id", driverId);

  if (error) throw new Error(`Unable to update driver status: ${error.message}`);
}

export const startTrip = createServerFn({ method: "POST" })
  .inputValidator((raw) => tripActionPayload.parse(raw))
  .handler(async ({ data }) => {
    const now = new Date().toISOString();

    const tripUpdate = await supabaseAdmin
      .from("trips")
      .update({
        status: "active",
        actual_start_time: now,
        actual_end_time: null,
      } as never)
      .eq("id", data.tripId)
      .eq("driver_id", data.driverId)
      .select("id")
      .single();

    if (tripUpdate.error) throw new Error(`Unable to start trip: ${tripUpdate.error.message}`);
    if (!tripUpdate.data) throw new Error("Trip was not started.");

    await updateBusStatus(data.busId, "assigned");
    await updateDriverStatus(data.driverId, "on_trip");
    return { ok: true };
  });

export const endTrip = createServerFn({ method: "POST" })
  .inputValidator((raw) => tripActionPayload.parse(raw))
  .handler(async ({ data }) => {
    const now = new Date().toISOString();

    const tripUpdate = await supabaseAdmin
      .from("trips")
      .update({
        status: "completed",
        actual_end_time: now,
      } as never)
      .eq("id", data.tripId)
      .eq("driver_id", data.driverId)
      .select("id")
      .single();

    if (tripUpdate.error) throw new Error(`Unable to end trip: ${tripUpdate.error.message}`);
    if (!tripUpdate.data) throw new Error("Trip was not completed.");

    await updateBusStatus(data.busId, "available");
    await updateDriverStatus(data.driverId, "available");
    return { ok: true };
  });
