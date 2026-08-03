-- Permanent schema: cohorts + tutor teaching groups + change log.
-- Builds on 001_portal_bootstrap.sql.
-- Mutations: service-role from Next.js. Authenticated select policies are temporary.

-- ---------------------------------------------------------------------------
-- Programmes — extend thin catalogue from 001 (needed for cohort programme_id)
-- ---------------------------------------------------------------------------
alter table public.programmes
  add column if not exists level integer not null default 2,
  add column if not exists route text not null default '',
  add column if not exists awarding_body text not null default '',
  add column if not exists status text not null default 'active',
  add column if not exists summary text not null default '',
  add column if not exists skills_england_url text not null default '',
  add column if not exists notes text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'programmes_status_check'
  ) then
    alter table public.programmes
      add constraint programmes_status_check
      check (status in ('active', 'inactive', 'retired'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'programmes_level_check'
  ) then
    alter table public.programmes
      add constraint programmes_level_check
      check (level between 2 and 7);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Employers (catalogue for enrolment placement)
-- ---------------------------------------------------------------------------
create table if not exists public.employers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text not null default '',
  company_number text not null default '',
  main_contact text not null default '',
  contact_role text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  address_line1 text not null default '',
  address_line2 text not null default '',
  town text not null default '',
  postcode text not null default '',
  website text not null default '',
  status text not null default 'active',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employers_status_check check (status in ('active', 'inactive'))
);

-- ---------------------------------------------------------------------------
-- Cohorts = shared intake (programme version + teachers + lock).
-- Not day/tutor-specific — teaching groups sit under the cohort.
-- ---------------------------------------------------------------------------
create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  programme_id uuid references public.programmes (id) on delete set null,
  programme_name text not null default '',
  standard_code text not null default '',
  standard_version text not null default '',
  delivery_spine text not null default 'groups',
  enrolment_opens_date date,
  start_date date not null,
  expected_end_date date,
  -- Legacy free-text fields; prefer cohort_teaching_groups.
  teaching_group text not null default '',
  college_days text not null default '',
  -- Pipe-joined teacher list (`Name | Name`); matches portal tutor_name storage.
  tutor_name text not null default '',
  status text not null default 'planned',
  notes text not null default '',
  locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path when an older cohorts table already exists.
alter table public.cohorts
  add column if not exists programme_id uuid references public.programmes (id) on delete set null,
  add column if not exists programme_name text not null default '',
  add column if not exists standard_code text not null default '',
  add column if not exists standard_version text not null default '',
  add column if not exists delivery_spine text not null default 'groups',
  add column if not exists enrolment_opens_date date,
  add column if not exists start_date date,
  add column if not exists expected_end_date date,
  add column if not exists teaching_group text not null default '',
  add column if not exists college_days text not null default '',
  add column if not exists tutor_name text not null default '',
  add column if not exists status text not null default 'planned',
  add column if not exists notes text not null default '',
  add column if not exists locked boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cohorts_status_check'
  ) then
    alter table public.cohorts
      add constraint cohorts_status_check
      check (status in ('planned', 'active', 'completed'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'cohorts_delivery_spine_check'
  ) then
    alter table public.cohorts
      add constraint cohorts_delivery_spine_check
      check (delivery_spine in ('groups', 'blocks'));
  end if;
end $$;

comment on table public.cohorts is
  'Intake delivering one Skills England version. Teachers own teaching groups under the cohort.';

comment on column public.cohorts.locked is
  'When true, cohort details, teachers, groups, and placements cannot be edited until unlocked.';

comment on column public.cohorts.delivery_spine is
  'Learner delivery UI spine: groups (CEA) or blocks (programme blocks). Locked with standard_version after start.';

comment on column public.cohorts.tutor_name is
  'Joined teacher list for the intake (`Name | Name`). Prefer parsing via the portal.';

-- ---------------------------------------------------------------------------
-- Teaching groups = tutor-owned class on college days, with capacity
-- ---------------------------------------------------------------------------
create table if not exists public.cohort_teaching_groups (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  tutor_name text not null default '',
  name text not null default '',
  college_days text not null default '',
  capacity integer not null default 9,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cohort_teaching_groups_capacity_check check (capacity >= 1)
);

create index if not exists cohort_teaching_groups_cohort_id_idx
  on public.cohort_teaching_groups (cohort_id);

comment on table public.cohort_teaching_groups is
  'Tutor-owned class within a cohort. Apprentices inherit tutor + college days from their group.';

-- Enrolment placement onto a teaching group (inherits tutor + days).
alter table public.learner_programmes
  add column if not exists teaching_group_id uuid
    references public.cohort_teaching_groups (id) on delete set null;

create index if not exists learner_programmes_teaching_group_id_idx
  on public.learner_programmes (teaching_group_id);

create index if not exists learner_programmes_cohort_id_idx
  on public.learner_programmes (cohort_id);

-- ---------------------------------------------------------------------------
-- Append-only change history (Save & lock / leave-lock sessions)
-- ---------------------------------------------------------------------------
create table if not exists public.cohort_change_log (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete cascade,
  created_at timestamptz not null default now(),
  summary text not null default '',
  details jsonb not null default '[]'::jsonb,
  actor_name text not null default ''
);

create index if not exists cohort_change_log_cohort_id_created_at_idx
  on public.cohort_change_log (cohort_id, created_at desc);

comment on table public.cohort_change_log is
  'Session summaries when a cohort is locked after edits (groups, teachers, placements, etc.).';

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists touch_employers_updated_at on public.employers;
create trigger touch_employers_updated_at
before update on public.employers
for each row execute function public.touch_updated_at();

drop trigger if exists touch_cohorts_updated_at on public.cohorts;
create trigger touch_cohorts_updated_at
before update on public.cohorts
for each row execute function public.touch_updated_at();

drop trigger if exists touch_cohort_teaching_groups_updated_at
  on public.cohort_teaching_groups;
create trigger touch_cohort_teaching_groups_updated_at
before update on public.cohort_teaching_groups
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (read for authenticated; writes via service role)
-- ---------------------------------------------------------------------------
alter table public.employers enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_teaching_groups enable row level security;
alter table public.cohort_change_log enable row level security;

drop policy if exists employers_select_authenticated on public.employers;
create policy employers_select_authenticated
on public.employers for select to authenticated using (true);

drop policy if exists cohorts_select_authenticated on public.cohorts;
create policy cohorts_select_authenticated
on public.cohorts for select to authenticated using (true);

drop policy if exists cohort_teaching_groups_select_authenticated
  on public.cohort_teaching_groups;
create policy cohort_teaching_groups_select_authenticated
on public.cohort_teaching_groups
for select to authenticated using (true);

drop policy if exists cohort_change_log_select_authenticated
  on public.cohort_change_log;
create policy cohort_change_log_select_authenticated
on public.cohort_change_log
for select to authenticated using (true);
