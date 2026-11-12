-- Programme tab: release day (the weekday a learner is at college; the Review Assistant's "collegeDay").
alter table public.apprentices add column release_day text;

alter table public.apprentices
  add constraint apprentices_release_day_check
  check (release_day is null or release_day in ('Monday','Tuesday','Wednesday','Thursday','Friday'));

create or replace function public.set_release_day(p_gta_id text, p_day text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_old text;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_day is not null and p_day not in ('Monday','Tuesday','Wednesday','Thursday','Friday') then
    raise exception 'Release day must be Monday to Friday' using errcode = '22023';
  end if;
  select a.release_day into v_old from public.apprentices a where a.gta_id = p_gta_id for update;
  if not found then
    raise exception 'Apprentice % not found', p_gta_id using errcode = 'P0002';
  end if;
  if v_old is not distinct from p_day then
    return;
  end if;
  update public.apprentices set release_day = p_day where gta_id = p_gta_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'apprentice', p_gta_id, 'release_day_set',
          format('%s release day %s -> %s', p_gta_id, coalesce(v_old, 'none'), coalesce(p_day, 'none')),
          jsonb_build_object('gta_id', p_gta_id, 'old', v_old, 'new', p_day));
end;
$$;

revoke all on function public.set_release_day(text, text) from public, anon;
grant execute on function public.set_release_day(text, text) to authenticated, service_role;
