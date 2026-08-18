alter table public.gta_programme_resource_attachments
  add column if not exists learner_release_timing text;

update public.gta_programme_resource_attachments
set learner_release_timing = 'WITH_SESSION'
where audience = 'LEARNER_VISIBLE'
  and learner_release_timing is null;

update public.gta_programme_resource_attachments
set learner_release_timing = null
where audience = 'TUTOR_ONLY';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gta_programme_resource_attachments_learner_release_timing_check'
  ) then
    alter table public.gta_programme_resource_attachments
      add constraint gta_programme_resource_attachments_learner_release_timing_check check (
        (
          audience = 'LEARNER_VISIBLE'
          and learner_release_timing in ('WITH_SESSION', 'REVIEW_LATER')
        )
        or (
          audience = 'TUTOR_ONLY'
          and learner_release_timing is null
        )
      );
  end if;
end $$;

comment on column public.gta_programme_resource_attachments.learner_release_timing is
  'When a learner-visible Session resource becomes accessible: WITH_SESSION or REVIEW_LATER. Null for tutor-only resources.';

create table if not exists public.gta_session_review_releases (
  id uuid primary key default gen_random_uuid(),
  programme_version_id uuid not null
    references public.gta_programme_versions (id) on delete cascade,
  session_id uuid not null
    references public.gta_programme_sessions (id) on delete cascade,
  apprentice_id uuid not null
    references public.apprentices (id) on delete cascade,
  apprentice_programme_id uuid not null
    references public.apprentice_programmes (id) on delete cascade,
  spine_item_id uuid
    references public.gta_spine_items (id) on delete set null,
  teaching_group_id uuid
    references public.cohort_teaching_groups (id) on delete set null,
  source text not null default 'teaching_group',
  released_at timestamptz not null default now(),
  released_by uuid
    references public.profiles (id) on delete set null,
  released_by_name text not null default '',
  note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_session_review_releases_source_check check (
    source in ('teaching_group', 'individual')
  ),
  constraint gta_session_review_releases_unique
    unique (session_id, apprentice_programme_id)
);

create index if not exists gta_session_review_releases_enrolment_idx
  on public.gta_session_review_releases (apprentice_programme_id);
create index if not exists gta_session_review_releases_apprentice_idx
  on public.gta_session_review_releases (apprentice_id);
create index if not exists gta_session_review_releases_session_idx
  on public.gta_session_review_releases (session_id);
create index if not exists gta_session_review_releases_version_idx
  on public.gta_session_review_releases (programme_version_id);
create index if not exists gta_session_review_releases_group_idx
  on public.gta_session_review_releases (teaching_group_id);

comment on table public.gta_session_review_releases is
  'Tutor grant that held learner-visible Session review materials are available to this enrolment. Not attendance, completion, Task pass, competence, or OTJ.';

alter table public.gta_session_review_releases enable row level security;

drop policy if exists gta_session_review_releases_select_authenticated
  on public.gta_session_review_releases;
create policy gta_session_review_releases_select_authenticated
  on public.gta_session_review_releases
  for select
  to authenticated
  using (true);

drop trigger if exists touch_gta_session_review_releases_updated_at
  on public.gta_session_review_releases;
create trigger touch_gta_session_review_releases_updated_at
before update on public.gta_session_review_releases
for each row execute function public.touch_updated_at();
