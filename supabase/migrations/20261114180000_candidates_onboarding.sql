-- Candidates (recruitment and onboarding). NOT APPLIED.
-- Reiss must approve before this runs on project cjtgjxgghfiskqnuttzd.
-- TODO(perms): replace has_portal_role('Administrator','Management') with a
-- Read / Edit / Admin tab (onboarding.view, onboarding.edit, onboarding.admin).
-- Tutors have no access. Do not treat every admin as Candidates Admin until that tab exists.

alter table public.reasons add column if not exists used_for_candidates boolean not null default false;

create or replace function public.enforce_reason_usage()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  r public.reasons%rowtype;
  ok boolean;
begin
  if new.reason_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.reason_id is not distinct from old.reason_id then
    return new;
  end if;
  select * into r from public.reasons where id = new.reason_id;
  if not found then
    raise exception 'Reason not found' using errcode = '22023';
  end if;
  if not r.active then
    raise exception 'Reason "%" is not active', r.label using errcode = '22023';
  end if;
  ok := case tg_argv[0]
    when 'breaks' then r.used_for_breaks
    when 'withdrawals' then r.used_for_withdrawals
    when 'date_changes' then r.used_for_date_changes
    when 'concerns' then r.used_for_concerns
    when 'candidates' then r.used_for_candidates
    else false end;
  if not ok then
    raise exception 'Reason "%" cannot be used for %', r.label, replace(tg_argv[0], '_', ' ') using errcode = '22023';
  end if;
  return new;
end;
$$;

insert into public.reasons (label, used_for_breaks, used_for_withdrawals, used_for_date_changes, is_safeguarding, used_for_concerns, used_for_candidates, sort_order, active)
select v.label, false, false, false, false, false, true, v.sort_order, true
from (values
  ('Withdrew before start', 300),
  ('Withdrew after start', 310),
  ('Rejected after interview', 320),
  ('Paused — not ready', 330)
) as v(label, sort_order)
where not exists (select 1 from public.reasons r where r.label = v.label);

