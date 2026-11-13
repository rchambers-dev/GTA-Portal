-- Test invites can open a draft round. Their answers are stored separately and left out of reports.
-- Reset clears those answers and keeps the same link.

alter table public.tutor_review_responses
  add column if not exists is_test boolean not null default false;

alter table public.tutor_review_invites
  add column if not exists access_token text;

update public.tutor_review_invites invite
   set access_token = 'vhPcNk8W7h6sLlmZHU-2U57o2y8G662A0giDpmRgCTA'
 where invite.token_hash = public.tutor_review_token_hash('vhPcNk8W7h6sLlmZHU-2U57o2y8G662A0giDpmRgCTA')
   and exists (
     select 1 from public.apprentices apprentice
     where apprentice.gta_id = invite.apprentice_id and apprentice.is_test
   );

create or replace function public.tutor_review_gate(
  p_status text,
  p_opens date,
  p_closes date,
  p_closed_early timestamptz,
  p_used timestamptz,
  p_today date,
  p_test boolean
)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when p_used is not null then 'submitted'
    when p_status = 'closed' or p_closed_early is not null or p_today > p_closes then 'closed'
    when p_test then 'ready'
    when p_status <> 'open' or p_today < p_opens then 'not_open'
    else 'ready'
  end;
$$;

revoke all on function public.tutor_review_gate(text, date, date, timestamptz, timestamptz, date, boolean) from public, anon, authenticated;

create or replace function public.get_tutor_review_form(p_token text)
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
  v_questions jsonb;
  v_test boolean := false;
begin
  select * into v_invite from public.tutor_review_invites where token_hash = public.tutor_review_token_hash(p_token);
  if not found then
    return jsonb_build_object('state', 'invalid', 'isTest', false);
  end if;
  select * into v_round from public.tutor_review_rounds where id = v_invite.round_id;
  select exists (
    select 1 from public.apprentices apprentice
    where apprentice.gta_id = v_invite.apprentice_id and apprentice.is_test
  ) into v_test;
  v_state := public.tutor_review_gate(v_round.status, v_round.opens_on, v_round.closes_on, v_round.closed_early_at, v_invite.used_at, v_today, v_test);
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', q.code, 'page', q.page, 'position', q.position, 'text', q.text, 'help', q.help, 'kind', q.kind, 'isConcern', q.is_concern
  ) order by q.position), '[]'::jsonb)
  into v_questions
  from public.tutor_review_questions q
  where q.round_id = v_round.id and v_state = 'ready';
  return jsonb_build_object(
    'state', v_state,
    'isTest', v_test,
    'title', v_round.title,
    'intro', v_round.intro,
    'ratingHelp', v_round.rating_help,
    'scale', v_round.scale,
    'pageHeadings', v_round.page_headings,
    'questions', coalesce(v_questions, '[]'::jsonb)
  );
end;
$$;

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
  v_test boolean := false;
begin
  select * into v_invite from public.tutor_review_invites where token_hash = public.tutor_review_token_hash(p_token) for update;
  if not found then
    return jsonb_build_object('state', 'invalid');
  end if;
  select * into v_round from public.tutor_review_rounds where id = v_invite.round_id;
  select exists (
    select 1 from public.apprentices apprentice
    where apprentice.gta_id = v_invite.apprentice_id and apprentice.is_test
  ) into v_test;
  v_state := public.tutor_review_gate(v_round.status, v_round.opens_on, v_round.closes_on, v_round.closed_early_at, v_invite.used_at, v_today, v_test);
  if v_state <> 'ready' then
    return jsonb_build_object('state', v_state);
  end if;

  update public.tutor_review_invites set used_at = now() where id = v_invite.id and used_at is null returning id into v_marked;
  if v_marked is null then
    return jsonb_build_object('state', 'submitted');
  end if;

  insert into public.tutor_review_responses (round_id, tutor_id, submitted_on, is_test)
  values (v_round.id, v_invite.tutor_id, v_today, v_test)
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

create or replace function public.reset_tutor_review_test(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'You do not have permission to change tutor reviews.' using errcode = '42501';
  end if;
  delete from public.tutor_review_answers answer
   using public.tutor_review_responses response
   where answer.response_id = response.id
     and response.round_id = p_round_id
     and response.is_test;
  delete from public.tutor_review_responses
   where round_id = p_round_id and is_test;
  update public.tutor_review_invites invite
     set used_at = null
   where invite.round_id = p_round_id
     and exists (
       select 1 from public.apprentices apprentice
       where apprentice.gta_id = invite.apprentice_id and apprentice.is_test
     );
end;
$$;

revoke all on function public.reset_tutor_review_test(uuid) from public, anon;
grant execute on function public.reset_tutor_review_test(uuid) to authenticated, service_role;

create or replace view public.tutor_review_question_stats as
select r.round_id,
       r.tutor_id,
       q.id as question_id,
       q.code,
       q.kind,
       q.is_concern,
       count(distinct r.id) as response_count,
       case when count(distinct r.id) >= 3 then round(avg(a.rating)::numeric, 1) else null end as average_rating
  from public.tutor_review_responses r
  join public.tutor_review_questions q on q.round_id = r.round_id
  left join public.tutor_review_answers a on a.response_id = r.id and a.question_id = q.id
 where r.is_test is not true
 group by r.round_id, r.tutor_id, q.id, q.code, q.kind, q.is_concern;

create or replace view public.tutor_review_concerns as
select r.round_id,
       r.tutor_id,
       q.text as question,
       a.text_answer as answer
  from public.tutor_review_answers a
  join public.tutor_review_responses r on r.id = a.response_id
  join public.tutor_review_questions q on q.id = a.question_id
 where q.is_concern
   and r.is_test is not true
   and nullif(btrim(a.text_answer), '') is not null;

alter view public.tutor_review_question_stats set (security_invoker = true);
alter view public.tutor_review_concerns set (security_invoker = true);
