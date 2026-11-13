-- Website questionnaire version, and staff dashboard figures that leave out test answers.
-- Not applied until the redesign is approved.

insert into public.tutor_review_template_versions (label, is_default, title, intro, rating_help, scale, page_headings)
select 'v 13 Nov 2026 (2)', false, title, intro, rating_help, scale, page_headings
from public.tutor_review_template_versions
where label = 'v 13 Nov 2026'
  and not exists (select 1 from public.tutor_review_template_versions where label = 'v 13 Nov 2026 (2)');

insert into public.tutor_review_template_questions (version_id, page, position, code, text, help, kind, is_concern)
select next_version.id, question.page, question.position, question.code, question.text, question.help, question.kind, question.is_concern
from public.tutor_review_template_versions next_version
join public.tutor_review_template_versions previous on previous.label = 'v 13 Nov 2026'
join public.tutor_review_template_questions question on question.version_id = previous.id
where next_version.label = 'v 13 Nov 2026 (2)'
  and not exists (
    select 1 from public.tutor_review_template_questions existing
    where existing.version_id = next_version.id
  );

update public.tutor_review_template_questions question
   set kind = 'yes_no',
       text = case question.code
         when '06' then 'Does your tutor have the materials ready when learning activities start?'
         when '10' then 'Does your tutor treat you respectfully?'
         when '13' then 'Does your tutor explain what you will learn in each session?'
         when '16' then 'Does your tutor explain which skills you need to work on next?'
         else question.text
       end
  from public.tutor_review_template_versions version
 where question.version_id = version.id
   and version.label = 'v 13 Nov 2026 (2)'
   and question.code in ('06', '10', '13', '16');

update public.tutor_review_template_questions question
   set kind = 'yes_no'
  from public.tutor_review_template_versions version
 where question.version_id = version.id
   and version.label = 'v 13 Nov 2026 (2)'
   and question.code = 'concern';

insert into public.tutor_review_template_questions (version_id, page, position, code, text, help, kind, is_concern)
select version.id, 3, 20, 'concern_note', 'Please describe what concerns you.',
       'Describe any unhelpful or unproductive behaviour, anything you feel is inappropriate, and how it affects you or the class.',
       'text', true
from public.tutor_review_template_versions version
where version.label = 'v 13 Nov 2026 (2)'
  and not exists (
    select 1 from public.tutor_review_template_questions question
    where question.version_id = version.id and question.code = 'concern_note'
  );

update public.tutor_review_template_versions set is_default = false where is_default;
update public.tutor_review_template_versions set is_default = true where label = 'v 13 Nov 2026 (2)';

update public.tutor_review_rounds round
   set template_version_id = (select id from public.tutor_review_template_versions where label = 'v 13 Nov 2026 (2)')
 where round.label in ('December 2026', 'June 2027')
   and round.snapshotted_at is null
   and not exists (
     select 1
     from public.tutor_review_invites invite
     join public.apprentices apprentice on apprentice.gta_id = invite.apprentice_id
     where invite.round_id = round.id
       and apprentice.is_test is not true
   );

create or replace function public.tutor_review_questions_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_round uuid := coalesce(new.round_id, old.round_id);
begin
  if exists (
    select 1
      from public.tutor_review_invites invite
      join public.apprentices apprentice on apprentice.gta_id = invite.apprentice_id
     where invite.round_id = v_round
       and apprentice.is_test is not true
    union all
    select 1
      from public.tutor_review_responses response
     where response.round_id = v_round
       and response.is_test is not true
  ) then
    raise exception 'Questions are locked because this round already has invites or responses.' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

update public.tutor_review_questions question
   set kind = 'yes_no',
       text = case question.code
         when '06' then 'Does your tutor have the materials ready when learning activities start?'
         when '10' then 'Does your tutor treat you respectfully?'
         when '13' then 'Does your tutor explain what you will learn in each session?'
         when '16' then 'Does your tutor explain which skills you need to work on next?'
         else question.text
       end
  from public.tutor_review_rounds round
 where question.round_id = round.id
   and round.label in ('December 2026', 'June 2027')
   and round.snapshotted_at is null
   and question.code in ('06', '10', '13', '16', 'concern')
   and question.code <> 'concern';

