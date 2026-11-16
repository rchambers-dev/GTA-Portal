-- Out visit marks, shelving finished reviews, and lock expiry.
-- Apply this in the SQL editor after review. Do not run it against production from a test.
--
-- A lock lasts until 10:00 Europe/London on the calendar day after it was set.
-- 10:00 is not the UK clock-change hour, so the conversion stays DST-safe.
-- When that time has passed, release_expired_review_locks clears the lock and
-- plan_counters stops counting it, so the learner returns to To book.
-- The morning job calls that clear before it releases packs.
--
-- Shelving a completed review only sets reviews.shelved_at. The row stays,
-- and the learner Reviews tab still lists it. Restore clears shelved_at.
--
-- Visit arrive and leave times are marks on the Out page. They do not complete
-- the review. Completing the plan day remains the review.

alter table public.review_day_stops
  add column if not exists lock_expires_at timestamptz;

update public.review_day_stops
   set lock_expires_at = timezone(
         'Europe/London',
         (((locked_at at time zone 'Europe/London')::date + 1) + time '10:00')
       )
 where locked_at is not null
   and lock_expires_at is null;

create or replace function public.review_lock_expiry(p_set_at timestamptz)
returns timestamptz
language sql
stable
set search_path to ''
as $$
  select timezone(
    'Europe/London',
    (((p_set_at at time zone 'Europe/London')::date + 1) + time '10:00')
  );
$$;

