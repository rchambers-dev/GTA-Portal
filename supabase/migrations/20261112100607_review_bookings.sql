-- Review booking method and booking details (follow-up, 12 Nov 2026).
-- What the Review Assistant stores, and where it now lives:
--   in person  -> learner.appointment {dateKey, arriveMinutes}, appointmentAt, appointmentClearedAt     -> review_bookings.appointment_on / appointment_minutes / booked_at / cleared_at
--   phone      -> learner.phoneReview + phoneReviewDay (a WEEKDAY only, no date or time)                  -> review_bookings.phone_day
--   verified   -> verifiedByDate[date] includes the learner (the visit is verified for that day)         -> review_bookings.verified_on
--   method     -> reviewAttendance[proposedDate] (explicit pick, In person / By phone / Teams), else implied by the above -> reviews.method
-- Phone and an appointment are mutually exclusive in the Assistant (booking one clears the other), so they are here too.
-- The Assistant has no way to book a Teams call (Teams exists only as the method pick), so there is no Teams booking function; a Teams review is just reviews.method = 'teams' with the booking fields blank, ready to be filled later.

create table public.review_bookings (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews(id) on delete cascade,
  appointment_on date,
  appointment_minutes integer,
  phone_day text,
  verified_on date,
  booked_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_bookings_appointment_consistent check (
    (appointment_on is null and appointment_minutes is null)
    or (appointment_on is not null and appointment_minutes between 0 and 1439)
  ),
  constraint review_bookings_appointment_weekday check (appointment_on is null or extract(isodow from appointment_on) <= 5),
  constraint review_bookings_phone_day_check check (phone_day is null or phone_day in ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  constraint review_bookings_phone_or_appointment check (phone_day is null or appointment_on is null)
);

create trigger touch_review_bookings_updated_at
  before update on public.review_bookings
  for each row execute function public.touch_updated_at();

-- A booking belongs to an open review only (the Assistant drops it once the visit is done).
create or replace function public.review_bookings_open_only()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not exists (select 1 from public.reviews r where r.id = new.review_id and r.status = 'open') then
    raise exception 'A booking can only be held on an open review' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger review_bookings_open_only
  before insert or update of review_id on public.review_bookings
  for each row execute function public.review_bookings_open_only();

alter table public.review_bookings enable row level security;
create policy review_bookings_select_staff on public.review_bookings
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management','Tutor')));
revoke all on table public.review_bookings from public, anon, authenticated;
grant select on table public.review_bookings to authenticated;
grant select, insert, update, delete on table public.review_bookings to service_role;

-- Move the three appointment values already held on reviews, then drop those columns.
insert into public.review_bookings (review_id, appointment_on, appointment_minutes)
select r.id, r.appointment_on, r.appointment_minutes from public.reviews r where r.appointment_on is not null;

alter table public.reviews drop constraint reviews_appointment_consistent;
alter table public.reviews drop constraint reviews_appointment_only_when_open;
alter table public.reviews drop column appointment_on;
alter table public.reviews drop column appointment_minutes;

-- Old function replaced by the three below.
drop function public.set_review_appointment(uuid, date, integer);

-- Concern rule: only a booked appointment (today or later) keeps the planned date (applyConcernSchedule). Phone or verified alone do not.
create or replace function public.review_apply_concern_schedule(p_gta_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/London')::date;
  v_rev public.reviews%rowtype;
  v_appt date;
  v_next date;
begin
  select * into v_rev from public.reviews r where r.gta_id = p_gta_id and r.status = 'open' for update;
  if not found then
    return;
  end if;
  select b.appointment_on into v_appt from public.review_bookings b where b.review_id = v_rev.id;
  if v_appt is not null and v_appt >= v_today then
    return;
  end if;
  v_next := public.review_next_planned_on(p_gta_id);
  if v_next is null or v_rev.planned_on is not distinct from v_next then
    return;
  end if;
  update public.reviews set planned_on = v_next where id = v_rev.id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', v_rev.id::text, 'rescheduled',
          format('Review for %s planned date %s -> %s (concern schedule)', p_gta_id, v_rev.planned_on, v_next),
          jsonb_build_object('gta_id', p_gta_id, 'old', v_rev.planned_on, 'new', v_next, 'reason', 'concern'));
end;
$$;

-- Completing a review: same as before, but the booking row is dropped instead of clearing columns.
create or replace function public.complete_review(p_review_id uuid, p_actual_on date, p_method text default null, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
  v_method text;
  v_next date;
  v_new uuid;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_actual_on is null then
    raise exception 'Actual review date is required' using errcode = '22023';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.status <> 'open' then
    raise exception 'Review is already completed' using errcode = '23514';
  end if;
  -- method: the one given, else the one booked on the review, else in person (reviewAttendedFor)
  v_method := coalesce(p_method, v_rev.method, 'in_person');
  if v_method not in ('in_person','phone','teams') then
    raise exception 'Method must be in_person, phone or teams' using errcode = '22023';
  end if;
  perform 1 from public.apprentices a where a.gta_id = v_rev.gta_id for update;
  delete from public.review_bookings where review_id = p_review_id;
  update public.reviews
     set status = 'completed', actual_on = p_actual_on, method = v_method,
         notes = coalesce(nullif(btrim(p_notes), ''), notes)
   where id = p_review_id;
  v_next := public.review_next_planned_on(v_rev.gta_id);
  insert into public.reviews (gta_id, reviewer_id, planned_on, status, source)
  values (v_rev.gta_id, v_rev.reviewer_id, v_next, 'open', 'entered')
  returning id into v_new;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'completed',
          format('Review for %s completed on %s; next planned %s', v_rev.gta_id, p_actual_on, v_next),
          jsonb_build_object('gta_id', v_rev.gta_id, 'planned_on', v_rev.planned_on, 'actual_on', p_actual_on,
                             'method', v_method, 'next_review_id', v_new, 'next_planned_on', v_next,
                             'interval_weeks', public.review_interval_weeks(v_rev.gta_id)));
  return v_new;
end;
$$;

-- Book an in-person visit (saveLearnerAppointment): a weekday, not in the past; clears any phone booking; method becomes in person.
create or replace function public.book_review_in_person(p_review_id uuid, p_on date, p_minutes integer)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/London')::date;
  v_rev public.reviews%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_on is null or p_minutes is null then
    raise exception 'Give both the visit date and arrival time' using errcode = '22023';
  end if;
  if extract(isodow from p_on) > 5 then
    raise exception 'A visit must be on a weekday' using errcode = '23514';
  end if;
  if p_on < v_today then
    raise exception 'A visit cannot be booked in the past' using errcode = '23514';
  end if;
  if p_minutes < 0 or p_minutes > 1439 then
    raise exception 'Arrival time must be minutes from midnight (0 to 1439)' using errcode = '22023';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.status <> 'open' then
    raise exception 'Only an open review can have a visit booked' using errcode = '23514';
  end if;
  insert into public.review_bookings (review_id, appointment_on, appointment_minutes, phone_day, booked_at)
  values (p_review_id, p_on, p_minutes, null, now())
  on conflict (review_id) do update
    set appointment_on = excluded.appointment_on, appointment_minutes = excluded.appointment_minutes,
        phone_day = null, booked_at = now();
  update public.reviews set method = 'in_person' where id = p_review_id and method is distinct from 'in_person';
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'visit_booked',
          format('Review for %s booked in person on %s', v_rev.gta_id, p_on),
          jsonb_build_object('gta_id', v_rev.gta_id, 'method', 'in_person', 'appointment_on', p_on, 'appointment_minutes', p_minutes));
