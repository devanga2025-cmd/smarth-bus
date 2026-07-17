alter table public.driver_locations enable row level security;

drop policy if exists "Allow public read driver locations" on public.driver_locations;
create policy "Allow public read driver locations"
on public.driver_locations
for select
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'driver_locations'
  ) then
    alter publication supabase_realtime add table public.driver_locations;
  end if;
end $$;
