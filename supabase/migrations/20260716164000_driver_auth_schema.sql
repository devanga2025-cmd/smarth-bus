-- Driver details and authentication schema required by the admin/driver app.
-- Safe to run more than once.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'driver_status') then
    create type public.driver_status as enum ('available', 'assigned', 'on_trip', 'offline');
  end if;
end $$;

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Driver',
  phone text not null default '',
  licence_number text not null default '',
  licence_expiry date,
  address text,
  status public.driver_status not null default 'available',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drivers
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists name text not null default 'Driver',
  add column if not exists phone text not null default '',
  add column if not exists licence_number text not null default '',
  add column if not exists licence_expiry date,
  add column if not exists address text,
  add column if not exists status public.driver_status not null default 'available',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists login_name text,
  add column if not exists pin_hash text,
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists locked_until timestamptz;

update public.drivers
set login_name = lower(regexp_replace(coalesce(name, 'driver') || '-' || left(id::text, 8), '[^a-z0-9._-]+', '.', 'g'))
where login_name is null or login_name = '';

alter table public.drivers
  alter column login_name set not null;

create unique index if not exists drivers_login_name_key
  on public.drivers (lower(login_name));

create table if not exists public.driver_login_attempts (
  id uuid primary key default gen_random_uuid(),
  attempted_login_name text not null,
  driver_id uuid references public.drivers(id) on delete set null,
  success boolean not null default false,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists driver_login_attempts_driver_id_idx
  on public.driver_login_attempts(driver_id);

create index if not exists driver_login_attempts_created_at_idx
  on public.driver_login_attempts(created_at desc);

create table if not exists public.driver_sessions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index if not exists driver_sessions_driver_id_idx
  on public.driver_sessions(driver_id);

create index if not exists driver_sessions_token_hash_idx
  on public.driver_sessions(token_hash);
