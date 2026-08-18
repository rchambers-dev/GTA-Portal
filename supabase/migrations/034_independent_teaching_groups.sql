-- Phase 2: independent Teaching Groups, GTA programme version pin on groups,
-- and durable teaching-group membership history.
-- Additive only. Table name cohort_teaching_groups is retained so existing
-- FKs (enrolments, session learning/review releases) keep working.

-- ---------------------------------------------------------------------------
-- Teaching groups: optional cohort, GTA version, active state
-- ---------------------------------------------------------------------------
alter table public.cohort_teaching_groups
  add column if not exists gta_programme_version_id uuid;

alter table public.cohort_teaching_groups
  add column if not exists status text not null default 'active';

alter table public.cohort_teaching_groups
  add column if not exists version_review_required boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cohort_teaching_groups'
      and column_name = 'cohort_id'
      and is_nullable = 'NO'
  ) then
    alter table public.cohort_teaching_groups
      alter column cohort_id drop not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'cohort_teaching_groups_cohort_id_fkey'
  ) then
    alter table public.cohort_teaching_groups
      drop constraint cohort_teaching_groups_cohort_id_fkey;
  end if;
end $$;

alter table public.cohort_teaching_groups
  add constraint cohort_teaching_groups_cohort_id_fkey
  foreign key (cohort_id)
  references public.cohorts (id)
  on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cohort_teaching_groups_gta_programme_version_fk'
  ) then
    if to_regclass('public.gta_programme_versions') is not null then
      alter table public.cohort_teaching_groups
        add constraint cohort_teaching_groups_gta_programme_version_fk
        foreign key (gta_programme_version_id)
        references public.gta_programme_versions (id)
        on delete restrict;
    end if;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cohort_teaching_groups_status_check'
  ) then
    alter table public.cohort_teaching_groups
      add constraint cohort_teaching_groups_status_check
      check (status in ('active', 'inactive'));
  end if;
end $$;

create index if not exists cohort_teaching_groups_gta_programme_version_id_idx
  on public.cohort_teaching_groups (gta_programme_version_id);

create index if not exists cohort_teaching_groups_status_idx
  on public.cohort_teaching_groups (status);

comment on table public.cohort_teaching_groups is
  'Independent tutor-led Teaching Group. Not owned by a cohort. Table name kept for existing FKs.';

comment on column public.cohort_teaching_groups.cohort_id is
  'Legacy/optional intake link. New groups do not require a cohort.';

comment on column public.cohort_teaching_groups.gta_programme_version_id is
  'Pinned GTA curriculum version this class delivers. Null until proven or staff-assigned.';

comment on column public.cohort_teaching_groups.version_review_required is
  'True when existing data could not safely prove a GTA programme version.';

-- ---------------------------------------------------------------------------
-- Proven pin for existing groups: every live member shares the same non-null pin
-- ---------------------------------------------------------------------------
with member_versions as (
  select
    teaching_group_id,
    count(*) filter (where gta_programme_version_id is null) as unpinned,
    count(distinct gta_programme_version_id)
      filter (where gta_programme_version_id is not null) as distinct_pins,
    (array_agg(gta_programme_version_id)
      filter (where gta_programme_version_id is not null))[1] as pin
  from public.apprentice_programmes
  where teaching_group_id is not null
    and status not in ('withdrawn', 'completed')
  group by teaching_group_id
)
update public.cohort_teaching_groups g
set
  gta_programme_version_id = case
    when m.unpinned = 0 and m.distinct_pins = 1 then m.pin
    else g.gta_programme_version_id
  end,
  version_review_required = not (m.unpinned = 0 and m.distinct_pins = 1)
from member_versions m
where g.id = m.teaching_group_id
  and g.gta_programme_version_id is null;

update public.cohort_teaching_groups
set version_review_required = true
where gta_programme_version_id is null;

-- ---------------------------------------------------------------------------
-- Membership history
-- ---------------------------------------------------------------------------
create table if not exists public.teaching_group_memberships (
  id uuid primary key default gen_random_uuid(),
  apprentice_programme_id uuid not null
    references public.apprentice_programmes (id) on delete cascade,
  teaching_group_id uuid not null
    references public.cohort_teaching_groups (id) on delete restrict,
  joined_at timestamptz,
  left_at timestamptz,
  is_current boolean not null default true,
  source text not null default 'staff',
  recorded_at timestamptz not null default now(),
  actor_name text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint teaching_group_memberships_source_check
    check (source in ('staff', 'legacy_backfill')),
  constraint teaching_group_memberships_left_after_join_check
    check (left_at is null or joined_at is null or left_at >= joined_at)
);

create unique index if not exists teaching_group_memberships_one_current_idx
  on public.teaching_group_memberships (apprentice_programme_id)
  where is_current;

create index if not exists teaching_group_memberships_group_id_idx
  on public.teaching_group_memberships (teaching_group_id);

create index if not exists teaching_group_memberships_enrolment_idx
  on public.teaching_group_memberships (apprentice_programme_id, recorded_at desc);

comment on table public.teaching_group_memberships is
  'Durable Teaching Group membership history. joined_at is null when the true join date is unknown.';

comment on column public.teaching_group_memberships.joined_at is
  'Effective join time when known. Null for legacy backfill — do not invent a date.';

-- Current pointer → current membership (unknown joined_at)
insert into public.teaching_group_memberships (
  apprentice_programme_id,
  teaching_group_id,
  joined_at,
  left_at,
  is_current,
  source,
  recorded_at,
  notes
)
select
  ap.id,
  ap.teaching_group_id,
  null,
  null,
  true,
  'legacy_backfill',
  now(),
  'Backfilled from apprentice_programmes.teaching_group_id; historic join date unknown.'
from public.apprentice_programmes ap
where ap.teaching_group_id is not null
  and not exists (
    select 1
    from public.teaching_group_memberships m
    where m.apprentice_programme_id = ap.id
      and m.is_current
  );

alter table public.teaching_group_memberships enable row level security;

drop policy if exists teaching_group_memberships_select_authenticated
  on public.teaching_group_memberships;
create policy teaching_group_memberships_select_authenticated
on public.teaching_group_memberships
for select to authenticated using (true);
