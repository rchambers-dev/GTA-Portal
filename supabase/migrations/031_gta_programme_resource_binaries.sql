-- Programme resource original binaries (private storage).
-- Source G01–G14 folders are provenance only — not controlled Blocks.

create table if not exists public.gta_programme_resource_binaries (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null
    references public.gta_programme_resources (id) on delete cascade,
  programme_version_id uuid not null
    references public.gta_programme_versions (id) on delete cascade,
  original_filename text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  sha256 text not null,
  storage_bucket text not null default 'gta-programme-resource-binaries',
  storage_path text not null,
  source_archive text not null default '',
  source_path text not null default '',
  source_group_code text not null default '',
  source_group_folder text not null default '',
  version_review text not null default 'SAME',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_programme_resource_binaries_version_review_check check (
    version_review in ('SAME', 'MINOR_REVISION', 'MATERIAL_REVISION', 'UNRESOLVED_VERSION')
  ),
  constraint gta_programme_resource_binaries_resource_uidx unique (resource_id)
);

create index if not exists gta_programme_resource_binaries_version_idx
  on public.gta_programme_resource_binaries (programme_version_id);
create index if not exists gta_programme_resource_binaries_sha_idx
  on public.gta_programme_resource_binaries (sha256);

comment on table public.gta_programme_resource_binaries is
  'Original supplied binaries for controlled programme resources. Not public. Access is via authorised API only.';

alter table public.gta_programme_resource_binaries enable row level security;

drop policy if exists gta_programme_resource_binaries_select_authenticated
  on public.gta_programme_resource_binaries;
create policy gta_programme_resource_binaries_select_authenticated
  on public.gta_programme_resource_binaries
  for select
  to authenticated
  using (false);

drop trigger if exists touch_gta_programme_resource_binaries_updated_at
  on public.gta_programme_resource_binaries;
create trigger touch_gta_programme_resource_binaries_updated_at
before update on public.gta_programme_resource_binaries
for each row execute function public.touch_updated_at();

-- Same binary may appear in several source Group folders.
create table if not exists public.gta_programme_resource_source_paths (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null
    references public.gta_programme_resources (id) on delete cascade,
  binary_id uuid
    references public.gta_programme_resource_binaries (id) on delete set null,
  source_archive text not null default '',
  source_path text not null,
  source_group_code text not null default '',
  source_group_folder text not null default '',
  sha256 text not null default '',
  created_at timestamptz not null default now(),
  constraint gta_programme_resource_source_paths_uidx
    unique (resource_id, source_path)
);

comment on table public.gta_programme_resource_source_paths is
  'Source-pack provenance (G-folder path). Not runtime Group curriculum.';

alter table public.gta_programme_resource_source_paths enable row level security;

drop policy if exists gta_programme_resource_source_paths_select_authenticated
  on public.gta_programme_resource_source_paths;
create policy gta_programme_resource_source_paths_select_authenticated
  on public.gta_programme_resource_source_paths
  for select
  to authenticated
  using (false);
