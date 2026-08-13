-- Phase 2A: Block session authoring — resources, attachments, session publish + LO review.
-- Pilot scope: Block 1 only (data). Schema is programme-version scoped.

alter table public.gta_programme_sessions
  add column if not exists publish_status text not null default 'draft';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gta_programme_sessions_publish_status_check'
  ) then
    alter table public.gta_programme_sessions
      add constraint gta_programme_sessions_publish_status_check
      check (publish_status in ('draft', 'published'));
  end if;
end $$;

comment on column public.gta_programme_sessions.publish_status is
  'Authoring publish state for the planned session. Not learner sign-off.';

alter table public.gta_programme_sessions
  add column if not exists learning_objectives_review jsonb not null default '{}'::jsonb;

comment on column public.gta_programme_sessions.learning_objectives_review is
  'Candidate aims/outcomes surfaced from lesson plans for human review. Not controlled structured LOs until approved.';

create table if not exists public.gta_programme_resources (
  id uuid primary key default gen_random_uuid(),
  programme_version_id uuid not null
    references public.gta_programme_versions (id) on delete cascade,
  resource_key text not null,
  title text not null default '',
  filename text not null default '',
  source_path text not null default '',
  evidence_resource_id text not null default '',
  extract_path text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_programme_resources_version_key
    unique (programme_version_id, resource_key)
);

create index if not exists gta_programme_resources_version_idx
  on public.gta_programme_resources (programme_version_id);

comment on table public.gta_programme_resources is
  'Programme-version teaching/assessment resources. A resource may attach to many sessions.';

alter table public.gta_programme_resources enable row level security;

drop policy if exists gta_programme_resources_select_authenticated
  on public.gta_programme_resources;
create policy gta_programme_resources_select_authenticated
  on public.gta_programme_resources
  for select
  to authenticated
  using (true);

drop trigger if exists touch_gta_programme_resources_updated_at
  on public.gta_programme_resources;
create trigger touch_gta_programme_resources_updated_at
before update on public.gta_programme_resources
for each row execute function public.touch_updated_at();

create table if not exists public.gta_programme_resource_attachments (
  id uuid primary key default gen_random_uuid(),
  programme_version_id uuid not null
    references public.gta_programme_versions (id) on delete cascade,
  resource_id uuid not null
    references public.gta_programme_resources (id) on delete cascade,
  -- Session placement (nullable = unplaced / block-level only)
  session_id uuid
    references public.gta_programme_sessions (id) on delete cascade,
  -- Block spine item for unplaced materials (required when session_id is null)
  spine_item_id uuid
    references public.gta_spine_items (id) on delete cascade,
  role text not null,
  audience text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_programme_resource_attachments_role_check check (
    role in (
      'TUTOR_DELIVERY',
      'LEARNER_LEARNING',
      'LEARNER_REVISION',
      'PRACTICE',
      'ASSESSMENT_PREP',
      'CONTROLLED_FORM'
    )
  ),
  constraint gta_programme_resource_attachments_audience_check check (
    audience in ('TUTOR_ONLY', 'LEARNER_VISIBLE')
  ),
  constraint gta_programme_resource_attachments_placement_check check (
    (session_id is not null and spine_item_id is not null)
    or (session_id is null and spine_item_id is not null)
  )
);

-- Unique session attachment per resource+role
create unique index if not exists gta_prog_res_attach_session_role_uidx
  on public.gta_programme_resource_attachments (resource_id, session_id, role)
  where session_id is not null;

-- Unique unplaced attachment per resource+block+role
create unique index if not exists gta_prog_res_attach_unplaced_role_uidx
  on public.gta_programme_resource_attachments (resource_id, spine_item_id, role)
  where session_id is null;

create index if not exists gta_prog_res_attach_version_idx
  on public.gta_programme_resource_attachments (programme_version_id);

create index if not exists gta_prog_res_attach_session_idx
  on public.gta_programme_resource_attachments (session_id);

create index if not exists gta_prog_res_attach_spine_idx
  on public.gta_programme_resource_attachments (spine_item_id);

comment on table public.gta_programme_resource_attachments is
  'Resource↔session (or unplaced block) attachments. Same resource may attach to multiple sessions; each row has its own role/audience/sort.';

alter table public.gta_programme_resource_attachments enable row level security;

drop policy if exists gta_programme_resource_attachments_select_authenticated
  on public.gta_programme_resource_attachments;
create policy gta_programme_resource_attachments_select_authenticated
  on public.gta_programme_resource_attachments
  for select
  to authenticated
  using (true);

drop trigger if exists touch_gta_programme_resource_attachments_updated_at
  on public.gta_programme_resource_attachments;
create trigger touch_gta_programme_resource_attachments_updated_at
before update on public.gta_programme_resource_attachments
for each row execute function public.touch_updated_at();
