-- Routes, stops, and route-stop links required by route creation and trip scheduling.
-- Safe to run more than once.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

create table if not exists public.stops (
  id uuid primary key default gen_random_uuid(),
  stop_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.stops
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists stop_name text not null default 'Stop',
  add column if not exists latitude double precision not null default 0,
  add column if not exists longitude double precision not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  route_name text not null,
  start_stop_id uuid references public.stops(id) on delete set null,
  end_stop_id uuid references public.stops(id) on delete set null,
  total_distance double precision,
  estimated_duration integer,
  route_geometry jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.routes
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists route_name text not null default 'Route',
  add column if not exists start_stop_id uuid,
  add column if not exists end_stop_id uuid,
  add column if not exists total_distance double precision,
  add column if not exists estimated_duration integer,
  add column if not exists route_geometry jsonb,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'routes_start_stop_id_fkey'
      and conrelid = 'public.routes'::regclass
  ) then
    alter table public.routes
      add constraint routes_start_stop_id_fkey
      foreign key (start_stop_id) references public.stops(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'routes_end_stop_id_fkey'
      and conrelid = 'public.routes'::regclass
  ) then
    alter table public.routes
      add constraint routes_end_stop_id_fkey
      foreign key (end_stop_id) references public.stops(id) on delete set null;
  end if;
end $$;

create unique index if not exists routes_route_name_key
  on public.routes (route_name);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  stop_id uuid not null references public.stops(id) on delete cascade,
  stop_order integer not null,
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

alter table public.stops enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;

drop policy if exists "Allow public read stops" on public.stops;
create policy "Allow public read stops"
  on public.stops
  for select
  using (true);

drop policy if exists "Allow authenticated write stops" on public.stops;
create policy "Allow authenticated write stops"
  on public.stops
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Allow public read routes" on public.routes;
create policy "Allow public read routes"
  on public.routes
  for select
  using (true);

drop policy if exists "Allow authenticated write routes" on public.routes;
create policy "Allow authenticated write routes"
  on public.routes
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

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
