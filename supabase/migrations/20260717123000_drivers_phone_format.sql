-- Keep driver phone numbers in the same format the admin UI saves.
-- Existing live projects may already have this constraint; this migration is idempotent.

update public.drivers
set phone = right(regexp_replace(phone, '\D', '', 'g'), 10)
where phone is not null
  and regexp_replace(phone, '\D', '', 'g') ~ '^(91)?[6-9][0-9]{9}$';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'drivers_phone_format_check'
      and conrelid = 'public.drivers'::regclass
  ) then
    alter table public.drivers
      add constraint drivers_phone_format_check
      check (phone ~ '^[6-9][0-9]{9}$');
  end if;
end $$;
