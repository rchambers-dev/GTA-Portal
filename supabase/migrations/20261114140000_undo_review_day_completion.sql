-- Undo a whole review day's completion. Not applied.
-- Complete on the Plan finishes every learner on an accepted route. Undoing it returns
-- that day to route accepted, the state immediately before Complete was pressed.
-- review_days keeps accepted, accepted_at and accepted_by. Only completed_at and
-- completed_by are cleared. Each stop returns to completed = false and keeps accepted,
-- verified, pinned, its times, sort_order, and its locked or accepted minutes.
-- Packs and reviews return to the stage they were in while the route was accepted.
-- The booking Complete deleted is inserted again. The next cycle's waiting pack is voided.
-- Rows are never deleted: each learner gets an 'undone' event. Safeguarding sign-offs
-- are left untouched.
-- A single pack event can still be undone, but only for released, received (submitted) and booked.
-- A completion is refused there and has to go through undo_review_day_completion.

alter table public.reviews drop constraint if exists reviews_status_check;
alter table public.reviews drop constraint if exists reviews_status_actual_consistent;
alter table public.reviews
  add constraint reviews_status_check check (status in ('open', 'completed', 'voided'));
alter table public.reviews
  add constraint reviews_status_actual_consistent check (
    (status = 'open' and actual_on is null)
    or (status = 'completed' and actual_on is not null)
    or (status = 'voided' and actual_on is null)
  );
alter table public.reviews add column if not exists voided_at timestamptz;
alter table public.review_packs add column if not exists voided_at timestamptz;

alter table public.review_pack_events drop constraint if exists review_pack_events_type_valid;
alter table public.review_pack_events
  add constraint review_pack_events_type_valid check (event_type in (
    'created','released','draft_saved','submitted','recalled','booked','booking_cleared',
    'reviewed','completed','held','hold_released','signature_recorded','undone'));

create index if not exists review_pack_events_undoes_idx
  on public.review_pack_events ((detail->>'undoes'))
  where event_type = 'undone';

create or replace function public.undo_review_pack_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_event public.review_pack_events%rowtype;
  v_pack public.review_packs%rowtype;
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_event_id is null then
    raise exception 'Event is required' using errcode = '22023';
  end if;

  select * into v_event from public.review_pack_events e where e.id = p_event_id for update;
  if not found then
    raise exception 'Review event not found' using errcode = 'P0002';
  end if;
  -- Completing a day is one action. It is undone for the whole day, never one learner.
  if v_event.event_type = 'completed' then
    raise exception 'A completion is undone with the whole review day' using errcode = '23514';
  end if;
  -- Safeguarding signatures, pack creation, an undo row, and any step other than
  -- released, received or booked cannot be undone here.
  if v_event.event_type not in ('released', 'submitted', 'booked')
     or v_event.from_stage is null
     or v_event.to_stage is null
     or v_event.from_stage = v_event.to_stage then
    raise exception 'This event cannot be undone' using errcode = '23514';
  end if;
  if v_event.occurred_at < now() - interval '7 days' then
    raise exception 'An event can only be undone within 7 days' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.review_pack_events later
    where later.detail->>'undoes' = p_event_id::text
  ) then
    raise exception 'This event has already been undone' using errcode = '23514';
  end if;

  select * into v_pack from public.review_packs p where p.id = v_event.pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.review_pack_events later
    join public.review_packs lp on lp.id = later.pack_id
    where lp.gta_id = v_pack.gta_id
      and later.id <> v_event.id
      and later.occurred_at > v_event.occurred_at
      and later.event_type not in ('undone', 'created', 'signature_recorded')
      and later.from_stage is not null
      and later.to_stage is not null
      and later.from_stage <> later.to_stage
      and later.occurred_at >= now() - interval '7 days'
      and not exists (
        select 1 from public.review_pack_events marker
        where marker.detail->>'undoes' = later.id::text
      )
  ) then
    raise exception 'Only the latest undoable event for this learner can be undone' using errcode = '23514';
  end if;

  update public.review_packs
     set stage = v_event.from_stage, stage_since = now()
   where id = v_pack.id;

  select pr.base_role into v_role from public.profiles pr where pr.id = v_uid;
  insert into public.review_pack_events
    (pack_id, event_type, from_stage, to_stage, actor_profile_id, actor_role, system, source, occurred_at, detail)
  values (
    v_pack.id, 'undone', v_event.to_stage, v_event.from_stage, v_uid, v_role, false, 'user', now(),
    jsonb_build_object('undoes', p_event_id, 'note', 'Stage restored')
  );
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (
    v_uid, 'review_pack', v_pack.id::text, 'undone',
    format('Undid %s for %s (%s -> %s)', v_event.event_type, v_pack.gta_id, v_event.to_stage, v_event.from_stage),
    jsonb_build_object('undoes', p_event_id, 'gta_id', v_pack.gta_id, 'from', v_event.to_stage, 'to', v_event.from_stage)
  );
