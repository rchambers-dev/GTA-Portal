-- Reviews-first employer directory and learner entry.
-- Additive only. Does not import reviews JSON, merge businesses, or rewrite legacy employer rows.
-- Legacy public.employers and apprentice_programmes.employer_id / employer_name stay as they are.
-- employer_uuid is the legacy enrolment foreign key when the selected catalogue id is a uuid.
-- Company, site, and manager identities for the reviews-first flow live in the new tables.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.apprentice_programmes
  add column if not exists employer_uuid uuid;

do $$
begin
  if to_regclass('public.employers') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'apprentice_programmes_employer_uuid_fkey'
     ) then
    alter table public.apprentice_programmes
      add constraint apprentice_programmes_employer_uuid_fkey
      foreign key (employer_uuid) references public.employers (id) on delete set null;
  end if;
end $$;

create table if not exists public.employer_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text not null default '',
  company_number text not null default '',
  notes text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employer_companies_name_not_blank check (length(btrim(name)) > 0),
  constraint employer_companies_status_check check (status in ('active', 'inactive'))
);

create table if not exists public.employer_sites (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  address_line1 text not null default '',
  address_line2 text not null default '',
  town text not null default '',
  postcode text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employer_sites_label_not_blank check (length(btrim(label)) > 0)
);

create table if not exists public.employer_company_sites (
  company_id uuid not null references public.employer_companies (id) on delete cascade,
  site_id uuid not null references public.employer_sites (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, site_id)
);

create table if not exists public.employer_managers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null default '',
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employer_managers_name_not_blank check (length(btrim(full_name)) > 0)
);

create table if not exists public.employer_manager_roles (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.employer_managers (id) on delete cascade,
  company_id uuid not null references public.employer_companies (id) on delete cascade,
  site_id uuid references public.employer_sites (id) on delete restrict,
  responsibility text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employer_manager_roles_company_wide_uidx
  on public.employer_manager_roles (manager_id, company_id)
  where site_id is null;

create unique index if not exists employer_manager_roles_site_uidx
  on public.employer_manager_roles (manager_id, company_id, site_id)
  where site_id is not null;

create table if not exists public.review_learners (
  id uuid primary key default gen_random_uuid(),
  portal_reference text not null unique,
  full_name text not null,
  source_company_name text not null default '',
  source_postcode text not null default '',
  release_day text not null default '',
  tutor_name text not null default '',
  apprenticeship_label text not null default '',
  apprenticeship_start_date date,
  apprenticeship_end_date date,
  reviewer_name text not null default '',
  source_contact_name text not null default '',
  source_contact_email text not null default '',
  source_contact_phone text not null default '',
  planned_review_date date,
  company_id uuid references public.employer_companies (id) on delete set null,
  site_id uuid references public.employer_sites (id) on delete set null,
  manager_role_id uuid references public.employer_manager_roles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_learners_name_not_blank check (length(btrim(full_name)) > 0),
  constraint review_learners_release_day_check check (
    release_day = ''
    or release_day in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
  )
);

create index if not exists review_learners_company_id_idx
  on public.review_learners (company_id);
create index if not exists employer_company_sites_site_id_idx
  on public.employer_company_sites (site_id);
create index if not exists employer_manager_roles_company_id_idx
  on public.employer_manager_roles (company_id);

create or replace function public.employer_manager_role_site_guard()
returns trigger
language plpgsql
as $$
begin
  if new.site_id is not null and not exists (
    select 1
    from public.employer_company_sites link
    where link.company_id = new.company_id
      and link.site_id = new.site_id
  ) then
    raise exception 'Manager site is not linked to that company'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists employer_manager_role_site_guard
  on public.employer_manager_roles;
create trigger employer_manager_role_site_guard
before insert or update on public.employer_manager_roles
for each row execute function public.employer_manager_role_site_guard();

create or replace function public.employer_company_site_unlink_guard()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.employer_manager_roles role
    where role.company_id = old.company_id
      and role.site_id = old.site_id
  ) or exists (
    select 1 from public.review_learners learner
    where learner.company_id = old.company_id
      and learner.site_id = old.site_id
  ) then
    raise exception 'Remove manager responsibilities and learner links before unlinking this site'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

