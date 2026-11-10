create table if not exists public.app_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- Supabase grants anon every table privilege by default. This table is staff-only.
revoke all on table public.app_state from anon;

-- Tutors do not read this table. They use /api/tutor-state and /api/review-attachment.
create or replace function public.is_admin_or_office()
returns boolean
language sql
security invoker
stable
set search_path = ''
as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role') in ('admin', 'office'), false);
$$;

comment on function public.is_admin_or_office() is
  'True for admin/office role. Tutors use /api/tutor-state and /api/review-attachment.';

revoke execute on function public.is_admin_or_office() from public, anon;
grant execute on function public.is_admin_or_office() to authenticated;

drop policy if exists staff_read_app_state on public.app_state;
drop policy if exists staff_write_app_state on public.app_state;
drop policy if exists staff_update_app_state on public.app_state;
drop policy if exists admin_office_read_app_state on public.app_state;
drop policy if exists admin_office_write_app_state on public.app_state;
create policy admin_office_read_app_state on public.app_state
  for select to authenticated using (public.is_admin_or_office());
create policy admin_office_write_app_state on public.app_state
  for all to authenticated
  using (public.is_admin_or_office())
  with check (public.is_admin_or_office());

-- Per-user minute counts for /api/tutor-reword. No learner data.
create table if not exists public.tutor_reword_rate (
  user_id uuid not null,
  bucket_key text not null default 'reword',
  bucket timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, bucket_key, bucket)
);

comment on table public.tutor_reword_rate is
  'Per-user minute counts for tutor reword. No learner data. Old buckets are deleted inside rate_limit_hit.';

alter table public.tutor_reword_rate enable row level security;

revoke all on table public.tutor_reword_rate from public, anon, authenticated, service_role;

create or replace function public.rate_limit_hit(
  actor_id uuid,
  bucket_key text,
  bucket_start timestamptz,
  max_hits integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_hits integer;
begin
  if actor_id is null or bucket_key is null or bucket_key = ''
     or bucket_start is null or max_hits is null or max_hits < 1 then
    return false;
  end if;

  delete from public.tutor_reword_rate
  where bucket < bucket_start - interval '2 hours';

  insert into public.tutor_reword_rate (user_id, bucket_key, bucket, hits)
  values (actor_id, bucket_key, bucket_start, 1)
  on conflict on constraint tutor_reword_rate_pkey
  do update set hits = public.tutor_reword_rate.hits + 1
  returning hits into next_hits;

  return next_hits <= max_hits;
end;
$$;

comment on function public.rate_limit_hit(uuid, text, timestamptz, integer) is
  'Increments one user bucket and returns whether that count is still within max_hits. bucket_key keeps reword and password guesses apart. Deletes buckets older than two hours.';

revoke all on function public.rate_limit_hit(uuid, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(uuid, text, timestamptz, integer) to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('review-app', 'review-app', false, 52428800)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('review-attachments', 'review-attachments', false, 26214400)
on conflict (id) do nothing;

drop policy if exists staff_read_review_files on storage.objects;
drop policy if exists staff_write_review_files on storage.objects;
drop policy if exists staff_update_review_files on storage.objects;
drop policy if exists admin_office_read_review_files on storage.objects;
drop policy if exists admin_office_insert_review_files on storage.objects;
drop policy if exists admin_office_update_review_files on storage.objects;
drop policy if exists admin_office_delete_review_files on storage.objects;

create policy admin_office_read_review_files on storage.objects
  for select to authenticated
  using (
    bucket_id in ('review-app', 'review-attachments')
    and public.is_admin_or_office()
  );

create policy admin_office_insert_review_files on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('review-app', 'review-attachments')
    and public.is_admin_or_office()
  );

create policy admin_office_update_review_files on storage.objects
  for update to authenticated
  using (
    bucket_id in ('review-app', 'review-attachments')
    and public.is_admin_or_office()
  )
  with check (
    bucket_id in ('review-app', 'review-attachments')
    and public.is_admin_or_office()
  );

create policy admin_office_delete_review_files on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('review-app', 'review-attachments')
    and public.is_admin_or_office()
  );

-- PII. Full app_state snapshots (names, postcodes, safeguarding), kept 30 days.
-- is_admin() is separate from is_admin_or_office(): office edits the live plan
-- and must not read every past snapshot.
create table if not exists public.app_state_history (
  id bigint generated always as identity primary key,
  user_id uuid,
  version integer not null,
  saved_at timestamptz not null default now(),
  payload jsonb not null
);

comment on table public.app_state_history is
  'PII. Full app_state snapshots (names, postcodes, safeguarding). Kept for 30 days. Admin read only.';

