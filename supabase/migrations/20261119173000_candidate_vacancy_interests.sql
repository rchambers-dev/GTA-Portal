-- NOT APPLIED. Proposal only. Do not run this until it is approved.
-- Early vacancy interest for an applicant, before a place is allocated.
-- candidates.employer_id / employer_site_id / employer_manager_id already store
-- the potential or confirmed employer. vacancy_allocations remains the later
-- "place taken" row and still requires a confirmed employer and Stage 2 approval.
-- This table is the interest list (proposed, applied, offered, declined, withdrawn).

create table public.candidate_vacancy_interests (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null references public.candidates(candidate_id) on delete restrict,
  vacancy_id uuid not null references public.employer_vacancies(id) on delete restrict,
  status text not null default 'proposed' check (status in ('proposed', 'applied', 'offered', 'declined', 'withdrawn')),
  noted_on date not null,
  notes text,
  entered_at timestamptz not null default now(),
  entered_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (candidate_id, vacancy_id)
);

comment on table public.candidate_vacancy_interests is
  'Interest in a vacancy before a place is allocated. Not a booking and not a start.';

create index candidate_vacancy_interests_candidate
  on public.candidate_vacancy_interests (candidate_id);

alter table public.candidate_vacancy_interests enable row level security;

create policy candidate_vacancy_interests_staff
  on public.candidate_vacancy_interests
  for all
  to authenticated
  using (public.candidates_staff_write())
  with check (public.candidates_staff_write());

revoke all on table public.candidate_vacancy_interests from public, anon;
grant select, insert, update, delete on table public.candidate_vacancy_interests to authenticated, service_role;