create or replace function public.lock_review_day_stop(
  p_date date,
  p_gta_id text,
  p_arrive double precision,
  p_leave double precision,
  p_until_minutes integer default 1425
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_set timestamptz := now();
  v_expires timestamptz := public.review_lock_expiry(v_set);
begin
  perform public.review_plan_require_writer();
  perform public.review_day_ensure(p_date);
  delete from public.review_lock_clears where gta_id = p_gta_id;
  insert into public.review_day_stops (
    date_on, gta_id, locked_until_minutes, lock_arrive_minutes, lock_leave_minutes, locked_at, lock_expires_at
  )
  values (p_date, p_gta_id, 600, p_arrive, p_leave, v_set, v_expires)
  on conflict (date_on, gta_id) do update set
    locked_until_minutes = 600,
    lock_arrive_minutes = coalesce(excluded.lock_arrive_minutes, public.review_day_stops.lock_arrive_minutes),
    lock_leave_minutes = coalesce(excluded.lock_leave_minutes, public.review_day_stops.lock_leave_minutes),
    locked_at = excluded.locked_at,
    lock_expires_at = excluded.lock_expires_at;
  perform public.review_plan_audit(
    'review_day_stop',
    p_date::text || '/' || p_gta_id,
    'locked',
    format('%s locked on %s until %s', p_gta_id, p_date, v_expires),
    jsonb_build_object('date_on', p_date, 'gta_id', p_gta_id, 'expires_at', v_expires, 'arrive', p_arrive, 'leave', p_leave)
  );
end;
$$;

create or replace function public.unlock_review_day_stop(p_gta_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.review_plan_require_writer();
  update public.review_day_stops
     set locked_until_minutes = null,
         lock_arrive_minutes = null,
         lock_leave_minutes = null,
         locked_at = null,
         lock_expires_at = null
   where gta_id = p_gta_id
     and locked_at is not null;
  insert into public.review_lock_clears (gta_id, cleared_at)
  values (p_gta_id, now())
  on conflict (gta_id) do update set cleared_at = excluded.cleared_at;
  perform public.review_plan_audit('review_day_stop', p_gta_id, 'unlocked', format('%s unlocked', p_gta_id), jsonb_build_object('gta_id', p_gta_id));
end;
$$;

create or replace function public.release_expired_review_locks()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_gta text;
  v_count integer := 0;
begin
  for v_gta in
    select distinct s.gta_id
      from public.review_day_stops s
     where s.locked_at is not null
       and coalesce(s.lock_expires_at, public.review_lock_expiry(s.locked_at)) <= now()
  loop
    update public.review_day_stops
       set locked_until_minutes = null,
           lock_arrive_minutes = null,
           lock_leave_minutes = null,
           locked_at = null,
           lock_expires_at = null
     where gta_id = v_gta
       and locked_at is not null
       and coalesce(lock_expires_at, public.review_lock_expiry(locked_at)) <= now();
    insert into public.review_lock_clears (gta_id, cleared_at)
    values (v_gta, now())
    on conflict (gta_id) do update set cleared_at = excluded.cleared_at;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.release_unverified_after_call_end()
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_portal_role('Administrator','Management','Tutor') then
    raise exception 'Staff role required' using errcode = '42501';
  end if;
  perform public.release_expired_review_locks();
end;
$$;

revoke all on function public.review_lock_expiry(timestamptz) from public, anon;
revoke all on function public.release_expired_review_locks() from public, anon;
grant execute on function public.review_lock_expiry(timestamptz) to authenticated, service_role;
grant execute on function public.release_expired_review_locks() to authenticated, service_role;

create or replace view public.plan_counters
with (security_invoker = true) as
with clock as (
  select (now() at time zone 'Europe/London')::date as today,
         date_trunc('week', (now() at time zone 'Europe/London')::date)::date as week_start
),
stops as (
  select s.gta_id,
         bool_or(s.completed and s.date_on >= c.week_start) as paper_done,
         bool_or(s.verified and not s.completed and s.date_on >= c.week_start) as verified_week,
         bool_or(s.verified and s.date_on >= c.today) as verified_today,
         bool_or(s.verified and not s.completed and s.date_on >= c.today) as verified_conf_today,
         min(s.date_on) filter (
           where s.locked_at is not null
             and s.date_on >= c.today
             and coalesce(s.lock_expires_at, public.review_lock_expiry(s.locked_at)) > now()
         ) as lock_date,
         bool_or(s.accepted and s.kind = 'visit' and s.date_on >= c.today) as accepted_today,
         bool_or(s.pinned and s.date_on >= c.today) as pinned_today
    from public.review_day_stops s
    cross join clock c
   group by s.gta_id
),
base as (
  select a.gta_id,
         btrim(a.first_name || ' ' || coalesce(a.middle_names || ' ', '') || a.last_name) as name,
         tp.display_name as tutor,
         pk.stage,
         coalesce(t.tutor_id = any (coalesce(rs.hidden_tutor_ids, '{}'::uuid[])), false) as tutor_hidden,
         b.appointment_on,
         coalesce(b.appointment_on is not null and exists (
           select 1 from public.review_day_stops d
            where d.gta_id = a.gta_id and d.date_on = b.appointment_on and d.completed
         ), false) as appt_route_done,
         coalesce(st.paper_done, false) as paper_done,
         coalesce(st.verified_week, false) as verified_week,
         coalesce(st.verified_today, false) as verified_today,
         coalesce(st.verified_conf_today, false) as verified_conf_today,
         st.lock_date,
         coalesce(st.accepted_today, false) as accepted_today,
         coalesce(st.pinned_today, false) as pinned_today
    from public.apprentices a
    left join public.reviews r on r.gta_id = a.gta_id and r.status = 'open'
    left join public.review_packs pk on pk.review_id = r.id
    left join public.review_bookings b on b.review_id = r.id
    left join public.apprentice_tutors t on t.apprentice_id = a.gta_id and t.end_date is null
    left join public.profiles tp on tp.id = t.tutor_id
    left join stops st on st.gta_id = a.gta_id
    cross join (select hidden_tutor_ids::uuid[] as hidden_tutor_ids from public.review_settings limit 1) rs
),
flags as (
  select b.*, c.today, c.week_start,
         coalesce(b.appointment_on >= c.today, false) as upcoming_booking,
         coalesce(b.appointment_on >= c.week_start and not b.appt_route_done, false) or b.verified_week as visit_confirmed,
         coalesce(b.appointment_on >= c.today and not b.appt_route_done, false) or b.verified_conf_today as booked_from_today
    from base b
    cross join clock c
),
flags2 as (
  select f.*,
         case when f.upcoming_booking then null else f.lock_date end as awaiting_date,
         (f.upcoming_booking or (case when f.upcoming_booking then null else f.lock_date end) is not null
            or f.accepted_today or f.verified_today or f.pinned_today) as held_on_plan
    from flags f
),
flags3 as (
  select f.*,
         coalesce(not f.visit_confirmed and not f.paper_done
            and not (f.tutor_hidden and not f.held_on_plan)
            and f.stage in ('to_book', 'reviewed'), false) as needs_booking
    from flags2 f
)
select f.gta_id, f.name, f.tutor, f.stage, f.tutor_hidden, f.appointment_on, f.awaiting_date,
       case
         when f.needs_booking and f.awaiting_date is null then 'to_book'
         when f.awaiting_date is not null and not f.verified_today then 'locked'
         when f.booked_from_today and not f.paper_done and not (f.awaiting_date is not null and not f.verified_today) then 'booked'
         else 'waiting'
       end as counter
  from flags3 f;

comment on view public.plan_counters is
  'Plan roster counters. A lock counts only until 10:00 Europe/London on the day after it was set. After that the learner returns to To book.';

-- The existing morning job. Clears expired locks first, then releases waiting packs.
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
  v_cleared integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_no_tutor jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  v_cleared := public.release_expired_review_locks();
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

  v_result := jsonb_build_object(
    'date', v_today, 'released', v_released, 'locks_cleared', v_cleared,
    'skipped', v_skipped, 'skipped_no_tutor', v_no_tutor,
    'failed', v_failed, 'errors', v_errors
  );
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (null, 'review_pack_job', v_today::text, 'daily_run',
          format('Daily review pack run %s: %s released, %s locks cleared, %s skipped, %s failed', v_today, v_released, v_cleared, v_skipped, v_failed),
          v_result);
  return v_result;
end;
$$;

alter table public.reviews
  add column if not exists shelved_at timestamptz;

comment on column public.reviews.shelved_at is
  'Set when a finished review is moved to the Archive page. The review row is kept and still appears on the learner Reviews tab.';

create or replace function public.shelve_completed_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.reviews%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_row from public.reviews where id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'completed' then
    raise exception 'Only a finished review can be moved to the archive' using errcode = '23514';
  end if;
  if v_row.shelved_at is not null then
    return;
  end if;
  update public.reviews set shelved_at = now() where id = p_review_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'shelved',
          format('Finished review for %s moved to the archive', v_row.gta_id),
          jsonb_build_object('gta_id', v_row.gta_id, 'actual_on', v_row.actual_on));
end;
$$;

create or replace function public.restore_completed_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.reviews%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_row from public.reviews where id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_row.shelved_at is null then
    return;
  end if;
  update public.reviews set shelved_at = null where id = p_review_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'restored',
          format('Finished review for %s restored from the archive', v_row.gta_id),
          jsonb_build_object('gta_id', v_row.gta_id, 'actual_on', v_row.actual_on));
