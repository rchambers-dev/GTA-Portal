-- Durable queue for tutor review invite emails.
-- The invite table still stores only a token hash.
-- dispatch_token lives on the attempt while it is queued or sending, then it is cleared.
-- Preview and every non-production run record dry_run and do not call a provider.

create table public.tutor_review_email_attempts (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.tutor_review_invites (id) on delete cascade,
  round_id uuid not null references public.tutor_review_rounds (id) on delete cascade,
  apprentice_id text not null references public.apprentices (gta_id),
  email text not null,
  status text not null default 'queued',
  provider_message_id text,
  error text,
  attempt_no integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  dispatch_token text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint tutor_review_email_attempts_status_check check (status in ('queued', 'sending', 'sent', 'failed', 'bounced', 'dry_run')),
  constraint tutor_review_email_attempts_attempt_no_check check (attempt_no >= 0)
);

create unique index tutor_review_email_attempts_inflight_key
  on public.tutor_review_email_attempts (invite_id)
  where status in ('queued', 'sending');

create index tutor_review_email_attempts_due_idx
  on public.tutor_review_email_attempts (round_id, next_attempt_at)
  where status = 'queued';

create index tutor_review_email_attempts_provider_idx
  on public.tutor_review_email_attempts (provider_message_id)
  where provider_message_id is not null;

alter table public.tutor_review_email_attempts enable row level security;

create policy tutor_review_email_attempts_staff on public.tutor_review_email_attempts
  for all to authenticated
  using ((select public.has_portal_role('Administrator', 'Management')))
  with check ((select public.has_portal_role('Administrator', 'Management')));

revoke all on public.tutor_review_email_attempts from public, anon;
grant select, insert, update, delete on public.tutor_review_email_attempts to authenticated, service_role;

create or replace function public.enqueue_tutor_review_emails(
  p_round_id uuid,
  p_resend boolean,
  p_rows jsonb
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
            a.status in ('queued', 'sending', 'sent', 'dry_run')
            or (not p_resend and a.status in ('failed', 'bounced'))
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

create or replace function public.claim_tutor_review_email_batch(p_round_id uuid, p_limit integer)
returns setof public.tutor_review_email_attempts
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'You do not have permission to change tutor reviews.' using errcode = '42501';
  end if;

  update public.tutor_review_email_attempts
     set status = 'queued', claimed_at = null
   where round_id = p_round_id
     and status = 'sending'
     and claimed_at < now() - interval '10 minutes';

  return query
  with picked as (
    select a.id
      from public.tutor_review_email_attempts a
     where a.round_id = p_round_id
       and a.status = 'queued'
       and a.next_attempt_at <= now()
     order by a.created_at
     limit least(greatest(coalesce(p_limit, 20), 1), 20)
     for update skip locked
  )
  update public.tutor_review_email_attempts a
     set status = 'sending',
         claimed_at = now(),
         attempt_no = a.attempt_no + 1
    from picked
   where a.id = picked.id
  returning a.*;
end;
$$;

create or replace function public.complete_tutor_review_email_attempt(
  p_id uuid,
  p_status text,
  p_provider_message_id text,
  p_error text,
  p_next_attempt_at timestamptz
) returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_attempt public.tutor_review_email_attempts%rowtype;
begin
  if not public.has_portal_role('Administrator', 'Management') then
    raise exception 'You do not have permission to change tutor reviews.' using errcode = '42501';
  end if;
  if p_status not in ('queued', 'sent', 'failed', 'bounced', 'dry_run') then
    raise exception 'That email status is not valid.' using errcode = '22023';
  end if;

  select * into v_attempt from public.tutor_review_email_attempts where id = p_id for update;
  if not found or v_attempt.status <> 'sending' then
    return;
  end if;

  update public.tutor_review_email_attempts
     set status = p_status,
         provider_message_id = coalesce(p_provider_message_id, provider_message_id),
         error = p_error,
         next_attempt_at = coalesce(p_next_attempt_at, next_attempt_at),
         claimed_at = case when p_status = 'queued' then null else claimed_at end,
         dispatch_token = case when p_status = 'queued' then dispatch_token else null end,
         sent_at = case when p_status in ('sent', 'dry_run') then now() else sent_at end
   where id = p_id;

  if p_status in ('sent', 'dry_run') then
    update public.tutor_review_invites
       set email_sent_to = v_attempt.email,
           sent_at = now()
     where id = v_attempt.invite_id
       and used_at is null;
  end if;
end;
$$;

create or replace function public.apply_tutor_review_email_event(
  p_provider_message_id text,
  p_status text,
  p_error text
) returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_count integer := 0;
begin
  if p_status = 'delivered' then
    return 0;
  end if;
  if p_status not in ('bounced', 'failed') then
    raise exception 'That email event is not valid.' using errcode = '22023';
  end if;
  update public.tutor_review_email_attempts
     set status = p_status,
         error = coalesce(nullif(btrim(coalesce(p_error, '')), ''), error),
         dispatch_token = null
   where provider_message_id = p_provider_message_id
     and status in ('sent', 'dry_run', 'sending');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_tutor_review_emails(uuid, boolean, jsonb) from public, anon;
revoke all on function public.claim_tutor_review_email_batch(uuid, integer) from public, anon;
revoke all on function public.complete_tutor_review_email_attempt(uuid, text, text, text, timestamptz) from public, anon;
revoke all on function public.apply_tutor_review_email_event(text, text, text) from public, anon, authenticated;
grant execute on function public.enqueue_tutor_review_emails(uuid, boolean, jsonb) to authenticated, service_role;
grant execute on function public.claim_tutor_review_email_batch(uuid, integer) to authenticated, service_role;
grant execute on function public.complete_tutor_review_email_attempt(uuid, text, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.apply_tutor_review_email_event(text, text, text) to service_role;
