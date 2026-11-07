-- Reviewed cutover only. Do not apply this until the page-access release is approved.
-- It creates empty tables. It does not copy staff, grant pages, or change role presets.
-- Recovery: delete the rows for a workspace from staff_workspace_page_defaults.
-- That returns the workspace to today's capability checks.

create table if not exists public.staff_workspace_page_defaults (
  workspace_id text primary key,
  grants jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.staff_page_bundles (
  id uuid primary key,
  name text not null,
  grants jsonb not null default '[]'::jsonb,
  staff_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.staff_direct_page_grants (
  staff_id uuid primary key,
  grants jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.staff_workspace_page_defaults enable row level security;
alter table public.staff_page_bundles enable row level security;
alter table public.staff_direct_page_grants enable row level security;
revoke all on table public.staff_workspace_page_defaults from public, anon, authenticated;
revoke all on table public.staff_page_bundles from public, anon, authenticated;
revoke all on table public.staff_direct_page_grants from public, anon, authenticated;
