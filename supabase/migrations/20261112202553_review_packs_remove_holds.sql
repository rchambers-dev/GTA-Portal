-- Remove the hold feature from review packs. Reiss (12 Nov 2026, "yes please"): never used; it was the Review Assistant's heldFromPlan workaround.
-- Stops if any pack still has a hold. Drops hold_review_pack, release_review_pack_hold, review_packs.hold_reason / held_until and their
-- three check constraints; removes hold handling from review_pack_record, review_pack_release_core and review_packs_run_daily.
-- Past review_pack_events rows ('held', 'hold_released') stay as history and stay valid under the event_type check, but a trigger now
-- refuses any new event of those types, so nothing can create one.
do $guard$
begin
  if exists (select 1 from public.review_packs where hold_reason is not null or held_until is not null) then
    raise exception 'Some review packs still have a hold; release them first';
  end if;
end
$guard$;

drop function public.hold_review_pack(uuid, text, date);
drop function public.release_review_pack_hold(uuid, text);

CREATE OR REPLACE FUNCTION public.review_pack_record(p_pack_id uuid, p_event text, p_to_stage text, p_source text, p_system boolean, p_occurred_at timestamp with time zone DEFAULT now(), p_detail jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := case when p_system then null else (select auth.uid()) end;
  v_role text;
  v_pack public.review_packs%rowtype;
  v_from text;
  v_to text;
  v_detail jsonb := coalesce(p_detail, '{}'::jsonb);
begin
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if p_event = 'created' then
    v_from := null;
    v_to := v_pack.stage;
  else
    v_from := v_pack.stage;
    v_to := coalesce(p_to_stage, v_from);
    if v_to <> v_from then
      if not (
           (v_from = 'waiting' and v_to = 'with_tutor')
        or (v_from = 'with_tutor' and v_to = 'to_book')
        or (v_from in ('to_book','booked') and v_to = 'with_tutor')
        or (v_from = 'to_book' and v_to = 'booked')
        or (v_from = 'booked' and v_to = 'to_book')
        or (v_from = 'booked' and v_to = 'reviewed')
        or (v_from in ('waiting','with_tutor','to_book','booked','reviewed') and v_to = 'completed')
      ) then
        raise exception 'A review pack cannot move from % to %', v_from, v_to using errcode = '23514';
      end if;
      update public.review_packs set stage = v_to, stage_since = p_occurred_at where id = p_pack_id;
    end if;
  end if;
  if v_uid is not null then
    select pr.base_role into v_role from public.profiles pr where pr.id = v_uid;
  end if;
  insert into public.review_pack_events
    (pack_id, event_type, from_stage, to_stage, actor_profile_id, actor_role, system, source, occurred_at, detail)
  values (p_pack_id, p_event, v_from, v_to, v_uid, v_role, p_system, p_source, p_occurred_at, v_detail);
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review_pack', p_pack_id::text, p_event,
          format('Review pack for %s: %s%s', v_pack.gta_id, p_event,
                 case when v_to is distinct from v_from and v_from is not null then format(' (%s -> %s)', v_from, v_to) else '' end),
          jsonb_build_object('gta_id', v_pack.gta_id, 'review_id', v_pack.review_id, 'from', v_from, 'to', v_to,
                             'source', p_source, 'system', p_system) || v_detail);
end;
$function$;

CREATE OR REPLACE FUNCTION public.review_pack_release_core(p_pack_id uuid, p_source text, p_system boolean, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pack public.review_packs%rowtype;
  v_rev public.reviews%rowtype;
  v_tutor uuid;
  v_prev_pack uuid;
begin
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.stage <> 'waiting' then
    raise exception 'Only a waiting pack can be released to the tutor (this one is %)', v_pack.stage using errcode = '23514';
  end if;
  select * into v_rev from public.reviews r where r.id = v_pack.review_id;
  if v_rev.status <> 'open' then
    raise exception 'The review is already completed' using errcode = '23514';
  end if;
  select t.tutor_id into v_tutor
    from public.apprentice_tutors t where t.apprentice_id = v_pack.gta_id and t.end_date is null;
  if v_tutor is null then
    raise exception 'Apprentice % has no current tutor to release the pack to', v_pack.gta_id using errcode = '23514';
  end if;
  update public.review_packs
     set tutor_id = v_tutor, learner_snapshot = public.review_pack_snapshot(v_pack.review_id), snapshot_at = now()
   where id = p_pack_id;
  -- an empty form, the 7 progress areas, and last cycle's new targets as this cycle's previous targets
  insert into public.review_tutor_forms (pack_id) values (p_pack_id) on conflict (pack_id) do nothing;
  insert into public.review_progress_rows (pack_id, area)
  select p_pack_id, a.area
  from unnest(array['overall_progress','knowledge_theory','practical_skills','behaviours_attendance','english_maths','off_the_job','epa_gateway']) as a(area)
  on conflict (pack_id, area) do nothing;
  select p.id into v_prev_pack
    from public.review_packs p join public.reviews r on r.id = p.review_id
   where p.gta_id = v_pack.gta_id and r.status = 'completed' and p.stage = 'completed'
   order by r.actual_on desc limit 1;
  if v_prev_pack is not null then
    insert into public.review_targets (pack_id, kind, slot, action, owner, measure, target_date, status, carried_from_id)
    select p_pack_id, 'previous', t.slot, t.action, t.owner, t.measure, t.target_date, 'open', t.id
      from public.review_targets t
     where t.pack_id = v_prev_pack and t.kind = 'new' and t.action is not null
    on conflict (pack_id, kind, slot) do nothing;
  end if;
  perform public.review_pack_record(p_pack_id, 'released', 'with_tutor', p_source, p_system, now(),
    jsonb_build_object('tutor_id', v_tutor, 'planned_on', v_rev.planned_on, 'note', nullif(btrim(p_note), '')));
end;
$function$;

CREATE OR REPLACE FUNCTION public.review_packs_run_daily()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  r record;
  v_released integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]'::jsonb;
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
    if r.learner_status <> 'in_learning' or not r.has_tutor then
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
                                 'skipped', v_skipped, 'failed', v_failed, 'errors', v_errors);
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (null, 'review_pack_job', v_today::text, 'daily_run',
          format('Daily review pack run %s: %s released, %s skipped, %s failed', v_today, v_released, v_skipped, v_failed),
          v_result);
  return v_result;
end;
$function$;

alter table public.review_packs drop constraint review_packs_hold_only_before_booking;
alter table public.review_packs drop constraint review_packs_held_until_needs_hold;
alter table public.review_packs drop constraint review_packs_hold_reason_not_blank;
alter table public.review_packs drop column held_until;
alter table public.review_packs drop column hold_reason;

create or replace function public.review_pack_events_no_new_holds()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'Holds were removed from review packs; ''%'' events can no longer be recorded', new.event_type using errcode = '23514';
end;
$$;
create trigger review_pack_events_no_new_holds
  before insert on public.review_pack_events
  for each row when (new.event_type in ('held', 'hold_released'))
  execute function public.review_pack_events_no_new_holds();

-- same grants as before on the replaced functions (create or replace keeps them; restated for clarity)
revoke all on function public.review_pack_record(uuid, text, text, text, boolean, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.review_pack_record(uuid, text, text, text, boolean, timestamptz, jsonb) to service_role;
revoke all on function public.review_pack_release_core(uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.review_pack_release_core(uuid, text, boolean, text) to service_role;
revoke all on function public.review_packs_run_daily() from public, anon, authenticated;
grant execute on function public.review_packs_run_daily() to service_role;
