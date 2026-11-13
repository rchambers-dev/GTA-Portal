-- One clearly labelled test apprentice, and a place to store a dry-run invite email.
-- The test apprentice is left out of lists, counts, and reports.
-- Send test email never needs a mail provider: the rendered message is stored on the attempt.

alter table public.apprentices
  add column if not exists is_test boolean not null default false;

insert into public.apprentices (first_name, last_name, email, status, is_test)
select 'Test', 'Apprentice', 'reiss.kc@gmail.com', 'in_learning', true
where not exists (
  select 1 from public.apprentices
  where lower(email) = 'reiss.kc@gmail.com'
     or (is_test and first_name = 'Test' and last_name = 'Apprentice')
);

insert into public.apprentice_tutors (apprentice_id, tutor_id)
select apprentice.gta_id, tutor.id
from public.apprentices apprentice
cross join lateral (
  select profile.id
  from public.profiles profile
  where profile.portal_status = 'active'
    and profile.archived_at is null
    and (profile.base_role = 'Tutor' or 'Apprenticeship Tutor' = any (profile.responsibilities))
  order by random()
  limit 1
) tutor
where apprentice.is_test
  and lower(apprentice.email) = 'reiss.kc@gmail.com'
  and not exists (
    select 1 from public.apprentice_tutors current_tutor
    where current_tutor.apprentice_id = apprentice.gta_id
      and current_tutor.end_date is null
  );

alter table public.tutor_review_email_attempts
  add column if not exists rendered_subject text,
  add column if not exists rendered_body text,
  add column if not exists rendered_link text;

create or replace function public.enqueue_tutor_review_emails(
  p_round_id uuid,
  p_resend boolean,
  p_rows jsonb,
  p_repeat boolean
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_item jsonb;
  v_invite public.tutor_review_invites%rowtype;
  v_round public.tutor_review_rounds%rowtype;
  v_today date := (now() at time zone 'Europe/London')::date;
  v_queued integer := 0;
  v_skipped integer := 0;
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'You do not have permission to change tutor reviews.' using errcode = '42501';
  end if;
  select * into v_round from public.tutor_review_rounds where id = p_round_id;
  if not found then
    raise exception 'That round could not be found.' using errcode = 'P0002';
  end if;
  if v_round.status = 'closed' or v_round.closed_early_at is not null or v_today > v_round.closes_on then
    raise exception 'Invites can be sent when a round is open or scheduled to open.' using errcode = '55000';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    begin
      select * into v_invite
        from public.tutor_review_invites
       where round_id = p_round_id and apprentice_id = v_item ->> 'apprenticeId'
       for update;

      if found and v_invite.used_at is not null then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      if nullif(btrim(coalesce(v_item ->> 'email', '')), '') is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      if found and exists (
        select 1 from public.tutor_review_email_attempts a
        where a.invite_id = v_invite.id
          and (
            a.status in ('queued', 'sending', 'sent')
            or (not p_repeat and a.status = 'dry_run')
            or (not p_resend and not p_repeat and a.status in ('failed', 'bounced'))
          )
      ) then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      if found then
        update public.tutor_review_invites
           set token_hash = v_item ->> 'tokenHash',
               tutor_id = (v_item ->> 'tutorId')::uuid
         where id = v_invite.id;
      else
        insert into public.tutor_review_invites (round_id, apprentice_id, tutor_id, token_hash)
        values (p_round_id, v_item ->> 'apprenticeId', (v_item ->> 'tutorId')::uuid, v_item ->> 'tokenHash')
        returning * into v_invite;
      end if;

      insert into public.tutor_review_email_attempts (invite_id, round_id, apprentice_id, email, status, dispatch_token)
      values (v_invite.id, p_round_id, v_item ->> 'apprenticeId', btrim(v_item ->> 'email'), 'queued', v_item ->> 'dispatchToken');
      v_queued := v_queued + 1;
    exception when unique_violation then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('queued', v_queued, 'skipped', v_skipped);
end;
$$;

revoke all on function public.enqueue_tutor_review_emails(uuid, boolean, jsonb, boolean) from public, anon;
grant execute on function public.enqueue_tutor_review_emails(uuid, boolean, jsonb, boolean) to authenticated, service_role;
