-- Roll back 20261102_app_state_history.sql.
-- Apply this in the Supabase SQL editor. The app does not run it.
--
-- History rows are removed with the table. This copies app_state and the
-- history table into the backup schema first. backup is not public, and
-- row level security is enabled on the copies. Re-running is safe: a
-- missing source is skipped, and an existing backup table is left as it is.
--
-- The copies hold the same PII. Drop them after the rollback has been
-- checked, and do not keep them past 30 days:
--   drop table if exists backup.app_state_20261102;
--   drop table if exists backup.app_state_history_20261102;
--
-- Both overloads remain. The two-argument function is restored with
-- search_path '' and no history write before the table is dropped.
-- actor_id defaults to null: the three-argument function calls that
-- two-argument function and ignores the actor. A SQL DEFAULT is not used,
-- because on Postgres 16 it is ambiguous with the overload.

begin;

create schema if not exists backup;

do $$
begin
  if to_regclass('public.app_state') is not null
     and to_regclass('backup.app_state_20261102') is null then
    execute 'create table backup.app_state_20261102 as select * from public.app_state';
    execute 'alter table backup.app_state_20261102 enable row level security';
    execute 'revoke all on table backup.app_state_20261102 from public, anon, authenticated, service_role';
    execute $c$comment on table backup.app_state_20261102 is 'PII copy taken by the 2026-11-02 history rollback. Drop it after the rollback has been checked, and do not keep it past 30 days.'$c$;
  end if;
  if to_regclass('public.app_state_history') is not null
     and to_regclass('backup.app_state_history_20261102') is null then
    execute 'create table backup.app_state_history_20261102 as select * from public.app_state_history';
    execute 'alter table backup.app_state_history_20261102 enable row level security';
    execute 'revoke all on table backup.app_state_history_20261102 from public, anon, authenticated, service_role';
    execute $c$comment on table backup.app_state_history_20261102 is 'PII copy taken by the 2026-11-02 history rollback. Drop it after the rollback has been checked, and do not keep it past 30 days.'$c$;
  end if;
end $$;

create or replace function public.save_app_state_if_version(
  expected_version integer,
  next_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.app_state
  set payload = next_payload,
      updated_at = now()
  where id = 'default'
    and coalesce(
      case
        when payload->>'version' ~ '^\d+$'
          and (payload->>'version')::int > 0
        then (payload->>'version')::int
        else null
      end,
      1
    ) = expected_version;

  get diagnostics updated_count = row_count;
  if updated_count > 0 then
    return updated_count;
  end if;

  if expected_version = 1 and not exists (
    select 1 from public.app_state where id = 'default'
  ) then
    insert into public.app_state (id, payload, updated_at)
    values ('default', next_payload, now())
    on conflict (id) do nothing;

    get diagnostics updated_count = row_count;
    return updated_count;
  end if;

  return 0;
end;
$$;

-- Drop the history-writing three-argument function before recreating it
-- as a wrapper. While it still has a body, a two-argument call is unique.
drop function if exists public.save_app_state_if_version(integer, jsonb, uuid);

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
begin
  return public.save_app_state_if_version(expected_version, next_payload);
end;
$$;

revoke all on function public.save_app_state_if_version(integer, jsonb) from public;
revoke all on function public.save_app_state_if_version(integer, jsonb) from anon;
revoke all on function public.save_app_state_if_version(integer, jsonb) from authenticated;
grant execute on function public.save_app_state_if_version(integer, jsonb) to service_role;

revoke all on function public.save_app_state_if_version(integer, jsonb, uuid) from public;
revoke all on function public.save_app_state_if_version(integer, jsonb, uuid) from anon;
revoke all on function public.save_app_state_if_version(integer, jsonb, uuid) from authenticated;
grant execute on function public.save_app_state_if_version(integer, jsonb, uuid) to service_role;

drop table if exists public.app_state_history cascade;
drop function if exists public.record_app_state_history(uuid, integer, jsonb);
drop function if exists public.app_state_history_guard();
drop function if exists public.is_admin();

commit;
