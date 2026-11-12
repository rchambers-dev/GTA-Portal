-- Review cycle logic (mirrors the Review Assistant: src/planner.js) and the concern functions.
--  * interval: 10 weeks, or 5 weeks while the learner has an open concern (reviewIntervalWeeks)
--  * next planned date = latest actual review date + interval * 7 calendar days, no rounding (nextScheduledReviewDateKey)
--  * raising/resolving a concern rewrites the open review's planned date unless a visit is booked (applyConcernSchedule)
--  * after a break in learning the next review is 10 weeks (70 days) from the return date (Reiss's decision, not in the Assistant)

-- Internal helpers: not callable by clients.
create or replace function public.review_interval_weeks(p_gta_id text)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select case when exists (
    select 1 from public.learner_concerns c where c.gta_id = p_gta_id and c.resolved_on is null
  ) then 5 else 10 end
$$;

create or replace function public.review_next_planned_on(p_gta_id text)
returns date
language sql
stable
security definer
set search_path to ''
as $$
  select max(r.actual_on) + (public.review_interval_weeks(p_gta_id) * 7)
  from public.reviews r
  where r.gta_id = p_gta_id and r.status = 'completed'
$$;

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
  v_next date;
begin
  select * into v_rev from public.reviews r where r.gta_id = p_gta_id and r.status = 'open' for update;
  if not found then
    return;
  end if;
  -- a visit already booked (today or later) keeps its planned date
  if v_rev.appointment_on is not null and v_rev.appointment_on >= v_today then
    return;
  end if;
  v_next := public.review_next_planned_on(p_gta_id);
  -- no actual review yet: the next date is the planned date itself, so nothing changes
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

-- Client functions
create or replace function public.open_review(p_gta_id text, p_planned_on date default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_planned date;
  v_reviewer uuid;
  v_id uuid;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  perform 1 from public.apprentices a where a.gta_id = p_gta_id for update;
  if not found then
    raise exception 'Apprentice % not found', p_gta_id using errcode = 'P0002';
  end if;
  if exists (select 1 from public.reviews r where r.gta_id = p_gta_id and r.status = 'open') then
    raise exception 'Apprentice % already has an open review', p_gta_id using errcode = '23505';
  end if;
  v_planned := coalesce(p_planned_on, public.review_next_planned_on(p_gta_id));
  if v_planned is null then
    raise exception 'A planned date is required' using errcode = '22023';
  end if;
  select rr.profile_id into v_reviewer from public.review_reviewers rr where rr.is_default;
  insert into public.reviews (gta_id, reviewer_id, planned_on, status, source)
  values (p_gta_id, v_reviewer, v_planned, 'open', 'entered')
  returning id into v_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', v_id::text, 'opened',
          format('Review opened for %s, planned %s', p_gta_id, v_planned),
          jsonb_build_object('gta_id', p_gta_id, 'planned_on', v_planned));
  return v_id;
end;
$$;

-- Completing a review creates the next open review (recordReview + nextScheduledReviewDateKey).
-- Method defaults to in person when none is given (reviewAttendedFor).
create or replace function public.complete_review(p_review_id uuid, p_actual_on date, p_method text default 'in_person', p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
  v_method text := coalesce(p_method, 'in_person');
  v_next date;
  v_new uuid;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_actual_on is null then
    raise exception 'Actual review date is required' using errcode = '22023';
  end if;
  if v_method not in ('in_person','phone','teams') then
    raise exception 'Method must be in_person, phone or teams' using errcode = '22023';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.status <> 'open' then
    raise exception 'Review is already completed' using errcode = '23514';
  end if;
  perform 1 from public.apprentices a where a.gta_id = v_rev.gta_id for update;
  update public.reviews
     set status = 'completed', actual_on = p_actual_on, method = v_method,
         notes = coalesce(nullif(btrim(p_notes), ''), notes),
         appointment_on = null, appointment_minutes = null
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

-- Hand-edit of the planned date (the Assistant's plannedReviewDate editor).
create or replace function public.reschedule_review(p_review_id uuid, p_planned_on date)
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
  if p_planned_on is null then
    raise exception 'Planned date is required' using errcode = '22023';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.status <> 'open' then
    raise exception 'Only an open review can be rescheduled' using errcode = '23514';
  end if;
  if v_rev.planned_on is not distinct from p_planned_on then
    return;
  end if;
  update public.reviews set planned_on = p_planned_on where id = p_review_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'rescheduled',
          format('Review for %s planned date %s -> %s', v_rev.gta_id, v_rev.planned_on, p_planned_on),
          jsonb_build_object('gta_id', v_rev.gta_id, 'old', v_rev.planned_on, 'new', p_planned_on, 'reason', 'manual'));
end;
$$;

-- Book or clear a visit (a weekday, not in the past: normaliseAppointment). Pass nulls to clear.
create or replace function public.set_review_appointment(p_review_id uuid, p_on date, p_minutes integer)
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
  if (p_on is null) <> (p_minutes is null) then
    raise exception 'Give both the visit date and arrival time, or neither' using errcode = '22023';
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
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.status <> 'open' then
    raise exception 'Only an open review can have a visit booked' using errcode = '23514';
  end if;
  update public.reviews set appointment_on = p_on, appointment_minutes = p_minutes where id = p_review_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, case when p_on is null then 'visit_cleared' else 'visit_booked' end,
          format('Review for %s visit %s', v_rev.gta_id, coalesce(p_on::text, 'cleared')),
          jsonb_build_object('gta_id', v_rev.gta_id, 'appointment_on', p_on, 'appointment_minutes', p_minutes));
end;
$$;

-- "Attended" dropdown on the Archive page.
create or replace function public.set_review_method(p_review_id uuid, p_method text)
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
  if p_method is not null and p_method not in ('in_person','phone','teams') then
    raise exception 'Method must be in_person, phone or teams' using errcode = '22023';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.method is not distinct from p_method then
    return;
  end if;
  update public.reviews set method = p_method where id = p_review_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'method_set',
          format('Review for %s method %s -> %s', v_rev.gta_id, coalesce(v_rev.method, 'none'), coalesce(p_method, 'none')),
          jsonb_build_object('gta_id', v_rev.gta_id, 'old', v_rev.method, 'new', p_method));
