create extension if not exists "pgcrypto";

-- Portal bootstrap schema (v1).
-- Writes in the Next.js app use SUPABASE_SERVICE_ROLE_KEY on the server only.
-- RLS is enabled below so the anon/authenticated keys cannot bypass policies;
-- service-role requests ignore RLS by design.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  username text unique,
  display_name text,
  base_role text not null default 'Owner',
  workspace text not null default 'management',
  permissions text[] not null default '{}',
  responsibilities text[] not null default '{}',
  department text,
  department_scope text[] not null default '{}',
  programme_scope text[] not null default '{}',
  module_scope text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_workspace_check check (
    workspace in (
      'learner',
      'employer',
      'staff',
      'quality',
      'management',
      'administration',
      'safeguarding'
    )
  )
);

create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  learner_reference text not null unique,
  email text not null default '',
  phone text not null default '',
  date_of_birth date,
  uln text not null default '',
  address_line1 text not null default '',
  address_line2 text not null default '',
  town text not null default '',
  postcode text not null default '',
  emergency_contact_name text not null default '',
  emergency_contact_phone text not null default '',
  emergency_contact_relationship text not null default '',
  support_notes text not null default '',
  intake_status text not null default 'in_progress',
  pack jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learners_intake_status_check check (
    intake_status in ('in_progress', 'ready')
  )
);

create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  standard_code text not null default '',
  duration_months integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learner_programmes (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.learners (id) on delete set null,
  kind text not null default 'new_starter',
  programme_id uuid references public.programmes (id),
  programme_name text not null default '',
  standard_code text not null default '',
  cohort_id text,
  employer_id text not null default '',
  employer_name text not null default '',
  workplace_contact text not null default '',
  mentor_name text not null default '',
  tutor_name text not null default '',
  start_date date not null,
  programme_year integer,
  programme_week integer,
  attendance_percent numeric(5,2),
  original_planned_end_date date not null,
  status text not null default 'active',
  actual_progress_percent numeric(5,2),
  college_days text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_programmes_kind_check check (
    kind in ('new_starter', 'currently_studying')
  ),
  constraint learner_programmes_status_check check (
    status in ('draft', 'pending_start', 'active', 'completed', 'withdrawn')
  )
);

create table if not exists public.proxy_write_audit (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles (id) on delete cascade,
  learner_id uuid references public.learners (id) on delete cascade,
  action text not null,
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists touch_learners_updated_at on public.learners;
create trigger touch_learners_updated_at
before update on public.learners
for each row
execute function public.touch_updated_at();

drop trigger if exists touch_programmes_updated_at on public.programmes;
create trigger touch_programmes_updated_at
before update on public.programmes
for each row
execute function public.touch_updated_at();

drop trigger if exists touch_learner_programmes_updated_at on public.learner_programmes;
create trigger touch_learner_programmes_updated_at
before update on public.learner_programmes
for each row
execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.learners enable row level security;
alter table public.programmes enable row level security;
alter table public.learner_programmes enable row level security;
alter table public.proxy_write_audit enable row level security;

-- Authenticated users can read their own profile row.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- Temporary staff-read policies until finer RBAC policies land.
-- Mutations remain on the service-role server path.
drop policy if exists learners_select_authenticated on public.learners;
create policy learners_select_authenticated
on public.learners
for select
to authenticated
using (true);

drop policy if exists programmes_select_authenticated on public.programmes;
create policy programmes_select_authenticated
on public.programmes
for select
to authenticated
using (true);

drop policy if exists learner_programmes_select_authenticated on public.learner_programmes;
create policy learner_programmes_select_authenticated
on public.learner_programmes
for select
to authenticated
using (true);
