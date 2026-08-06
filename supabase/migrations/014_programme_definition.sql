-- Programme definition foundations: immutable Skills England snapshots + GTA spines.
-- Official rows are append-only by version; never update SE wording in place.

-- ---------------------------------------------------------------------------
-- Standards catalogue (external ST / OCC codes)
-- ---------------------------------------------------------------------------
create table if not exists public.se_standards (
  id uuid primary key default gen_random_uuid(),
  standard_code text not null,
  occupation_code text not null default '',
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint se_standards_standard_code_unique unique (standard_code)
);

comment on table public.se_standards is
  'Skills England apprenticeship product identity (e.g. ST0499). UUID PK; codes are external ids.';

-- ---------------------------------------------------------------------------
-- Immutable imported version snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.se_standard_versions (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.se_standards (id) on delete cascade,
  external_version text not null,
  level integer not null default 2,
  status text not null default '',
  typical_duration_months integer,
  assessment_period_months integer,
  minimum_compliance_hours integer,
  maximum_funding_pounds integer,
  lars_code integer,
  route text not null default '',
  pathway text not null default '',
  cluster_name text not null default '',
  assessment_plan_url text not null default '',
  approved_for_delivery_date date,
  updated_date date,
  apprenticeship_details_complete boolean not null default false,
  occupation_raw_payload jsonb not null default '{}'::jsonb,
  apprenticeship_raw_payload jsonb,
  source_hash text not null default '',
  imported_at timestamptz not null default now(),
  is_current boolean not null default false,
  constraint se_standard_versions_unique unique (standard_id, external_version)
);

create index if not exists se_standard_versions_standard_id_idx
  on public.se_standard_versions (standard_id);

comment on table public.se_standard_versions is
  'Immutable import of one Skills England standard version. New SE version = new row.';

-- ---------------------------------------------------------------------------
-- Official curriculum locked to a version
-- ---------------------------------------------------------------------------
create table if not exists public.se_duties (
  id uuid primary key default gen_random_uuid(),
  standard_version_id uuid not null references public.se_standard_versions (id) on delete cascade,
  duty_code text not null,
  description text not null default '',
  constraint se_duties_unique unique (standard_version_id, duty_code)
);

create table if not exists public.se_ksbs (
  id uuid primary key default gen_random_uuid(),
  standard_version_id uuid not null references public.se_standard_versions (id) on delete cascade,
  ksb_code text not null,
  ksb_type text not null,
  description text not null default '',
  constraint se_ksbs_type_check check (ksb_type in ('knowledge', 'skill', 'behaviour')),
  constraint se_ksbs_unique unique (standard_version_id, ksb_code)
);

create table if not exists public.se_duty_ksb_mappings (
  duty_id uuid not null references public.se_duties (id) on delete cascade,
  ksb_id uuid not null references public.se_ksbs (id) on delete cascade,
  primary key (duty_id, ksb_id)
);

create index if not exists se_duties_version_idx on public.se_duties (standard_version_id);
create index if not exists se_ksbs_version_idx on public.se_ksbs (standard_version_id);

-- ---------------------------------------------------------------------------
-- GTA programme definition (mutable until published)
-- ---------------------------------------------------------------------------
create table if not exists public.gta_programmes (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.se_standards (id) on delete restrict,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gta_programme_versions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.gta_programmes (id) on delete cascade,
  standard_version_id uuid not null references public.se_standard_versions (id) on delete restrict,
  internal_version text not null default '1',
  status text not null default 'draft',
  copied_from_version_id uuid references public.gta_programme_versions (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_programme_versions_status_check
    check (status in ('draft', 'in_review', 'approved', 'published', 'superseded', 'archived'))
);

create table if not exists public.gta_spines (
  id uuid primary key default gen_random_uuid(),
  programme_version_id uuid not null references public.gta_programme_versions (id) on delete cascade,
  title text not null default 'Main spine',
  created_at timestamptz not null default now()
);

create table if not exists public.gta_spine_items (
  id uuid primary key default gen_random_uuid(),
  spine_id uuid not null references public.gta_spines (id) on delete cascade,
  item_type text not null,
  gateway_type text,
  title text not null default '',
  sequence integer not null default 0,
  planned_weeks integer,
  planned_otj_hours numeric(8, 2) not null default 0,
  counts_towards_learning_hours boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  constraint gta_spine_items_type_check
    check (item_type in ('block', 'gateway', 'epa', 'milestone', 'break')),
  constraint gta_spine_items_gateway_type_check
    check (gateway_type is null or gateway_type in ('internal', 'official'))
);

create index if not exists gta_spine_items_spine_seq_idx
  on public.gta_spine_items (spine_id, sequence);

create table if not exists public.gta_spine_item_ksbs (
  spine_item_id uuid not null references public.gta_spine_items (id) on delete cascade,
  ksb_id uuid not null references public.se_ksbs (id) on delete cascade,
  primary key (spine_item_id, ksb_id)
);

-- RLS: authenticated read for now (mutations via service role / Next.js)
alter table public.se_standards enable row level security;
alter table public.se_standard_versions enable row level security;
alter table public.se_duties enable row level security;
alter table public.se_ksbs enable row level security;
alter table public.se_duty_ksb_mappings enable row level security;
alter table public.gta_programmes enable row level security;
alter table public.gta_programme_versions enable row level security;
alter table public.gta_spines enable row level security;
alter table public.gta_spine_items enable row level security;
alter table public.gta_spine_item_ksbs enable row level security;

drop policy if exists se_standards_select_authenticated on public.se_standards;
create policy se_standards_select_authenticated
  on public.se_standards for select to authenticated using (true);

drop policy if exists se_standard_versions_select_authenticated on public.se_standard_versions;
create policy se_standard_versions_select_authenticated
  on public.se_standard_versions for select to authenticated using (true);

drop policy if exists se_duties_select_authenticated on public.se_duties;
create policy se_duties_select_authenticated
  on public.se_duties for select to authenticated using (true);

drop policy if exists se_ksbs_select_authenticated on public.se_ksbs;
create policy se_ksbs_select_authenticated
  on public.se_ksbs for select to authenticated using (true);

drop policy if exists se_duty_ksb_mappings_select_authenticated on public.se_duty_ksb_mappings;
create policy se_duty_ksb_mappings_select_authenticated
  on public.se_duty_ksb_mappings for select to authenticated using (true);

drop policy if exists gta_programmes_select_authenticated on public.gta_programmes;
create policy gta_programmes_select_authenticated
  on public.gta_programmes for select to authenticated using (true);

drop policy if exists gta_programme_versions_select_authenticated on public.gta_programme_versions;
create policy gta_programme_versions_select_authenticated
  on public.gta_programme_versions for select to authenticated using (true);

drop policy if exists gta_spines_select_authenticated on public.gta_spines;
create policy gta_spines_select_authenticated
  on public.gta_spines for select to authenticated using (true);

drop policy if exists gta_spine_items_select_authenticated on public.gta_spine_items;
create policy gta_spine_items_select_authenticated
  on public.gta_spine_items for select to authenticated using (true);

drop policy if exists gta_spine_item_ksbs_select_authenticated on public.gta_spine_item_ksbs;
create policy gta_spine_item_ksbs_select_authenticated
  on public.gta_spine_item_ksbs for select to authenticated using (true);
