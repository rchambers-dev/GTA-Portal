-- Shared Programme Builder activity / API history (multi-staff).
-- Append-only; filtered by Skills England standard_code in the UI.

create table if not exists public.gta_programme_activity (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  kind text not null,
  summary text not null default '',
  actor text not null default 'Unknown staff',
  actor_profile_id uuid references public.profiles (id) on delete set null,
  standard_code text not null default '',
  external_version text not null default '',
  programme_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint gta_programme_activity_kind_check check (
    kind in (
      'api_request',
      'api_ok',
      'api_error',
      'new_version',
      'official_cached',
      'draft_reopened',
      'programme_created',
      'spine_saved',
      'parameters_saved',
      'formula_published',
      'spine_published',
      'title_saved'
    )
  )
);

create index if not exists gta_programme_activity_standard_occurred_idx
  on public.gta_programme_activity (standard_code, occurred_at desc);

create index if not exists gta_programme_activity_occurred_idx
  on public.gta_programme_activity (occurred_at desc);

comment on table public.gta_programme_activity is
  'Shared Programme Builder history + API log. Visible to all staff; not browser-local.';

alter table public.gta_programme_activity enable row level security;

drop policy if exists gta_programme_activity_select_authenticated
  on public.gta_programme_activity;
create policy gta_programme_activity_select_authenticated
  on public.gta_programme_activity for select to authenticated using (true);

-- Mutations go through service-role Next.js routes.