end;
$$;

-- Book a phone review (setPhoneReviewDay): a weekday only. Clears any appointment; method becomes phone.
create or replace function public.book_review_phone(p_review_id uuid, p_day text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
  v_had_appt boolean;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_day is null or p_day not in ('Monday','Tuesday','Wednesday','Thursday','Friday') then
    raise exception 'Phone review day must be Monday to Friday' using errcode = '22023';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.status <> 'open' then
    raise exception 'Only an open review can have a phone review booked' using errcode = '23514';
  end if;
  select (b.appointment_on is not null) into v_had_appt from public.review_bookings b where b.review_id = p_review_id;
  insert into public.review_bookings (review_id, phone_day, appointment_on, appointment_minutes, cleared_at)
  values (p_review_id, p_day, null, null, case when coalesce(v_had_appt, false) then now() end)
  on conflict (review_id) do update
    set phone_day = excluded.phone_day, appointment_on = null, appointment_minutes = null,
        cleared_at = case when coalesce(v_had_appt, false) then now() else public.review_bookings.cleared_at end;
  update public.reviews set method = 'phone' where id = p_review_id and method is distinct from 'phone';
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'phone_booked',
          format('Review for %s booked as a phone review on %ss', v_rev.gta_id, p_day),
          jsonb_build_object('gta_id', v_rev.gta_id, 'method', 'phone', 'phone_day', p_day));
