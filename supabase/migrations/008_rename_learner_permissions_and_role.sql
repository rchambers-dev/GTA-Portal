-- Rename permission capability strings + portal role Learner → Apprentice.
-- Also remaps AI scope names stored only in code (permissions live on profiles).

-- ---------------------------------------------------------------------------
-- profiles.permissions: learner.* → apprentice.*
-- ---------------------------------------------------------------------------
update public.profiles
set permissions = coalesce((
  select array_agg(
    case p
      when 'learners.assigned.view' then 'apprentices.assigned.view'
      when 'learner.caseload.view' then 'apprentice.caseload.view'
      when 'learner.workspace.view' then 'apprentice.workspace.view'
      when 'learner.workspace.own' then 'apprentice.workspace.own'
      when 'learner.modules.view' then 'apprentice.modules.view'
      when 'learner.otj.view' then 'apprentice.otj.view'
      else p
    end
    order by ordinality
  )
  from unnest(permissions) with ordinality as u(p, ordinality)
), '{}'::text[])
where permissions is not null
  and permissions && array[
    'learners.assigned.view',
    'learner.caseload.view',
    'learner.workspace.view',
    'learner.workspace.own',
    'learner.modules.view',
    'learner.otj.view'
  ]::text[];

-- temporary_assignments.permissions (if any rows use old keys)
do $$
begin
  if to_regclass('public.temporary_assignments') is not null then
    update public.temporary_assignments
    set permissions = coalesce((
      select array_agg(
        case p
          when 'learners.assigned.view' then 'apprentices.assigned.view'
          when 'learner.caseload.view' then 'apprentice.caseload.view'
          when 'learner.workspace.view' then 'apprentice.workspace.view'
          when 'learner.workspace.own' then 'apprentice.workspace.own'
          when 'learner.modules.view' then 'apprentice.modules.view'
          when 'learner.otj.view' then 'apprentice.otj.view'
          else p
        end
        order by ordinality
      )
      from unnest(permissions) with ordinality as u(p, ordinality)
    ), '{}'::text[])
    where permissions is not null
      and permissions && array[
        'learners.assigned.view',
        'learner.caseload.view',
        'learner.workspace.view',
        'learner.workspace.own',
        'learner.modules.view',
        'learner.otj.view'
      ]::text[];
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Portal role: Learner → Apprentice
-- ---------------------------------------------------------------------------
update public.profiles
set base_role = 'Apprentice'
where base_role = 'Learner';
