import { supabase } from "@/integrations/supabase/client";

import type { DriverLocationInput } from "@/types/app"; // Updated import path

import { isValidCoordinate, type Coordinates } from "@/lib/geo"; // Updated import path

import { haversine } from "@/lib/routing"; // Using existing haversine

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
  onLocation?: (position: GeolocationPosition) => void;
  onError?: (error: GeolocationPositionError) => void;
}

async function saveDriverLocation(location: DriverLocationInput): Promise<void> {
  const { error } = await supabase.from("driver_locations").insert(location);

  if (error) {
    throw new Error(`Location update failed: ${error.message}`);
  }
}

export function startBrowserTracking({
  tripId,
  driverId,
  busId,
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
    const {
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      altitude,
      // battery_level, place_name are not directly from GeolocationCoordinates
    } = position.coords;

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
      await saveDriverLocation({
        trip_id: tripId,
        driver_id: driverId,
        bus_id: busId,
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        speed: speed !== null && Number.isFinite(speed) ? Math.max(0, speed) : null,
        heading: heading !== null && Number.isFinite(heading) ? heading : null,
        altitude: altitude !== null && Number.isFinite(altitude) ? altitude : null,
        battery_level: null, // GeolocationPosition does not provide battery_level
        place_name: null, // GeolocationPosition does not provide place_name
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
