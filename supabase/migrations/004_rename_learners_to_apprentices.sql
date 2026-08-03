-- Rename people/enrolment tables from learners → apprentices.
-- Idempotent: safe if already applied (checks for old table names).

do $$
begin
  -- -----------------------------------------------------------------------
  -- learners → apprentices
  -- -----------------------------------------------------------------------
  if to_regclass('public.learners') is not null
     and to_regclass('public.apprentices') is null then
    alter table public.learners rename to apprentices;
  end if;
end $$;

do $$
begin
  if to_regclass('public.apprentices') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'apprentices'
        and column_name = 'learner_reference'
    ) then
      alter table public.apprentices
        rename column learner_reference to apprentice_reference;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'learners_intake_status_check'
    ) then
      alter table public.apprentices
        rename constraint learners_intake_status_check
        to apprentices_intake_status_check;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'learners_learner_reference_key'
    ) then
      alter table public.apprentices
        rename constraint learners_learner_reference_key
        to apprentices_apprentice_reference_key;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'learners_pkey'
    ) then
      alter table public.apprentices
        rename constraint learners_pkey to apprentices_pkey;
    end if;
  end if;
end $$;

drop trigger if exists touch_learners_updated_at on public.apprentices;
drop trigger if exists touch_apprentices_updated_at on public.apprentices;
create trigger touch_apprentices_updated_at
before update on public.apprentices
for each row
execute function public.touch_updated_at();

drop policy if exists learners_select_authenticated on public.apprentices;
drop policy if exists apprentices_select_authenticated on public.apprentices;
create policy apprentices_select_authenticated
on public.apprentices
for select
to authenticated
using (true);

-- -----------------------------------------------------------------------
-- learner_programmes → apprentice_programmes
-- -----------------------------------------------------------------------
do $$
begin
  if to_regclass('public.learner_programmes') is not null
     and to_regclass('public.apprentice_programmes') is null then
    alter table public.learner_programmes rename to apprentice_programmes;
  end if;
end $$;

do $$
begin
  if to_regclass('public.apprentice_programmes') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'apprentice_programmes'
        and column_name = 'learner_id'
    ) then
      alter table public.apprentice_programmes
        rename column learner_id to apprentice_id;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'learner_programmes_kind_check'
    ) then
      alter table public.apprentice_programmes
        rename constraint learner_programmes_kind_check
        to apprentice_programmes_kind_check;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'learner_programmes_status_check'
    ) then
      alter table public.apprentice_programmes
        rename constraint learner_programmes_status_check
        to apprentice_programmes_status_check;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'learner_programmes_pkey'
    ) then
      alter table public.apprentice_programmes
        rename constraint learner_programmes_pkey
        to apprentice_programmes_pkey;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'learner_programmes_learner_id_fkey'
    ) then
      alter table public.apprentice_programmes
        rename constraint learner_programmes_learner_id_fkey
        to apprentice_programmes_apprentice_id_fkey;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'learner_programmes_programme_id_fkey'
    ) then
      alter table public.apprentice_programmes
        rename constraint learner_programmes_programme_id_fkey
        to apprentice_programmes_programme_id_fkey;
    end if;

    if exists (
      select 1 from pg_constraint
      where conname = 'learner_programmes_teaching_group_id_fkey'
    ) then
      alter table public.apprentice_programmes
        rename constraint learner_programmes_teaching_group_id_fkey
        to apprentice_programmes_teaching_group_id_fkey;
    end if;
  end if;
end $$;

alter index if exists learner_programmes_teaching_group_id_idx
  rename to apprentice_programmes_teaching_group_id_idx;
alter index if exists learner_programmes_cohort_id_idx
  rename to apprentice_programmes_cohort_id_idx;

drop trigger if exists touch_learner_programmes_updated_at on public.apprentice_programmes;
drop trigger if exists touch_apprentice_programmes_updated_at on public.apprentice_programmes;
create trigger touch_apprentice_programmes_updated_at
before update on public.apprentice_programmes
for each row
execute function public.touch_updated_at();

drop policy if exists learner_programmes_select_authenticated on public.apprentice_programmes;
drop policy if exists apprentice_programmes_select_authenticated on public.apprentice_programmes;
create policy apprentice_programmes_select_authenticated
on public.apprentice_programmes
for select
to authenticated
using (true);

-- -----------------------------------------------------------------------
-- proxy_write_audit.learner_id → apprentice_id
-- -----------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'proxy_write_audit'
      and column_name = 'learner_id'
  ) then
    alter table public.proxy_write_audit
      rename column learner_id to apprentice_id;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'proxy_write_audit_learner_id_fkey'
  ) then
    alter table public.proxy_write_audit
      rename constraint proxy_write_audit_learner_id_fkey
      to proxy_write_audit_apprentice_id_fkey;
  end if;
end $$;

-- -----------------------------------------------------------------------
-- profiles.linked_learner_id → linked_apprentice_id
-- -----------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'linked_learner_id'
  ) then
    alter table public.profiles
      rename column linked_learner_id to linked_apprentice_id;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_linked_learner_id_fkey'
  ) then
    alter table public.profiles
      rename constraint profiles_linked_learner_id_fkey
      to profiles_linked_apprentice_id_fkey;
  end if;
end $$;

comment on column public.profiles.temporary_password is
  'Optional plaintext temp password for apprentice enable flows; not used for day-to-day staff logins.';

-- -----------------------------------------------------------------------
-- staff_assignments.learner_programme_id → apprentice_programme_id
-- -----------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'staff_assignments'
      and column_name = 'learner_programme_id'
  ) then
    alter table public.staff_assignments
      rename column learner_programme_id to apprentice_programme_id;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'staff_assignments_learner_programme_id_fkey'
  ) then
    alter table public.staff_assignments
      rename constraint staff_assignments_learner_programme_id_fkey
      to staff_assignments_apprentice_programme_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'staff_assignments_profile_id_learner_programme_id_role_key'
  ) then
    alter table public.staff_assignments
      rename constraint staff_assignments_profile_id_learner_programme_id_role_key
      to staff_assignments_profile_id_apprentice_programme_id_role_key;
  end if;
end $$;

comment on table public.apprentices is
  'Apprentice personal records from intake (formerly learners).';

comment on table public.apprentice_programmes is
  'Apprentice programme enrolments / placements (formerly learner_programmes).';

comment on column public.cohorts.delivery_spine is
  'Apprentice delivery UI spine: groups (CEA) or blocks (programme blocks). Locked with standard_version after start.';
