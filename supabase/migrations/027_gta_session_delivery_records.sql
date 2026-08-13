-- Phase 2B: per-apprentice Session delivery records (Block 1 pilot).
-- Sign-off = planned learning event delivered — NOT competence / Task pass / OTJ.

create table if not exists public.gta_session_delivery_records (
  id uuid primary key default gen_random_uuid(),
  programme_version_id uuid not null
    references public.gta_programme_versions (id) on delete cascade,
  session_id uuid not null
    references public.gta_programme_sessions (id) on delete cascade,
  apprentice_id uuid not null
    references public.apprentices (id) on delete cascade,
  apprentice_programme_id uuid not null
    references public.apprentice_programmes (id) on delete cascade,
  spine_item_id uuid
    references public.gta_spine_items (id) on delete set null,
  status text not null default 'delivered',
  delivered_at timestamptz not null default now(),
  signed_off_by uuid
    references public.profiles (id) on delete set null,
  signed_off_by_name text not null default '',
  note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_session_delivery_records_status_check check (
    status in ('delivered')
  ),
  constraint gta_session_delivery_records_unique
    unique (session_id, apprentice_programme_id)
);

create index if not exists gta_session_delivery_records_enrolment_idx
  on public.gta_session_delivery_records (apprentice_programme_id);

create index if not exists gta_session_delivery_records_apprentice_idx
  on public.gta_session_delivery_records (apprentice_id);

create index if not exists gta_session_delivery_records_session_idx
  on public.gta_session_delivery_records (session_id);

create index if not exists gta_session_delivery_records_version_idx
  on public.gta_session_delivery_records (programme_version_id);

comment on table public.gta_session_delivery_records is
  'Tutor confirms a planned Session was delivered for an apprentice. Not KSB competence, Task pass, OTJ, or attendance.';

alter table public.gta_session_delivery_records enable row level security;

drop policy if exists gta_session_delivery_records_select_authenticated
  on public.gta_session_delivery_records;
create policy gta_session_delivery_records_select_authenticated
  on public.gta_session_delivery_records
  for select
  to authenticated
  using (true);

drop trigger if exists touch_gta_session_delivery_records_updated_at
  on public.gta_session_delivery_records;
create trigger touch_gta_session_delivery_records_updated_at
before update on public.gta_session_delivery_records
for each row execute function public.touch_updated_at();
