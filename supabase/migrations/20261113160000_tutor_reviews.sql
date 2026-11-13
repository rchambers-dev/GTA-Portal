-- Confidential apprentice-to-tutor feedback.
-- Staff (Administrator and Management) read the admin tables.
-- An apprentice opens a one-time link. Anon can only call the two functions below.
-- Responses store the tutor and the date, never the apprentice or the invite.
-- Seeded rounds stay draft so a preview of the live database cannot collect answers.

create table public.tutor_review_rounds (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  opens_on date not null,
  closes_on date not null,
  status text not null default 'draft',
  closed_early_at timestamptz,
  title text not null,
  intro text not null,
  rating_help text not null,
  scale jsonb not null,
  page_headings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_review_rounds_label_key unique (label),
  constraint tutor_review_rounds_status_check check (status in ('draft', 'open', 'closed')),
  constraint tutor_review_rounds_dates_check check (closes_on >= opens_on),
  constraint tutor_review_rounds_scale_check check (jsonb_typeof(scale) = 'array' and jsonb_array_length(scale) = 5)
);

create table public.tutor_review_questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.tutor_review_rounds (id) on delete cascade,
  page integer not null,
  position integer not null,
  code text not null,
  text text not null,
  help text,
  kind text not null,
  is_concern boolean not null default false,
  constraint tutor_review_questions_round_code_key unique (round_id, code),
  constraint tutor_review_questions_round_position_key unique (round_id, position),
  constraint tutor_review_questions_page_check check (page between 1 and 3),
  constraint tutor_review_questions_kind_check check (kind in ('rating_1_5', 'text'))
);

create table public.tutor_review_invites (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.tutor_review_rounds (id) on delete cascade,
  apprentice_id text not null references public.apprentices (gta_id),
  tutor_id uuid not null references public.profiles (id),
  token_hash text not null unique,
  email_sent_to text,
  sent_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tutor_review_invites_round_apprentice_key unique (round_id, apprentice_id)
);

create table public.tutor_review_responses (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.tutor_review_rounds (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id),
  submitted_on date not null
);

create table public.tutor_review_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.tutor_review_responses (id) on delete cascade,
  question_id uuid not null references public.tutor_review_questions (id) on delete restrict,
  rating smallint,
  text_answer text,
  constraint tutor_review_answers_response_question_key unique (response_id, question_id),
  constraint tutor_review_answers_rating_check check (rating is null or rating between 1 and 5)
);

create index tutor_review_responses_round_tutor_idx on public.tutor_review_responses (round_id, tutor_id);
create index tutor_review_answers_response_idx on public.tutor_review_answers (response_id);

create or replace function public.tutor_review_questions_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_round uuid := coalesce(new.round_id, old.round_id);
begin
  if exists (
    select 1 from public.tutor_review_invites i where i.round_id = v_round
    union all
    select 1 from public.tutor_review_responses r where r.round_id = v_round
  ) then
    raise exception 'Questions are locked because this round already has invites or responses.' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger tutor_review_questions_guard
before insert or update or delete on public.tutor_review_questions
for each row execute function public.tutor_review_questions_guard();

create or replace function public.tutor_review_rounds_guard()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.title is distinct from old.title
     or new.intro is distinct from old.intro
     or new.rating_help is distinct from old.rating_help
     or new.scale is distinct from old.scale
     or new.page_headings is distinct from old.page_headings then
    if exists (
      select 1 from public.tutor_review_invites i where i.round_id = new.id
      union all
      select 1 from public.tutor_review_responses r where r.round_id = new.id
    ) then
      raise exception 'Questions are locked because this round already has invites or responses.' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

create trigger tutor_review_rounds_guard
before update on public.tutor_review_rounds
for each row execute function public.tutor_review_rounds_guard();

create or replace function public.tutor_review_token_hash(p_token text)
returns text
language sql
immutable
set search_path to ''
as $$
  select encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.tutor_review_gate(
  p_status text,
  p_opens date,
  p_closes date,
  p_closed_early timestamptz,
  p_used timestamptz,
  p_today date
)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when p_used is not null then 'submitted'
    when p_status = 'closed' or p_closed_early is not null or p_today > p_closes then 'closed'
    when p_status <> 'open' or p_today < p_opens then 'not_open'
    else 'ready'
  end;
