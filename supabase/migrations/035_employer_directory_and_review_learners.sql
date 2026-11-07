-- Reviews-first extension on the existing apprentice and employer registers.
-- Does not create a second person table or a second company table.
-- Not applied to the live database by this change.
--
-- Preflight before any future apply (read-only):
--   select count(*) from public.apprentices;
--   select count(*) from public.employers;
--   select count(*) from public.apprentice_programmes where employer_uuid is not null;
-- Take a logical backup of those tables and confirm the backup restores to a
-- scratch database before applying. Do not copy production credentials into a
-- preview environment. Preview currently has no separate Supabase scope.
--
-- Exact reversal, only when the new tables are empty and no apprentice has
-- portal_entry = 'reviews'. Do not run this on the live database now.
--   drop table if exists public.review_apprentice_details;
--   drop table if exists public.employer_manager_roles;
--   drop table if exists public.employer_managers;
--   drop table if exists public.employer_site_memberships;
--   drop table if exists public.employer_sites;
--   alter table public.apprentices drop constraint if exists apprentices_portal_entry_check;
--   alter table public.apprentices drop column if exists portal_entry;
-- Refuse to drop employer_uuid if any apprentice_programmes.employer_uuid is not null.
-- Never drop public.apprentices or public.employers.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.apprentices
  add column if not exists portal_entry text not null default 'onboarding';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'apprentices_portal_entry_check'
  ) then
    alter table public.apprentices
      add constraint apprentices_portal_entry_check
      check (portal_entry in ('onboarding', 'reviews'));
  end if;
end $$;

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

create table if not exists public.employer_site_memberships (
  employer_id uuid not null references public.employers (id) on delete cascade,
  site_id uuid not null references public.employer_sites (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employer_id, site_id)
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
  employer_id uuid not null references public.employers (id) on delete cascade,
  site_id uuid references public.employer_sites (id) on delete restrict,
  responsibility text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employer_manager_roles_employer_wide_uidx
  on public.employer_manager_roles (manager_id, employer_id)
  where site_id is null;

create unique index if not exists employer_manager_roles_site_uidx
  on public.employer_manager_roles (manager_id, employer_id, site_id)
  where site_id is not null;

create table if not exists public.review_apprentice_details (
  apprentice_id uuid primary key references public.apprentices (id) on delete cascade,
  version integer not null default 1,
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
  employer_id uuid references public.employers (id) on delete set null,
  site_id uuid references public.employer_sites (id) on delete set null,
  manager_role_id uuid references public.employer_manager_roles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_apprentice_details_version_positive check (version > 0),
  constraint review_apprentice_details_release_day_check check (
    release_day = ''
    or release_day in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
  )
);

create index if not exists review_apprentice_details_employer_id_idx
  on public.review_apprentice_details (employer_id);
create index if not exists employer_site_memberships_site_id_idx
  on public.employer_site_memberships (site_id);

create or replace function public.employer_manager_role_site_guard()
returns trigger
language plpgsql
as $$
begin
  if new.site_id is not null and not exists (
    select 1 from public.employer_site_memberships link
    where link.employer_id = new.employer_id
      and link.site_id = new.site_id
  ) then
    raise exception 'Manager site is not linked to that employer'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists employer_manager_role_site_guard on public.employer_manager_roles;
create trigger employer_manager_role_site_guard
before insert or update on public.employer_manager_roles
for each row execute function public.employer_manager_role_site_guard();

create or replace function public.review_apprentice_link_guard()
returns trigger
language plpgsql
as $$
declare
  role_employer uuid;
  role_site uuid;
begin
  if new.employer_id is null and (new.site_id is not null or new.manager_role_id is not null) then
    raise exception 'Choose an employer before a site or manager'
      using errcode = '23514';
  end if;
  if new.site_id is not null and not exists (
    select 1 from public.employer_site_memberships link
    where link.employer_id = new.employer_id
      and link.site_id = new.site_id
  ) then
    raise exception 'Apprentice site is not linked to the selected employer'
      using errcode = '23514';
  end if;
  if new.manager_role_id is not null then
    select role.employer_id, role.site_id
      into role_employer, role_site
    from public.employer_manager_roles role
    where role.id = new.manager_role_id;
    if role_employer is distinct from new.employer_id then
      raise exception 'Manager is not responsible for the selected employer'
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

drop trigger if exists review_apprentice_link_guard on public.review_apprentice_details;
create trigger review_apprentice_link_guard
before insert or update on public.review_apprentice_details
for each row execute function public.review_apprentice_link_guard();

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

drop trigger if exists touch_review_apprentice_details_updated_at
  on public.review_apprentice_details;
create trigger touch_review_apprentice_details_updated_at
before update on public.review_apprentice_details
for each row execute function public.touch_updated_at();

alter table public.employer_sites enable row level security;
alter table public.employer_site_memberships enable row level security;
alter table public.employer_managers enable row level security;
alter table public.employer_manager_roles enable row level security;
alter table public.review_apprentice_details enable row level security;

do $$
declare
  role_name text;
  table_name text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      foreach table_name in array array[
        'employer_sites',
        'employer_site_memberships',
        'employer_managers',
        'employer_manager_roles',
        'review_apprentice_details'
      ]
      loop
        execute format('revoke all on table public.%I from %I', table_name, role_name);
      end loop;
    end if;
  end loop;
end $$;

comment on table public.review_apprentice_details is
  'Review-only facts for an existing apprentice. The person row is public.apprentices. version must match on update.';
comment on column public.apprentices.portal_entry is
  'onboarding keeps the existing intake queue. reviews marks a person added from the simplified Apprentices form.';
