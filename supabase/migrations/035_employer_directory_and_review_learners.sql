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
-- Reversal is supabase/rollback/035_employer_directory_reversal.sql.
-- Read-only go/no-go queries are supabase/rollback/035_go_no_go.sql.
-- This file locks the existing apprentice, employer, and programme tables
-- against writes, then records what already existed in
-- public.migration_035_prestate. It does not replace touch_updated_at when
-- that function is already there, and it does not take a backup.
-- Do not run it on the live database until the go/no-go checklist passes
-- and a backup has been verified outside this script.

lock table public.apprentices in share row exclusive mode;
lock table public.employers in share row exclusive mode;
lock table public.apprentice_programmes in share row exclusive mode;

create table if not exists public.migration_035_prestate (
  object_kind text not null,
  object_name text not null,
  existed boolean not null,
  definition text,
  captured_at timestamptz not null default now(),
  primary key (object_kind, object_name)
);

insert into public.migration_035_prestate (object_kind, object_name, existed, definition)
select
  'function',
  'public.touch_updated_at()',
  to_regprocedure('public.touch_updated_at()') is not null,
  null
where not exists (
  select 1 from public.migration_035_prestate
  where object_kind = 'function' and object_name = 'public.touch_updated_at()'
);

do $$
begin
  if to_regprocedure('public.touch_updated_at()') is not null then
    execute $capture$
      update public.migration_035_prestate
      set definition = pg_get_functiondef('public.touch_updated_at()'::regprocedure)
      where object_kind = 'function'
        and object_name = 'public.touch_updated_at()'
        and definition is null
    $capture$;
  end if;
end $$;

insert into public.migration_035_prestate (object_kind, object_name, existed, definition)
select
  'column',
  'public.apprentices.portal_entry',
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'apprentices' and column_name = 'portal_entry'
  ),
  null
where not exists (
  select 1 from public.migration_035_prestate
  where object_kind = 'column' and object_name = 'public.apprentices.portal_entry'
);

insert into public.migration_035_prestate (object_kind, object_name, existed, definition)
select
  'column',
  'public.apprentice_programmes.employer_uuid',
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'apprentice_programmes'
      and column_name = 'employer_uuid'
  ),
  null
where not exists (
  select 1 from public.migration_035_prestate
  where object_kind = 'column' and object_name = 'public.apprentice_programmes.employer_uuid'
);

insert into public.migration_035_prestate (object_kind, object_name, existed, definition)
select
  'constraint',
  'apprentice_programmes_employer_uuid_fkey',
  exists (select 1 from pg_constraint where conname = 'apprentice_programmes_employer_uuid_fkey'),
  null
where not exists (
  select 1 from public.migration_035_prestate
  where object_kind = 'constraint' and object_name = 'apprentice_programmes_employer_uuid_fkey'
);

insert into public.migration_035_prestate (object_kind, object_name, existed, definition)
select 'acl', 'public.apprentices', true, c.relacl::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'apprentices'
  and not exists (
    select 1 from public.migration_035_prestate
    where object_kind = 'acl' and object_name = 'public.apprentices'
  );

insert into public.migration_035_prestate (object_kind, object_name, existed, definition)
select 'acl', 'public.employers', true, c.relacl::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'employers'
  and not exists (
    select 1 from public.migration_035_prestate
    where object_kind = 'acl' and object_name = 'public.employers'
  );

do $$
begin
  if to_regprocedure('public.touch_updated_at()') is null then
    create function public.touch_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;
end $$;

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
  if new.site_id is not null then
    perform 1
    from public.employer_site_memberships link
    where link.employer_id = new.employer_id
      and link.site_id = new.site_id
    for key share;
    if not found then
      raise exception 'Manager site is not linked to that employer'
        using errcode = '23514';
    end if;
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
  if new.site_id is not null then
    perform 1
    from public.employer_site_memberships link
    where link.employer_id = new.employer_id
      and link.site_id = new.site_id
    for key share;
    if not found then
      raise exception 'Apprentice site is not linked to the selected employer'
        using errcode = '23514';
    end if;
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

create or replace function public.employer_site_membership_delete_guard()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.employer_manager_roles role
    where role.employer_id = old.employer_id
      and role.site_id = old.site_id
    for update
  ) then
    raise exception 'This site is still used by a manager responsibility'
      using errcode = '23514';
  end if;
  if exists (
    select 1
    from public.review_apprentice_details detail
    where detail.employer_id = old.employer_id
      and detail.site_id = old.site_id
    for update
  ) then
    raise exception 'This site is still linked to an apprentice'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

drop trigger if exists employer_site_membership_delete_guard
  on public.employer_site_memberships;
create trigger employer_site_membership_delete_guard
before delete on public.employer_site_memberships
for each row execute function public.employer_site_membership_delete_guard();