drop trigger if exists employer_company_site_unlink_guard
  on public.employer_company_sites;
create trigger employer_company_site_unlink_guard
before delete on public.employer_company_sites
for each row execute function public.employer_company_site_unlink_guard();

create or replace function public.review_learner_link_guard()
returns trigger
language plpgsql
as $$
declare
  role_company uuid;
  role_site uuid;
begin
  if new.company_id is null and (new.site_id is not null or new.manager_role_id is not null) then
    raise exception 'Choose a company before a site or manager'
      using errcode = '23514';
  end if;
  if new.site_id is not null and not exists (
    select 1 from public.employer_company_sites link
    where link.company_id = new.company_id
      and link.site_id = new.site_id
  ) then
    raise exception 'Learner site is not linked to the selected company'
      using errcode = '23514';
  end if;
  if new.manager_role_id is not null then
    select role.company_id, role.site_id
      into role_company, role_site
    from public.employer_manager_roles role
    where role.id = new.manager_role_id;
    if role_company is distinct from new.company_id then
      raise exception 'Manager is not responsible for the selected company'
        using errcode = '23514';
    end if;
    if role_site is not null and role_site is distinct from new.site_id then
      raise exception 'Manager is responsible for a different site'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists review_learner_link_guard on public.review_learners;
create trigger review_learner_link_guard
before insert or update on public.review_learners
for each row execute function public.review_learner_link_guard();

drop trigger if exists touch_employer_companies_updated_at on public.employer_companies;
create trigger touch_employer_companies_updated_at
before update on public.employer_companies
for each row execute function public.touch_updated_at();

drop trigger if exists touch_employer_sites_updated_at on public.employer_sites;
create trigger touch_employer_sites_updated_at
before update on public.employer_sites
for each row execute function public.touch_updated_at();

drop trigger if exists touch_employer_managers_updated_at on public.employer_managers;
create trigger touch_employer_managers_updated_at
before update on public.employer_managers
for each row execute function public.touch_updated_at();

drop trigger if exists touch_employer_manager_roles_updated_at on public.employer_manager_roles;
create trigger touch_employer_manager_roles_updated_at
before update on public.employer_manager_roles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_review_learners_updated_at on public.review_learners;
create trigger touch_review_learners_updated_at
before update on public.review_learners
for each row execute function public.touch_updated_at();

alter table public.employer_companies enable row level security;
alter table public.employer_sites enable row level security;
alter table public.employer_company_sites enable row level security;
alter table public.employer_managers enable row level security;
alter table public.employer_manager_roles enable row level security;
alter table public.review_learners enable row level security;

-- Supabase creates anon and authenticated. Skip the revoke where those roles
-- are absent so a local database without them can still apply the tables.
do $$
declare
  role_name text;
  table_name text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      foreach table_name in array array[
        'employer_companies',
        'employer_sites',
        'employer_company_sites',
        'employer_managers',
        'employer_manager_roles',
        'review_learners'
      ]
      loop
        execute format('revoke all on table public.%I from %I', table_name, role_name);
      end loop;
    end if;
  end loop;
end $$;

comment on table public.employer_companies is
  'Company identity for the reviews-first directory. Not the legacy employers row.';
comment on table public.employer_sites is
  'Physical site identity. Address parts may be blank. Not derived from a learner postcode.';
comment on table public.employer_company_sites is
  'Many companies may share one site, and one company may use many sites.';
comment on table public.employer_manager_roles is
  'A person''s responsibility for one company, optionally limited to one of that company''s sites.';
comment on table public.review_learners is
  'Reviews-first learner. Optional company, site, and manager links. Source text is kept when unresolved.';
