-- Portal workspace id: learner → apprentice (signed-in apprentice portal).

do $$
begin
  -- Drop old check so we can rewrite values, then recreate.
  if exists (
    select 1 from pg_constraint where conname = 'profiles_workspace_check'
  ) then
    alter table public.profiles drop constraint profiles_workspace_check;
  end if;
end $$;

update public.profiles
set workspace = 'apprentice'
where workspace = 'learner';

alter table public.profiles
  add constraint profiles_workspace_check check (
    workspace in (
      'apprentice',
      'employer',
      'staff',
      'quality',
      'management',
      'administration',
      'safeguarding'
    )
  );
