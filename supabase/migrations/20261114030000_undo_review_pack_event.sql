-- Undo a review pack event. Not applied. The Review log hides a working Undo button until this function exists.
-- A later migration, 20261114140000_undo_review_day_completion.sql, replaces this function so a
-- completion is undone with the whole review day rather than one learner.
-- Undo never deletes a review_pack_events row. It appends an 'undone' row that points at the original event
-- and puts the pack back to from_stage. A completed event also voids the next cycle's still-waiting pack
-- and reopens that review, in this same transaction.

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
  v_review public.reviews%rowtype;
  v_next public.reviews%rowtype;
  v_next_pack public.review_packs%rowtype;
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
  -- Safeguarding signatures, pack creation and an undo row itself cannot be undone.
  if v_event.event_type in ('undone', 'created', 'signature_recorded')
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

  select * into v_review from public.reviews r where r.id = v_pack.review_id for update;
  if v_event.event_type = 'completed' and not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;

  if v_event.event_type = 'completed' then
    select * into v_next
    from public.reviews r
    where r.gta_id = v_pack.gta_id
      and r.status = 'open'
      and r.id <> v_pack.review_id
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
        raise exception 'The next pack has moved on, so this completion cannot be undone' using errcode = '23514';
      end if;
      update public.reviews
         set status = 'voided', voided_at = now()
       where id = v_next.id;
      update public.review_packs
         set voided_at = now()
       where id = v_next_pack.id;
    end if;
    update public.reviews
       set status = 'open', actual_on = null
     where id = v_review.id;
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

revoke all on function public.undo_review_pack_event(uuid) from public, anon;
grant execute on function public.undo_review_pack_event(uuid) to authenticated, service_role;
