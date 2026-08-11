-- Phase 1: controlled programme sessions (calendar week ≠ planned session)
-- and course-task curriculum purpose / source PDF fields.

create table if not exists public.gta_programme_sessions (
  id uuid primary key default gen_random_uuid(),
  programme_version_id uuid not null
    references public.gta_programme_versions (id) on delete cascade,
  spine_item_id uuid
    references public.gta_spine_items (id) on delete set null,
  -- Stable key within a programme version, e.g. W012 or W112-A
  session_key text not null,
  sequence integer not null default 0,
  calendar_week integer not null,
  session_index_in_week integer not null default 1,
  title text not null default '',
  topic text not null default '',
  foundation_skill_code text,
  planned_otj_hours numeric(8, 2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_programme_sessions_week_check check (calendar_week >= 1),
  constraint gta_programme_sessions_index_check check (session_index_in_week >= 1),
  constraint gta_programme_sessions_version_key unique (programme_version_id, session_key)
);

create index if not exists gta_programme_sessions_version_seq_idx
  on public.gta_programme_sessions (programme_version_id, sequence);

create index if not exists gta_programme_sessions_spine_idx
  on public.gta_programme_sessions (spine_item_id);

create index if not exists gta_programme_sessions_week_idx
  on public.gta_programme_sessions (programme_version_id, calendar_week);

comment on table public.gta_programme_sessions is
  'Controlled teaching sessions. calendar_week + session_index_in_week distinguish multiple sessions in one week (e.g. Week 112 A/B). resource→session may remain NULL.';

alter table public.gta_programme_sessions enable row level security;

drop policy if exists gta_programme_sessions_select_authenticated
  on public.gta_programme_sessions;
create policy gta_programme_sessions_select_authenticated
  on public.gta_programme_sessions
  for select
  to authenticated
  using (true);

drop trigger if exists touch_gta_programme_sessions_updated_at
  on public.gta_programme_sessions;
create trigger touch_gta_programme_sessions_updated_at
before update on public.gta_programme_sessions
for each row execute function public.touch_updated_at();

-- Course task controlled form / purpose fields (no KSB intents)
alter table public.gta_course_tasks
  add column if not exists source_pdf text not null default '';

alter table public.gta_course_tasks
  add column if not exists evidence_ref text not null default '';

alter table public.gta_course_tasks
  add column if not exists curriculum_purposes jsonb not null default '[]'::jsonb;

comment on column public.gta_course_tasks.curriculum_purposes is
  'Task purpose tags e.g. KNOWLEDGE_CHECKS, PRACTISES, ASSESSES, RECORDS_EVIDENCE, REFLECTION. Not KSB mappings.';
