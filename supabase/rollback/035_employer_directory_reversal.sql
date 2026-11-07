-- NOT a migration. Do not place this file in supabase/migrations.
-- Do not run against the live database.
-- Reversal is valid only after preflight shows:
--   review_apprentice_details is empty
--   employer_manager_roles, employer_managers, employer_site_memberships, employer_sites are empty
--   no apprentices.portal_entry = 'reviews'
--   apprentice_programmes.employer_uuid is null for every row, if that column is dropped
-- Never drop public.apprentices or public.employers.

-- preflight
-- select count(*) from public.review_apprentice_details;
-- select count(*) from public.employer_manager_roles;
-- select count(*) from public.employer_managers;
-- select count(*) from public.employer_site_memberships;
-- select count(*) from public.employer_sites;
-- select count(*) from public.apprentices where portal_entry = 'reviews';
-- select count(*) from public.apprentice_programmes where employer_uuid is not null;

drop table if exists public.review_apprentice_details;
drop table if exists public.employer_manager_roles;
drop table if exists public.employer_managers;
drop table if exists public.employer_site_memberships;
drop table if exists public.employer_sites;
alter table public.apprentices drop constraint if exists apprentices_portal_entry_check;
alter table public.apprentices drop column if exists portal_entry;
-- alter table public.apprentice_programmes drop constraint if exists apprentice_programmes_employer_uuid_fkey;
-- alter table public.apprentice_programmes drop column if exists employer_uuid;
