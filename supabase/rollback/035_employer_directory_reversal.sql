-- NOT a migration. Do not place this file in supabase/migrations.
-- Do not run it against the live database.
--
-- This is a guarded removal of objects this migration added when they are
-- still empty. It is not an exact schema restore:
--   * public.touch_updated_at() is left in place. This migration creates it
--     only when it is missing and never replaces an existing body, so there
--     is no previous body to put back.
--   * public.apprentice_programmes.employer_uuid is left in place. The live
--     database can already have that column. This migration only adds it
--     when it is missing, and dropping it would not be a proven undo.
--   * public.apprentices and public.employers are never dropped.

do $$
declare
  detail_count bigint := 0;
  role_count bigint := 0;
  manager_count bigint := 0;
  membership_count bigint := 0;
  site_count bigint := 0;
  reviews_people bigint := 0;
begin
  if to_regclass('public.review_apprentice_details') is not null then
    execute 'select count(*) from public.review_apprentice_details' into detail_count;
  end if;
  if to_regclass('public.employer_manager_roles') is not null then
    execute 'select count(*) from public.employer_manager_roles' into role_count;
  end if;
  if to_regclass('public.employer_managers') is not null then
    execute 'select count(*) from public.employer_managers' into manager_count;
  end if;
  if to_regclass('public.employer_site_memberships') is not null then
    execute 'select count(*) from public.employer_site_memberships' into membership_count;
  end if;
  if to_regclass('public.employer_sites') is not null then
    execute 'select count(*) from public.employer_sites' into site_count;
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'apprentices'
      and column_name = 'portal_entry'
  ) then
    execute $q$
      select count(*) from public.apprentices where portal_entry = 'reviews'
    $q$ into reviews_people;
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

  drop table if exists public.review_apprentice_details;
  drop table if exists public.employer_manager_roles;
  drop table if exists public.employer_managers;
  drop table if exists public.employer_site_memberships;
  drop table if exists public.employer_sites;

  drop function if exists public.apply_review_apprentice_change(uuid, integer, text, jsonb);
  drop function if exists public.create_review_apprentice(jsonb);
  drop function if exists public.employer_site_membership_delete_guard();
  drop function if exists public.review_apprentice_link_guard();
  drop function if exists public.employer_manager_role_site_guard();

  alter table public.apprentices drop constraint if exists apprentices_portal_entry_check;
  alter table public.apprentices drop column if exists portal_entry;
end $$;
