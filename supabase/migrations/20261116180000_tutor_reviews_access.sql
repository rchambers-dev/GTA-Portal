-- Let tutors open their own review list, and record which waiting packs the
-- daily job skips because no tutor is set. Apply this in the SQL editor after
-- review. Do not run it against production from a test.
--
-- reviews.tutor opens only the tutor list and form. It does not open Plan,
-- Analytics, or the shared review queue. schedule.view is not added: live
-- tutor profiles were stored from the shorter staff bootstrap list, not from
-- the wider code pack, and that gap is left for a separate decision.
--
-- The existing pg_cron job review-packs-daily already calls
-- review_packs_run_daily() at 06:00 UTC. The database has no cron timezone
-- argument. The job's date is Europe/London, so a waiting pack is released
-- once planned_on is 14 days away or sooner. Running it again does nothing
-- to a pack that is no longer waiting. A pack with no current tutor is
-- skipped and named in the audit payload.

update public.profiles
   set permissions = (
     select array(select distinct unnest(coalesce(permissions, '{}') || array['reviews.tutor']))
   )
 where base_role = 'Tutor'
   and not (coalesce(permissions, '{}') @> array['reviews.tutor']);

create or replace function public.review_packs_run_daily()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  r record;
  v_released integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_no_tutor jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  for r in
    select p.id, p.gta_id, a.status as learner_status,
           exists (select 1 from public.apprentice_tutors t where t.apprentice_id = p.gta_id and t.end_date is null) as has_tutor
      from public.review_packs p
      join public.reviews rv on rv.id = p.review_id
      join public.apprentices a on a.gta_id = p.gta_id
     where p.stage = 'waiting'
       and rv.status = 'open' and rv.planned_on is not null and rv.planned_on - 14 <= v_today
     order by rv.planned_on, p.gta_id
  loop
    if not r.has_tutor then
      v_skipped := v_skipped + 1;
      v_no_tutor := v_no_tutor || jsonb_build_object('pack_id', r.id, 'gta_id', r.gta_id);
      continue;
    end if;
    if r.learner_status <> 'in_learning' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    begin
      perform public.review_pack_release_core(r.id, 'auto', true);
      v_released := v_released + 1;
    exception when others then
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object('pack_id', r.id, 'gta_id', r.gta_id, 'error', sqlerrm);
    end;
  end loop;

  v_result := jsonb_build_object('date', v_today, 'released', v_released,
                                 'skipped', v_skipped, 'skipped_no_tutor', v_no_tutor,
                                 'failed', v_failed, 'errors', v_errors);
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (null, 'review_pack_job', v_today::text, 'daily_run',
          format('Daily review pack run %s: %s released, %s skipped, %s failed', v_today, v_released, v_skipped, v_failed),
          v_result);
  return v_result;
end;
$$;
