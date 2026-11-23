-- A learner can be held off the automatic tutor queue and still need booking.
-- This is not the removed pack hold. Do not record a pack event for it.
-- The trigger on review_pack_events rejects the old hold event types. The hold lives on the review.
-- An active hold is released_at is null and held_until is today or later in Europe/London.
-- No job expires it. complete_review inserts a new review id and does not copy this row.

create table public.review_holds (
  id uuid primary key default gen_random_uuid(),
  gta_id text not null references public.apprentices (gta_id),
  review_id uuid not null references public.reviews (id),
  held_until date not null,
  reason text not null,
  held_by uuid references public.profiles (id),
  held_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles (id),
  constraint review_holds_reason_not_blank check (btrim(reason) <> ''),
  constraint review_holds_release_pair check ((released_at is null) = (released_by is null))
);

create unique index review_holds_one_open_per_review
  on public.review_holds (review_id)
  where released_at is null;

create index review_holds_gta_id_idx on public.review_holds (gta_id);

alter table public.review_holds enable row level security;

create policy review_holds_select_admin_mgmt on public.review_holds
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));

revoke all on table public.review_holds from public, anon, authenticated;
grant select on table public.review_holds to authenticated, service_role;

comment on table public.review_holds is
  'One open hold per review. Active while released_at is null and held_until is today or later in Europe/London. Writes go through hold_review and release_review_hold.';

create or replace function public.hold_review(p_review_id uuid, p_held_until date, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/London')::date;
  v_rev public.reviews%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_id uuid;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_held_until is null or p_held_until < v_today then
    raise exception 'Hold until must be today or later' using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'A reason is required' using errcode = '22023';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.status <> 'open' then
    raise exception 'Only an open review can be put on hold' using errcode = '23514';
  end if;
  update public.review_holds
     set held_until = p_held_until, reason = v_reason, held_by = v_uid, held_at = now()
   where review_id = p_review_id and released_at is null
   returning id into v_id;
  if v_id is null then
    insert into public.review_holds (gta_id, review_id, held_until, reason, held_by)
    values (v_rev.gta_id, p_review_id, p_held_until, v_reason, v_uid)
    returning id into v_id;
  end if;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'hold_set',
          format('Review for %s on hold until %s', v_rev.gta_id, p_held_until),
          jsonb_build_object('gta_id', v_rev.gta_id, 'hold_id', v_id, 'held_until', p_held_until, 'reason', v_reason));
end;
$$;

create or replace function public.release_review_hold(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
  v_hold public.review_holds%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.status <> 'open' then
    raise exception 'Only an open review can be taken off hold' using errcode = '23514';
  end if;
  select * into v_hold
    from public.review_holds h
   where h.review_id = p_review_id and h.released_at is null
   for update;
  if not found then
    raise exception 'This review is not on hold' using errcode = 'P0002';
  end if;
  update public.review_holds
     set released_at = now(), released_by = v_uid
   where id = v_hold.id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'hold_released',
          format('Review for %s taken off hold', v_rev.gta_id),
          jsonb_build_object('gta_id', v_rev.gta_id, 'hold_id', v_hold.id, 'held_until', v_hold.held_until, 'reason', v_hold.reason));
end;
$$;

revoke all on function public.hold_review(uuid, date, text) from public, anon;
revoke all on function public.release_review_hold(uuid) from public, anon;
grant execute on function public.hold_review(uuid, date, text) to authenticated, service_role;
grant execute on function public.release_review_hold(uuid) to authenticated, service_role;

-- Daily release skips an active hold. The pack stays waiting and is not failed.
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
           exists (select 1 from public.apprentice_tutors t where t.apprentice_id = p.gta_id and t.end_date is null) as has_tutor,
           exists (
             select 1 from public.review_holds h
              where h.review_id = p.review_id
                and h.released_at is null
                and h.held_until >= v_today
           ) as on_hold
      from public.review_packs p
      join public.reviews rv on rv.id = p.review_id
      join public.apprentices a on a.gta_id = p.gta_id
     where p.stage = 'waiting'
       and rv.status = 'open' and rv.planned_on is not null and rv.planned_on - 14 <= v_today
     order by rv.planned_on, p.gta_id
  loop
    if r.on_hold then
      v_skipped := v_skipped + 1;
      continue;
    end if;
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

create or replace function public.release_review_to_tutor(p_pack_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  v_until date;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select h.held_until into v_until
    from public.review_packs p
    left join public.review_holds h
      on h.review_id = p.review_id
     and h.released_at is null
     and h.held_until >= v_today
   where p.id = p_pack_id;
  if v_until is not null then
    raise exception 'This learner is on hold until %. Take them off hold before sending the review to the tutor.', v_until using errcode = '23514';
  end if;
  perform public.review_pack_release_core(p_pack_id, 'user', false, p_note);
end;
$$;

-- Booking an appointment ends an open hold. Clearing a booking does not.
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
  v_hold_id uuid;
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
  if p_on is not null then
    update public.review_holds
       set released_at = now(), released_by = v_uid
     where review_id = p_review_id and released_at is null
     returning id into v_hold_id;
    if v_hold_id is not null then
      insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
      values (v_uid, 'review', p_review_id::text, 'hold_released',
              format('Review for %s taken off hold because it was booked', v_rev.gta_id),
              jsonb_build_object('gta_id', v_rev.gta_id, 'hold_id', v_hold_id, 'reason', 'booked'));
    end if;
  end if;
  perform public.review_pack_sync_booking(p_review_id);
end;
$$;