end;
$$;

-- p_day_id is review_days.date_on, the day's primary key.
create or replace function public.undo_review_day_completion(p_day_id date)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_day public.review_days%rowtype;
  v_count integer;
  v_gta text;
  v_review public.reviews%rowtype;
  v_pack public.review_packs%rowtype;
  v_event public.review_pack_events%rowtype;
  v_next public.reviews%rowtype;
  v_next_pack public.review_packs%rowtype;
  v_stop public.review_day_stops%rowtype;
  v_book jsonb;
  v_booked_at timestamptz;
  v_method text;
  v_on date;
  v_minutes integer;
  v_phone text;
  v_stage text;
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_day_id is null then
    raise exception 'Review day is required' using errcode = '22023';
  end if;

  select * into v_day from public.review_days d where d.date_on = p_day_id for update;
  if not found or v_day.completed_at is null then
    raise exception 'This review day is not completed' using errcode = 'P0002';
  end if;
  if v_day.completed_at < now() - interval '7 days' then
    raise exception 'A completed day can only be undone within 7 days' using errcode = '23514';
  end if;

  select count(*) into v_count
  from public.review_day_stops s
  where s.date_on = p_day_id and s.completed;
  if v_count = 0 then
    raise exception 'This day has no completed learners' using errcode = 'P0002';
  end if;

  select pr.base_role into v_role from public.profiles pr where pr.id = v_uid;

  for v_gta in
    select s.gta_id
    from public.review_day_stops s
    where s.date_on = p_day_id and s.completed
    order by s.sort_order, s.gta_id
    for update
  loop
    select * into v_review
    from public.reviews r
    where r.gta_id = v_gta
      and r.status = 'completed'
      and r.actual_on = p_day_id
    order by r.created_at desc
    limit 1
    for update;
    if not found then
      raise exception 'Learner % has no completion recorded on this day', v_gta using errcode = 'P0002';
    end if;

    select * into v_pack from public.review_packs p where p.review_id = v_review.id for update;
    if not found or v_pack.stage is distinct from 'completed' then
      raise exception 'Learner % has no completed pack on this day', v_gta using errcode = 'P0002';
    end if;

    select * into v_event
    from public.review_pack_events e
    where e.pack_id = v_pack.id
      and e.event_type = 'completed'
      and not exists (
        select 1 from public.review_pack_events marker
        where marker.detail->>'undoes' = e.id::text
      )
    order by e.occurred_at desc
    limit 1
    for update;
    if not found then
      raise exception 'Learner % has no completion event to undo', v_gta using errcode = 'P0002';
    end if;
    v_stage := v_event.from_stage;
    if v_stage is null or v_stage not in ('waiting', 'with_tutor', 'to_book', 'booked', 'reviewed') then
      v_stage := 'booked';
    end if;
    if v_stage <> 'waiting' and (v_pack.tutor_id is null or v_pack.learner_snapshot is null) then
      raise exception 'Learner % cannot return to the accepted route', v_gta using errcode = '23514';
    end if;

    -- The next cycle's waiting pack, opened when this review was completed.
    select * into v_next
    from public.reviews r
    where r.gta_id = v_gta
      and r.status = 'open'
      and r.id <> v_review.id
    order by r.created_at desc
    limit 1
    for update;
    if found then
      select * into v_next_pack from public.review_packs p where p.review_id = v_next.id for update;
      if not found
         or v_next_pack.voided_at is not null
         or v_next_pack.stage is distinct from 'waiting'
         or exists (
           select 1 from public.review_pack_events e
           where e.pack_id = v_next_pack.id and e.event_type <> 'created'
         ) then
        raise exception 'The next pack for % has moved on, so this day cannot be undone', v_gta using errcode = '23514';
      end if;
      update public.reviews
         set status = 'voided', voided_at = now()
       where id = v_next.id;
      update public.review_packs
         set voided_at = now()
       where id = v_next_pack.id;
    end if;

    -- planned_on, reviewer_id, method, notes and interval stay as they were before Complete.
    update public.reviews
       set status = 'open', actual_on = null
     where id = v_review.id;

    select * into v_stop
    from public.review_day_stops s
    where s.date_on = p_day_id and s.gta_id = v_gta;
    v_book := null;
    v_booked_at := null;
    select a.payload, a.occurred_at into v_book, v_booked_at
    from public.audit_events a
    where a.entity_type = 'review'
      and a.entity_id = v_review.id::text
      and a.action = 'booked'
      and a.occurred_at <= v_day.completed_at
    order by a.occurred_at desc
    limit 1;
    v_method := coalesce(v_review.method, 'in_person');
    if v_method not in ('in_person', 'phone', 'teams') then
      v_method := 'in_person';
    end if;
    v_on := null;
    v_minutes := null;
    v_phone := null;
    if v_book is not null and coalesce(v_book->>'method', v_method) = v_method then
      v_on := nullif(v_book->>'appointment_on', '')::date;
      v_minutes := nullif(v_book->>'appointment_minutes', '')::integer;
      v_phone := nullif(v_book->>'phone_day', '');
    end if;
    if v_minutes is not null and (v_minutes < 0 or v_minutes > 1439) then
      v_minutes := null;
    end if;
    if v_method = 'phone' then
      v_on := null;
      v_minutes := null;
      if v_phone is null or v_phone not in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday') then
        v_phone := (array['Monday','Tuesday','Wednesday','Thursday','Friday'])[extract(isodow from p_day_id)::integer];
      end if;
    else
      v_phone := null;
      if v_on is null then
        v_on := p_day_id;
      end if;
      if v_minutes is null then
        v_minutes := round(coalesce(v_stop.accepted_arrive_minutes, v_stop.arrive_minutes, v_stop.lock_arrive_minutes))::integer;
      end if;
      if v_minutes is null or v_minutes < 0 or v_minutes > 1439 then
        v_on := null;
        v_minutes := null;
      end if;
    end if;
    -- Complete deletes this row. Put the same booking back. Do not delete or rewrite the route stop.
    if not exists (select 1 from public.review_bookings b where b.review_id = v_review.id) then
      insert into public.review_bookings
        (review_id, method, appointment_on, appointment_minutes, phone_day, booked_at)
      values (v_review.id, v_method, v_on, v_minutes, v_phone, coalesce(v_booked_at, v_event.occurred_at));
    end if;

    update public.review_packs
       set stage = v_stage,
           stage_since = now(),
           hold_reason = case when v_stage in ('booked', 'reviewed') then null else hold_reason end,
           held_until = case when v_stage in ('booked', 'reviewed') then null else held_until end
     where id = v_pack.id;
    -- Sign-off rows and signature_recorded events are not updated.
    insert into public.review_pack_events
      (pack_id, event_type, from_stage, to_stage, actor_profile_id, actor_role, system, source, occurred_at, detail)
    values (
      v_pack.id, 'undone', 'completed', v_stage, v_uid, v_role, false, 'user', now(),
      jsonb_build_object('undoes', v_event.id, 'day', p_day_id, 'note', 'Route accepted restored')
    );
    insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
    values (
      v_uid, 'review_pack', v_pack.id::text, 'undone',
      format('Undid the day completion for %s on %s', v_gta, p_day_id),
      jsonb_build_object('undoes', v_event.id, 'gta_id', v_gta, 'day', p_day_id, 'from', 'completed', 'to', v_stage)
    );
    -- Only the completed flag changes. accepted, verified, pinned, times, sort_order
    -- and locked or accepted minutes stay exactly as they were on the accepted route.
    update public.review_day_stops
       set completed = false
     where date_on = p_day_id and gta_id = v_gta;
  end loop;

  -- Route accepted stays. Only the completion stamp is cleared.
  update public.review_days
     set completed_at = null, completed_by = null
   where date_on = p_day_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (
    v_uid, 'review_day', p_day_id::text, 'undone',
    format('Undid the completion of %s (%s learner(s))', p_day_id, v_count),
    jsonb_build_object('date_on', p_day_id, 'learners', v_count)
  );
end;
$$;

revoke all on function public.undo_review_pack_event(uuid) from public, anon;
grant execute on function public.undo_review_pack_event(uuid) to authenticated, service_role;
revoke all on function public.undo_review_day_completion(date) from public, anon;
grant execute on function public.undo_review_day_completion(date) to authenticated, service_role;
