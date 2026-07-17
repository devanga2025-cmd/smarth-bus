alter table public.driver_locations
  alter column trip_id drop not null,
  alter column bus_id drop not null,
  add column if not exists altitude double precision,
  add column if not exists is_online boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update public.driver_locations
set updated_at = coalesce(recorded_at, now())
where updated_at is null;

create index if not exists driver_locations_driver_online_idx
on public.driver_locations (driver_id, is_online, updated_at desc);

delete from public.driver_locations existing
using public.driver_locations newer
where existing.driver_id = newer.driver_id
  and (
    existing.updated_at < newer.updated_at
    or (existing.updated_at = newer.updated_at and existing.id < newer.id)
  );

create unique index if not exists driver_locations_live_driver_key
on public.driver_locations (driver_id);
