-- Performance Advisor:
-- 1) auth_rls_initplan on temporary_assignments_select_own
-- 2) multiple permissive SELECT policies on profiles (+ initplan on profiles_select_own)
--
-- profiles_select_authenticated already allows authenticated SELECT of all rows,
-- so profiles_select_own is redundant and triggers both warnings.

drop policy if exists profiles_select_own on public.profiles;

drop policy if exists temporary_assignments_select_own on public.temporary_assignments;
create policy temporary_assignments_select_own
on public.temporary_assignments
for select
to authenticated
using ((select auth.uid()) = profile_id);