update public.tutor_review_questions question
   set kind = 'yes_no'
  from public.tutor_review_rounds round
 where question.round_id = round.id
   and round.label in ('December 2026', 'June 2027')
   and question.code = 'concern';

insert into public.tutor_review_questions (round_id, page, position, code, text, help, kind, is_concern)
select round.id, 3, 20, 'concern_note', 'Please describe what concerns you.',
       'Describe any unhelpful or unproductive behaviour, anything you feel is inappropriate, and how it affects you or the class.',
       'text', true
from public.tutor_review_rounds round
where round.label in ('December 2026', 'June 2027')
  and not exists (
    select 1 from public.tutor_review_questions question
    where question.round_id = round.id and question.code = 'concern_note'
  );

create index if not exists tutor_review_invites_round_tutor_idx
  on public.tutor_review_invites (round_id, tutor_id);

create index if not exists tutor_review_email_attempts_round_status_idx
  on public.tutor_review_email_attempts (round_id, status);

create or replace view public.tutor_review_round_kpis
with (security_invoker = true) as
select round.id as round_id,
       count(invite.id) filter (where apprentice.is_test is not true) as invited,
       count(invite.id) filter (where apprentice.is_test is not true and invite.used_at is not null) as submitted,
       count(invite.id) filter (where apprentice.is_test is not true and nullif(btrim(coalesce(apprentice.email, '')), '') is null) as no_email,
       count(distinct attempt.id) filter (where attempt.status in ('failed', 'bounced') and apprentice.is_test is not true) as failed_emails
  from public.tutor_review_rounds round
  left join public.tutor_review_invites invite on invite.round_id = round.id
  left join public.apprentices apprentice on apprentice.gta_id = invite.apprentice_id
  left join public.tutor_review_email_attempts attempt on attempt.round_id = round.id and attempt.apprentice_id = invite.apprentice_id
 group by round.id;

create or replace view public.tutor_review_tutor_response_rates
with (security_invoker = true) as
select invite.round_id,
       invite.tutor_id,
       count(*) filter (where apprentice.is_test is not true) as invited,
       count(*) filter (where apprentice.is_test is not true and invite.used_at is not null) as submitted
  from public.tutor_review_invites invite
  join public.apprentices apprentice on apprentice.gta_id = invite.apprentice_id
 group by invite.round_id, invite.tutor_id;

create or replace view public.tutor_review_tutor_scores
with (security_invoker = true) as
select response.round_id,
       response.tutor_id,
       question.code,
       question.kind,
       count(distinct response.id) as response_count,
       case when count(distinct response.id) >= 3 and question.kind = 'rating_1_5' then round(avg(answer.rating)::numeric, 1) end as average_rating,
       case when count(distinct response.id) >= 3 and question.kind = 'yes_no'
            then round(100.0 * count(answer.id) filter (where answer.yes_answer) / nullif(count(answer.id) filter (where answer.yes_answer is not null), 0))
       end as yes_percent
  from public.tutor_review_responses response
  join public.tutor_review_questions question on question.round_id = response.round_id
  left join public.tutor_review_answers answer on answer.response_id = response.id and answer.question_id = question.id
 where response.is_test is not true
 group by response.round_id, response.tutor_id, question.code, question.kind;

create or replace view public.tutor_review_needs_attention
with (security_invoker = true) as
select attempt.round_id, 'failed_email'::text as kind, attempt.email as detail
  from public.tutor_review_email_attempts attempt
  join public.apprentices apprentice on apprentice.gta_id = attempt.apprentice_id
 where attempt.status in ('failed', 'bounced')
   and apprentice.is_test is not true
union all
select invite.round_id, 'no_email'::text, invite.apprentice_id
  from public.tutor_review_invites invite
  join public.apprentices apprentice on apprentice.gta_id = invite.apprentice_id
 where apprentice.is_test is not true
   and nullif(btrim(coalesce(apprentice.email, '')), '') is null
union all
select concern.round_id, 'concern'::text, concern.answer
  from public.tutor_review_concerns concern;

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
    'roundLabel', v_round.label,
    'closesOn', v_round.closes_on,
    'title', v_round.title,
    'intro', v_round.intro,
    'ratingHelp', v_round.rating_help,
    'scale', v_round.scale,
    'pageHeadings', v_round.page_headings,
    'questions', coalesce(v_questions, '[]'::jsonb)
  );
end;
$$;