$$;

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
begin
  select * into v_invite from public.tutor_review_invites where token_hash = public.tutor_review_token_hash(p_token);
  if not found then
    return jsonb_build_object('state', 'invalid');
  end if;
  select * into v_round from public.tutor_review_rounds where id = v_invite.round_id;
  v_state := public.tutor_review_gate(v_round.status, v_round.opens_on, v_round.closes_on, v_round.closed_early_at, v_invite.used_at, v_today);
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', q.code, 'page', q.page, 'position', q.position, 'text', q.text, 'help', q.help, 'kind', q.kind, 'isConcern', q.is_concern
  ) order by q.position), '[]'::jsonb)
  into v_questions
  from public.tutor_review_questions q
  where q.round_id = v_round.id and v_state = 'ready';
  return jsonb_build_object(
    'state', v_state,
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

-- Averages and comments stay hidden below 3 responses. Concerns stay visible and anonymous.
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
 group by r.round_id, r.tutor_id, q.id, q.code, q.kind, q.is_concern;

create or replace view public.tutor_review_concerns as
select r.round_id,
       r.tutor_id,
       q.text as question,
       a.text_answer as answer
  from public.tutor_review_answers a
  join public.tutor_review_responses r on r.id = a.response_id
  join public.tutor_review_questions q on q.id = a.question_id
 where q.is_concern and nullif(btrim(a.text_answer), '') is not null;

alter view public.tutor_review_question_stats set (security_invoker = true);
alter view public.tutor_review_concerns set (security_invoker = true);

alter table public.tutor_review_rounds enable row level security;
alter table public.tutor_review_questions enable row level security;
alter table public.tutor_review_invites enable row level security;
alter table public.tutor_review_responses enable row level security;
alter table public.tutor_review_answers enable row level security;

create policy tutor_review_rounds_staff on public.tutor_review_rounds
  for all to authenticated
  using ((select public.has_portal_role('Administrator', 'Management')))
  with check ((select public.has_portal_role('Administrator', 'Management')));
create policy tutor_review_questions_staff on public.tutor_review_questions
  for all to authenticated
  using ((select public.has_portal_role('Administrator', 'Management')))
  with check ((select public.has_portal_role('Administrator', 'Management')));
create policy tutor_review_invites_staff on public.tutor_review_invites
  for all to authenticated
  using ((select public.has_portal_role('Administrator', 'Management')))
  with check ((select public.has_portal_role('Administrator', 'Management')));
create policy tutor_review_responses_staff on public.tutor_review_responses
  for all to authenticated
  using ((select public.has_portal_role('Administrator', 'Management')))
  with check ((select public.has_portal_role('Administrator', 'Management')));
create policy tutor_review_answers_staff on public.tutor_review_answers
  for all to authenticated
  using ((select public.has_portal_role('Administrator', 'Management')))
  with check ((select public.has_portal_role('Administrator', 'Management')));

revoke all on public.tutor_review_rounds, public.tutor_review_questions, public.tutor_review_invites, public.tutor_review_responses, public.tutor_review_answers from public, anon;
grant select, insert, update, delete on public.tutor_review_rounds, public.tutor_review_questions, public.tutor_review_invites, public.tutor_review_responses, public.tutor_review_answers to authenticated, service_role;

revoke all on public.tutor_review_question_stats, public.tutor_review_concerns from public, anon;
grant select on public.tutor_review_question_stats, public.tutor_review_concerns to authenticated, service_role;

revoke all on function public.tutor_review_token_hash(text) from public, anon, authenticated;
revoke all on function public.tutor_review_gate(text, date, date, timestamptz, timestamptz, date) from public, anon, authenticated;
revoke all on function public.tutor_review_questions_guard() from public, anon, authenticated;
revoke all on function public.tutor_review_rounds_guard() from public, anon, authenticated;
grant execute on function public.tutor_review_token_hash(text) to service_role;
grant execute on function public.get_tutor_review_form(text) to anon, authenticated, service_role;
grant execute on function public.submit_tutor_review(text, jsonb) to anon, authenticated, service_role;
revoke all on function public.get_tutor_review_form(text) from public;
revoke all on function public.submit_tutor_review(text, jsonb) from public;

create or replace function public.save_tutor_review_questionnaire(
  p_round_id uuid,
  p_title text,
  p_intro text,
  p_rating_help text,
  p_scale jsonb,
  p_page_headings jsonb,
  p_questions jsonb
) returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_item jsonb;
  v_position integer := 0;
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'You do not have permission to change tutor reviews.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tutor_review_rounds where id = p_round_id) then
    raise exception 'That round could not be found.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.tutor_review_invites i where i.round_id = p_round_id
    union all
    select 1 from public.tutor_review_responses r where r.round_id = p_round_id
  ) then
    raise exception 'Questions are locked because this round already has invites or responses.' using errcode = '55000';
  end if;
  if jsonb_typeof(p_scale) <> 'array' or jsonb_array_length(p_scale) <> 5 then
    raise exception 'Each point on the rating scale needs a label.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) < 1 then
    raise exception 'Add at least one question.' using errcode = '22023';
  end if;

  update public.tutor_review_rounds
     set title = btrim(p_title),
         intro = btrim(p_intro),
         rating_help = btrim(p_rating_help),
         scale = p_scale,
         page_headings = p_page_headings,
         updated_at = now()
   where id = p_round_id;

  delete from public.tutor_review_questions where round_id = p_round_id;

  for v_item in select * from jsonb_array_elements(p_questions) loop
    v_position := v_position + 1;
    if nullif(btrim(coalesce(v_item ->> 'text', '')), '') is null then
      raise exception 'Each question needs some text.' using errcode = '22023';
    end if;
    if coalesce(v_item ->> 'kind', '') not in ('rating_1_5', 'text') then
      raise exception 'A question must be a rating or written answer.' using errcode = '22023';
    end if;
    if coalesce((v_item ->> 'page')::integer, 0) not between 1 and 3 then
      raise exception 'A question must be on page 1, 2, or 3.' using errcode = '22023';
    end if;
    insert into public.tutor_review_questions (round_id, page, position, code, text, help, kind, is_concern)
    values (
      p_round_id,
      (v_item ->> 'page')::integer,
      v_position,
      v_item ->> 'code',
      btrim(v_item ->> 'text'),
      nullif(btrim(coalesce(v_item ->> 'help', '')), ''),
      v_item ->> 'kind',
      coalesce((v_item ->> 'isConcern')::boolean, false)
    );
  end loop;
