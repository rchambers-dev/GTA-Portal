-- A paper review is the same pack and the same empty form, moved to To book as if the tutor had submitted it.
-- Apply this in the SQL editor after review. Do not run it against production from a test.
--
-- Waiting (never sent): no released event is written, so the sent-to-tutor time stays null.
-- With the tutor (already sent): the real released event stays, and only the return is marked paper.
-- The form entry_method becomes 'paper' and submitted_at is the moment of the drag.
-- Undo is allowed only while the pack is still to_book and has no booking. It returns the pack
-- to the stage it left (waiting, or with_tutor) and clears the paper flag. Both steps are audited.

create or replace function public.review_pack_record(
  p_pack_id uuid,
  p_event text,
  p_to_stage text,
  p_source text,
  p_system boolean,
  p_occurred_at timestamptz default now(),
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
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
        or (v_from = 'waiting' and v_to = 'to_book')
        or (v_from = 'with_tutor' and v_to = 'to_book')
        or (v_from = 'to_book' and v_to = 'waiting')
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
$$;

create or replace function public.record_paper_review_return(p_pack_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack public.review_packs%rowtype;
  v_sent boolean;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.stage not in ('waiting', 'with_tutor') then
    raise exception 'Only a waiting review, or one still with the tutor, can be marked received (this one is %)', v_pack.stage using errcode = '23514';
  end if;
  v_sent := v_pack.stage = 'with_tutor';
  insert into public.review_tutor_forms (pack_id) values (p_pack_id) on conflict (pack_id) do nothing;
  insert into public.review_progress_rows (pack_id, area)
  select p_pack_id, a.area
  from unnest(array['overall_progress','knowledge_theory','practical_skills','behaviours_attendance','english_maths','off_the_job','epa_gateway']) as a(area)
  on conflict (pack_id, area) do nothing;
  update public.review_tutor_forms
     set submitted_at = now(), submitted_by = v_uid, entry_method = 'paper'
   where pack_id = p_pack_id;
  perform public.review_pack_record(
    p_pack_id, 'submitted', 'to_book', 'user', false, now(),
    jsonb_build_object('on_paper', true, 'sent_known', v_sent, 'return_method', 'paper')
  );
  perform public.review_pack_sync_booking(v_pack.review_id);
end;
$$;

create or replace function public.undo_paper_review_return(p_pack_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pack public.review_packs%rowtype;
  v_event_id uuid;
  v_sent boolean;
  v_back text;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.stage <> 'to_book' then
    raise exception 'A received review can only be undone while it is still To book (this one is %)', v_pack.stage using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.review_tutor_forms f
     where f.pack_id = p_pack_id and f.entry_method = 'paper'
  ) then
    raise exception 'This review was not marked received' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.review_bookings b
     where b.review_id = v_pack.review_id
       and (b.appointment_on is not null or b.phone_day is not null)
  ) then
    raise exception 'This review is already booked, so receiving it cannot be undone' using errcode = '23514';
  end if;
  select e.id into v_event_id
    from public.review_pack_events e
   where e.pack_id = p_pack_id
     and e.event_type = 'submitted'
     and coalesce(e.detail->>'on_paper', '') = 'true'
     and not exists (
       select 1 from public.review_pack_events marker
        where marker.detail->>'undoes' = e.id::text
     )
   order by e.occurred_at desc
   limit 1;
  v_sent := exists (
    select 1 from public.review_pack_events e
     where e.pack_id = p_pack_id and e.event_type = 'released'
  );
  v_back := case when v_sent then 'with_tutor' else 'waiting' end;
  update public.review_tutor_forms
     set submitted_at = null, submitted_by = null, entry_method = 'portal'
   where pack_id = p_pack_id;
  perform public.review_pack_record(
    p_pack_id, 'undone', v_back, 'user', false, now(),
    jsonb_build_object('undoes', v_event_id, 'on_paper', true, 'note', 'Received review undone')
  );
end;
$$;

revoke all on function public.record_paper_review_return(uuid) from public, anon;
revoke all on function public.undo_paper_review_return(uuid) from public, anon;
grant execute on function public.record_paper_review_return(uuid) to authenticated, service_role;
grant execute on function public.undo_paper_review_return(uuid) to authenticated, service_role;
