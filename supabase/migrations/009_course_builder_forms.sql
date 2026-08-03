-- Course Builder authored learner forms (Groups + Blocks spines).
-- Seeds for Autocare Groups are loaded via scripts/seed-autocare-course-forms.mjs

create table if not exists public.course_pack_task_forms (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null,
  task_id text not null,
  title text not null default '',
  scenario text not null default '',
  status text not null default 'pending',
  modules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_pack_task_forms_status_check check (
    status in ('pending', 'ready')
  ),
  constraint course_pack_task_forms_pack_task_key unique (pack_id, task_id)
);

create index if not exists course_pack_task_forms_pack_id_idx
  on public.course_pack_task_forms (pack_id);

drop trigger if exists touch_course_pack_task_forms_updated_at on public.course_pack_task_forms;
create trigger touch_course_pack_task_forms_updated_at
before update on public.course_pack_task_forms
for each row execute function public.touch_updated_at();

alter table public.course_pack_task_forms enable row level security;

drop policy if exists course_pack_task_forms_select_authenticated
  on public.course_pack_task_forms;
create policy course_pack_task_forms_select_authenticated
on public.course_pack_task_forms
for select
to authenticated
using (true);

comment on table public.course_pack_task_forms is
  'Course Builder learner form drafts/published forms keyed by pack_id + task_id.';
