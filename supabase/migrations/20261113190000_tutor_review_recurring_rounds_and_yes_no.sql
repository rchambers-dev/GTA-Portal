-- Keep the next two December and June rounds present, and accept Yes/No questions.

alter table public.tutor_review_questions drop constraint tutor_review_questions_kind_check;
alter table public.tutor_review_questions
  add constraint tutor_review_questions_kind_check check (kind in ('rating_1_5', 'text', 'yes_no'));

alter table public.tutor_review_template_questions drop constraint tutor_review_template_questions_kind_check;
alter table public.tutor_review_template_questions
  add constraint tutor_review_template_questions_kind_check check (kind in ('rating_1_5', 'text', 'yes_no'));

alter table public.tutor_review_answers
  add column if not exists yes_answer boolean;

create or replace function public.submit_tutor_review(p_token text, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_today date := (now() at time zone 'Europe/London')::date;
  v_invite public.tutor_review_invites%rowtype;
  v_round public.tutor_review_rounds%rowtype;
  v_state text;
  v_response uuid;
  v_item jsonb;
  v_question public.tutor_review_questions%rowtype;
  v_rating smallint;
  v_text text;
  v_marked uuid;
  v_yes boolean;
begin
  select * into v_invite from public.tutor_review_invites where token_hash = public.tutor_review_token_hash(p_token) for update;
  if not found then
    return jsonb_build_object('state', 'invalid');
  end if;
  select * into v_round from public.tutor_review_rounds where id = v_invite.round_id;
  v_state := public.tutor_review_gate(v_round.status, v_round.opens_on, v_round.closes_on, v_round.closed_early_at, v_invite.used_at, v_today);
  if v_state <> 'ready' then
    return jsonb_build_object('state', v_state);
  end if;

  update public.tutor_review_invites set used_at = now() where id = v_invite.id and used_at is null returning id into v_marked;
  if v_marked is null then
    return jsonb_build_object('state', 'submitted');
  end if;

  insert into public.tutor_review_responses (round_id, tutor_id, submitted_on)
  values (v_round.id, v_invite.tutor_id, v_today)
  returning id into v_response;

  for v_item in select * from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) loop
    select * into v_question from public.tutor_review_questions
    where round_id = v_round.id and code = v_item ->> 'code';
    if not found then
      raise exception 'Unknown question' using errcode = '22023';
    end if;
    if v_question.kind = 'rating_1_5' then
      if nullif(v_item ->> 'rating', '') is null then
        continue;
      end if;
      v_rating := (v_item ->> 'rating')::smallint;
      if v_rating < 1 or v_rating > 5 then
        raise exception 'A rating must be from 1 to 5' using errcode = '22023';
      end if;
      insert into public.tutor_review_answers (response_id, question_id, rating) values (v_response, v_question.id, v_rating);
    elsif v_question.kind = 'yes_no' then
      if jsonb_typeof(v_item -> 'yes') is distinct from 'boolean' then
        continue;
      end if;
      v_yes := (v_item ->> 'yes')::boolean;
      insert into public.tutor_review_answers (response_id, question_id, yes_answer) values (v_response, v_question.id, v_yes);
    else
      v_text := nullif(btrim(coalesce(v_item ->> 'text', '')), '');
      if v_text is null then
        continue;
      end if;
      insert into public.tutor_review_answers (response_id, question_id, text_answer) values (v_response, v_question.id, v_text);
    end if;
  end loop;

  return jsonb_build_object('state', 'submitted');
end;
$$;

create or replace function public.ensure_tutor_review_rounds(p_today date default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'Europe/London')::date);
  v_template public.tutor_review_template_versions%rowtype;
  v_created integer := 0;
begin
  if (select auth.uid()) is not null and not public.has_portal_role('Administrator', 'Management') then
    raise exception 'You do not have permission to change tutor reviews.' using errcode = '42501';
  end if;

  select * into v_template
  from public.tutor_review_template_versions
  where is_default
  order by created_at desc
  limit 1;

  with years as (
    select (extract(year from v_today)::integer + g.offset) as year
    from generate_series(-1, 2) as g(offset)
  ),
  june as (
    select 'June ' || year::text as label,
           (make_date(year, 6, 7) + ((1 - extract(dow from make_date(year, 6, 7))::integer + 7) % 7))::date as opens_on
    from years
  ),
  december as (
    select 'December ' || year::text as label,
           (make_date(year, 12, 1) + ((1 - extract(dow from make_date(year, 12, 1))::integer + 7) % 7))::date as opens_on
    from years
  ),
  windows as (
    select label, opens_on, (opens_on + 18)::date as closes_on from june
    union all
    select label, opens_on,
           case
             when (opens_on + 18) >= make_date(extract(year from opens_on)::integer, 12, 25) then (opens_on + 11)
             else (opens_on + 18)
           end::date as closes_on
    from december
  ),
  next_two as (
    select label, opens_on, closes_on
    from windows
    where closes_on >= v_today
    order by opens_on
    limit 2
  )
  insert into public.tutor_review_rounds (
    label, opens_on, closes_on, status, title, intro, rating_help, scale, page_headings, template_version_id
  )
  select n.label,
         n.opens_on,
         n.closes_on,
         'draft',
         coalesce(v_template.title, 'Apprentice tutor review'),
         coalesce(v_template.intro, 'Think about your sessions with this tutor over the last four weeks.'),
         coalesce(v_template.rating_help, 'Select one rating per statement. Leave blank if you have not experienced it.'),
         coalesce(v_template.scale, '[{"value":1,"label":"Never"},{"value":2,"label":"Rarely"},{"value":3,"label":"Sometimes"},{"value":4,"label":"Often"},{"value":5,"label":"Always"}]'::jsonb),
         coalesce(v_template.page_headings, '{"1":null,"2":"Your teaching experience","3":"Your feedback"}'::jsonb),
         v_template.id
  from next_two n
  where not exists (select 1 from public.tutor_review_rounds r where r.label = n.label);
  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

revoke all on function public.ensure_tutor_review_rounds(date) from public, anon;
grant execute on function public.ensure_tutor_review_rounds(date) to authenticated, service_role;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('ensure_tutor_review_rounds');
    exception when others then
      null;
    end;
    perform cron.schedule(
      'ensure_tutor_review_rounds',
      '0 6 * * *',
      'select public.ensure_tutor_review_rounds(null)'
    );
  end if;
exception when others then
  null;
end
$cron$;