create index if not exists app_state_history_saved_at_desc
  on public.app_state_history (saved_at desc);

alter table public.app_state_history enable row level security;

revoke all on table public.app_state_history from public;
revoke all on table public.app_state_history from anon;
revoke all on table public.app_state_history from authenticated;
revoke update, delete, truncate on table public.app_state_history from service_role;
revoke truncate on table public.app_state_history from public, anon, authenticated;
grant select on table public.app_state_history to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

comment on function public.is_admin() is
  'True for the admin role only. History reads use this, not is_admin_or_office(), because office must not read full PII snapshots.';

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists admin_read_app_state_history on public.app_state_history;
create policy admin_read_app_state_history
  on public.app_state_history
  for select
  to authenticated
  using (public.is_admin());

create or replace function public.app_state_history_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'app_state_history is append-only';
  end if;
  if tg_op = 'DELETE' and current_setting('app.history_prune', true) = 'on' then
    return old;
  end if;
  raise exception 'app_state_history is append-only';
end;
$$;

revoke all on function public.app_state_history_guard() from public, anon, authenticated;

drop trigger if exists app_state_history_append_only on public.app_state_history;
create trigger app_state_history_append_only
  before update or delete on public.app_state_history
  for each row
  execute function public.app_state_history_guard();

drop trigger if exists app_state_history_no_truncate on public.app_state_history;
create trigger app_state_history_no_truncate
  before truncate on public.app_state_history
  for each statement
  execute function public.app_state_history_guard();

create or replace function public.record_app_state_history(
  actor_id uuid,
  next_version integer,
  next_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select h.payload
    from public.app_state_history h
    order by h.id desc
    limit 1
  ) is distinct from next_payload then
    insert into public.app_state_history (user_id, version, saved_at, payload)
    values (actor_id, next_version, now(), next_payload);
  end if;
  perform set_config('app.history_prune', 'on', true);
  delete from public.app_state_history
  where saved_at < now() - interval '30 days';
  delete from public.app_state_history
  where id in (
    select id
    from public.app_state_history
    order by saved_at desc, id desc
    offset 500
  );
  perform set_config('app.history_prune', 'off', true);
end;
$$;

revoke all on function public.record_app_state_history(uuid, integer, jsonb) from public, anon, authenticated, service_role;

create or replace function public.save_app_state_if_version(
  expected_version integer,
  next_payload jsonb,
  actor_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
  next_version integer;
begin
  next_version := coalesce(
    case
      when next_payload->>'version' ~ '^\d+$'
        and (next_payload->>'version')::integer > 0
      then (next_payload->>'version')::integer
      else null
    end,
    expected_version
  );

  update public.app_state
  set payload = next_payload,
      updated_at = now()
  where id = 'default'
    and coalesce(
      case
        when payload->>'version' ~ '^\d+$'
          and (payload->>'version')::integer > 0
        then (payload->>'version')::integer
        else null
      end,
      1
    ) = expected_version;

  get diagnostics updated_count = row_count;
  if updated_count > 0 then
    perform public.record_app_state_history(actor_id, next_version, next_payload);
    return updated_count;
  end if;

  if expected_version = 1 and not exists (
    select 1 from public.app_state where id = 'default'
  ) then
    insert into public.app_state (id, payload, updated_at)
    values ('default', next_payload, now())
    on conflict (id) do nothing;

    get diagnostics updated_count = row_count;
    if updated_count > 0 then
      perform public.record_app_state_history(actor_id, next_version, next_payload);
    end if;
    return updated_count;
  end if;

  return 0;
end;
$$;

revoke all on function public.save_app_state_if_version(integer, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_app_state_if_version(integer, jsonb, uuid) to service_role;

-- Two-argument overload. actor_id defaults to null.
create or replace function public.save_app_state_if_version(
  expected_version integer,
  next_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.save_app_state_if_version(expected_version, next_payload, null);
end;
$$;

revoke all on function public.save_app_state_if_version(integer, jsonb) from public, anon, authenticated;
grant execute on function public.save_app_state_if_version(integer, jsonb) to service_role;

-- New auth users start with password_changed false unless the insert already set it.
create or replace function public.staff_password_change_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data->>'password_changed', '') = '' then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('password_changed', false);
  end if;
  return new;
end;
$$;

comment on function public.staff_password_change_default() is
  'New auth users start with app_metadata.password_changed false unless the insert already set it.';

revoke all on function public.staff_password_change_default() from public, anon, authenticated;

drop trigger if exists staff_password_change_default on auth.users;
create trigger staff_password_change_default
  before insert on auth.users
  for each row
  execute function public.staff_password_change_default();