end;
$$;

-- Cancel the booking (clear appointment / cancel phone review). Verified day is left alone; use set_review_verified for that.
create or replace function public.clear_review_booking(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
  v_b public.review_bookings%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  select * into v_b from public.review_bookings b where b.review_id = p_review_id for update;
  if not found or (v_b.appointment_on is null and v_b.phone_day is null) then
    return;
  end if;
  update public.review_bookings
     set appointment_on = null, appointment_minutes = null, phone_day = null,
         cleared_at = case when v_b.appointment_on is not null then now() else cleared_at end
   where review_id = p_review_id;
  update public.reviews set method = null where id = p_review_id and method in ('in_person','phone');
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'booking_cleared',
          format('Booking cleared for review of %s', v_rev.gta_id),
          jsonb_build_object('gta_id', v_rev.gta_id, 'appointment_on', v_b.appointment_on, 'phone_day', v_b.phone_day));
end;
$$;

-- Verify / undo verify (Plan page): the day the visit is verified for.
create or replace function public.set_review_verified(p_review_id uuid, p_on date)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_on is not null and extract(isodow from p_on) > 5 then
    raise exception 'A visit must be on a weekday' using errcode = '23514';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.status <> 'open' then
    raise exception 'Only an open review can be verified' using errcode = '23514';
  end if;
  insert into public.review_bookings (review_id, verified_on) values (p_review_id, p_on)
  on conflict (review_id) do update set verified_on = excluded.verified_on;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, case when p_on is null then 'unverified' else 'verified' end,
          format('Review for %s %s', v_rev.gta_id, case when p_on is null then 'verification removed' else 'verified for ' || p_on end),
          jsonb_build_object('gta_id', v_rev.gta_id, 'verified_on', p_on));
end;
$$;

revoke all on function public.review_bookings_open_only() from public, anon, authenticated;
grant execute on function public.review_bookings_open_only() to service_role;
revoke all on function public.review_apply_concern_schedule(text) from public, anon, authenticated;
grant execute on function public.review_apply_concern_schedule(text) to service_role;
revoke all on function public.complete_review(uuid, date, text, text) from public, anon;
grant execute on function public.complete_review(uuid, date, text, text) to authenticated, service_role;
revoke all on function public.book_review_in_person(uuid, date, integer) from public, anon;
revoke all on function public.book_review_phone(uuid, text) from public, anon;
revoke all on function public.clear_review_booking(uuid) from public, anon;
revoke all on function public.set_review_verified(uuid, date) from public, anon;
grant execute on function public.book_review_in_person(uuid, date, integer) to authenticated, service_role;
grant execute on function public.book_review_phone(uuid, text) to authenticated, service_role;
grant execute on function public.clear_review_booking(uuid) to authenticated, service_role;
grant execute on function public.set_review_verified(uuid, date) to authenticated, service_role;
