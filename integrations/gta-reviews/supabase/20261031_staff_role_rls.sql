-- SUPERSEDED AND INERT. Applying this file raises and changes nothing.
-- A fresh database should use supabase/schema.sql, which creates
-- public.is_admin_or_office() and the admin_office_* policies.
-- 20261031_tutor_isolation.sql replaced these tutor-inclusive staff_* policies
-- on databases that already had them. 20261031_drop_is_staff_user.sql drops
-- the is_staff_user() helper this file used to create.
-- The old statements are commented out so they cannot run.

do $$
begin
  raise exception 'supabase/20261031_staff_role_rls.sql is superseded. Use supabase/schema.sql. This file does not change policies.';
end $$;

-- Migration: Add staff role-based RLS policies
-- Created: 2026-10-31
-- Description: Restricts access to app_state, learners, and storage.objects to users with staff roles in app_metadata

-- drop policy if exists signed_in_read_app_state on public.app_state;
-- drop policy if exists signed_in_write_app_state on public.app_state;
-- drop policy if exists signed_in_update_app_state on public.app_state;
-- drop policy if exists signed_in_read_learners on public.learners;
-- drop policy if exists signed_in_write_learners on public.learners;
-- drop policy if exists signed_in_update_learners on public.learners;
-- drop policy if exists signed_in_read_review_files on storage.objects;
-- drop policy if exists signed_in_write_review_files on storage.objects;
-- drop policy if exists signed_in_update_review_files on storage.objects;

-- create or replace function is_staff_user()
-- returns boolean
-- language sql
-- security definer
-- stable
-- as $$
--   select coalesce(
--     (auth.jwt()->'app_metadata'->>'role') in ('office', 'admin', 'tutor'),
--     false
--   );
-- $$;

-- create policy staff_read_app_state on public.app_state
--   for select to authenticated
--   using (is_staff_user());
-- create policy staff_write_app_state on public.app_state
--   for insert to authenticated
--   with check (is_staff_user());
-- create policy staff_update_app_state on public.app_state
--   for update to authenticated
--   using (is_staff_user())
--   with check (is_staff_user());

-- create policy staff_read_learners on public.learners
--   for select to authenticated
--   using (is_staff_user());
-- create policy staff_write_learners on public.learners
--   for insert to authenticated
--   with check (is_staff_user());
-- create policy staff_update_learners on public.learners
--   for update to authenticated
--   using (is_staff_user())
--   with check (is_staff_user());

-- create policy staff_read_review_files on storage.objects
--   for select to authenticated
--   using (
--     bucket_id in ('review-app', 'review-attachments')
--     and is_staff_user()
--   );
-- create policy staff_write_review_files on storage.objects
--   for insert to authenticated
--   with check (
--     bucket_id in ('review-app', 'review-attachments')
--     and is_staff_user()
--   );
-- create policy staff_update_review_files on storage.objects
--   for update to authenticated
--   using (
--     bucket_id in ('review-app', 'review-attachments')
--     and is_staff_user()
--   )
--   with check (
--     bucket_id in ('review-app', 'review-attachments')
--     and is_staff_user()
--   );
