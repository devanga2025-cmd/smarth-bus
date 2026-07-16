import type { Json, Enums } from "@/integrations/supabase/types";

// This interface defines the structure of a trip object that includes joined data
// from routes, buses, drivers, and current_stop_id's stop_name, as typically fetched in the application.
// The 'phone' property on 'drivers' is optional to accommodate queries that might not select it.
export interface PublicActiveTrip {
  id: string;
  status: Enums<'trip_status'>;
  scheduled_start_time: string;
  actual_start_time: string | null;
  delay_minutes: number | null;
  route_id: string;
  bus_id: string;
  driver_id: string;
  routes: { id: string; route_name: string; route_geometry: Json } | null;
  buses: { bus_number: string; bus_name: string } | null;
  drivers: { name: string; phone?: string } | null;
  current_stop_id: string | null;
  next_stop_id: string | null;
  expected_end_time: string | null;
  actual_end_time: string | null;
  created_at: string;
  updated_at: string;
  // This 'stops' property is the result of the join on `current_stop_id`
  // with the alias `stops!trips_current_stop_id_fkey` used in track.$tripId.tsx
  stops: { stop_name: string } | null;
}