create or replace function public.create_review_apprentice(p_row jsonb)
returns void
language plpgsql
as $$
begin
  insert into public.apprentices (
    id, display_name, apprentice_reference, portal_entry
  ) values (
    (p_row->>'id')::uuid,
    p_row->>'display_name',
    p_row->>'apprentice_reference',
    'reviews'
  );
  insert into public.review_apprentice_details (
    apprentice_id,
    version,
    source_company_name,
    source_postcode,
    release_day,
    tutor_name,
    apprenticeship_label,
    apprenticeship_start_date,
    apprenticeship_end_date,
    reviewer_name,
    source_contact_name,
    source_contact_email,
    source_contact_phone,
    planned_review_date
  ) values (
    (p_row->>'id')::uuid,
    1,
    coalesce(p_row->>'source_company_name', ''),
    coalesce(p_row->>'source_postcode', ''),
    coalesce(p_row->>'release_day', ''),
    coalesce(p_row->>'tutor_name', ''),
    coalesce(p_row->>'apprenticeship_label', ''),
    nullif(p_row->>'apprenticeship_start_date', '')::date,
    nullif(p_row->>'apprenticeship_end_date', '')::date,
    coalesce(p_row->>'reviewer_name', ''),
    coalesce(p_row->>'source_contact_name', ''),
    coalesce(p_row->>'source_contact_email', ''),
    coalesce(p_row->>'source_contact_phone', ''),
    nullif(p_row->>'planned_review_date', '')::date
  );
end;
$$;

create or replace function public.apply_review_apprentice_change(
  p_apprentice_id uuid,
  p_expected_version integer,
  p_display_name text,
  p_fields jsonb
)
returns integer
language plpgsql
as $$
declare
  new_version integer;
begin
  perform 1
  from public.apprentices
  where id = p_apprentice_id
  for update;
  if not found then
    raise exception 'Apprentice not found'
      using errcode = 'P0002';
  end if;

  if p_expected_version = 0 and not exists (
    select 1
    from public.review_apprentice_details
    where apprentice_id = p_apprentice_id
  ) then
    insert into public.review_apprentice_details (apprentice_id, version)
    values (p_apprentice_id, 1);
    new_version := 1;
  else
    update public.review_apprentice_details
    set
      source_company_name = case
        when p_fields ? 'source_company_name' then p_fields->>'source_company_name'
        else source_company_name end,
      source_postcode = case
        when p_fields ? 'source_postcode' then p_fields->>'source_postcode'
        else source_postcode end,
      release_day = case
        when p_fields ? 'release_day' then p_fields->>'release_day'
        else release_day end,
      tutor_name = case
        when p_fields ? 'tutor_name' then p_fields->>'tutor_name'
        else tutor_name end,
      apprenticeship_label = case
        when p_fields ? 'apprenticeship_label' then p_fields->>'apprenticeship_label'
        else apprenticeship_label end,
      apprenticeship_start_date = case
        when p_fields ? 'apprenticeship_start_date'
          then nullif(p_fields->>'apprenticeship_start_date', '')::date
        else apprenticeship_start_date end,
      apprenticeship_end_date = case
        when p_fields ? 'apprenticeship_end_date'
          then nullif(p_fields->>'apprenticeship_end_date', '')::date
        else apprenticeship_end_date end,
      reviewer_name = case
        when p_fields ? 'reviewer_name' then p_fields->>'reviewer_name'
        else reviewer_name end,
      source_contact_name = case
        when p_fields ? 'source_contact_name' then p_fields->>'source_contact_name'
        else source_contact_name end,
      source_contact_email = case
        when p_fields ? 'source_contact_email' then p_fields->>'source_contact_email'
        else source_contact_email end,
      source_contact_phone = case
        when p_fields ? 'source_contact_phone' then p_fields->>'source_contact_phone'
        else source_contact_phone end,
      planned_review_date = case
        when p_fields ? 'planned_review_date'
          then nullif(p_fields->>'planned_review_date', '')::date
        else planned_review_date end,
      employer_id = case
        when p_fields ? 'employer_id' then nullif(p_fields->>'employer_id', '')::uuid
        else employer_id end,
      site_id = case
        when p_fields ? 'site_id' then nullif(p_fields->>'site_id', '')::uuid
        else site_id end,
      manager_role_id = case
        when p_fields ? 'manager_role_id' then nullif(p_fields->>'manager_role_id', '')::uuid
        else manager_role_id end,
      version = version + 1
    where apprentice_id = p_apprentice_id
      and version = p_expected_version
    returning version into new_version;
  end if;

  if new_version is null then
    raise exception 'version_conflict'
      using errcode = '40001';
  end if;

  if p_expected_version = 0 and new_version = 1 and p_fields is not null then
    update public.review_apprentice_details
    set
      source_company_name = case
        when p_fields ? 'source_company_name' then p_fields->>'source_company_name'
        else source_company_name end,
      source_postcode = case
        when p_fields ? 'source_postcode' then p_fields->>'source_postcode'
        else source_postcode end,
      release_day = case
        when p_fields ? 'release_day' then p_fields->>'release_day'
        else release_day end,
      tutor_name = case
        when p_fields ? 'tutor_name' then p_fields->>'tutor_name'
        else tutor_name end,
      apprenticeship_label = case
        when p_fields ? 'apprenticeship_label' then p_fields->>'apprenticeship_label'
        else apprenticeship_label end,
      apprenticeship_start_date = case
        when p_fields ? 'apprenticeship_start_date'
          then nullif(p_fields->>'apprenticeship_start_date', '')::date
        else apprenticeship_start_date end,
      apprenticeship_end_date = case
        when p_fields ? 'apprenticeship_end_date'
          then nullif(p_fields->>'apprenticeship_end_date', '')::date
        else apprenticeship_end_date end,
      reviewer_name = case
        when p_fields ? 'reviewer_name' then p_fields->>'reviewer_name'
        else reviewer_name end,
      source_contact_name = case
        when p_fields ? 'source_contact_name' then p_fields->>'source_contact_name'
        else source_contact_name end,
      source_contact_email = case
        when p_fields ? 'source_contact_email' then p_fields->>'source_contact_email'
        else source_contact_email end,
      source_contact_phone = case
        when p_fields ? 'source_contact_phone' then p_fields->>'source_contact_phone'
        else source_contact_phone end,
      planned_review_date = case
        when p_fields ? 'planned_review_date'
          then nullif(p_fields->>'planned_review_date', '')::date
        else planned_review_date end,
      employer_id = case
        when p_fields ? 'employer_id' then nullif(p_fields->>'employer_id', '')::uuid
        else employer_id end,
      site_id = case
        when p_fields ? 'site_id' then nullif(p_fields->>'site_id', '')::uuid
        else site_id end,
      manager_role_id = case
        when p_fields ? 'manager_role_id' then nullif(p_fields->>'manager_role_id', '')::uuid
        else manager_role_id end
    where apprentice_id = p_apprentice_id
      and version = 1;
  end if;

  if p_display_name is not null then
    perform set_config('gta.review_name_write', p_apprentice_id::text, true);
    update public.apprentices
    set display_name = p_display_name
    where id = p_apprentice_id;
  end if;

  return new_version;
