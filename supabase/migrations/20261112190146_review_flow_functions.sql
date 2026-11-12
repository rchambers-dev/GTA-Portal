-- Review flow, part 3: one audited function per move, and the hooks into the existing review functions (13 Nov 2026).
-- Stages: waiting -> with_tutor -> to_book -> booked -> reviewed -> completed.
--   release_review_to_tutor        waiting -> with_tutor      (also run by the daily job, source 'auto')
--   save_review_tutor_form         draft, no move
--   submit_review_tutor_form       with_tutor -> to_book      (checks the form is complete; then on to booked if a visit is already booked)
--   recall_review_to_tutor         to_book / booked -> with_tutor
--   book_review / clear_review_booking / set_review_method   keep to_book <-> booked in step with the booking
--   mark_review_reviewed           booked -> reviewed
--   complete_review                any open stage -> completed; the next review gets its waiting pack
--   hold_review_pack / release_review_pack_hold   no move
-- Every function writes its review_pack_events row, the stage change and an audit_events row together.

-- ---------- internal: what the tutor is shown about the learner (frozen at release) ----------
create or replace function public.review_pack_snapshot(p_review_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'gta_id', a.gta_id,
    'name', btrim(a.first_name || ' ' || a.last_name),
    'programme', pr.name,
    'standard_code', pr.standard_code,
    'employer', emp.company_name,
    'site', emp.area_name,
    'site_postcode', emp.postcode,
    'course_start', a.course_start,
    'planned_course_end', a.planned_course_end,
    'planned_gateway_1', a.planned_gateway_1,
    'planned_gateway_2', a.planned_gateway_2,
    'planned_epa', a.planned_epa,
    'release_day', a.release_day,
    'tutor_name', tp.display_name,
    'review_planned_on', r.planned_on,
    'interval_weeks', r.interval_weeks,
    'previous_review_on', (select max(c.actual_on) from public.reviews c where c.gta_id = r.gta_id and c.status = 'completed'),
    'reviews_completed', (select count(*) from public.reviews c where c.gta_id = r.gta_id and c.status = 'completed'),
    'concern_open', exists (select 1 from public.learner_concerns lc where lc.gta_id = r.gta_id and lc.resolved_on is null)
  )
  from public.reviews r
  join public.apprentices a on a.gta_id = r.gta_id
  left join public.programmes pr on pr.id = a.programme_id
  left join lateral (
    select e.company_name, s.area_name, s.postcode
    from public.apprentice_employments ae
    join public.employers e on e.employer_id = ae.employer_id
    left join public.employer_sites s on s.id = ae.site_id
    where ae.gta_id = a.gta_id and ae.end_date is null
    order by ae.start_date desc nulls last
    limit 1
  ) emp on true
  left join public.apprentice_tutors at on at.apprentice_id = a.gta_id and at.end_date is null
  left join public.profiles tp on tp.id = at.tutor_id
  where r.id = p_review_id
$$;

-- ---------- internal: write one move (stage + event + audit together) ----------
create or replace function public.review_pack_record(
  p_pack_id uuid,
  p_event text,
  p_to_stage text,
  p_source text,
  p_system boolean,
  p_occurred_at timestamptz default now(),
  p_detail jsonb default '{}'::jsonb)
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
        or (v_from = 'with_tutor' and v_to = 'to_book')
        or (v_from in ('to_book','booked') and v_to = 'with_tutor')
        or (v_from = 'to_book' and v_to = 'booked')
        or (v_from = 'booked' and v_to = 'to_book')
        or (v_from = 'booked' and v_to = 'reviewed')
        or (v_from in ('waiting','with_tutor','to_book','booked','reviewed') and v_to = 'completed')
      ) then
        raise exception 'A review pack cannot move from % to %', v_from, v_to using errcode = '23514';
      end if;
      -- a hold only applies before a visit is booked, so it ends when the pack moves past that
      if v_to in ('booked','reviewed','completed') and v_pack.hold_reason is not null then
        v_detail := v_detail || jsonb_build_object('hold_cleared', v_pack.hold_reason, 'held_until', v_pack.held_until);
        update public.review_packs set hold_reason = null, held_until = null where id = p_pack_id;
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

-- ---------- every new open review gets its waiting pack (open_review, complete_review, imports) ----------
create or replace function public.reviews_create_pack()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pack uuid;
begin
  insert into public.review_packs (review_id, gta_id) values (new.id, new.gta_id) returning id into v_pack;
  perform public.review_pack_record(v_pack, 'created', null, 'auto', false, now(),
    jsonb_build_object('planned_on', new.planned_on, 'interval_weeks', new.interval_weeks));
  return new;
end;
$$;
create trigger reviews_create_pack
  after insert on public.reviews
  for each row
  when (new.status = 'open')
  execute function public.reviews_create_pack();