end;
$$;

create or replace function public.set_review_notes(p_review_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
  v_notes text := nullif(btrim(p_notes), '');
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_rev from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  if v_rev.notes is not distinct from v_notes then
    return;
  end if;
  update public.reviews set notes = v_notes where id = p_review_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', p_review_id::text, 'notes_set',
          format('Review notes changed for %s', v_rev.gta_id),
          jsonb_build_object('gta_id', v_rev.gta_id));
end;
$$;

create or replace function public.add_review_attachment(p_review_id uuid, p_file_name text, p_content_type text, p_size_bytes bigint, p_storage_path text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_gta text;
  v_id uuid;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select r.gta_id into v_gta from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  insert into public.review_attachments (review_id, file_name, content_type, size_bytes, storage_path, uploaded_by)
  values (p_review_id, btrim(p_file_name), p_content_type, p_size_bytes, p_storage_path, v_uid)
  returning id into v_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review_attachment', v_id::text, 'added',
          format('Attachment added to review for %s', v_gta),
          jsonb_build_object('gta_id', v_gta, 'review_id', p_review_id, 'file_name', btrim(p_file_name), 'content_type', p_content_type));
  return v_id;
end;
$$;

create or replace function public.remove_review_attachment(p_attachment_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_att public.review_attachments%rowtype;
  v_gta text;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_att from public.review_attachments a where a.id = p_attachment_id for update;
  if not found then
    raise exception 'Attachment not found' using errcode = 'P0002';
  end if;
  select r.gta_id into v_gta from public.reviews r where r.id = v_att.review_id;
  delete from public.review_attachments where id = p_attachment_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review_attachment', p_attachment_id::text, 'removed',
          format('Attachment removed from review for %s', v_gta),
          jsonb_build_object('gta_id', v_gta, 'review_id', v_att.review_id, 'file_name', v_att.file_name, 'storage_path', v_att.storage_path));
end;
$$;

-- Concerns
create or replace function public.raise_concern(p_gta_id text, p_reason_id uuid, p_notes text default null, p_raised_on date default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/London')::date;
  v_on date := coalesce(p_raised_on, (now() at time zone 'Europe/London')::date);
  v_id uuid;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_reason_id is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;
  if v_on > v_today then
    raise exception 'Raised date cannot be in the future' using errcode = '23514';
  end if;
  perform 1 from public.apprentices a where a.gta_id = p_gta_id for update;
  if not found then
    raise exception 'Apprentice % not found', p_gta_id using errcode = 'P0002';
  end if;
  if exists (select 1 from public.learner_concerns c where c.gta_id = p_gta_id and c.resolved_on is null) then
    raise exception 'Apprentice % already has an open concern', p_gta_id using errcode = '23505';
  end if;
  insert into public.learner_concerns (gta_id, raised_on, raised_by, reason_id, notes)
  values (p_gta_id, v_on, v_uid, p_reason_id, nullif(btrim(p_notes), ''))
  returning id into v_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'learner_concern', v_id::text, 'raised',
          format('Concern raised for %s on %s', p_gta_id, v_on),
          jsonb_build_object('gta_id', p_gta_id, 'raised_on', v_on, 'reason_id', p_reason_id));
  perform public.review_apply_concern_schedule(p_gta_id);
  return v_id;
end;
$$;

