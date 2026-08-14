-- Tutor Session learning release (teaching-group action → per-enrolment grants).
-- This is NOT attendance, Session completion, Task pass, competence, or OTJ.
-- Future joiners of a teaching group do not inherit historical grants.

create table if not exists public.gta_session_learning_releases (
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
  constraint gta_session_learning_releases_source_check check (
    source in ('teaching_group', 'individual', 'migrated_from_delivery')
  ),
  constraint gta_session_learning_releases_unique
    unique (session_id, apprentice_programme_id)
);

create index if not exists gta_session_learning_releases_enrolment_idx
  on public.gta_session_learning_releases (apprentice_programme_id);

create index if not exists gta_session_learning_releases_apprentice_idx
  on public.gta_session_learning_releases (apprentice_id);

create index if not exists gta_session_learning_releases_session_idx
  on public.gta_session_learning_releases (session_id);

create index if not exists gta_session_learning_releases_version_idx
  on public.gta_session_learning_releases (programme_version_id);

create index if not exists gta_session_learning_releases_group_idx
  on public.gta_session_learning_releases (teaching_group_id);

comment on table public.gta_session_learning_releases is
  'Tutor grant that approved learner-facing Session learning is available to this enrolment. Not attendance, completion, Task pass, competence, or OTJ. Group UI action writes one row per selected enrolment. Future teaching-group joiners do not inherit these rows.';

alter table public.gta_session_learning_releases enable row level security;

drop policy if exists gta_session_learning_releases_select_authenticated
  on public.gta_session_learning_releases;
create policy gta_session_learning_releases_select_authenticated
  on public.gta_session_learning_releases
  for select
  to authenticated
  using (true);

drop trigger if exists touch_gta_session_learning_releases_updated_at
  on public.gta_session_learning_releases;
create trigger touch_gta_session_learning_releases_updated_at
before update on public.gta_session_learning_releases
for each row execute function public.touch_updated_at();
