delete from public.driver_locations existing
using public.driver_locations newer
where existing.trip_id = newer.trip_id
  and existing.driver_id = newer.driver_id
  and existing.bus_id = newer.bus_id
  and (
    existing.recorded_at < newer.recorded_at
    or (existing.recorded_at = newer.recorded_at and existing.id < newer.id)
  );

create unique index if not exists driver_locations_live_trip_driver_bus_key
on public.driver_locations (trip_id, driver_id, bus_id);
