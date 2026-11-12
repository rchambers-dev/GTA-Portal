create or replace view public.plan_counters
with (security_invoker = true) as
with clock as (
  select (now() at time zone 'Europe/London')::date as today,
         date_trunc('week', (now() at time zone 'Europe/London')::date)::date as week_start,
         (extract(hour from (now() at time zone 'Europe/London')) * 60
          + extract(minute from (now() at time zone 'Europe/London'))) as minutes_now
),
stops as (
  select s.gta_id,
         bool_or(s.completed and s.date_on >= c.week_start) as paper_done,
         bool_or(s.verified and not s.completed and s.date_on >= c.week_start) as verified_week,
         bool_or(s.verified and s.date_on >= c.today) as verified_today,
         bool_or(s.verified and not s.completed and s.date_on >= c.today) as verified_conf_today,
         min(s.date_on) filter (where s.locked_until_minutes is not null and s.date_on >= c.today
                                  and (s.date_on > c.today or c.minutes_now < s.locked_until_minutes)) as lock_date,
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
  'Plan roster counters. security_invoker so apprentice and review RLS applies. Waiting, To book, Locked and Booked.';

revoke all on table public.plan_counters from public, anon;
grant select on table public.plan_counters to authenticated, service_role;
