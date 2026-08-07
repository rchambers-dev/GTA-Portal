-- Block ↔ KSB mappings: LearningIntent + IsPrimary + audit fields.
-- Extends gta_spine_item_ksbs; one primary per KSB per programme version.

alter table public.gta_spine_item_ksbs
  add column if not exists id uuid,
  add column if not exists programme_version_id uuid,
  add column if not exists is_primary boolean not null default false,
  add column if not exists learning_intent text not null default 'practise',
  add column if not exists mapping_source text not null default 'manual',
  add column if not exists confidence numeric(5, 4),
  add column if not exists ai_reason_summary text,
  add column if not exists created_by text not null default '',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.gta_spine_item_ksbs
set id = gen_random_uuid()
where id is null;

alter table public.gta_spine_item_ksbs
  alter column id set default gen_random_uuid();

-- Backfill programme_version_id from spine ancestry where missing.
update public.gta_spine_item_ksbs mik
set programme_version_id = s.programme_version_id
from public.gta_spine_items si
join public.gta_spines s on s.id = si.spine_id
where mik.spine_item_id = si.id
  and mik.programme_version_id is null;

-- Drop old composite PK so we can use uuid PK (keep unique pair).
alter table public.gta_spine_item_ksbs
  drop constraint if exists gta_spine_item_ksbs_pkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gta_spine_item_ksbs_id_pkey'
  ) then
    alter table public.gta_spine_item_ksbs
      add constraint gta_spine_item_ksbs_id_pkey primary key (id);
  end if;
end $$;

alter table public.gta_spine_item_ksbs
  drop constraint if exists gta_spine_item_ksbs_pair_unique;
alter table public.gta_spine_item_ksbs
  add constraint gta_spine_item_ksbs_pair_unique unique (spine_item_id, ksb_id);

alter table public.gta_spine_item_ksbs
  drop constraint if exists gta_spine_item_ksbs_intent_check;
alter table public.gta_spine_item_ksbs
  add constraint gta_spine_item_ksbs_intent_check
  check (
    learning_intent in (
      'introduce',
      'practise',
      'apply',
      'reinforce',
      'consolidate',
      'assess'
    )
  );

alter table public.gta_spine_item_ksbs
  drop constraint if exists gta_spine_item_ksbs_source_check;
alter table public.gta_spine_item_ksbs
  add constraint gta_spine_item_ksbs_source_check
  check (mapping_source in ('manual', 'ai_suggested', 'imported'));

-- FK for programme_version_id when present (nullable during migrate of orphans).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gta_spine_item_ksbs_programme_version_fk'
  ) then
    alter table public.gta_spine_item_ksbs
      add constraint gta_spine_item_ksbs_programme_version_fk
      foreign key (programme_version_id)
      references public.gta_programme_versions (id)
      on delete cascade;
  end if;
end $$;

create unique index if not exists gta_spine_item_ksbs_one_primary_idx
  on public.gta_spine_item_ksbs (programme_version_id, ksb_id)
  where is_primary = true;

create index if not exists gta_spine_item_ksbs_programme_version_idx
  on public.gta_spine_item_ksbs (programme_version_id);

comment on column public.gta_spine_item_ksbs.is_primary is
  'Valuation/ownership flag — at most one true per (programme_version_id, ksb_id).';
comment on column public.gta_spine_item_ksbs.learning_intent is
  'Educational use of this KSB in this block (introduce…assess).';