end;
$$;

revoke all on function public.shelve_completed_review(uuid) from public, anon;
revoke all on function public.restore_completed_review(uuid) from public, anon;
grant execute on function public.shelve_completed_review(uuid) to authenticated, service_role;
grant execute on function public.restore_completed_review(uuid) to authenticated, service_role;

create table if not exists public.review_visit_marks (
  date_on date not null,
  gta_id text not null references public.apprentices(gta_id) on delete restrict,
  arrived_at timestamptz,
  left_at timestamptz,
  primary key (date_on, gta_id),
  constraint review_visit_marks_left_after_arrive check (left_at is null or arrived_at is not null)
);

alter table public.review_visit_marks enable row level security;

drop policy if exists review_visit_marks_select_staff on public.review_visit_marks;
create policy review_visit_marks_select_staff on public.review_visit_marks
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management','Tutor')));

revoke all on table public.review_visit_marks from public, anon, authenticated;
grant select on table public.review_visit_marks to authenticated;
grant select, insert, update, delete on table public.review_visit_marks to service_role;

create or replace function public.stamp_review_visit(p_date date, p_gta_id text, p_kind text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_kind not in ('arrive', 'leave') then
    raise exception 'Visit mark must be arrive or leave' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.review_days d where d.date_on = p_date and d.accepted and d.completed_at is null
  ) then
    raise exception 'Accept this route on the Plan page before you start the round' using errcode = '23514';
  end if;
  insert into public.review_visit_marks (date_on, gta_id, arrived_at)
  values (p_date, p_gta_id, case when p_kind = 'arrive' then now() else null end)
  on conflict (date_on, gta_id) do update set
    arrived_at = coalesce(public.review_visit_marks.arrived_at, excluded.arrived_at),
    left_at = case
      when p_kind = 'leave' and public.review_visit_marks.arrived_at is not null then coalesce(public.review_visit_marks.left_at, now())
      else public.review_visit_marks.left_at
    end;
end;
$$;

revoke all on function public.stamp_review_visit(date, text, text) from public, anon;
grant execute on function public.stamp_review_visit(date, text, text) to authenticated, service_role;
