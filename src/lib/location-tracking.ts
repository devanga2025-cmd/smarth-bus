import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { TablesInsert } from "@/integrations/supabase/types";

import { isValidCoordinate, type Coordinates } from "@/lib/geo";

import { haversine } from "@/lib/routing";

const MINIMUM_INTERVAL_MS = 4_000;
const MINIMUM_MOVEMENT_METERS = 10;
const MAXIMUM_ACCEPTABLE_ACCURACY_METERS = 150;

let watchId: number | null = null;
let lastSavedCoordinate: Coordinates | null = null;
let lastSavedAt = 0;

interface StartTrackingArguments {
  tripId: string;
  driverId: string;
  busId: string;
  saveLocation?: (location: DriverLocationInput) => Promise<void>;
  onLocation?: (position: GeolocationPosition) => void;
  onError?: (error: GeolocationPositionError) => void;
}

type DriverLocationInput = TablesInsert<"driver_locations">;

const driverLocationPayload = z.object({
  trip_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  bus_id: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  recorded_at: z.string().datetime().optional(),
});

export const saveDriverLocation = createServerFn({ method: "POST" })
  .inputValidator((raw) => driverLocationPayload.parse(raw))
  .handler(async ({ data }) => {
    const { data: trip, error: tripError } = await supabaseAdmin
      .from("trips")
      .select("id")
      .eq("id", data.trip_id)
      .eq("driver_id", data.driver_id)
      .eq("bus_id", data.bus_id)
      .in("status", ["active", "delayed"])
      .single();

    if (tripError || !trip) {
      throw new Error("Location rejected because the trip is not active for this driver.");
    }

    const { error } = await supabaseAdmin.from("driver_locations").insert(data);

    if (error) {
      throw new Error(`Location update failed: ${error.message}`);
    }

    return { ok: true };
  });

async function saveDriverLocationFromBrowser(location: DriverLocationInput): Promise<void> {
  const { error } = await supabase.from("driver_locations").insert(location);

  if (error) {
    throw new Error(`Location update failed: ${error.message}`);
  }
}

export function startBrowserTracking({
  tripId,
  driverId,
  busId,
  saveLocation,
  onLocation,
  onError,
}: StartTrackingArguments): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;

  if (!navigator.geolocation) {
    throw new Error("This browser does not support geolocation.");
  }

  if (!window.isSecureContext) {
    throw new Error(
      "Location requires a secure browser context. Use HTTPS or localhost for driver tracking.",
    );
  }

  if (watchId !== null) {
    return;
  }

  const handlePosition = async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;

    if (!isValidCoordinate(latitude, longitude)) {
      return;
    }

    // Always update the UI with a valid browser location, even if it is too coarse to save.
    onLocation?.(position);

    if (Number.isFinite(accuracy) && accuracy > MAXIMUM_ACCEPTABLE_ACCURACY_METERS) {
      return;
    }

    const currentCoordinate: Coordinates = {
      latitude,
      longitude,
    };

    const now = Date.now();

    const elapsedTime = now - lastSavedAt;

    const movementDistance =
      lastSavedCoordinate === null
        ? Number.POSITIVE_INFINITY
        : haversine(
            { lat: lastSavedCoordinate.latitude, lng: lastSavedCoordinate.longitude },
            { lat: currentCoordinate.latitude, lng: currentCoordinate.longitude },
          );

    const enoughTimePassed = elapsedTime >= MINIMUM_INTERVAL_MS;

    const meaningfulMovement = movementDistance >= MINIMUM_MOVEMENT_METERS;

    if (lastSavedCoordinate !== null && !enoughTimePassed && !meaningfulMovement) {
      return;
    }

    try {
      await (saveLocation ?? saveDriverLocationFromBrowser)({
        trip_id: tripId,
        driver_id: driverId,
        bus_id: busId,
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        speed: speed !== null && Number.isFinite(speed) ? Math.max(0, speed) : null,
        heading: heading !== null && Number.isFinite(heading) ? heading : null,
        recorded_at: new Date(position.timestamp).toISOString(),
      });

      lastSavedCoordinate = currentCoordinate;
      lastSavedAt = now;
    } catch (error) {
      console.error(error);
      // Saving can fail because of RLS/schema issues, but the driver's live browser GPS should still display.
    }
  };

  navigator.geolocation.getCurrentPosition(handlePosition, (error) => onError?.(error), {
    enableHighAccuracy: true,
    maximumAge: 30_000,
    timeout: 20_000,
  });

  watchId = navigator.geolocation.watchPosition(
    handlePosition,
    (error) => {
      onError?.(error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 15_000,
      timeout: 30_000,
    },
  );
}

export function stopBrowserTracking(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }

  watchId = null;
  lastSavedCoordinate = null;
  lastSavedAt = 0;
}
