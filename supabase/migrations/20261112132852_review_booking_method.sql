-- Reiss's decision, 12 Nov 2026: the method is chosen per booking (dropdown): In person (default), Teams, Phone call. It is NOT sticky on the learner.
--   * review_bookings.method: in_person (default) | teams | phone
--   * phone_day (the Assistant's phoneReviewDay, weekday only) applies only when method = phone
--   * an appointment (date + arrival time, the Assistant's appointment) is for in person or Teams; a phone booking has none
--   * reviews.method on an OPEN review mirrors the booking's method (trigger); on completion it records the method used
-- Teams: the Assistant has no Teams booking of its own, so a Teams booking just holds the method and, optionally, a date and time.

alter table public.review_bookings add column method text not null default 'in_person';
alter table public.review_bookings add constraint review_bookings_method_check check (method in ('in_person','teams','phone'));
update public.review_bookings set method = 'phone' where phone_day is not null;
alter table public.review_bookings drop constraint review_bookings_phone_or_appointment;
alter table public.review_bookings add constraint review_bookings_phone_day_only_for_phone check (phone_day is null or method = 'phone');
alter table public.review_bookings add constraint review_bookings_no_appointment_for_phone check (method <> 'phone' or appointment_on is null);

-- Keep the open review's method in step with its booking.
create or replace function public.review_bookings_sync_method()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.reviews r set method = new.method
   where r.id = new.review_id and r.status = 'open' and r.method is distinct from new.method;
  return new;
end;
$$;
create trigger review_bookings_sync_method
  after insert or update of method on public.review_bookings
  for each row execute function public.review_bookings_sync_method();
revoke all on function public.review_bookings_sync_method() from public, anon, authenticated;
grant execute on function public.review_bookings_sync_method() to service_role;

-- One booking function with a method, replacing the in-person and phone ones.
drop function public.book_review_in_person(uuid, date, integer);
drop function public.book_review_phone(uuid, text);

create or replace function public.book_review(
  p_review_id uuid,
  p_method text default 'in_person',
  p_on date default null,
  p_minutes integer default null,
  p_phone_day text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/London')::date;
  v_method text := coalesce(p_method, 'in_person');
  v_rev public.reviews%rowtype;
  v_old public.review_bookings%rowtype;
  v_booked_at timestamptz;
  v_cleared_at timestamptz;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if v_method not in ('in_person','teams','phone') then
    raise exception 'Method must be in_person, teams or phone' using errcode = '22023';
  end if;
  if v_method = 'phone' then
    if p_on is not null or p_minutes is not null then
      raise exception 'A phone review has a weekday, not a visit date and time' using errcode = '22023';
    end if;
    if p_phone_day is not null and p_phone_day not in ('Monday','Tuesday','Wednesday','Thursday','Friday') then
      raise exception 'Phone review day must be Monday to Friday' using errcode = '22023';
    end if;
  else
    if p_phone_day is not null then
      raise exception 'A phone weekday only applies to a phone review' using errcode = '22023';
    end if;
    if (p_on is null) <> (p_minutes is null) then
      raise exception 'Give both the date and arrival time, or neither' using errcode = '22023';
    end if;
    if p_on is not null then
      if extract(isodow from p_on) > 5 then
        raise exception 'A visit must be on a weekday' using errcode = '23514';
      end if;
      if p_on < v_today then
        raise exception 'A visit cannot be booked in the past' using errcode = '23514';
      end if;
      if p_minutes < 0 or p_minutes > 1439 then
        raise exception 'Arrival time must be minutes from midnight (0 to 1439)' using errcode = '22023';
      end if;
    end if;
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.status <> 'open' then
    raise exception 'Only an open review can be booked' using errcode = '23514';
  end if;
  select * into v_old from public.review_bookings b where b.review_id = p_review_id for update;
  -- booked_at follows the appointment (appointmentAt); cleared_at is stamped when an appointment is taken away (appointmentClearedAt)
  v_booked_at := case
    when p_on is null then null
    when v_old.appointment_on is not distinct from p_on and v_old.appointment_minutes is not distinct from p_minutes then v_old.booked_at
    else now() end;
  v_cleared_at := case when v_old.appointment_on is not null and p_on is null then now() else v_old.cleared_at end;
  insert into public.review_bookings (review_id, method, appointment_on, appointment_minutes, phone_day, booked_at, cleared_at)
  values (p_review_id, v_method, p_on, p_minutes, p_phone_day, v_booked_at, v_cleared_at)
  on conflict (review_id) do update
    set method = excluded.method, appointment_on = excluded.appointment_on,
        appointment_minutes = excluded.appointment_minutes, phone_day = excluded.phone_day,
        booked_at = excluded.booked_at, cleared_at = excluded.cleared_at;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'booked',
          format('Review for %s booked: %s%s', v_rev.gta_id, v_method,
                 case when p_on is not null then ' on ' || p_on when p_phone_day is not null then ' on ' || p_phone_day || 's' else '' end),
          jsonb_build_object('gta_id', v_rev.gta_id, 'method', v_method, 'appointment_on', p_on,
                             'appointment_minutes', p_minutes, 'phone_day', p_phone_day));
end;
$$;

-- Take the booking away: back to the default (in person, nothing booked). The verified day is left alone.
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
  if not found or (v_b.method = 'in_person' and v_b.appointment_on is null and v_b.phone_day is null) then
    return;
  end if;
  update public.review_bookings
     set method = 'in_person', appointment_on = null, appointment_minutes = null, phone_day = null, booked_at = null,
         cleared_at = case when v_b.appointment_on is not null then now() else cleared_at end
   where review_id = p_review_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'booking_cleared',
          format('Booking cleared for review of %s', v_rev.gta_id),
          jsonb_build_object('gta_id', v_rev.gta_id, 'method', v_b.method, 'appointment_on', v_b.appointment_on, 'phone_day', v_b.phone_day));
end;
$$;

-- Method dropdown. On an open review it changes the booking's method (null = the default, in person); a phone booking drops any appointment,
-- and a non-phone booking drops the phone weekday. On a completed review it corrects the recorded method (the Archive "Attended" dropdown).
create or replace function public.set_review_method(p_review_id uuid, p_method text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
  v_b public.review_bookings%rowtype;
  v_new text;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_method is not null and p_method not in ('in_person','phone','teams') then
    raise exception 'Method must be in_person, phone or teams' using errcode = '22023';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.status = 'open' then
    v_new := coalesce(p_method, 'in_person');
    select * into v_b from public.review_bookings b where b.review_id = p_review_id for update;
    if found and v_b.method = v_new then
      return;
    end if;
    insert into public.review_bookings (review_id, method) values (p_review_id, v_new)
    on conflict (review_id) do update
      set method = excluded.method,
          appointment_on = case when excluded.method = 'phone' then null else public.review_bookings.appointment_on end,
          appointment_minutes = case when excluded.method = 'phone' then null else public.review_bookings.appointment_minutes end,
          booked_at = case when excluded.method = 'phone' then null else public.review_bookings.booked_at end,
          cleared_at = case when excluded.method = 'phone' and public.review_bookings.appointment_on is not null then now() else public.review_bookings.cleared_at end,
          phone_day = case when excluded.method = 'phone' then public.review_bookings.phone_day else null end;
  else
    if v_rev.method is not distinct from p_method then
      return;
    end if;
    update public.reviews set method = p_method where id = p_review_id;
  end if;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'method_set',
          format('Review for %s method %s -> %s', v_rev.gta_id, coalesce(v_rev.method, 'none'), coalesce(v_new, p_method, 'none')),
          jsonb_build_object('gta_id', v_rev.gta_id, 'old', v_rev.method, 'new', coalesce(v_new, p_method)));
end;
$$;

revoke all on function public.book_review(uuid, text, date, integer, text) from public, anon;
revoke all on function public.clear_review_booking(uuid) from public, anon;
revoke all on function public.set_review_method(uuid, text) from public, anon;
grant execute on function public.book_review(uuid, text, date, integer, text) to authenticated, service_role;
grant execute on function public.clear_review_booking(uuid) to authenticated, service_role;
grant execute on function public.set_review_method(uuid, text) to authenticated, service_role;
