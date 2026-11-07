-- Mirrors what was applied to production on 31 Oct 2026.
-- Order: tutor_isolation_admin_office_only, then is_admin_or_office_invoker.

drop policy if exists staff_read_app_state on public.app_state;
drop policy if exists staff_write_app_state on public.app_state;
drop policy if exists staff_update_app_state on public.app_state;
drop policy if exists staff_read_learners on public.learners;
drop policy if exists staff_write_learners on public.learners;
drop policy if exists staff_update_learners on public.learners;
drop policy if exists staff_read_review_files on storage.objects;
drop policy if exists staff_write_review_files on storage.objects;
drop policy if exists staff_update_review_files on storage.objects;

create or replace function public.is_admin_or_office()
returns boolean language sql security definer stable set search_path = ''
as $$ select coalesce((auth.jwt()->'app_metadata'->>'role') in ('admin','office'), false); $$;

create policy admin_office_read_app_state on public.app_state for select to authenticated using (public.is_admin_or_office());
create policy admin_office_write_app_state on public.app_state for all to authenticated using (public.is_admin_or_office()) with check (public.is_admin_or_office());
create policy admin_office_read_learners on public.learners for select to authenticated using (public.is_admin_or_office());
create policy admin_office_write_learners on public.learners for all to authenticated using (public.is_admin_or_office()) with check (public.is_admin_or_office());

create policy admin_office_read_review_files on storage.objects for select to authenticated using (bucket_id in ('review-app','review-attachments') and public.is_admin_or_office());
create policy admin_office_insert_review_files on storage.objects for insert to authenticated with check (bucket_id in ('review-app','review-attachments') and public.is_admin_or_office());
create policy admin_office_update_review_files on storage.objects for update to authenticated using (bucket_id in ('review-app','review-attachments') and public.is_admin_or_office()) with check (bucket_id in ('review-app','review-attachments') and public.is_admin_or_office());
create policy admin_office_delete_review_files on storage.objects for delete to authenticated using (bucket_id in ('review-app','review-attachments') and public.is_admin_or_office());

revoke execute on function public.is_admin_or_office() from anon;
comment on function public.is_admin_or_office() is 'True for admin/office role. Tutors use /api/tutor-state and /api/review-attachment.';

alter function public.is_admin_or_office() security invoker;
revoke execute on function public.is_admin_or_office() from public, anon;
grant execute on function public.is_admin_or_office() to authenticated;
