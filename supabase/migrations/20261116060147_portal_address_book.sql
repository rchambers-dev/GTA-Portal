-- Read-only address book for the mobile companion.
-- One way: the phone may copy these rows. Nothing here accepts writes.
-- security_invoker so the signed-in user's existing RLS applies:
--   apprentices: Administrator and Management see every non-test learner;
--     a Tutor sees only learners tutor_can_see already allows.
--   employers, sites, and managers: Administrator, Management, and Tutor.
--   profiles: any signed-in user can already read the directory. This view
--     exposes name, email, and role only — never passwords or permissions.
-- Learners have no phone column. Their phone is null until one exists.
-- Test apprentices are left out, matching the Portal lists.

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
  null::text as phone,
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
  'Contacts the mobile app may copy onto a phone. security_invoker so apprentice, employer, and profile RLS still decide the rows. Learners, employer managers, tutors, and other staff. No passwords. No writes.';

revoke all on table public.portal_address_book from public, anon, authenticated;
grant select on table public.portal_address_book to authenticated, service_role;
