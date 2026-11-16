-- A phone review is booked on the learner's release day, between 9:00 and 10:00.
-- The call is 20 minutes. The database refuses any other weekday and any time
-- outside that window. Apply this in the SQL editor after review. Do not run it
-- against production from a test.

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
  v_release text;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if v_method not in ('in_person','teams','phone') then
    raise exception 'Method must be in_person, teams or phone' using errcode = '22023';
  end if;
  if v_method = 'phone' then
    if p_on is null or p_minutes is null or p_phone_day is null then
      raise exception 'A phone review needs the release day, the date and a time between 9:00 and 10:00' using errcode = '22023';
    end if;
    if p_phone_day not in ('Monday','Tuesday','Wednesday','Thursday','Friday') then
      raise exception 'Phone review day must be Monday to Friday' using errcode = '22023';
    end if;
    if extract(isodow from p_on) > 5 then
      raise exception 'A phone review must be on a weekday' using errcode = '23514';
    end if;
    if (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])[extract(isodow from p_on)::int] is distinct from p_phone_day then
      raise exception 'A phone review must be on the learner''s release day' using errcode = '23514';
    end if;
    if p_on < v_today then
      raise exception 'A phone review cannot be booked in the past' using errcode = '23514';
    end if;
    if p_minutes < 540 or p_minutes + 20 > 600 then
      raise exception 'A phone review must be between 9:00 and 10:00' using errcode = '22023';
    end if;
    select btrim(a.release_day) into v_release
      from public.reviews r
      join public.apprentices a on a.gta_id = r.gta_id
     where r.id = p_review_id;
    if v_release is null or v_release = '' then
      raise exception 'Set this learner''s release day before booking a phone review' using errcode = '23514';
    end if;
    if v_release is distinct from p_phone_day then
      raise exception 'A phone review must be on the learner''s release day' using errcode = '23514';
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
  perform public.review_pack_sync_booking(p_review_id);
end;
$$;

create or replace function public.rebook_review_appointment(
  p_review_id uuid,
  p_gta_id text,
  p_missed_date date,
  p_date date,
  p_method text,
  p_kind text,
  p_arrive double precision,
  p_leave double precision,
  p_gta_ids text[],
  p_back_to_queue boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_method text := coalesce(p_method, 'in_person');
  v_kind text := coalesce(p_kind, 'visit');
  v_ids text[] := coalesce(p_gta_ids, '{}');
  v_weekday text;
  v_release text;
  v_sort integer;
begin
  if p_back_to_queue then
    perform public.exclude_review_day_stop(p_missed_date, p_gta_id);
    perform public.clear_review_booking(p_review_id);
    return;
  end if;

  if v_method not in ('in_person', 'teams', 'phone') then
    raise exception 'Method must be in_person, teams or phone' using errcode = '22023';
  end if;
  if v_method = 'teams' and v_kind <> 'teams'
     or v_method = 'phone' and v_kind <> 'phone'
     or v_method = 'in_person' and v_kind <> 'visit' then
    raise exception 'Stop kind must match the booking method' using errcode = '22023';
  end if;
  if p_date is null then
    raise exception 'A rebooked visit needs a day' using errcode = '22023';
  end if;
  if v_method = 'phone' then
    if p_arrive is null or p_leave is null then
      raise exception 'A phone review must be between 9:00 and 10:00' using errcode = '22023';
    end if;
    if p_arrive < 540 or p_leave > 600 or p_leave <= p_arrive then
      raise exception 'A phone review must be between 9:00 and 10:00' using errcode = '22023';
    end if;
    select btrim(release_day) into v_release from public.apprentices where gta_id = p_gta_id;
    v_weekday := (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])[extract(isodow from p_date)::int];
    if v_release is null or v_release = '' then
      raise exception 'Set this learner''s release day before booking a phone review' using errcode = '23514';
    end if;
    if v_release is distinct from v_weekday then
      raise exception 'A phone review must be on the learner''s release day' using errcode = '23514';
    end if;
  elsif p_arrive is null or p_leave is null then
    raise exception 'Give both the arrival and leave times' using errcode = '22023';
  end if;

  perform public.exclude_review_day_stop(p_missed_date, p_gta_id);

  if v_method = 'phone' then
    v_weekday := (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])[extract(isodow from p_date)::int];
    perform public.book_review(p_review_id, 'phone', p_date, round(p_arrive)::integer, v_weekday);
    perform public.review_day_ensure(p_date);
    select coalesce(max(s.sort_order), -1) + 1 into v_sort
      from public.review_day_stops s
     where s.date_on = p_date and s.gta_id <> p_gta_id and not s.excluded;
    insert into public.review_day_stops (date_on, gta_id, kind, pinned, excluded, sort_order, arrive_minutes, leave_minutes)
    values (p_date, p_gta_id, 'phone', true, false, v_sort, p_arrive, p_leave)
    on conflict (date_on, gta_id) do update
      set kind = 'phone', pinned = true, excluded = false, arrive_minutes = excluded.arrive_minutes, leave_minutes = excluded.leave_minutes;
    perform public.review_plan_audit(
      'review_day_stop', p_date::text || '/' || p_gta_id, 'rebooked',
      format('%s rebooked by phone on %s', p_gta_id, p_date),
      jsonb_build_object('date_on', p_date, 'gta_id', p_gta_id, 'kind', 'phone', 'missed_date', p_missed_date, 'arrive_minutes', p_arrive, 'leave_minutes', p_leave)
    );
    return;
  end if;

  if (select count(*) from unnest(v_ids)) <> (select count(distinct i) from unnest(v_ids) i) then
    raise exception 'Each learner can be pinned once per day' using errcode = '22023';
  end if;
  if not (p_gta_id = any (v_ids)) then
    v_ids := v_ids || p_gta_id;
  end if;
  perform public.set_review_day_pins(p_date, v_ids);
  perform public.set_review_day_stop_times(p_date, p_gta_id, p_arrive, p_leave);
  update public.review_day_stops
     set kind = v_kind
   where date_on = p_date and gta_id = p_gta_id;
  perform public.book_review(p_review_id, v_method, p_date, round(p_arrive)::integer, null);
end;
$$;
