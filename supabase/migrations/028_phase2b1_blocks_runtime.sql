-- Phase 2B.1: blocks-only delivery runtime.
-- S4 authorised early-unlock audit trail + retire unused Groups/CEA state table.
-- Inventory (2026-08-13): cea_apprentice_states=0, cohorts=0, only SAFE TEST apprentice.
-- No real learner evidence dropped.

-- ---------------------------------------------------------------------------
-- S4 — per-enrolment authorised Block unlock (one learner, auditable)
-- ---------------------------------------------------------------------------
create table if not exists public.gta_enrolment_block_unlocks (
  id uuid primary key default gen_random_uuid(),
  apprentice_programme_id uuid not null
    references public.apprentice_programmes (id) on delete cascade,
  spine_item_id uuid not null
    references public.gta_spine_items (id) on delete cascade,
  unlocked_by uuid
    references public.profiles (id) on delete set null,
  unlocked_by_name text not null default '',
  unlocked_at timestamptz not null default now(),
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gta_enrolment_block_unlocks_reason_check
    check (char_length(trim(reason)) > 0),
  constraint gta_enrolment_block_unlocks_unique
    unique (apprentice_programme_id, spine_item_id)
);

create index if not exists gta_enrolment_block_unlocks_enrolment_idx
  on public.gta_enrolment_block_unlocks (apprentice_programme_id);

create index if not exists gta_enrolment_block_unlocks_spine_idx
  on public.gta_enrolment_block_unlocks (spine_item_id);

comment on table public.gta_enrolment_block_unlocks is
  'S4 authorised early unlock of one Block for one enrolment. Calendar/sequence remains default. Not Task/Session auto-unlock.';

alter table public.gta_enrolment_block_unlocks enable row level security;

drop policy if exists gta_enrolment_block_unlocks_select_authenticated
  on public.gta_enrolment_block_unlocks;
create policy gta_enrolment_block_unlocks_select_authenticated
  on public.gta_enrolment_block_unlocks
  for select
  to authenticated
  using (true);

drop trigger if exists touch_gta_enrolment_block_unlocks_updated_at
  on public.gta_enrolment_block_unlocks;
create trigger touch_gta_enrolment_block_unlocks_updated_at
before update on public.gta_enrolment_block_unlocks
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Cohorts: controlled delivery is Blocks. Do not default new rows to Groups.
-- ---------------------------------------------------------------------------
alter table public.cohorts
  alter column delivery_spine set default 'blocks';

update public.cohorts
set delivery_spine = 'blocks'
where delivery_spine is distinct from 'blocks';

-- ---------------------------------------------------------------------------
-- Retire unused Groups/CEA runtime table (zero rows at Phase 2B.1).
-- ---------------------------------------------------------------------------
drop table if exists public.cea_apprentice_states;
