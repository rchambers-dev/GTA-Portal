-- NOT a migration. Do not place this file in supabase/migrations.
-- Do not run it against the live database until supabase/rollback/035_go_no_go.sql
-- is a no-go only for data, and a backup taken outside this script has been
-- restored to a scratch database. This file does not prove that backup.
--
-- Write control: SHARE ROW EXCLUSIVE is taken on every affected table that
-- exists before any count. That blocks inserts, updates, and deletes until
-- this transaction commits or rolls back. Readers are not blocked.
-- Counts made before those locks are not used.
--
-- Undo uses public.migration_035_prestate, captured under the same class of
-- lock at the start of migration 035. It drops only objects that capture
-- recorded as absent. It does not restore a previous touch_updated_at body,
-- because the migration does not replace that function when it already
-- exists. It does not rewrite table ACLs. public.apprentices and
-- public.employers are never dropped.

do $$
declare
  detail_count bigint := 0;
  role_count bigint := 0;
  manager_count bigint := 0;
  membership_count bigint := 0;
  site_count bigint := 0;
  reviews_people bigint := 0;
  portal_entry_existed boolean;
  employer_uuid_existed boolean;
  employer_uuid_fkey_existed boolean;
begin
  lock table public.apprentices in share row exclusive mode;
  lock table public.employers in share row exclusive mode;
  lock table public.apprentice_programmes in share row exclusive mode;

  if to_regclass('public.employer_sites') is not null then
    lock table public.employer_sites in share row exclusive mode;
  end if;
  if to_regclass('public.employer_managers') is not null then
    lock table public.employer_managers in share row exclusive mode;
  end if;
  if to_regclass('public.employer_site_memberships') is not null then
    lock table public.employer_site_memberships in share row exclusive mode;
  end if;
  if to_regclass('public.employer_manager_roles') is not null then
    lock table public.employer_manager_roles in share row exclusive mode;
  end if;
  if to_regclass('public.review_apprentice_details') is not null then
    lock table public.review_apprentice_details in share row exclusive mode;
  end if;
  if to_regclass('public.migration_035_prestate') is not null then
    lock table public.migration_035_prestate in share row exclusive mode;
  else
    raise exception 'Refusing reversal. migration_035_prestate was not captured, so column and function changes cannot be undone exactly.';
  end if;

  select count(*) into detail_count from public.review_apprentice_details;
  select count(*) into role_count from public.employer_manager_roles;
  select count(*) into manager_count from public.employer_managers;
  select count(*) into membership_count from public.employer_site_memberships;
  select count(*) into site_count from public.employer_sites;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'apprentices' and column_name = 'portal_entry'
  ) then
    select count(*) into reviews_people
    from public.apprentices
    where portal_entry = 'reviews';
  end if;

  if detail_count <> 0
     or role_count <> 0
     or manager_count <> 0
     or membership_count <> 0
     or site_count <> 0
     or reviews_people <> 0 then
    raise exception
      'Refusing reversal. details=%, roles=%, managers=%, memberships=%, sites=%, reviews apprentices=%',
      detail_count, role_count, manager_count, membership_count, site_count, reviews_people;
  end if;

  select existed into portal_entry_existed
  from public.migration_035_prestate
  where object_kind = 'column' and object_name = 'public.apprentices.portal_entry';
  select existed into employer_uuid_existed
  from public.migration_035_prestate
  where object_kind = 'column' and object_name = 'public.apprentice_programmes.employer_uuid';
  select existed into employer_uuid_fkey_existed
  from public.migration_035_prestate
  where object_kind = 'constraint' and object_name = 'apprentice_programmes_employer_uuid_fkey';

  if portal_entry_existed is null
     or employer_uuid_existed is null
     or employer_uuid_fkey_existed is null then
    raise exception 'Refusing reversal. Prestate is missing a column or constraint record.';
  end if;

  drop trigger if exists apprentice_display_name_version_guard on public.apprentices;
  drop table if exists public.review_apprentice_details;
  drop table if exists public.employer_manager_roles;
  drop table if exists public.employer_managers;
  drop table if exists public.employer_site_memberships;
  drop table if exists public.employer_sites;

  drop function if exists public.rename_apprentice(uuid, text, integer);
  drop function if exists public.apprentice_display_name_version_guard();
  drop function if exists public.apply_review_apprentice_change(uuid, integer, text, jsonb);
  drop function if exists public.create_review_apprentice(jsonb);
  drop function if exists public.employer_site_membership_delete_guard();
  drop function if exists public.review_apprentice_link_guard();
  drop function if exists public.employer_manager_role_site_guard();

  if not portal_entry_existed then
    alter table public.apprentices drop constraint if exists apprentices_portal_entry_check;
    alter table public.apprentices drop column if exists portal_entry;
  end if;

  if not employer_uuid_fkey_existed then
    alter table public.apprentice_programmes
      drop constraint if exists apprentice_programmes_employer_uuid_fkey;
  end if;
  if not employer_uuid_existed then
    alter table public.apprentice_programmes drop column if exists employer_uuid;
  end if;

  drop table public.migration_035_prestate;
end $$;
