-- Append-only history of app_state saves.
-- Apply this in the Supabase SQL editor. The app does not run it, and it
-- must not be applied to the live database from this repository.
--
-- Order, once Reiss has approved applying it to the live database:
-- 1. Apply this file.
-- 2. Deploy the app.
-- 3. Sign in as an admin and save once, and confirm that save succeeds.
-- actor_id defaults to null through the two-argument overload, which calls
-- the three-argument function with null. A SQL DEFAULT on that third
-- argument is ambiguous with the overload on Postgres 16, so the parameter
-- is required and the overload supplies null. The current app keeps saving
-- if this file is applied first. The server retries without actor_id if
-- this file is not applied yet. After a rollback both overloads remain:
-- the two-argument function no longer writes history, and the
-- three-argument one calls it, so the new server still saves.
--
-- PII: each row is a full app_state snapshot. The live payload is about
-- 170KB and includes learner names, postcodes, and safeguarding notes.
-- Rows older than 30 days are deleted, and at most 500 snapshots are kept.
-- A save that does not change the payload does not write another row.
--
-- user_id is the actor_id argument. The Node server fills that from the
-- verified JWT (auth.getUser). It is never read from the request body.
-- The server connects as service_role, so the session user is not
-- available. Desktop saves pass null.
--
-- is_admin() is separate from is_admin_or_office(). Office staff edit the
-- live plan, but they must not read every past snapshot.
--
-- Admin can read the table. anon has no privileges. authenticated can
-- select, and row level security limits that to the admin role. Neither
-- anon nor authenticated can insert, update, delete, or truncate.
-- service_role cannot update, delete, or truncate the table directly.
--
-- This copies app_state into backup before it changes the save function.
-- backup is not the public schema. Those tables hold the same PII. Drop
-- them after the migration has been checked, and do not keep them past 30 days:
--   drop table if exists backup.app_state_20261102;
--   drop table if exists backup.app_state_history_20261102;

begin;

create schema if not exists backup;

do $$
begin
  if to_regclass('public.app_state') is not null
     and to_regclass('backup.app_state_20261102') is null then
    execute 'create table backup.app_state_20261102 as select * from public.app_state';
    execute 'alter table backup.app_state_20261102 enable row level security';
    execute 'revoke all on table backup.app_state_20261102 from public, anon, authenticated, service_role';
    execute $c$comment on table backup.app_state_20261102 is 'PII copy taken before the 2026-11-02 history migration. Drop it after the migration has been checked, and do not keep it past 30 days.'$c$;
  end if;
  if to_regclass('public.app_state_history') is not null
     and to_regclass('backup.app_state_history_20261102') is null then
    execute 'create table backup.app_state_history_20261102 as select * from public.app_state_history';
    execute 'alter table backup.app_state_history_20261102 enable row level security';
    execute 'revoke all on table backup.app_state_history_20261102 from public, anon, authenticated, service_role';
    execute $c$comment on table backup.app_state_history_20261102 is 'PII copy taken before the 2026-11-02 history migration. Drop it after the migration has been checked, and do not keep it past 30 days.'$c$;
  end if;
end $$;

create table if not exists public.app_state_history (
  id bigint generated always as identity primary key,
  user_id uuid,
  version integer not null,
  saved_at timestamptz not null default now(),
  payload jsonb not null
);

comment on table public.app_state_history is
  'PII. Full app_state snapshots (names, postcodes, safeguarding). Kept for 30 days and at most 500 rows. Admin read only.';

comment on column public.app_state_history.user_id is
  'Verified auth user id supplied by the server. Not taken from the request body. Null for a desktop save.';

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

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
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

revoke all on function public.app_state_history_guard() from public;
revoke all on function public.app_state_history_guard() from anon;
revoke all on function public.app_state_history_guard() from authenticated;

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

revoke all on function public.record_app_state_history(uuid, integer, jsonb) from public;
revoke all on function public.record_app_state_history(uuid, integer, jsonb) from anon;
revoke all on function public.record_app_state_history(uuid, integer, jsonb) from authenticated;
revoke all on function public.record_app_state_history(uuid, integer, jsonb) from service_role;

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

revoke all on function public.save_app_state_if_version(integer, jsonb, uuid) from public;
revoke all on function public.save_app_state_if_version(integer, jsonb, uuid) from anon;
revoke all on function public.save_app_state_if_version(integer, jsonb, uuid) from authenticated;
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

revoke all on function public.save_app_state_if_version(integer, jsonb) from public;
revoke all on function public.save_app_state_if_version(integer, jsonb) from anon;
revoke all on function public.save_app_state_if_version(integer, jsonb) from authenticated;
grant execute on function public.save_app_state_if_version(integer, jsonb) to service_role;

commit;
