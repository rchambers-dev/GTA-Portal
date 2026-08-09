-- GTA Course Builder tasks (block delivery content), version-scoped.
-- Separate from course_pack_task_forms (CEA pack_id + task_id).

create table if not exists public.gta_course_tasks (
  id uuid primary key default gen_random_uuid(),
  programme_version_id uuid not null
    references public.gta_programme_versions (id) on delete cascade,
  spine_item_id uuid not null
    references public.gta_spine_items (id) on delete restrict,
  -- Version-scoped public key (client draft.id). NOT a cross-version identity.
  task_key text not null,
  sequence integer not null default 0,
  task_number integer not null default 1,
  kind text not null default 'practical',
  title text not null default '',
  scenario text not null default '',
  objectives jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  knowledge_questions jsonb not null default '[]'::jsonb,
  estimated_minutes integer not null default 60,
  block_ordinal integer not null default 1,
  form_title text not null default '',
  form_scenario text not null default '',
  form_status text not null default 'pending',
  form_modules jsonb not null default '[]'::jsonb,
  publish_status text not null default 'draft',
  copied_from_task_id uuid
    references public.gta_course_tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_course_tasks_kind_check check (
    kind in ('practical', 'reflection', 'knowledge_test', 'job_card')
  ),
  constraint gta_course_tasks_form_status_check check (
    form_status in ('pending', 'ready')
  ),
  constraint gta_course_tasks_publish_status_check check (
    publish_status in ('draft', 'published')
  ),
  constraint gta_course_tasks_version_task_key unique (programme_version_id, task_key)
);

create index if not exists gta_course_tasks_version_idx
  on public.gta_course_tasks (programme_version_id);

create index if not exists gta_course_tasks_spine_item_idx
  on public.gta_course_tasks (spine_item_id);

create index if not exists gta_course_tasks_version_block_seq_idx
  on public.gta_course_tasks (programme_version_id, spine_item_id, sequence);

-- Block-only ownership: spine item must be a training block on this programme version.
create or replace function public.gta_course_tasks_assert_block_ownership()
returns trigger
language plpgsql
as $$
declare
  item_type text;
  item_version_id uuid;
begin
  select si.item_type, s.programme_version_id
    into item_type, item_version_id
  from public.gta_spine_items si
  join public.gta_spines s on s.id = si.spine_id
  where si.id = new.spine_item_id;

  if item_type is null then
    raise exception 'spine_item_id % does not exist', new.spine_item_id;
  end if;

  if item_type <> 'block' then
    raise exception
      'Course Builder tasks may only attach to spine blocks (got item_type=%)',
      item_type;
  end if;

  if item_version_id is distinct from new.programme_version_id then
    raise exception
      'spine_item_id % does not belong to programme_version_id %',
      new.spine_item_id,
      new.programme_version_id;
  end if;

  return new;
end;
$$;

drop trigger if exists gta_course_tasks_assert_block_ownership
  on public.gta_course_tasks;
create trigger gta_course_tasks_assert_block_ownership
before insert or update of spine_item_id, programme_version_id
on public.gta_course_tasks
for each row execute function public.gta_course_tasks_assert_block_ownership();

drop trigger if exists touch_gta_course_tasks_updated_at on public.gta_course_tasks;
create trigger touch_gta_course_tasks_updated_at
before update on public.gta_course_tasks
for each row execute function public.touch_updated_at();

alter table public.gta_course_tasks enable row level security;

drop policy if exists gta_course_tasks_select_authenticated on public.gta_course_tasks;
create policy gta_course_tasks_select_authenticated
  on public.gta_course_tasks for select to authenticated using (true);

comment on table public.gta_course_tasks is
  'GTA Course Builder tasks+forms scoped to a programme version and spine block. task_key is version-scoped only.';

comment on column public.gta_course_tasks.task_key is
  'Version-scoped task identity (client draft.id). Regenerated on fork — not a cross-version identity. Submissions bind to the row/version they were created against.';
