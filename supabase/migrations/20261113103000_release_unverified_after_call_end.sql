-- After today's call end (the day's start, default 10:00 Europe/London), unverified
-- unbooked stops are no longer a hold. This clears the lock the same way as
-- unlock_review_day_stop, but only on today's row, and the counter view stops
-- counting that hold even if the row has not been cleared yet.
-- Apply this in the Supabase SQL editor at merge time. Do not run it against
-- production from a test.

create or replace function public.review_call_end_minutes(p_date date)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((
    select case
      when start_min >= lunch_start and start_min < lunch_end then lunch_end
      else start_min
    end
    from (
      select
        coalesce(
          (select d.call_anchor_minutes from public.review_days d where d.date_on = p_date),
          (extract(hour from s.start_time)::int * 60 + extract(minute from s.start_time)::int),
          600
        ) as start_min,
        coalesce((extract(hour from s.lunch_start)::int * 60 + extract(minute from s.lunch_start)::int), 780) as lunch_start,
        coalesce((extract(hour from s.lunch_start)::int * 60 + extract(minute from s.lunch_start)::int), 780)
          + coalesce(s.lunch_minutes, 30) as lunch_end
      from public.review_settings s
      limit 1
    ) bounds
  ), 600);
$$;

create or replace function public.release_unverified_after_call_end()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  v_now integer := (extract(hour from (now() at time zone 'Europe/London')) * 60
    + extract(minute from (now() at time zone 'Europe/London')))::int;
  v_call_end integer := public.review_call_end_minutes(v_today);
  v_gta text;
begin
  if not public.has_portal_role('Administrator','Management','Tutor') then
    raise exception 'Staff role required' using errcode = '42501';
  end if;
  if v_now < v_call_end then
    return;
  end if;
  for v_gta in
    select s.gta_id
      from public.review_day_stops s
     where s.date_on = v_today
       and s.locked_at is not null
       and not s.verified
       and not s.completed
       and not s.accepted
       and not exists (
         select 1
           from public.review_bookings b
           join public.reviews r on r.id = b.review_id
          where r.gta_id = s.gta_id
            and r.status = 'open'
            and b.appointment_on = v_today
       )
  loop
    update public.review_day_stops
       set locked_until_minutes = null,
           lock_arrive_minutes = null,
           lock_leave_minutes = null,
           locked_at = null
     where date_on = v_today
       and gta_id = v_gta
       and locked_at is not null;
    insert into public.review_lock_clears (gta_id, cleared_at)
    values (v_gta, now())
    on conflict (gta_id) do update set cleared_at = excluded.cleared_at;
    perform public.review_plan_audit(
      'review_day_stop',
      v_gta,
      'unlocked',
      format('%s unlocked', v_gta),
      jsonb_build_object('gta_id', v_gta, 'date_on', v_today, 'reason', 'call_end')
    );
  end loop;
end;
$$;

revoke all on function public.review_call_end_minutes(date) from public, anon;
revoke all on function public.release_unverified_after_call_end() from public, anon;
grant execute on function public.review_call_end_minutes(date) to authenticated, service_role;
grant execute on function public.release_unverified_after_call_end() to authenticated, service_role;

create or replace view public.plan_counters
with (security_invoker = true) as
with clock as (
  select (now() at time zone 'Europe/London')::date as today,
         date_trunc('week', (now() at time zone 'Europe/London')::date)::date as week_start,
         (extract(hour from (now() at time zone 'Europe/London')) * 60
          + extract(minute from (now() at time zone 'Europe/London')))::int as minutes_now,
         public.review_call_end_minutes((now() at time zone 'Europe/London')::date) as call_end
),
stops as (
  select s.gta_id,
         bool_or(s.completed and s.date_on >= c.week_start) as paper_done,
         bool_or(s.verified and not s.completed and s.date_on >= c.week_start) as verified_week,
         bool_or(s.verified and s.date_on >= c.today) as verified_today,
         bool_or(s.verified and not s.completed and s.date_on >= c.today) as verified_conf_today,
         min(s.date_on) filter (where s.locked_until_minutes is not null and s.date_on >= c.today
                                  and (s.date_on > c.today or c.minutes_now < s.locked_until_minutes)
                                  and not (
                                    s.date_on = c.today
                                    and c.minutes_now >= c.call_end
                                    and not s.verified
                                    and not s.completed
                                    and not s.accepted
                                    and not exists (
                                      select 1
                                        from public.review_bookings b
                                        join public.reviews r on r.id = b.review_id
                                       where r.gta_id = s.gta_id
                                         and r.status = 'open'
                                         and b.appointment_on = c.today
                                    )
                                  )) as lock_date,
         bool_or(s.accepted and s.kind = 'visit' and s.date_on >= c.today) as accepted_today,
         bool_or(s.pinned and s.date_on >= c.today) as pinned_today
    from public.review_day_stops s cross join clock c
   group by s.gta_id
),
base as (
  select a.gta_id,
         btrim(a.first_name || ' ' || coalesce(a.middle_names || ' ', '') || a.last_name) as name,
         tp.display_name as tutor,
         pk.stage,
         coalesce(t.tutor_id = any (coalesce(rs.hidden_tutor_ids, '{}'::uuid[])), false) as tutor_hidden,
         b.appointment_on,
         coalesce(b.appointment_on is not null and exists (select 1 from public.review_day_stops d
              where d.gta_id = a.gta_id and d.date_on = b.appointment_on and d.completed), false) as appt_route_done,
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
    from base b cross join clock c
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
  'Plan roster counters. security_invoker so apprentice and review RLS applies. Waiting, To book, Locked and Booked. A lock on today no longer counts after call end when the stop is unverified and unbooked.';
