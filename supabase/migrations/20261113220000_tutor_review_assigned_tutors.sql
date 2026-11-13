-- Tutor reviews count every open apprentice_tutors assignment.
-- portal_status invited and active both count. Disabled and archived profiles do not.
-- Test apprentices stay out of the counts. Not applied until Reiss approves it.

create or replace view public.tutor_review_counted_tutors
with (security_invoker = true) as
select distinct tutor.tutor_id
  from public.apprentice_tutors tutor
  join public.profiles profile on profile.id = tutor.tutor_id
 where tutor.end_date is null
   and profile.archived_at is null
   and profile.portal_status is distinct from 'disabled';

create or replace view public.tutor_review_tutor_response_rates
with (security_invoker = true) as
select round.id as round_id,
       counted.tutor_id,
       count(invite.id) filter (where apprentice.gta_id is not null and apprentice.is_test is not true) as invited,
       count(invite.id) filter (where apprentice.gta_id is not null and apprentice.is_test is not true and invite.used_at is not null) as submitted
  from public.tutor_review_rounds round
  join public.tutor_review_counted_tutors counted on true
  left join public.tutor_review_invites invite on invite.round_id = round.id and invite.tutor_id = counted.tutor_id
  left join public.apprentices apprentice on apprentice.gta_id = invite.apprentice_id
 group by round.id, counted.tutor_id;

create or replace view public.tutor_review_tutor_scores
with (security_invoker = true) as
select round.id as round_id,
       counted.tutor_id,
       question.code,
       question.kind,
       count(distinct response.id) as response_count,
       case when count(distinct response.id) >= 3 and question.kind = 'rating_1_5' then round(avg(answer.rating)::numeric, 1) end as average_rating,
       case when count(distinct response.id) >= 3 and question.kind = 'yes_no'
            then round(100.0 * count(answer.id) filter (where answer.yes_answer) / nullif(count(answer.id) filter (where answer.yes_answer is not null), 0))
       end as yes_percent
  from public.tutor_review_rounds round
  join public.tutor_review_questions question on question.round_id = round.id
  join public.tutor_review_counted_tutors counted on true
  left join public.tutor_review_responses response
    on response.round_id = round.id
   and response.tutor_id = counted.tutor_id
   and response.is_test is not true
  left join public.tutor_review_answers answer
    on answer.response_id = response.id
   and answer.question_id = question.id
 group by round.id, counted.tutor_id, question.code, question.kind;