-- ---------- release to the tutor ----------
create or replace function public.review_pack_release_core(p_pack_id uuid, p_source text, p_system boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pack public.review_packs%rowtype;
  v_rev public.reviews%rowtype;
  v_tutor uuid;
  v_prev_pack uuid;
begin
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.stage <> 'waiting' then
    raise exception 'Only a waiting pack can be released to the tutor (this one is %)', v_pack.stage using errcode = '23514';
  end if;
  if v_pack.hold_reason is not null then
    raise exception 'This pack is on hold (%). Release the hold first.', v_pack.hold_reason using errcode = '23514';
  end if;
  select * into v_rev from public.reviews r where r.id = v_pack.review_id;
  if v_rev.status <> 'open' then
    raise exception 'The review is already completed' using errcode = '23514';
  end if;
  select t.tutor_id into v_tutor
    from public.apprentice_tutors t where t.apprentice_id = v_pack.gta_id and t.end_date is null;
  if v_tutor is null then
    raise exception 'Apprentice % has no current tutor to release the pack to', v_pack.gta_id using errcode = '23514';
  end if;
  update public.review_packs
     set tutor_id = v_tutor, learner_snapshot = public.review_pack_snapshot(v_pack.review_id), snapshot_at = now()
   where id = p_pack_id;
  -- an empty form, the 7 progress areas, and last cycle's new targets as this cycle's previous targets
  insert into public.review_tutor_forms (pack_id) values (p_pack_id) on conflict (pack_id) do nothing;
  insert into public.review_progress_rows (pack_id, area)
  select p_pack_id, a.area
  from unnest(array['overall_progress','knowledge_theory','practical_skills','behaviours_attendance','english_maths','off_the_job','epa_gateway']) as a(area)
  on conflict (pack_id, area) do nothing;
  select p.id into v_prev_pack
    from public.review_packs p join public.reviews r on r.id = p.review_id
   where p.gta_id = v_pack.gta_id and r.status = 'completed' and p.stage = 'completed'
   order by r.actual_on desc limit 1;
  if v_prev_pack is not null then
    insert into public.review_targets (pack_id, kind, slot, action, owner, measure, target_date, status, carried_from_id)
    select p_pack_id, 'previous', t.slot, t.action, t.owner, t.measure, t.target_date, 'open', t.id
      from public.review_targets t
     where t.pack_id = v_prev_pack and t.kind = 'new' and t.action is not null
    on conflict (pack_id, kind, slot) do nothing;
  end if;
  perform public.review_pack_record(p_pack_id, 'released', 'with_tutor', p_source, p_system, now(),
    jsonb_build_object('tutor_id', v_tutor, 'planned_on', v_rev.planned_on));
end;
$$;

create or replace function public.release_review_to_tutor(p_pack_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  perform public.review_pack_release_core(p_pack_id, 'user', false);
end;
$$;

-- ---------- the tutor form: draft, completeness, submit ----------
create or replace function public.review_pack_apply_form(p_pack_id uuid, p_payload jsonb, p_is_staff boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_form jsonb := p_payload -> 'form';
  v_item jsonb;
  v_key text;
  v_area text;
  v_th numeric;
  v_ch numeric;
  v_kind text;
  v_slot integer;
  v_status text;
  v_action text;
  v_owner text;
  v_measure text;
  v_date date;
  v_carried uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'The form must be sent as a JSON object' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(p_payload) loop
    if v_key not in ('form','progress','targets') then
      raise exception 'Unknown key "%" in the form', v_key using errcode = '22023';
    end if;
  end loop;
  insert into public.review_tutor_forms (pack_id) values (p_pack_id) on conflict (pack_id) do nothing;

  if v_form is not null then
    if jsonb_typeof(v_form) <> 'object' then
      raise exception '"form" must be a JSON object' using errcode = '22023';
    end if;
    for v_key in select jsonb_object_keys(v_form) loop
      if v_key not in ('previous_summary','tutor_comment','apprentice_comment','employer_comment','reviewer_comment','agreed_summary','differing_views') then
        raise exception 'Unknown form field "%"', v_key using errcode = '22023';
      end if;
      if v_key in ('apprentice_comment','employer_comment','reviewer_comment','agreed_summary','differing_views') and not p_is_staff then
        raise exception 'Only staff fill in %', v_key using errcode = '42501';
      end if;
    end loop;
    update public.review_tutor_forms f set
      previous_summary = case when v_form ? 'previous_summary' then nullif(btrim(v_form ->> 'previous_summary'), '') else f.previous_summary end,
      tutor_comment = case when v_form ? 'tutor_comment' then nullif(btrim(v_form ->> 'tutor_comment'), '') else f.tutor_comment end,
      apprentice_comment = case when v_form ? 'apprentice_comment' then nullif(btrim(v_form ->> 'apprentice_comment'), '') else f.apprentice_comment end,
      employer_comment = case when v_form ? 'employer_comment' then nullif(btrim(v_form ->> 'employer_comment'), '') else f.employer_comment end,
      reviewer_comment = case when v_form ? 'reviewer_comment' then nullif(btrim(v_form ->> 'reviewer_comment'), '') else f.reviewer_comment end,
      agreed_summary = case when v_form ? 'agreed_summary' then nullif(btrim(v_form ->> 'agreed_summary'), '') else f.agreed_summary end,
      differing_views = case when v_form ? 'differing_views' then nullif(btrim(v_form ->> 'differing_views'), '') else f.differing_views end
    where f.pack_id = p_pack_id;
  end if;

  if p_payload ? 'progress' then
    if jsonb_typeof(p_payload -> 'progress') <> 'array' then
      raise exception '"progress" must be a list' using errcode = '22023';
    end if;
    for v_item in select e from jsonb_array_elements(p_payload -> 'progress') e loop
      v_area := v_item ->> 'area';
      if v_area is null or v_area not in ('overall_progress','knowledge_theory','practical_skills','behaviours_attendance','english_maths','off_the_job','epa_gateway') then
        raise exception 'Unknown progress area "%"', coalesce(v_area, 'null') using errcode = '22023';
      end if;
      insert into public.review_progress_rows (pack_id, area) values (p_pack_id, v_area) on conflict (pack_id, area) do nothing;
      update public.review_progress_rows r set
        evidence = case when v_item ? 'evidence' then nullif(btrim(v_item ->> 'evidence'), '') else r.evidence end,
        action_ref = case when v_item ? 'action_ref' then nullif(btrim(v_item ->> 'action_ref'), '') else r.action_ref end,
        rag = case when v_item ? 'rag' then nullif(btrim(v_item ->> 'rag'), '') else r.rag end,
        target_hours = case when v_item ? 'target_hours' then nullif(btrim(v_item ->> 'target_hours'), '')::numeric else r.target_hours end,
        current_hours = case when v_item ? 'current_hours' then nullif(btrim(v_item ->> 'current_hours'), '')::numeric else r.current_hours end
      where r.pack_id = p_pack_id and r.area = v_area;
      if v_area = 'off_the_job' then
        -- the rag follows the hours once both are given (otjTrackFromHours)
        select r.target_hours, r.current_hours into v_th, v_ch
          from public.review_progress_rows r where r.pack_id = p_pack_id and r.area = 'off_the_job';
        if v_th is not null and v_ch is not null and v_th > 0 then
          update public.review_progress_rows r set rag = case
              when v_ch / v_th < 0.8 then 'red'
              when v_ch / v_th < 0.95 then 'amber'
              when v_ch / v_th < 1.2 then 'green'
              else 'blue' end
          where r.pack_id = p_pack_id and r.area = 'off_the_job';
        end if;
      end if;
    end loop;
  end if;

  if p_payload ? 'targets' then
    if jsonb_typeof(p_payload -> 'targets') <> 'array' then
      raise exception '"targets" must be a list' using errcode = '22023';
    end if;
    for v_item in select e from jsonb_array_elements(p_payload -> 'targets') e loop
      v_kind := v_item ->> 'kind';
      v_slot := (v_item ->> 'slot')::integer;
      if v_kind is null or v_kind not in ('previous','new') or v_slot is null or v_slot not between 1 and 3 then
        raise exception 'A target needs kind previous or new and a slot from 1 to 3' using errcode = '22023';
      end if;
      if v_kind = 'previous' then
        -- previous targets come from the last review; the tutor can only mark how they went
        for v_key in select jsonb_object_keys(v_item) loop
          if v_key not in ('kind','slot','status') then
            raise exception 'A previous target can only have its status changed' using errcode = '22023';
          end if;
        end loop;
        v_status := v_item ->> 'status';
        if v_status is null or v_status not in ('open','met','partly','not-met','carry-forward') then
          raise exception 'Status must be open, met, partly, not-met or carry-forward' using errcode = '22023';
        end if;
        update public.review_targets t set status = v_status
         where t.pack_id = p_pack_id and t.kind = 'previous' and t.slot = v_slot;
        if not found then
          raise exception 'There is no previous target in slot %', v_slot using errcode = 'P0002';
        end if;
      else
        -- a new slot is replaced whole; an empty slot is removed
        v_action := nullif(btrim(v_item ->> 'action'), '');
        v_owner := nullif(btrim(v_item ->> 'owner'), '');
        v_measure := nullif(btrim(v_item ->> 'measure'), '');
        v_date := nullif(btrim(v_item ->> 'target_date'), '')::date;
        v_carried := nullif(btrim(v_item ->> 'carried_from_id'), '')::uuid;
        if v_carried is not null and not exists (
          select 1 from public.review_targets t where t.id = v_carried and t.pack_id = p_pack_id and t.kind = 'previous'
        ) then
          raise exception 'carried_from_id must be a previous target on this pack' using errcode = '22023';
        end if;
        if v_action is null and v_owner is null and v_measure is null and v_date is null then
          delete from public.review_targets t where t.pack_id = p_pack_id and t.kind = 'new' and t.slot = v_slot;
        else
          insert into public.review_targets (pack_id, kind, slot, action, owner, measure, target_date, status, carried_from_id)
          values (p_pack_id, 'new', v_slot, v_action, v_owner, v_measure, v_date, 'open', v_carried)
          on conflict (pack_id, kind, slot) do update
            set action = excluded.action, owner = excluded.owner, measure = excluded.measure,
                target_date = excluded.target_date, carried_from_id = excluded.carried_from_id;
        end if;
      end if;
    end loop;
  end if;
end;
$$;

-- What is still missing before the form can go back (mirrors tutorReviewFillProgress). An empty list means complete.
-- N/A (english_maths, epa_gateway) counts as an answer.
create or replace function public.review_pack_form_problems(p_pack_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  v_weeks integer;
  v_form public.review_tutor_forms%rowtype;
  v_problems text[] := '{}';
  v_started integer;
  r record;
begin
  select rv.interval_weeks into v_weeks
    from public.review_packs p join public.reviews rv on rv.id = p.review_id where p.id = p_pack_id;
  select * into v_form from public.review_tutor_forms f where f.pack_id = p_pack_id;
  if not found then
    return array['the form has not been started'];
  end if;
  if v_form.previous_summary is null then v_problems := v_problems || 'summary of the last review'::text; end if;
  if v_form.tutor_comment is null then v_problems := v_problems || 'tutor comment'::text; end if;

  select count(*) into v_started from public.review_targets t
   where t.pack_id = p_pack_id and t.kind = 'new'
     and (t.action is not null or t.owner is not null or t.measure is not null or t.target_date is not null);
  if v_started = 0 then v_problems := v_problems || 'at least one new target'::text; end if;
  for r in select t.slot, t.action, t.owner, t.measure, t.target_date from public.review_targets t
            where t.pack_id = p_pack_id and t.kind = 'new' order by t.slot loop
    if r.action is null or r.owner is null or r.measure is null then
      v_problems := v_problems || format('new target %s needs an action, owner and measure', r.slot);
    end if;
    if r.target_date is null then
      v_problems := v_problems || format('new target %s needs a date', r.slot);
    elsif r.target_date < v_today or r.target_date > v_today + (v_weeks * 7) then
      v_problems := v_problems || format('new target %s date must be between today and %s weeks from today', r.slot, v_weeks);
    end if;
  end loop;

  for r in select a.area, pr.evidence, pr.rag, pr.target_hours, pr.current_hours
             from unnest(array['overall_progress','knowledge_theory','practical_skills','behaviours_attendance','english_maths','off_the_job','epa_gateway']) with ordinality as a(area, n)
             left join public.review_progress_rows pr on pr.pack_id = p_pack_id and pr.area = a.area
            order by a.n loop
    if r.evidence is null then
      v_problems := v_problems || format('%s: evidence', r.area);
    end if;
    if r.area = 'off_the_job' then
      if r.target_hours is null or r.current_hours is null or r.target_hours = 0 then
        v_problems := v_problems || 'off_the_job: target and current hours'::text;
      end if;
    elsif r.rag is null or r.rag not in ('red','amber','green','na') then
      v_problems := v_problems || format('%s: red, amber, green or N/A', r.area);
    end if;
  end loop;

  for r in select t.slot from public.review_targets t
            where t.pack_id = p_pack_id and t.kind = 'previous' and t.action is not null and t.status = 'open' order by t.slot loop
    v_problems := v_problems || format('previous target %s needs a status', r.slot);
  end loop;
  for r in select t.slot from public.review_targets t
            where t.pack_id = p_pack_id and t.kind = 'previous' and t.status = 'carry-forward'
              and not exists (select 1 from public.review_targets n where n.pack_id = p_pack_id and n.kind = 'new' and n.carried_from_id = t.id)
            order by t.slot loop
    v_problems := v_problems || format('previous target %s is carried forward but has no new target', r.slot);
  end loop;
  return v_problems;
end;
$$;

-- Who may write to the form: a tutor only on their own pack while it is with the tutor; staff while it is with the tutor or later.
create or replace function public.review_pack_form_access(p_pack_id uuid, p_staff_stages text[])
returns public.review_packs
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack public.review_packs%rowtype;
  v_staff boolean := public.has_portal_role('Administrator','Management');
begin
  if not (v_staff or public.has_portal_role('Tutor')) then
    raise exception 'Tutor, Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if not v_staff and v_pack.tutor_id is distinct from v_uid then
    raise exception 'This pack is not yours' using errcode = '42501';
  end if;
  if v_staff then
    if not (v_pack.stage = any (p_staff_stages)) then
      raise exception 'The form cannot be changed while the pack is %', v_pack.stage using errcode = '23514';
    end if;
  elsif v_pack.stage <> 'with_tutor' then
    raise exception 'The form can only be changed while the pack is with the tutor (this one is %)', v_pack.stage using errcode = '23514';
  end if;
  return v_pack;
end;
$$;

create or replace function public.save_review_tutor_form(p_pack_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack public.review_packs%rowtype;
  v_staff boolean := public.has_portal_role('Administrator','Management');
begin
  v_pack := public.review_pack_form_access(p_pack_id, array['with_tutor','to_book','booked','reviewed']);
  perform public.review_pack_apply_form(p_pack_id, p_payload, v_staff);
  update public.review_tutor_forms set draft_saved_at = now(), draft_saved_by = v_uid where pack_id = p_pack_id;
  perform public.review_pack_record(p_pack_id, 'draft_saved', null, 'user', false, now(),
    jsonb_build_object('parts', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(p_payload) k)));
end;
$$;

create or replace function public.submit_review_tutor_form(p_pack_id uuid, p_payload jsonb default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack public.review_packs%rowtype;
  v_staff boolean := public.has_portal_role('Administrator','Management');
  v_problems text[];
begin
  v_pack := public.review_pack_form_access(p_pack_id, array['with_tutor']);
  if p_payload is not null then
    perform public.review_pack_apply_form(p_pack_id, p_payload, v_staff);
  end if;
  v_problems := public.review_pack_form_problems(p_pack_id);
  if cardinality(v_problems) > 0 then
    raise exception 'The form is not complete: %', array_to_string(v_problems, '; ') using errcode = '23514';
  end if;
  update public.review_tutor_forms
     set submitted_at = now(), submitted_by = v_uid, draft_saved_at = now(), draft_saved_by = v_uid, entry_method = 'portal'
   where pack_id = p_pack_id;
  perform public.review_pack_record(p_pack_id, 'submitted', 'to_book', 'user', false, now(), '{}'::jsonb);
  -- a visit that was booked while the pack was out goes straight on to booked
  perform public.review_pack_sync_booking(v_pack.review_id);
end;
$$;

-- ---------- recall ----------
create or replace function public.recall_review_to_tutor(p_pack_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pack public.review_packs%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.stage not in ('to_book','booked') then
    raise exception 'Only a pack that is back with you (to book or booked) can be recalled to the tutor (this one is %)', v_pack.stage using errcode = '23514';
  end if;
  -- the tutor can edit and send it back again; any booking stays as it is
  update public.review_tutor_forms set submitted_at = null, submitted_by = null where pack_id = p_pack_id;
  perform public.review_pack_record(p_pack_id, 'recalled', 'with_tutor', 'user', false, now(),
    jsonb_build_object('reason', nullif(btrim(p_reason), ''), 'tutor_id', v_pack.tutor_id));
end;
$$;

-- ---------- booking and completion hooks (called by the existing review functions below) ----------
-- A visit counts as booked once it has a date (or a phone day). A method with no date does not.
create or replace function public.review_pack_sync_booking(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pack public.review_packs%rowtype;
  v_b public.review_bookings%rowtype;
  v_has boolean;
begin
  select * into v_pack from public.review_packs p where p.review_id = p_review_id for update;
  if not found then
    return;
  end if;
  select * into v_b from public.review_bookings b where b.review_id = p_review_id;
  v_has := found and (v_b.appointment_on is not null or v_b.phone_day is not null);
  if v_has and v_pack.stage = 'to_book' then
    perform public.review_pack_record(v_pack.id, 'booked', 'booked', 'auto', false, now(),
      jsonb_build_object('method', v_b.method, 'appointment_on', v_b.appointment_on, 'phone_day', v_b.phone_day));
  elsif not v_has and v_pack.stage = 'booked' then
    perform public.review_pack_record(v_pack.id, 'booking_cleared', 'to_book', 'auto', false, now(),
      jsonb_build_object('method', v_b.method));
  end if;
end;
$$;

create or replace function public.review_pack_complete(p_review_id uuid, p_actual_on date)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pack public.review_packs%rowtype;
begin
  select * into v_pack from public.review_packs p where p.review_id = p_review_id for update;
  if not found or v_pack.stage = 'completed' then
    return;
  end if;
  perform public.review_pack_record(v_pack.id, 'completed', 'completed', 'auto', false, now(),
    jsonb_build_object('actual_on', p_actual_on, 'completed_from', v_pack.stage));
end;
$$;

-- ---------- reviewed ----------
create or replace function public.mark_review_reviewed(p_pack_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pack public.review_packs%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.stage <> 'booked' then
    raise exception 'Only a booked pack can be marked reviewed (this one is %)', v_pack.stage using errcode = '23514';
  end if;
  perform public.review_pack_record(p_pack_id, 'reviewed', 'reviewed', 'user', false, now(), '{}'::jsonb);
end;
$$;

-- ---------- hold ----------
create or replace function public.hold_review_pack(p_pack_id uuid, p_reason text, p_held_until date default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  v_pack public.review_packs%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'A reason is required to hold a pack' using errcode = '22023';
  end if;
  if p_held_until is not null and p_held_until < v_today then
    raise exception 'The hold date cannot be in the past' using errcode = '23514';
  end if;
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.stage not in ('waiting','with_tutor','to_book') then
    raise exception 'A pack can only be held before the visit is booked (this one is %)', v_pack.stage using errcode = '23514';
  end if;
  update public.review_packs set hold_reason = v_reason, held_until = p_held_until where id = p_pack_id;
  perform public.review_pack_record(p_pack_id, 'held', null, 'user', false, now(),
    jsonb_build_object('reason', v_reason, 'held_until', p_held_until,
                       'previous_reason', v_pack.hold_reason, 'previous_held_until', v_pack.held_until));
end;
$$;

create or replace function public.release_review_pack_hold(p_pack_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pack public.review_packs%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.hold_reason is null then
    return;
  end if;
  update public.review_packs set hold_reason = null, held_until = null where id = p_pack_id;
  perform public.review_pack_record(p_pack_id, 'hold_released', null, 'user', false, now(),
    jsonb_build_object('reason', v_pack.hold_reason, 'held_until', v_pack.held_until));
end;
$$;

-- ---------- signatures (staff record them at the visit) ----------
create or replace function public.record_review_signature(p_pack_id uuid, p_party text, p_signer_name text, p_signature_image text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pack public.review_packs%rowtype;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_party is null or p_party not in ('apprentice','employer','reviewer') then
    raise exception 'Party must be apprentice, employer or reviewer' using errcode = '22023';
  end if;
  if nullif(btrim(p_signer_name), '') is null then
    raise exception 'The signer''s name is required' using errcode = '22023';
  end if;
  if p_signature_image is null or p_signature_image not like 'data:image/%' or length(p_signature_image) > 300000 then
    raise exception 'The signature must be an image (data:image/...) of at most 300000 characters' using errcode = '22023';
  end if;
  select * into v_pack from public.review_packs p where p.id = p_pack_id for update;
  if not found then
    raise exception 'Review pack not found' using errcode = 'P0002';
  end if;
  if v_pack.stage not in ('booked','reviewed') then
    raise exception 'Signatures are recorded at the visit (the pack is %)', v_pack.stage using errcode = '23514';
  end if;
  insert into public.review_signatures (pack_id, party, signer_name, signature_image, recorded_by)
  values (p_pack_id, p_party, btrim(p_signer_name), p_signature_image, v_uid)
  on conflict (pack_id, party) do update
    set signer_name = excluded.signer_name, signature_image = excluded.signature_image,
        signed_at = now(), recorded_by = excluded.recorded_by;
  perform public.review_pack_record(p_pack_id, 'signature_recorded', null, 'user', false, now(),
    jsonb_build_object('party', p_party, 'signer_name', btrim(p_signer_name)));
end;
$$;

-- ---------- the daily job: release waiting packs at planned date minus 14 days, lift holds that have reached their date ----------
-- A pack is skipped (and counted) when it is held, the learner is not in learning, or the learner has no current tutor.
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
  v_lifted integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  for r in
    select p.id, p.hold_reason, p.held_until from public.review_packs p
     where p.hold_reason is not null and p.held_until is not null and p.held_until <= v_today
     order by p.held_until, p.id
  loop
    begin
      update public.review_packs set hold_reason = null, held_until = null where id = r.id;
      perform public.review_pack_record(r.id, 'hold_released', null, 'auto', true, now(),
        jsonb_build_object('reason', r.hold_reason, 'held_until', r.held_until, 'lifted_by', 'daily job'));
      v_lifted := v_lifted + 1;
    exception when others then
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object('pack_id', r.id, 'error', sqlerrm);
    end;
  end loop;

  for r in
    select p.id, p.gta_id, a.status as learner_status,
           exists (select 1 from public.apprentice_tutors t where t.apprentice_id = p.gta_id and t.end_date is null) as has_tutor
      from public.review_packs p
      join public.reviews rv on rv.id = p.review_id
      join public.apprentices a on a.gta_id = p.gta_id
     where p.stage = 'waiting' and p.hold_reason is null
       and rv.status = 'open' and rv.planned_on is not null and rv.planned_on - 14 <= v_today
     order by rv.planned_on, p.gta_id
  loop
    if r.learner_status <> 'in_learning' or not r.has_tutor then
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

  v_result := jsonb_build_object('date', v_today, 'released', v_released, 'holds_lifted', v_lifted,
                                 'skipped', v_skipped, 'failed', v_failed, 'errors', v_errors);
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (null, 'review_pack_job', v_today::text, 'daily_run',
          format('Daily review pack run %s: %s released, %s holds lifted, %s skipped, %s failed', v_today, v_released, v_lifted, v_skipped, v_failed),
          v_result);
  return v_result;
end;
$$;

-- ======================================================================================
-- Hooks: the existing review functions, with the pack and interval changes added.
-- ======================================================================================

-- open_review: record the interval the planned date was worked out with (the new pack comes from the reviews trigger)
create or replace function public.open_review(p_gta_id text, p_planned_on date default null::date)
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
  insert into public.reviews (gta_id, reviewer_id, planned_on, interval_weeks, status, source)
  values (p_gta_id, v_reviewer, v_planned, public.review_interval_weeks(p_gta_id), 'open', 'entered')
  returning id into v_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', v_id::text, 'opened',
          format('Review opened for %s, planned %s', p_gta_id, v_planned),
          jsonb_build_object('gta_id', p_gta_id, 'planned_on', v_planned, 'interval_weeks', public.review_interval_weeks(p_gta_id)));
  return v_id;
end;
$$;

-- complete_review: the pack completes, the next review is made at actual + interval (review_next_planned_on) with that
-- interval recorded, and the reviews trigger gives the next review its waiting pack.
create or replace function public.complete_review(p_review_id uuid, p_actual_on date, p_method text default null::text, p_notes text default null::text)
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
  -- the pack first, so dropping the booking below does not move it back to to_book
  perform public.review_pack_complete(p_review_id, p_actual_on);
  delete from public.review_bookings where review_id = p_review_id;
  update public.reviews
     set status = 'completed', actual_on = p_actual_on, method = v_method,
         notes = coalesce(nullif(btrim(p_notes), ''), notes)
   where id = p_review_id;
  v_next := public.review_next_planned_on(v_rev.gta_id);
  insert into public.reviews (gta_id, reviewer_id, planned_on, interval_weeks, status, source)
  values (v_rev.gta_id, v_rev.reviewer_id, v_next, public.review_interval_weeks(v_rev.gta_id), 'open', 'entered')
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

-- book_review: keeps the pack's to_book / booked stage in step
create or replace function public.book_review(p_review_id uuid, p_method text default 'in_person'::text, p_on date default null::date, p_minutes integer default null::integer, p_phone_day text default null::text)
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
  perform public.review_pack_sync_booking(p_review_id);
end;
$$;

-- clear_review_booking: a pack that was booked goes back to to_book
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
  perform public.review_pack_sync_booking(p_review_id);
end;
$$;

-- set_review_method can take a date away (a switch to phone), so it keeps the stage in step too
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
  if v_rev.status = 'open' then
    perform public.review_pack_sync_booking(p_review_id);
  end if;
end;
$$;

-- review_apply_concern_schedule: when the planned date is reworked from the interval, the interval used is recorded with it
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
  v_weeks integer := public.review_interval_weeks(p_gta_id);
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
  if v_next is null then
    return;
  end if;
  if v_rev.planned_on is not distinct from v_next then
    -- the date already fits the current interval; make the recorded interval agree
    if v_rev.interval_weeks <> v_weeks then
      update public.reviews set interval_weeks = v_weeks where id = v_rev.id;
      insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
      values (v_uid, 'review', v_rev.id::text, 'interval_set',
              format('Review for %s interval %s -> %s weeks (concern schedule)', p_gta_id, v_rev.interval_weeks, v_weeks),
              jsonb_build_object('gta_id', p_gta_id, 'old', v_rev.interval_weeks, 'new', v_weeks, 'reason', 'concern'));
    end if;
    return;
  end if;
  update public.reviews set planned_on = v_next, interval_weeks = v_weeks where id = v_rev.id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review', v_rev.id::text, 'rescheduled',
          format('Review for %s planned date %s -> %s (concern schedule)', p_gta_id, v_rev.planned_on, v_next),
          jsonb_build_object('gta_id', p_gta_id, 'old', v_rev.planned_on, 'new', v_next, 'reason', 'concern',
                             'interval_weeks', v_weeks));
end;
$$;

-- return_from_break: the next review is 70 days (10 weeks) from the return date, so the interval is 10
create or replace function public.return_from_break(p_break_id uuid, p_return_date date default null::date)
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
    update public.reviews set planned_on = v_date + 70, interval_weeks = 10 where id = v_rev.id;
    insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
    values (v_uid, 'review', v_rev.id::text, 'rescheduled',
            format('Review for %s planned date %s -> %s (10 weeks after return from break)', v_break.apprentice_id, v_rev.planned_on, v_date + 70),
            jsonb_build_object('gta_id', v_break.apprentice_id, 'old', v_rev.planned_on, 'new', v_date + 70,
                               'reason', 'return_from_break', 'break_id', p_break_id, 'interval_weeks', 10));
  end if;
end;
$$;

-- add_review_attachment: now takes the kind (default 'other', so existing callers keep working)
drop function public.add_review_attachment(uuid, text, text, bigint, text);
create or replace function public.add_review_attachment(p_review_id uuid, p_file_name text, p_content_type text, p_size_bytes bigint, p_storage_path text, p_kind text default 'other')
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
  if p_kind is null or p_kind not in ('review_pack','previous_review','returned_form','signed_review','other') then
    raise exception 'Kind must be review_pack, previous_review, returned_form, signed_review or other' using errcode = '22023';
  end if;
  select r.gta_id into v_gta from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'Review not found' using errcode = 'P0002';
  end if;
  insert into public.review_attachments (review_id, file_name, content_type, size_bytes, storage_path, uploaded_by, kind)
  values (p_review_id, btrim(p_file_name), p_content_type, p_size_bytes, p_storage_path, v_uid, p_kind)
  returning id into v_id;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (v_uid, 'review_attachment', v_id::text, 'added',
          format('Attachment added to review for %s', v_gta),
          jsonb_build_object('gta_id', v_gta, 'review_id', p_review_id, 'file_name', btrim(p_file_name),
                             'content_type', p_content_type, 'kind', p_kind));
  return v_id;
end;
$$;

-- ---------- grants ----------
-- internal: not callable by clients
revoke all on function public.review_pack_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.review_pack_record(uuid, text, text, text, boolean, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.reviews_create_pack() from public, anon, authenticated;
revoke all on function public.review_pack_release_core(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.review_pack_apply_form(uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.review_pack_form_problems(uuid) from public, anon, authenticated;
revoke all on function public.review_pack_form_access(uuid, text[]) from public, anon, authenticated;
revoke all on function public.review_pack_sync_booking(uuid) from public, anon, authenticated;
revoke all on function public.review_pack_complete(uuid, date) from public, anon, authenticated;
revoke all on function public.review_packs_run_daily() from public, anon, authenticated;
revoke all on function public.review_pack_events_append_only() from public, anon, authenticated;
grant execute on function public.review_pack_snapshot(uuid) to service_role;
grant execute on function public.review_pack_record(uuid, text, text, text, boolean, timestamptz, jsonb) to service_role;
grant execute on function public.review_pack_release_core(uuid, text, boolean) to service_role;
grant execute on function public.review_pack_apply_form(uuid, jsonb, boolean) to service_role;
grant execute on function public.review_pack_form_problems(uuid) to service_role;
grant execute on function public.review_pack_form_access(uuid, text[]) to service_role;
grant execute on function public.review_pack_sync_booking(uuid) to service_role;
grant execute on function public.review_pack_complete(uuid, date) to service_role;
grant execute on function public.review_packs_run_daily() to service_role;

-- client functions: a signed-in user (each checks the role itself)
revoke all on function public.release_review_to_tutor(uuid) from public, anon;
revoke all on function public.save_review_tutor_form(uuid, jsonb) from public, anon;
revoke all on function public.submit_review_tutor_form(uuid, jsonb) from public, anon;
revoke all on function public.recall_review_to_tutor(uuid, text) from public, anon;
revoke all on function public.mark_review_reviewed(uuid) from public, anon;
revoke all on function public.hold_review_pack(uuid, text, date) from public, anon;
revoke all on function public.release_review_pack_hold(uuid) from public, anon;
revoke all on function public.record_review_signature(uuid, text, text, text) from public, anon;
revoke all on function public.add_review_attachment(uuid, text, text, bigint, text, text) from public, anon;
grant execute on function public.release_review_to_tutor(uuid) to authenticated, service_role;
grant execute on function public.save_review_tutor_form(uuid, jsonb) to authenticated, service_role;
grant execute on function public.submit_review_tutor_form(uuid, jsonb) to authenticated, service_role;
grant execute on function public.recall_review_to_tutor(uuid, text) to authenticated, service_role;
grant execute on function public.mark_review_reviewed(uuid) to authenticated, service_role;
grant execute on function public.hold_review_pack(uuid, text, date) to authenticated, service_role;
grant execute on function public.release_review_pack_hold(uuid) to authenticated, service_role;
grant execute on function public.record_review_signature(uuid, text, text, text) to authenticated, service_role;
grant execute on function public.add_review_attachment(uuid, text, text, bigint, text, text) to authenticated, service_role;
-- the replaced functions keep their existing grants (create or replace does not change them)
