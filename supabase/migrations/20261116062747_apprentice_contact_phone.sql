-- Optional contact phone on an apprentice, stored as E.164.
-- Existing apprentice policies stay as they are: Administrator and Management
-- can read and write every apprentice, and a Tutor can read only the apprentices
-- they can already see. The new column is covered by those row policies.
-- The address book view is replaced so learner rows return this phone.
-- Profiles stay without a phone column. Staff editing is a login and job-title
-- directory, not a contact card.

alter table public.apprentices
  add column if not exists phone text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'apprentices_phone_e164'
  ) then
    alter table public.apprentices
      add constraint apprentices_phone_e164
      check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');
  end if;
end $$;

create or replace function public.apprentices_normalise_phone()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  raw text;
  digits text;
  compact text;
  national text;
begin
  if new.phone is null then
    return new;
  end if;
  raw := btrim(new.phone);
  if raw = '' then
    new.phone := null;
    return new;
  end if;
  raw := regexp_replace(raw, '\s*(?:ext\.?|extension|x)\s*[0-9]+\s*$', '', 'i');
  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  if digits = '' then
    raise exception 'Enter a UK phone number, such as 07700 900123.'
      using errcode = '23514';
  end if;
  if raw ~ '^\s*00' then
    compact := '+' || substr(digits, 3);
  elsif position('+' in raw) > 0 then
    compact := '+' || digits;
  else
    compact := digits;
  end if;

  national := null;
  if compact ~ '^\+44' then
    national := substr(compact, 4);
  elsif compact ~ '^0' then
    national := substr(compact, 2);
  elsif compact ~ '^44[0-9]{9,11}$' then
    national := substr(compact, 3);
  end if;
  if national is not null and national ~ '^0' then
    national := substr(national, 2);
  end if;
  if national is not null and national ~ '^[1-9][0-9]{8,9}$' then
    new.phone := '+44' || national;
    return new;
  end if;
  if compact ~ '^\+[1-9][0-9]{7,14}$' then
    new.phone := compact;
    return new;
  end if;
  raise exception 'Enter a UK phone number, such as 07700 900123.'
    using errcode = '23514';
end;
$$;

drop trigger if exists apprentices_normalise_phone on public.apprentices;
create trigger apprentices_normalise_phone
before insert or update of phone on public.apprentices
for each row
execute function public.apprentices_normalise_phone();

comment on column public.apprentices.phone is
  'Optional contact phone, stored as E.164. Blank becomes null. UK numbers are normalised. Staff read and write it under the existing apprentice policies.';

revoke all on function public.apprentices_normalise_phone() from public, anon;
grant execute on function public.apprentices_normalise_phone() to authenticated, service_role;

create or replace view public.portal_address_book
with (security_invoker = true) as
select
  'learner'::text as contact_group,
  a.gta_id as source_id,
  ('learner:' || a.gta_id) as contact_key,
  btrim(a.first_name) as given_name,
  nullif(btrim(a.middle_names), '') as middle_name,
  btrim(a.last_name) as family_name,
  btrim(concat_ws(' ', a.first_name, nullif(btrim(a.middle_names), ''), a.last_name)) as display_name,
  nullif(btrim(a.email), '') as email,
  nullif(btrim(a.phone), '') as phone,
  emp.company_name as organisation,
  'Apprentice'::text as job_title,
  nullif(btrim(concat_ws(' · ',
    a.gta_id,
    case a.status
      when 'in_learning' then 'In learning'
      when 'break_in_learning' then 'Break in learning'
      when 'withdrawn' then 'Withdrawn'
      when 'completed' then 'Completed'
      when 'overdue' then 'Overdue'
      else nullif(btrim(a.status), '')
    end,
    nullif(btrim(prog.name), '')
  )), '') as detail
from public.apprentices a
left join lateral (
  select e.company_name
  from public.apprentice_employments ae
  join public.employers e on e.employer_id = ae.employer_id
  where ae.gta_id = a.gta_id
    and ae.end_date is null
  order by ae.start_date desc, ae.id desc
  limit 1
) emp on true
left join public.programmes prog on prog.id = a.programme_id
where a.is_test = false

union all

select
  'employer'::text,
  m.id::text,
  'employer:' || m.id::text,
  btrim(m.first_name),
  nullif(btrim(m.middle_names), ''),
  btrim(m.last_name),
  btrim(concat_ws(' ', m.first_name, nullif(btrim(m.middle_names), ''), m.last_name)),
  nullif(btrim(m.email), ''),
  nullif(btrim(m.phone), ''),
  e.company_name,
  'Employer contact'::text,
  nullif(btrim(concat_ws(', ',
    nullif(btrim(s.area_name), ''),
    nullif(btrim(s.postcode), '')
  )), '')
from public.employer_managers m
join public.employers e on e.employer_id = m.employer_id
left join public.employer_sites s on s.id = m.site_id

union all

select
  case when p.base_role = 'Tutor' then 'tutor' else 'staff' end,
  p.id::text,
  'profile:' || p.id::text,
  split_part(person.full_name, ' ', 1),
  null::text,
  nullif(btrim(regexp_replace(person.full_name, '^\S+\s*', '')), ''),
  person.full_name,
  nullif(btrim(p.email), ''),
  null::text,
  'Doncaster GTA'::text,
  coalesce(nullif(btrim(p.responsibilities[1]), ''), p.base_role),
  nullif(btrim(concat_ws(' · ',
    p.base_role,
    nullif(array_to_string(p.responsibilities, ', '), '')
  )), '')
from public.profiles p
cross join lateral (
  select btrim(coalesce(
    nullif(btrim(p.display_name), ''),
    split_part(p.email, '@', 1)
  )) as full_name
) person
where p.archived_at is null
  and p.portal_status in ('active', 'invited')
  and p.linked_apprentice_id is null
  and p.base_role <> '';

comment on view public.portal_address_book is
  'Contacts the mobile app may copy onto a phone. security_invoker so apprentice, employer, and profile RLS still decide the rows. Learner phones come from apprentices.phone. No passwords. No writes.';

revoke all on table public.portal_address_book from public, anon, authenticated;
grant select on table public.portal_address_book to authenticated, service_role;
