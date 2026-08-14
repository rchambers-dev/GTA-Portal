-- Stored presentation/document preview derivatives.
-- Separate from original binaries and text extracts.

create table if not exists public.gta_programme_resource_previews (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null
    references public.gta_programme_resources (id) on delete cascade,
  binary_id uuid
    references public.gta_programme_resource_binaries (id) on delete set null,
  programme_version_id uuid not null
    references public.gta_programme_versions (id) on delete cascade,
  preview_type text not null default 'slide_images',
  status text not null default 'ready',
  generated_from_binary_hash text not null,
  storage_bucket text not null default 'gta-programme-resource-binaries',
  slide_count integer not null default 0,
  failure_reason text not null default '',
  manifest jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_programme_resource_previews_type_check check (
    preview_type in ('slide_images', 'slide_html', 'pdf', 'video')
  ),
  constraint gta_programme_resource_previews_status_check check (
    status in ('ready', 'stale', 'failed', 'unavailable')
  ),
  constraint gta_programme_resource_previews_resource_uidx unique (resource_id)
);

create index if not exists gta_programme_resource_previews_version_idx
  on public.gta_programme_resource_previews (programme_version_id);
create index if not exists gta_programme_resource_previews_hash_idx
  on public.gta_programme_resource_previews (generated_from_binary_hash);

comment on table public.gta_programme_resource_previews is
  'Generated preview derivatives for programme resources. Not the original file. Not public.';

alter table public.gta_programme_resource_previews enable row level security;

drop policy if exists gta_programme_resource_previews_select_authenticated
  on public.gta_programme_resource_previews;
create policy gta_programme_resource_previews_select_authenticated
  on public.gta_programme_resource_previews
  for select
  to authenticated
  using (false);

drop trigger if exists touch_gta_programme_resource_previews_updated_at
  on public.gta_programme_resource_previews;
create trigger touch_gta_programme_resource_previews_updated_at
before update on public.gta_programme_resource_previews
for each row execute function public.touch_updated_at();
