-- PORTAL-001. Not applied. Move apprentice temporary passwords off profiles,
-- and stop any signed-in user from reading every profile row.
-- Idempotent: safe to run once the two earlier security migrations are present.

create table if not exists public.profile_credentials (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  temporary_password text,
  set_at timestamptz not null default now(),
  set_by uuid references public.profiles (id)
);

comment on table public.profile_credentials is
  'Apprentice temporary passwords. No anon or authenticated policies: only the service role, from server code that has checked admin.users.manage.';

alter table public.profile_credentials enable row level security;

revoke all on table public.profile_credentials from public, anon, authenticated;
grant all on table public.profile_credentials to service_role;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'temporary_password'
  ) then
    insert into public.profile_credentials (profile_id, temporary_password, set_at)
    select p.id, p.temporary_password, now()
    from public.profiles p
    where p.temporary_password is not null
      and btrim(p.temporary_password) <> ''
    on conflict (profile_id) do update
      set temporary_password = excluded.temporary_password,
          set_at = now()
    where public.profile_credentials.temporary_password is distinct from excluded.temporary_password;

    alter table public.profiles drop column temporary_password;
  end if;
end $$;

-- Reader rules, pinned and security definer so the policy does not recurse into profiles RLS.
-- A user reads their own row. Staff (not Apprentice or Employer, and not those workspaces)
-- read every row. An apprentice also reads the current tutor on their linked apprentice.
create or replace function public.can_read_profile(p_target uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or p_target is null then
    return false;
  end if;
  if p_target = v_uid then
    return true;
  end if;
  if exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and lower(coalesce(p.base_role, '')) not in ('apprentice', 'employer', 'learner')
      and lower(coalesce(p.workspace, '')) not in ('apprentice', 'employer', 'learner')
  ) then
    return true;
  end if;
  return exists (
    select 1
    from public.profiles me
    join public.apprentices a on a.id = me.linked_apprentice_id
    join public.apprentice_tutors t
      on t.apprentice_id = a.gta_id
     and t.tutor_id = p_target
     and t.end_date is null
    where me.id = v_uid
  );
end;
$$;

revoke all on function public.can_read_profile(uuid) from public, anon;
grant execute on function public.can_read_profile(uuid) to authenticated, service_role;

drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_visible on public.profiles;

create policy profiles_select_visible
on public.profiles
for select
to authenticated
using (public.can_read_profile(id));

-- No logged-out page reads profiles. Authenticated pages only select.
-- Profile writes in the app use the service role.
revoke all on table public.profiles from public, anon;
revoke insert, update, delete, truncate, trigger, references on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant all on table public.profiles to service_role;
