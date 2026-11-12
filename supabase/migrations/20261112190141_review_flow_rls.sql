-- Review flow, part 2: tutor helpers and row level security (13 Nov 2026).
-- Admin and Management read everything, as before. A Tutor reads only their own learners' rows (current assignment in
-- apprentice_tutors, end_date null) and only the packs released to them. Nobody writes through the tables: writes go through
-- the audited SECURITY DEFINER functions in part 3. anon has no grants and no policies.

-- ---------- helpers (SECURITY DEFINER so they can read apprentice_tutors without going round the policy on it) ----------
create or replace function public.tutor_can_see(p_gta_id text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.apprentice_tutors t
    where t.apprentice_id = p_gta_id and t.tutor_id = (select auth.uid()) and t.end_date is null
  )
$$;

create or replace function public.tutor_can_see_review(p_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.reviews r
    join public.apprentice_tutors t on t.apprentice_id = r.gta_id and t.end_date is null
    where r.id = p_review_id and t.tutor_id = (select auth.uid())
  )
$$;

-- the pack was released to this user (tutor_id is frozen at release)
create or replace function public.tutor_owns_pack(p_pack_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.review_packs p where p.id = p_pack_id and p.tutor_id = (select auth.uid()))
$$;

revoke all on function public.tutor_can_see(text) from public, anon;
revoke all on function public.tutor_can_see_review(uuid) from public, anon;
revoke all on function public.tutor_owns_pack(uuid) from public, anon;
grant execute on function public.tutor_can_see(text) to authenticated, service_role;
grant execute on function public.tutor_can_see_review(uuid) to authenticated, service_role;
grant execute on function public.tutor_owns_pack(uuid) to authenticated, service_role;

-- ---------- new tables ----------
create policy review_packs_select_admin_mgmt on public.review_packs
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy review_packs_select_tutor_own on public.review_packs
  for select to authenticated
  using ((select public.has_portal_role('Tutor')) and tutor_id = (select auth.uid()));

create policy review_pack_events_select_admin_mgmt on public.review_pack_events
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy review_pack_events_select_tutor_own on public.review_pack_events
  for select to authenticated
  using ((select public.has_portal_role('Tutor')) and public.tutor_owns_pack(pack_id));

create policy review_tutor_forms_select_admin_mgmt on public.review_tutor_forms
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy review_tutor_forms_select_tutor_own on public.review_tutor_forms
  for select to authenticated
  using ((select public.has_portal_role('Tutor')) and public.tutor_owns_pack(pack_id));

create policy review_progress_rows_select_admin_mgmt on public.review_progress_rows
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy review_progress_rows_select_tutor_own on public.review_progress_rows
  for select to authenticated
  using ((select public.has_portal_role('Tutor')) and public.tutor_owns_pack(pack_id));

create policy review_targets_select_admin_mgmt on public.review_targets
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy review_targets_select_tutor_own on public.review_targets
  for select to authenticated
  using ((select public.has_portal_role('Tutor')) and public.tutor_owns_pack(pack_id));

create policy review_signatures_select_admin_mgmt on public.review_signatures
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy review_signatures_select_tutor_own on public.review_signatures
  for select to authenticated
  using ((select public.has_portal_role('Tutor')) and public.tutor_owns_pack(pack_id));

-- ---------- narrow the existing Tutor read policies to the tutor's own learners ----------
drop policy reviews_select_staff on public.reviews;
create policy reviews_select_admin_mgmt on public.reviews
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy reviews_select_tutor_own on public.reviews
  for select to authenticated
  using ((select public.has_portal_role('Tutor')) and public.tutor_can_see(gta_id));

drop policy review_bookings_select_staff on public.review_bookings;
create policy review_bookings_select_admin_mgmt on public.review_bookings
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy review_bookings_select_tutor_own on public.review_bookings
  for select to authenticated
  using ((select public.has_portal_role('Tutor')) and public.tutor_can_see_review(review_id));

drop policy review_attachments_select_staff on public.review_attachments;
create policy review_attachments_select_admin_mgmt on public.review_attachments
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy review_attachments_select_tutor_own on public.review_attachments
  for select to authenticated
  using ((select public.has_portal_role('Tutor')) and public.tutor_can_see_review(review_id));

drop policy apprentice_tutors_select_staff on public.apprentice_tutors;
create policy apprentice_tutors_select_admin_mgmt on public.apprentice_tutors
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy apprentice_tutors_select_tutor_own on public.apprentice_tutors
  for select to authenticated
  using ((select public.has_portal_role('Tutor')) and public.tutor_can_see(apprentice_id));

drop policy apprentices_select_staff on public.apprentices;
create policy apprentices_select_admin_mgmt on public.apprentices
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management')));
create policy apprentices_select_tutor_own on public.apprentices
  for select to authenticated
  using ((select public.has_portal_role('Tutor')) and public.tutor_can_see(gta_id));

-- the files themselves follow the attachment rows (the subquery runs under the attachment policies above)
drop policy review_attachments_objects_select_staff on storage.objects;
create policy review_attachments_objects_select_admin_mgmt on storage.objects
  for select to authenticated
  using (bucket_id = 'review-attachments' and (select public.has_portal_role('Administrator','Management')));
create policy review_attachments_objects_select_tutor_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'review-attachments'
    and (select public.has_portal_role('Tutor'))
    and exists (select 1 from public.review_attachments a where a.storage_path = name)
  );