create table public.candidate_centres (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_enquiry_sources (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  needs_detail boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_bank_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_on date not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.candidate_settings (
  id boolean primary key default true check (id),
  interview_capacity integer not null default 8 check (interview_capacity > 0),
  responsive_review_months integer not null default 12 check (responsive_review_months > 0),
  unresponsive_review_months integer not null default 3 check (unresponsive_review_months > 0),
  intake_booking_deadline_days integer check (intake_booking_deadline_days is null or intake_booking_deadline_days >= 0),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.induction_intakes (
  id uuid primary key default gen_random_uuid(),
  intake_on date not null,
  centre_id uuid references public.candidate_centres(id),
  booking_deadline_on date,
  paperwork_deadline_on date,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidates (
  candidate_id text primary key,
  external_id text unique,
  first_name text not null,
  middle_names text,
  last_name text not null,
  email text,
  phone text,
  centre_id uuid not null references public.candidate_centres(id),
  programme_id uuid not null references public.programmes(id),
  first_contact_on date not null,
  enquiry_source_id uuid not null references public.candidate_enquiry_sources(id),
  enquiry_source_detail text,
  employer_status text not null default 'needed' check (employer_status in ('needed', 'identified', 'confirmed')),
  employer_id text references public.employers(employer_id),
  employer_site_id uuid references public.employer_sites(id),
  employer_manager_id uuid references public.employer_managers(id),
  intended_intake_id uuid references public.induction_intakes(id),
  notes text,
  responsiveness text not null default 'responsive' check (responsiveness in ('responsive', 'unresponsive')),
  review_due_on date not null,
  status text not null default 'active' check (status in (
    'active', 'paused', 'rejected', 'withdrawn_before_start', 'withdrawn_after_start', 'archived', 'converted'
  )),
  status_reason_id uuid references public.reasons(id),
  stage2_approved_at timestamptz,
  stage2_approved_by uuid references public.profiles(id),
  actual_start_on date,
  converted_gta_id text unique references public.apprentices(gta_id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidates_names_not_blank check (btrim(first_name) <> '' and btrim(last_name) <> ''),
  constraint candidates_stage2_pair check ((stage2_approved_at is null) = (stage2_approved_by is null)),
  constraint candidates_start_once check (
    (actual_start_on is null and converted_gta_id is null)
    or (actual_start_on is not null and converted_gta_id is not null)
  )
);

create table public.candidate_check_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  stage text not null check (stage in ('stage_1', 'stage_2')),
  label text not null,
  result_type text not null check (result_type in ('completed', 'pass_fail', 'booked_or_completed')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_check_results (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null references public.candidates(candidate_id) on delete restrict,
  definition_id uuid not null references public.candidate_check_definitions(id),
  result text check (result in ('pass', 'fail', 'done', 'booked')),
  actual_on date not null,
  entered_at timestamptz not null default now(),
  entered_by uuid not null references public.profiles(id),
  superseded_at timestamptz,
  superseded_by uuid references public.profiles(id),
  supersedes_id uuid references public.candidate_check_results(id),
  correction_note text,
  constraint candidate_checks_correction check (
    (supersedes_id is null and correction_note is null)
    or (supersedes_id is not null and correction_note is not null and btrim(correction_note) <> '')
  )
);

create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  session_on date not null,
  centre_id uuid not null references public.candidate_centres(id),
  kind text not null check (kind in ('group', 'resit')),
  capacity integer not null check (capacity > 0),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interview_bookings (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null references public.candidates(candidate_id) on delete restrict,
  session_id uuid not null references public.interview_sessions(id),
  attempt_number integer not null check (attempt_number between 1 and 4),
  is_final_attempt boolean not null default false,
  attendance text check (attendance in ('attended', 'no_show', 'rescheduled', 'cancelled')),
  frees_place boolean not null default false,
  outcome text not null default 'awaiting' check (outcome in ('awaiting', 'passed', 'failed')),
  actual_on date,
  entered_at timestamptz not null default now(),
  entered_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.induction_bookings (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null references public.candidates(candidate_id) on delete restrict,
  intake_id uuid not null references public.induction_intakes(id),
  attendance text check (attendance in ('attended', 'absent', 'cancelled')),
  absence_outcome text check (absence_outcome in ('reschedule', 'pause', 'withdraw')),
  actual_on date,
  entered_at timestamptz not null default now(),
  entered_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employer_vacancies (
  id uuid primary key default gen_random_uuid(),
  employer_id text not null references public.employers(employer_id),
  site_id uuid references public.employer_sites(id),
  manager_id uuid references public.employer_managers(id),
  programme_id uuid references public.programmes(id),
  centre_id uuid references public.candidate_centres(id),
  title text not null,
  notes text,
  status text not null default 'open' check (status in ('potential', 'open', 'filled', 'on_hold', 'cancelled')),
  total_places integer not null check (total_places > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vacancy_allocations (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid not null references public.employer_vacancies(id),
  candidate_id text not null references public.candidates(candidate_id) on delete restrict,
  allocated_at timestamptz not null default now(),
  allocated_by uuid not null references public.profiles(id),
  released_at timestamptz,
  released_by uuid references public.profiles(id),
  release_reason text check (release_reason is null or release_reason in ('withdrawal', 'reassigned', 'cancelled'))
);

create unique index vacancy_allocations_one_open
  on public.vacancy_allocations (candidate_id) where released_at is null;

create table public.vacancy_reoffer_decisions (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.vacancy_allocations(id),
  vacancy_id uuid not null references public.employer_vacancies(id),
  decision text not null default 'pending' check (decision in ('reoffer', 'close', 'pending')),
  decided_on date,
  decided_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table public.employer_activities (
  id uuid primary key default gen_random_uuid(),
  employer_id text not null references public.employers(employer_id),
  activity_type text not null,
  actual_on date not null,
  notes text,
  entered_at timestamptz not null default now(),
  entered_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employer_follow_ups (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.employer_activities(id),
  due_on date not null,
  completed_on date,
  notes text,
  entered_at timestamptz not null default now(),
  entered_by uuid not null references public.profiles(id)
);

create table public.recruitment_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  audience text not null,
  event_on date not null,
  centre_id uuid references public.candidate_centres(id),
  owner_id uuid not null references public.profiles(id),
  status text not null default 'planned' check (status in ('planned', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruitment_actions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_id uuid not null references public.profiles(id),
  deadline_on date,
  impact_check text,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  candidate_id text references public.candidates(candidate_id),
  employer_id text references public.employers(employer_id),
  vacancy_id uuid references public.employer_vacancies(id),
  calendar_event_id uuid references public.recruitment_calendar_events(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence public.candidate_event_seq;

create table public.candidate_events (
  id uuid primary key default gen_random_uuid(),
  seq bigint not null unique default nextval('public.candidate_event_seq'),
  candidate_id text not null,
  event_type text not null,
  actual_on date,
  entered_at timestamptz not null default now(),
  entered_by uuid references public.profiles(id),
  detail jsonb not null default '{}'::jsonb,
  correction_of uuid references public.candidate_events(id)
);

create table public.candidate_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null,
  candidate_name_confirmed text not null,
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  completed_at timestamptz,
  reason_note text
);

create table public.candidate_aggregate_counters (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  centre_code text,
  programme_id uuid references public.programmes(id),
  measure text not null check (measure in (
    'enquiries', 'starts', 'withdrawals_before_start', 'withdrawals_after_start', 'rejections', 'interviews_passed'
  )),
  total integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (year, centre_code, programme_id, measure)
);

create sequence public.candidate_id_seq;

create or replace function public.next_candidate_id()
returns text
language plpgsql
security definer
set search_path to ''
as $$
begin
  return 'GTA-C-' || lpad(nextval('public.candidate_id_seq')::text, 6, '0');
end;
$$;

create or replace function public.candidates_staff_write()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.has_portal_role('Administrator', 'Management');
$$;

-- Reference rows only (centres, sources, checks, England & Wales bank holidays 2026). Not candidate demo data.
insert into public.candidate_centres (code, name, sort_order) values
  ('doncaster', 'Doncaster', 1),
  ('sheffield', 'Sheffield', 2);
insert into public.candidate_enquiry_sources (label, needs_detail, sort_order) values
  ('Website', false, 1), ('Social media', false, 2), ('School event', false, 3),
  ('Google', false, 4), ('Word of mouth', false, 5), ('Leaflet', false, 6),
  ('Flyer', false, 7), ('GTA prospectus', false, 8), ('Other', true, 9);
insert into public.candidate_check_definitions (code, stage, label, result_type, sort_order) values
  ('id', 'stage_1', 'ID verified', 'completed', 1),
  ('maths', 'stage_1', 'Maths', 'pass_fail', 2),
  ('english', 'stage_1', 'English', 'pass_fail', 3),
  ('tna', 'stage_2', 'TNA completed', 'completed', 4),
  ('hs_booked', 'stage_2', 'H&S visit booked', 'booked_or_completed', 5),
  ('hs_completed', 'stage_2', 'H&S visit completed', 'completed', 6),
  ('file_created', 'stage_2', 'File created', 'completed', 7),
  ('file_completed', 'stage_2', 'File completed', 'completed', 8);
insert into public.candidate_bank_holidays (holiday_on, name) values
  ('2026-01-01', 'New Year''s Day'),
  ('2026-04-03', 'Good Friday'),
  ('2026-04-06', 'Easter Monday'),
  ('2026-05-04', 'Early May bank holiday'),
  ('2026-05-25', 'Spring bank holiday'),
  ('2026-08-31', 'Summer bank holiday'),
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-28', 'Boxing Day (substitute)');
insert into public.candidate_settings (id) values (true);

alter table public.candidate_centres enable row level security;
alter table public.candidate_enquiry_sources enable row level security;
alter table public.candidate_bank_holidays enable row level security;
alter table public.candidate_settings enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_check_definitions enable row level security;
alter table public.candidate_check_results enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_bookings enable row level security;
alter table public.induction_intakes enable row level security;
alter table public.induction_bookings enable row level security;
alter table public.employer_vacancies enable row level security;
alter table public.vacancy_allocations enable row level security;
alter table public.vacancy_reoffer_decisions enable row level security;
alter table public.employer_activities enable row level security;
alter table public.employer_follow_ups enable row level security;
alter table public.recruitment_calendar_events enable row level security;
alter table public.recruitment_actions enable row level security;
alter table public.candidate_events enable row level security;
alter table public.candidate_deletion_requests enable row level security;
alter table public.candidate_aggregate_counters enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'candidate_centres','candidate_enquiry_sources','candidate_bank_holidays','candidate_settings',
    'candidates','candidate_check_definitions','candidate_check_results','interview_sessions',
    'interview_bookings','induction_intakes','induction_bookings','employer_vacancies',
    'vacancy_allocations','vacancy_reoffer_decisions','employer_activities','employer_follow_ups',
    'recruitment_calendar_events','recruitment_actions','candidate_deletion_requests'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.candidates_staff_write()) with check (public.candidates_staff_write())',
      t || '_staff', t
    );
  end loop;
end $$;

create policy candidate_events_read on public.candidate_events for select to authenticated
  using (public.candidates_staff_write());
create policy candidate_events_insert on public.candidate_events for insert to authenticated
  with check (public.candidates_staff_write());

create trigger candidates_reason
  before insert or update of status_reason_id on public.candidates
  for each row execute function public.enforce_reason_usage('candidates');
create policy candidate_counters_read on public.candidate_aggregate_counters for select to authenticated
  using (public.candidates_staff_write());

revoke all on function public.next_candidate_id() from public, anon;
grant execute on function public.next_candidate_id() to authenticated, service_role;
revoke all on function public.candidates_staff_write() from public, anon;
grant execute on function public.candidates_staff_write() to authenticated, service_role;
