-- Review cycle build (not applied). Reiss approves before this runs on the live database.
--
-- 1. Safeguarding becomes one-way.
--    reverse_safeguarding_signoff now always raises "A safeguarding sign-off cannot be undone".
--    The row trigger rejects every update, so reversed_at can no longer be set.
--    The Plan page no longer offers Undo. This function still raises so no other path can unsign.
--
-- 2. record_cycle_safeguarding(p_gta_ids text[]) records today's London date and the signed-in user
--    for each apprentice who is not already signed. Every id in the list must share the same current
--    employer manager and the same programme. It returns how many new sign-offs were written.
--    There is no unsign function.
--
-- 3. set_open_review_reviewer(p_review_id uuid, p_reviewer_id uuid) lets Administrator or Management
--    change the reviewer on an open review to someone who is already in review_reviewers.
--
-- 4. review_pack_form_problems no longer treats rag 'na' as a complete progress colour.
--    N/A still fills the evidence comment. Send still requires red, amber or green, matching the form.

create or replace function public.safeguarding_signoffs_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  raise exception 'A safeguarding sign-off cannot be changed' using errcode = '23514';
end;
$$;

create or replace function public.reverse_safeguarding_signoff(p_signoff_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  raise exception 'A safeguarding sign-off cannot be undone' using errcode = '23514';
end;
$$;

create or replace function public.record_cycle_safeguarding(p_gta_ids text[])
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/London')::date;
  v_manager text;
  v_programme text;
  v_count integer := 0;
  v_id uuid;
  v_gta text;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if p_gta_ids is null or cardinality(p_gta_ids) = 0 then
    raise exception 'Choose at least one apprentice' using errcode = '22023';
  end if;

  select count(distinct (e.manager_id, a.programme_id))
    into v_count
  from unnest(p_gta_ids) as requested(gta_id)
  join public.apprentices a on a.gta_id = requested.gta_id
  join public.apprentice_employments e on e.gta_id = a.gta_id and e.end_date is null
  where e.manager_id is not null and a.programme_id is not null;

  if v_count <> 1 or cardinality(p_gta_ids) <> (
    select count(distinct requested.gta_id)
    from unnest(p_gta_ids) as requested(gta_id)
    join public.apprentices a on a.gta_id = requested.gta_id
    join public.apprentice_employments e on e.gta_id = a.gta_id and e.end_date is null
    where e.manager_id is not null and a.programme_id is not null
  ) then
    raise exception 'Safeguarding can only be signed for apprentices with the same manager and programme' using errcode = '23514';
  end if;

  select e.manager_id::text, a.programme_id::text into v_manager, v_programme
  from unnest(p_gta_ids) as requested(gta_id)
  join public.apprentices a on a.gta_id = requested.gta_id
  join public.apprentice_employments e on e.gta_id = a.gta_id and e.end_date is null
  limit 1;

  v_count := 0;
  for v_gta in select distinct requested.gta_id from unnest(p_gta_ids) as requested(gta_id) loop
    if exists (
      select 1 from public.apprentice_safeguarding_signoffs s
      where s.gta_id = v_gta and s.reversed_at is null
    ) then
      continue;
    end if;
    insert into public.apprentice_safeguarding_signoffs (gta_id, signed_on, source, recorded_by)
    values (v_gta, v_today, 'entered', v_uid)
    returning id into v_id;
    insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
    values (
      v_uid, 'safeguarding_signoff', v_id::text, 'recorded',
      format('Safeguarding sign-off recorded for %s on %s', v_gta, v_today),
      jsonb_build_object('gta_id', v_gta, 'signed_on', v_today, 'source', 'entered', 'one_way', true,
                         'manager_id', v_manager, 'programme_id', v_programme)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.set_open_review_reviewer(p_review_id uuid, p_reviewer_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_gta text;
begin
  if not public.has_portal_role('Administrator','Management') then
    raise exception 'Administrator or Management role required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.review_reviewers r where r.profile_id = p_reviewer_id) then
    raise exception 'Choose a reviewer from the review reviewer list' using errcode = '22023';
  end if;
  update public.reviews
     set reviewer_id = p_reviewer_id
   where id = p_review_id and status = 'open'
   returning gta_id into v_gta;
  if not found then
    raise exception 'Only an open review can change reviewer' using errcode = '23514';
  end if;
  insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
  values (
    v_uid, 'review', p_review_id::text, 'reviewer_changed',
    format('Reviewer for %s set to %s', v_gta, p_reviewer_id),
    jsonb_build_object('gta_id', v_gta, 'reviewer_id', p_reviewer_id)
  );
end;
$$;

revoke all on function public.record_cycle_safeguarding(text[]) from public, anon;
revoke all on function public.set_open_review_reviewer(uuid, uuid) from public, anon;
grant execute on function public.record_cycle_safeguarding(text[]) to authenticated, service_role;
grant execute on function public.set_open_review_reviewer(uuid, uuid) to authenticated, service_role;

-- N/A fills the evidence text. It is not a passing colour. Same rule as the tutor form.
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
    elsif r.rag is null or r.rag not in ('red','amber','green') then
      v_problems := v_problems || format('%s: red, amber or green', r.area);
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
