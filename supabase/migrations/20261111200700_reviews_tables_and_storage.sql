-- Reviews tab: reviewers, reviews, attachments, private storage bucket policies.
create table public.review_reviewers (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index review_reviewers_one_default_idx on public.review_reviewers (is_default) where is_default;

-- Reiss is the single default reviewer (the Assistant forces "Reiss Chambers" on every load).
insert into public.review_reviewers (profile_id, is_default)
select p.id, true from public.profiles p where p.email = 'reisschambers@doncastergta.co.uk';

do $$
begin
  if (select count(*) from public.review_reviewers where is_default) <> 1 then
    raise exception 'Reiss Chambers profile not found for the default reviewer';
  end if;
end $$;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  gta_id text not null references public.apprentices(gta_id) on delete restrict,
  reviewer_id uuid not null references public.review_reviewers(profile_id) on delete restrict,
  planned_on date,
  actual_on date,
  method text check (method in ('in_person','phone','teams')),
  status text not null default 'open' check (status in ('open','completed')),
  source text not null default 'entered' check (source in ('entered','imported')),
  notes text,
  -- A booked visit (the Assistant's "appointment"). Needed so a concern change can leave a booked visit's date alone.
  appointment_on date,
  appointment_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_status_actual_consistent check (
    (status = 'open' and actual_on is null) or (status = 'completed' and actual_on is not null)
  ),
  constraint reviews_notes_not_blank check (notes is null or btrim(notes) <> ''),
  constraint reviews_appointment_consistent check (
    (appointment_on is null and appointment_minutes is null)
    or (appointment_on is not null and appointment_minutes between 0 and 1439)
  ),
  constraint reviews_appointment_only_when_open check (appointment_on is null or status = 'open')
);

create unique index reviews_one_open_idx on public.reviews (gta_id) where status = 'open';
create unique index reviews_one_per_actual_date_idx on public.reviews (gta_id, actual_on) where status = 'completed';
create index reviews_gta_id_idx on public.reviews (gta_id, planned_on desc);
create index reviews_reviewer_id_idx on public.reviews (reviewer_id);

create trigger touch_reviews_updated_at
  before update on public.reviews
  for each row execute function public.touch_updated_at();

create table public.review_attachments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  file_name text not null,
  content_type text not null check (content_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  storage_bucket text not null default 'review-attachments' check (storage_bucket = 'review-attachments'),
  storage_path text not null unique,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint review_attachments_file_name_not_blank check (btrim(file_name) <> ''),
  constraint review_attachments_path_not_blank check (btrim(storage_path) <> '')
);
create index review_attachments_review_id_idx on public.review_attachments (review_id);
create index review_attachments_uploaded_by_idx on public.review_attachments (uploaded_by);

alter table public.review_reviewers enable row level security;
alter table public.reviews enable row level security;
alter table public.review_attachments enable row level security;

create policy review_reviewers_select_staff on public.review_reviewers
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management','Tutor')));
create policy reviews_select_staff on public.reviews
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management','Tutor')));
create policy review_attachments_select_staff on public.review_attachments
  for select to authenticated
  using ((select public.has_portal_role('Administrator','Management','Tutor')));

revoke all on table public.review_reviewers, public.reviews, public.review_attachments from public, anon, authenticated;
grant select on table public.review_reviewers, public.reviews, public.review_attachments to authenticated;
grant select, insert, update, delete on table public.review_reviewers, public.reviews, public.review_attachments to service_role;

-- Private bucket: PDF and Word only, 25 MB (the bucket already exists and is empty).
update storage.buckets
   set public = false,
       file_size_limit = 26214400,
       allowed_mime_types = array[
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
 where id = 'review-attachments';

create policy review_attachments_objects_select_staff on storage.objects
  for select to authenticated
  using (bucket_id = 'review-attachments' and (select public.has_portal_role('Administrator','Management','Tutor')));
create policy review_attachments_objects_insert_admin_mgmt on storage.objects
  for insert to authenticated
  with check (bucket_id = 'review-attachments' and (select public.has_portal_role('Administrator','Management')));
create policy review_attachments_objects_update_admin_mgmt on storage.objects
  for update to authenticated
  using (bucket_id = 'review-attachments' and (select public.has_portal_role('Administrator','Management')))
  with check (bucket_id = 'review-attachments' and (select public.has_portal_role('Administrator','Management')));
create policy review_attachments_objects_delete_admin_mgmt on storage.objects
  for delete to authenticated
  using (bucket_id = 'review-attachments' and (select public.has_portal_role('Administrator','Management')));
