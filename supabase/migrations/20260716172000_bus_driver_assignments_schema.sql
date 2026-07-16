-- Bus and driver assignment schema required by the admin assignment/trip pages.
-- Safe to run more than once.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

create table if not exists public.bus_driver_assignments (
  id uuid primary key default gen_random_uuid(),
  bus_id uuid not null references public.buses(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  is_active boolean not null default true
);

alter table public.bus_driver_assignments
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists bus_id uuid,
  add column if not exists driver_id uuid,
  add column if not exists assigned_at timestamptz not null default now(),
  add column if not exists unassigned_at timestamptz,
  add column if not exists is_active boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bus_driver_assignments_bus_id_fkey'
      and conrelid = 'public.bus_driver_assignments'::regclass
  ) then
    alter table public.bus_driver_assignments
      add constraint bus_driver_assignments_bus_id_fkey
      foreign key (bus_id) references public.buses(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'bus_driver_assignments_driver_id_fkey'
      and conrelid = 'public.bus_driver_assignments'::regclass
  ) then
    alter table public.bus_driver_assignments
      add constraint bus_driver_assignments_driver_id_fkey
      foreign key (driver_id) references public.drivers(id) on delete cascade;
  end if;
end $$;

update public.bus_driver_assignments
set is_active = false
where unassigned_at is not null;

create unique index if not exists bus_driver_assignments_one_active_bus_idx
  on public.bus_driver_assignments(bus_id)
  where is_active;

create unique index if not exists bus_driver_assignments_one_active_driver_idx
  on public.bus_driver_assignments(driver_id)
  where is_active;

create index if not exists bus_driver_assignments_driver_id_idx
  on public.bus_driver_assignments(driver_id);

create index if not exists bus_driver_assignments_assigned_at_idx
  on public.bus_driver_assignments(assigned_at desc);

alter table public.bus_driver_assignments enable row level security;

drop policy if exists "Allow public read bus driver assignments" on public.bus_driver_assignments;
create policy "Allow public read bus driver assignments"
  on public.bus_driver_assignments
  for select
  using (true);

drop policy if exists "Allow authenticated write bus driver assignments" on public.bus_driver_assignments;
create policy "Allow authenticated write bus driver assignments"
  on public.bus_driver_assignments
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
