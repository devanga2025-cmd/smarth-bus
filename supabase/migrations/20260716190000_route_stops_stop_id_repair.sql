-- Repair route_stops when an older table exists without stop_id.
-- Safe to run more than once.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid,
  stop_id uuid,
  stop_order integer not null default 1,
  expected_arrival_offset integer,
  distance_from_route_start double precision
);

alter table public.route_stops
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists route_id uuid,
  add column if not exists stop_id uuid,
  add column if not exists stop_order integer not null default 1,
  add column if not exists expected_arrival_offset integer,
  add column if not exists distance_from_route_start double precision;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'route_stops'
      and column_name = 'stop'
  ) then
    execute 'update public.route_stops set stop_id = stop where stop_id is null and stop is not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'route_stops'
      and column_name = 'stops_id'
  ) then
    execute 'update public.route_stops set stop_id = stops_id where stop_id is null and stops_id is not null';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'route_stops_route_id_fkey'
      and conrelid = 'public.route_stops'::regclass
  ) then
    alter table public.route_stops
      add constraint route_stops_route_id_fkey
      foreign key (route_id) references public.routes(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'route_stops_stop_id_fkey'
      and conrelid = 'public.route_stops'::regclass
  ) then
    alter table public.route_stops
      add constraint route_stops_stop_id_fkey
      foreign key (stop_id) references public.stops(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'route_stops_order_positive'
      and conrelid = 'public.route_stops'::regclass
  ) then
    alter table public.route_stops
      add constraint route_stops_order_positive
      check (stop_order > 0);
  end if;
end $$;

create unique index if not exists route_stops_route_order_key
  on public.route_stops(route_id, stop_order);

create unique index if not exists route_stops_route_stop_key
  on public.route_stops(route_id, stop_id);

create index if not exists route_stops_route_id_idx
  on public.route_stops(route_id);

create index if not exists route_stops_stop_id_idx
  on public.route_stops(stop_id);

alter table public.route_stops enable row level security;

drop policy if exists "Allow public read route stops" on public.route_stops;
create policy "Allow public read route stops"
  on public.route_stops
  for select
  using (true);

drop policy if exists "Allow authenticated write route stops" on public.route_stops;
create policy "Allow authenticated write route stops"
  on public.route_stops
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