create or replace function public.resolve_concern(p_concern_id uuid, p_resolution_note text default null, p_resolved_on date default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/London')::date;
  v_on date := coalesce(p_resolved_on, (now() at time zone 'Europe/London')::date);
  v_row public.learner_concerns%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if v_on > v_today then
    raise exception 'Resolved date cannot be in the future' using errcode = '23514';
  end if;
  select * into v_row from public.learner_concerns c where c.id = p_concern_id for update;
  if not found then
    raise exception 'Concern not found' using errcode = 'P0002';
  end if;
  if v_row.resolved_on is not null then
    raise exception 'Concern has already been resolved' using errcode = '23514';
  end if;
  if v_on < v_row.raised_on then
    raise exception 'Resolved date cannot be before the raised date %', v_row.raised_on using errcode = '23514';
  end if;
  update public.learner_concerns
     set resolved_on = v_on, resolved_by = v_uid, resolution_note = nullif(btrim(p_resolution_note), '')
   where id = p_concern_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'learner_concern', p_concern_id::text, 'resolved',
          format('Concern for %s resolved on %s', v_row.gta_id, v_on),
          jsonb_build_object('gta_id', v_row.gta_id, 'raised_on', v_row.raised_on, 'resolved_on', v_on));
  perform public.review_apply_concern_schedule(v_row.gta_id);
end;
$$;

-- Break in learning: same body as before, plus the next review moves to 10 weeks (70 days) from the return date.
create or replace function public.return_from_break(p_break_id uuid, p_return_date date default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_break public.breaks_in_learning%rowtype;
  v_check uuid;
  v_signed timestamptz;
  v_date date;
  v_uid uuid := (select auth.uid());
  v_rev public.reviews%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_break from public.breaks_in_learning b where b.id = p_break_id for update;
  if not found then
    raise exception 'Break not found' using errcode = 'P0002';
  end if;
  if v_break.actual_return is not null then
    raise exception 'Break has already ended' using errcode = '23514';
  end if;
  v_date := coalesce(p_return_date, (now() at time zone 'Europe/London')::date);
  if v_date < v_break.start_date then
    raise exception 'Return date cannot be before the break start date' using errcode = '23514';
  end if;
  select c.id, c.signed_off_at into v_check, v_signed from public.return_to_learning_checks c where c.break_id = p_break_id;
  if v_signed is null then
    raise exception 'Return-to-learning sign-off is required before returning from a break' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.return_checklist_items i
    where i.active
      and not exists (select 1 from public.return_check_results r where r.check_id = v_check and r.item_id = i.id and r.passed)
  ) then
    raise exception 'Every active return-to-learning checklist item must be passed' using errcode = '23514';
  end if;
  update public.breaks_in_learning set actual_return = v_date where id = p_break_id;
  update public.apprentices set status = 'in_learning' where gta_id = v_break.apprentice_id and status = 'break_in_learning';

  select * into v_rev from public.reviews r where r.gta_id = v_break.apprentice_id and r.status = 'open' for update;
  if found and v_rev.planned_on is distinct from (v_date + 70) then
    update public.reviews set planned_on = v_date + 70 where id = v_rev.id;
    insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
    values (v_uid, 'review', v_rev.id::text, 'rescheduled',
            format('Review for %s planned date %s -> %s (10 weeks after return from break)', v_break.apprentice_id, v_rev.planned_on, v_date + 70),
            jsonb_build_object('gta_id', v_break.apprentice_id, 'old', v_rev.planned_on, 'new', v_date + 70,
                               'reason', 'return_from_break', 'break_id', p_break_id));
  end if;
end;
$$;

-- Grants: helpers are internal; client functions need a signed-in user.
revoke all on function public.review_interval_weeks(text) from public, anon, authenticated;
revoke all on function public.review_next_planned_on(text) from public, anon, authenticated;
revoke all on function public.review_apply_concern_schedule(text) from public, anon, authenticated;
grant execute on function public.review_interval_weeks(text) to service_role;
grant execute on function public.review_next_planned_on(text) to service_role;
grant execute on function public.review_apply_concern_schedule(text) to service_role;

revoke all on function public.open_review(text, date) from public, anon;
revoke all on function public.complete_review(uuid, date, text, text) from public, anon;
revoke all on function public.reschedule_review(uuid, date) from public, anon;
revoke all on function public.set_review_appointment(uuid, date, integer) from public, anon;
revoke all on function public.set_review_method(uuid, text) from public, anon;
revoke all on function public.set_review_notes(uuid, text) from public, anon;
revoke all on function public.add_review_attachment(uuid, text, text, bigint, text) from public, anon;
revoke all on function public.remove_review_attachment(uuid) from public, anon;
revoke all on function public.raise_concern(text, uuid, text, date) from public, anon;
revoke all on function public.resolve_concern(uuid, text, date) from public, anon;
grant execute on function public.open_review(text, date) to authenticated, service_role;
grant execute on function public.complete_review(uuid, date, text, text) to authenticated, service_role;
grant execute on function public.reschedule_review(uuid, date) to authenticated, service_role;
grant execute on function public.set_review_appointment(uuid, date, integer) to authenticated, service_role;
grant execute on function public.set_review_method(uuid, text) to authenticated, service_role;
grant execute on function public.set_review_notes(uuid, text) to authenticated, service_role;
grant execute on function public.add_review_attachment(uuid, text, text, bigint, text) to authenticated, service_role;
grant execute on function public.remove_review_attachment(uuid) to authenticated, service_role;
grant execute on function public.raise_concern(text, uuid, text, date) to authenticated, service_role;
grant execute on function public.resolve_concern(uuid, text, date) to authenticated, service_role;
