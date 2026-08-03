-- Permanent staff / portal account fields on profiles + staffing helpers.
-- Builds on 001 + 002. Mutations: service-role from Next.js.

-- ---------------------------------------------------------------------------
-- Portal account fields (Staff directory, Account Setup, enable/disable)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists portal_status text not null default 'active',
  add column if not exists linked_learner_id uuid references public.learners (id) on delete set null,
  add column if not exists enabled_by text,
  add column if not exists enabled_at timestamptz,
  add column if not exists disabled_by text,
  add column if not exists disabled_at timestamptz,
  add column if not exists temporary_password text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_portal_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_portal_status_check
      check (portal_status in ('active', 'invited', 'disabled'));
  end if;
end $$;

comment on column public.profiles.portal_status is
  'Portal login environment: invited (awaiting enable), active, or disabled.';

comment on column public.profiles.responsibilities is
  'Org-chart job titles for staff (array). Prefer this over department for multi-title people.';

comment on column public.profiles.department is
  'Legacy single job title; kept in sync as the first responsibilities entry.';

comment on column public.profiles.temporary_password is
  'Optional plaintext temp password for learner enable flows; not used for day-to-day staff logins.';

-- Authenticated staff can read the directory (writes still via service role).
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles
for select
to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- Staff assignments (tutor / mentor ↔ enrolment)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  learner_programme_id uuid not null references public.learner_programmes (id) on delete cascade,
  role text not null,
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_assignments_role_check
    check (role in ('tutor', 'mentor', 'assessor', 'coordinator')),
  unique (profile_id, learner_programme_id, role)
);

drop trigger if exists touch_staff_assignments_updated_at on public.staff_assignments;
create trigger touch_staff_assignments_updated_at
before update on public.staff_assignments
for each row execute function public.touch_updated_at();

alter table public.staff_assignments enable row level security;

drop policy if exists staff_assignments_select_authenticated on public.staff_assignments;
create policy staff_assignments_select_authenticated
on public.staff_assignments for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Temporary permission grants + general audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.temporary_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default '',
  permissions text[] not null default '{}',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  granted_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.temporary_assignments enable row level security;

drop policy if exists temporary_assignments_select_own on public.temporary_assignments;
create policy temporary_assignments_select_own
on public.temporary_assignments for select to authenticated
using (auth.uid() = profile_id);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id text not null default '',
  action text not null,
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.audit_events enable row level security;

-- ---------------------------------------------------------------------------
-- Seed GTA apprenticeship programmes (idempotent by standard_code)
-- ---------------------------------------------------------------------------
insert into public.programmes (
  name, standard_code, level, route, duration_months, awarding_body, status, summary, skills_england_url, notes
)
select v.name, v.standard_code, v.level, v.route, v.duration_months, v.awarding_body, 'active', v.summary, v.skills_england_url, v.notes
from (
  values
    (
      'Autocare Level 2',
      'ST0499',
      2,
      'Engineering and manufacturing',
      30,
      'IMI / City & Guilds',
      'Official title: Autocare Technician. Carries out services and repairs on cars, car-derived vans and light goods vehicles in autocare or fast-fit centres.',
      'https://skillsengland.education.gov.uk/apprenticeships/st0499-v1-3',
      'Skills England reference ST0499 · Level 2 · typically 30 months.'
    ),
    (
      'Vehicle Maintenance and Repair Level 3',
      'ST0033',
      3,
      'Engineering and manufacturing',
      36,
      'IMI',
      'Official title: Motor vehicle service and maintenance technician – light vehicle.',
      'https://skillsengland.education.gov.uk/apprenticeships/st0033-v1-5',
      'Skills England reference ST0033 · Level 3 · typically 36 months.'
    ),
    (
      'Heavy Vehicle Technician Level 3',
      'ST0068',
      3,
      'Engineering and manufacturing',
      36,
      'IMI',
      'Official title: Heavy vehicle service and maintenance technician.',
      'https://skillsengland.education.gov.uk/apprenticeships/st0068-v1-5',
      'Skills England reference ST0068 · Level 3 · typically 36 months.'
    ),
    (
      'Vehicle Damage Paint Level 3',
      'ST0448',
      3,
      'Engineering and manufacturing',
      36,
      'IMI',
      'Official title: Vehicle damage paint technician.',
      'https://skillsengland.education.gov.uk/apprenticeships/st0448-v1-2',
      'Skills England reference ST0448 · Level 3 · typically 36 months.'
    ),
    (
      'Vehicle Damage Panel Level 3',
      'ST0403',
      3,
      'Engineering and manufacturing',
      36,
      'IMI',
      'Official title: Vehicle damage panel technician.',
      'https://skillsengland.education.gov.uk/apprenticeships/st0403-v1-3',
      'Skills England reference ST0403 · Level 3 · typically 36 months.'
    ),
    (
      'Customer Service Level 2',
      'ST0072',
      2,
      'Sales, marketing and procurement',
      12,
      'IMI / Institute of Customer Service',
      'Official title: Customer service practitioner.',
      'https://skillsengland.education.gov.uk/apprenticeships/st0072-v1-1',
      'Skills England reference ST0072 · Level 2 · typically 12 months.'
    ),
    (
      'Customer Service Specialist Level 3',
      'ST0071',
      3,
      'Sales, marketing and procurement',
      15,
      'IMI / Institute of Customer Service',
      'Official title: Customer service specialist.',
      'https://skillsengland.education.gov.uk/apprenticeships/st0071-v1-3',
      'Skills England reference ST0071 · Level 3 · typically 15 months.'
    ),
    (
      'Business Administration Level 3',
      'ST0070',
      3,
      'Business and administration',
      18,
      'Various EPAOs',
      'Official title: Business administrator.',
      'https://skillsengland.education.gov.uk/apprenticeships/st0070-v1-0',
      'Skills England reference ST0070 · Level 3 · typically 12–18 months.'
    )
) as v(name, standard_code, level, route, duration_months, awarding_body, summary, skills_england_url, notes)
where not exists (
  select 1 from public.programmes p where p.standard_code = v.standard_code
);