end;
$$;

revoke all on function public.save_tutor_review_questionnaire(uuid, text, text, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_tutor_review_questionnaire(uuid, text, text, text, jsonb, jsonb, jsonb) to authenticated, service_role;

-- Seed both rounds as draft, each with its own copy of the questions.
insert into public.tutor_review_rounds (label, opens_on, closes_on, status, title, intro, rating_help, scale, page_headings)
values
  (
    'December 2026', '2026-12-01', '2026-12-19', 'draft',
    'Apprentice tutor review',
    'Think about your sessions with this tutor over the last four weeks.',
    'Select one rating per statement. Leave blank if you have not experienced it.',
    '[{"value":1,"label":"Never"},{"value":2,"label":"Rarely"},{"value":3,"label":"Sometimes"},{"value":4,"label":"Often"},{"value":5,"label":"Always"}]'::jsonb,
    '{"1":null,"2":"Your teaching experience","3":"Your feedback"}'::jsonb
  ),
  (
    'June 2027', '2027-06-07', '2027-06-25', 'draft',
    'Apprentice tutor review',
    'Think about your sessions with this tutor over the last four weeks.',
    'Select one rating per statement. Leave blank if you have not experienced it.',
    '[{"value":1,"label":"Never"},{"value":2,"label":"Rarely"},{"value":3,"label":"Sometimes"},{"value":4,"label":"Often"},{"value":5,"label":"Always"}]'::jsonb,
    '{"1":null,"2":"Your teaching experience","3":"Your feedback"}'::jsonb
  );

insert into public.tutor_review_questions (round_id, page, position, code, text, help, kind, is_concern)
select r.id, q.page, q.position, q.code, q.text, q.help, q.kind, q.is_concern
from public.tutor_review_rounds r
cross join (values
  (1, 1, '01', 'My tutor clearly explains what I need to do before I start a task.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (1, 2, '02', 'My tutor checks that I understand before moving on to a new topic.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (1, 3, '03', 'When I do not understand, my tutor explains things another way.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (1, 4, '04', 'When I ask a question, my tutor responds in a way that encourages me to ask again.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (1, 5, '05', 'My tutor gives me feedback that explains how to improve my work.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (1, 6, '06', 'My tutor has the materials we need ready when learning activities start.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (2, 7, '07', 'My tutor gives me opportunities to take part in learning activities.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (2, 8, '08', 'My tutor explains how the learning relates to tasks I do at work.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (2, 9, '09', 'When I can complete a task confidently, my tutor gives me work that develops my skills further.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (2, 10, '10', 'My tutor treats me respectfully.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (2, 11, '11', 'My tutor uses lesson time for activities that help me learn.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (2, 12, '12', 'When my tutor agrees to provide support, they follow through on it.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (2, 13, '13', 'My tutor explains what we should learn in each session.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (2, 14, '14', 'When I need help during a task, my tutor gives me support to continue.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (2, 15, '15', 'When behaviour interrupts learning, my tutor deals with it.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (2, 16, '16', 'My tutor explains which skills I need to work on next.', 'Select one rating per statement. Leave blank if you have not experienced it.', 'rating_1_5', false),
  (3, 17, 'help', 'What does your tutor do that helps you learn?', null, 'text', false),
  (3, 18, 'change', 'What one change would most improve your learning?', null, 'text', false),
  (3, 19, 'concern', 'Is there anything your tutor does in class that concerns you?', 'Describe any unhelpful or unproductive behaviour, anything you feel is inappropriate, and how it affects you or the class.', 'text', true)
) as q(page, position, code, text, help, kind, is_concern);