exception
  when unique_violation then
    raise exception 'version_conflict'
      using errcode = '40001';
end;
$$;

create or replace function public.apprentice_display_name_version_guard()
returns trigger
language plpgsql
as $$
begin
  if new.display_name is not distinct from old.display_name then
    return new;
  end if;
  if not exists (
    select 1
    from public.review_apprentice_details detail
    where detail.apprentice_id = new.id
  ) then
    return new;
  end if;
  if current_setting('gta.review_name_write', true) is distinct from new.id::text then
    raise exception 'version_conflict'
      using errcode = '40001';
  end if;
  return new;
end;
$$;

drop trigger if exists apprentice_display_name_version_guard on public.apprentices;
create trigger apprentice_display_name_version_guard
before update of display_name on public.apprentices
for each row execute function public.apprentice_display_name_version_guard();

create or replace function public.rename_apprentice(
  p_apprentice_id uuid,
  p_display_name text,
  p_expected_version integer
)
returns integer
language plpgsql
as $$
declare
  current_version integer;
begin
  if p_display_name is null or length(btrim(p_display_name)) = 0 then
    raise exception 'Full name is required'
      using errcode = '23514';
  end if;

  perform 1
  from public.apprentices
  where id = p_apprentice_id
  for update;
  if not found then
    raise exception 'Apprentice not found'
      using errcode = 'P0002';
  end if;

  select detail.version
    into current_version
  from public.review_apprentice_details detail
  where detail.apprentice_id = p_apprentice_id
  for update;

  if found then
    if p_expected_version is null or p_expected_version is distinct from current_version then
      raise exception 'version_conflict'
        using errcode = '40001';
    end if;
    update public.review_apprentice_details
    set version = version + 1
    where apprentice_id = p_apprentice_id
      and version = current_version;
    perform set_config('gta.review_name_write', p_apprentice_id::text, true);
    update public.apprentices
    set display_name = btrim(p_display_name)
    where id = p_apprentice_id;
    return current_version + 1;
  end if;

  if p_expected_version is not null then
    raise exception 'version_conflict'
      using errcode = '40001';
  end if;

  update public.apprentices
  set display_name = btrim(p_display_name)
  where id = p_apprentice_id;
  return null;
end;
$$;

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
      execute format(
        'revoke all on function public.create_review_apprentice(jsonb) from %I',
        role_name
      );
      execute format(
        'revoke all on function public.apply_review_apprentice_change(uuid, integer, text, jsonb) from %I',
        role_name
      );
      execute format(
        'revoke all on function public.rename_apprentice(uuid, text, integer) from %I',
        role_name
      );
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.create_review_apprentice(jsonb) to service_role;
    grant execute on function public.apply_review_apprentice_change(uuid, integer, text, jsonb) to service_role;
    grant execute on function public.rename_apprentice(uuid, text, integer) to service_role;
  end if;
end $$;

revoke all on function public.create_review_apprentice(jsonb) from public;
revoke all on function public.apply_review_apprentice_change(uuid, integer, text, jsonb) from public;
revoke all on function public.rename_apprentice(uuid, text, integer) from public;

comment on table public.review_apprentice_details is
  'Review-only facts for an existing apprentice. The person row is public.apprentices. version must match on update.';
comment on column public.apprentices.portal_entry is
  'onboarding keeps the existing intake queue. reviews marks a person added from the simplified Apprentices form.';
