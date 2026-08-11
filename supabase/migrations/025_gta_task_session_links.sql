-- S8 gate: task↔session links + optional release mode on course tasks.
-- SESSION model decisions S1–S8. No Primaries / Golden B / form content.

create table if not exists public.gta_course_task_session_links (
  id uuid primary key default gen_random_uuid(),
  programme_version_id uuid not null
    references public.gta_programme_versions (id) on delete cascade,
  task_id uuid not null
    references public.gta_course_tasks (id) on delete cascade,
  session_id uuid not null
    references public.gta_programme_sessions (id) on delete cascade,
  link_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_course_task_session_links_type_check check (
    link_type in (
      'supports',
      'earliest_available_after',
      'target',
      'due_by',
      'requires'
    )
  ),
  constraint gta_course_task_session_links_unique
    unique (task_id, session_id, link_type)
);

create index if not exists gta_course_task_session_links_version_idx
  on public.gta_course_task_session_links (programme_version_id);

create index if not exists gta_course_task_session_links_task_idx
  on public.gta_course_task_session_links (task_id);

create index if not exists gta_course_task_session_links_session_idx
  on public.gta_course_task_session_links (session_id);

comment on table public.gta_course_task_session_links is
  'TASK remains child of BLOCK; optional SESSION links for support/availability/due (S2/S3).';

alter table public.gta_course_task_session_links enable row level security;

drop policy if exists gta_course_task_session_links_select_authenticated
  on public.gta_course_task_session_links;
create policy gta_course_task_session_links_select_authenticated
  on public.gta_course_task_session_links
  for select
  to authenticated
  using (true);

drop trigger if exists touch_gta_course_task_session_links_updated_at
  on public.gta_course_task_session_links;
create trigger touch_gta_course_task_session_links_updated_at
before update on public.gta_course_task_session_links
for each row execute function public.touch_updated_at();

-- Optional task release mode (S3). Default session: use earliest link if present,
-- else available when block opens. manual: tutor must release.
alter table public.gta_course_tasks
  add column if not exists release_mode text not null default 'session';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gta_course_tasks_release_mode_check'
  ) then
    alter table public.gta_course_tasks
      add constraint gta_course_tasks_release_mode_check
      check (
        release_mode in (
          'session',
          'manual',
          'date',
          'immediate_when_block_open'
        )
      );
  end if;
end $$;

comment on column public.gta_course_tasks.release_mode is
  'S3 availability driver. session = gate on earliest_available_after when set; manual = tutor release; date reserved; immediate_when_block_open = open with block.';
