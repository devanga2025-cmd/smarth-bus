import type {
  RealtimeChannel,
} from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { PublicActiveTrip } from "@/types/app";

type TripUpdateHandler = (
  trip: PublicActiveTrip,
) => void;

export function subscribeToTrip(
  tripId: string,
  onTripUpdate: TripUpdateHandler,
  onStatusChange?: (status: string) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`trip-${tripId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "trips",
        filter: `id=eq.${tripId}`,
      },
      async (payload) => {
        // When a trip update is received, re-fetch the full trip details
        // including joined tables (routes, buses, drivers, and current stop name)
        // to match PublicActiveTrip interface.
        const { data, error } = await supabase.from("trips")
          .select("*, routes(id,route_name,route_geometry), buses(bus_number,bus_name), drivers(name,phone), stops!trips_current_stop_id_fkey(stop_name)")
          .eq("id", tripId)
          .single();

        if (error) {
          console.error("Error re-fetching trip data for real-time update:", error);
          return;
        }
        if (data) {
          onTripUpdate(data as PublicActiveTrip);
        }
      },
    )
    .subscribe((status) => {
      onStatusChange?.(status);
    });

  return channel;
}

export async function unsubscribeFromTrip(
  channel: RealtimeChannel,
): Promise<void> {
  const result = await supabase.removeChannel(channel);

  if (result === "error") {
    throw new Error(
      "Unable to disconnect from trip updates.",
    );
  }
}