-- PORTAL-009: a tutor whose access is only that of a tutor can read learner
-- concerns for apprentices they are currently assigned to. The assignment
-- counts when the tutor profile is invited or active, the same rule as tutor
-- reviews (archived and disabled profiles do not count). Managers, safeguarding
-- staff, and anyone with a concerns or safeguarding permission still read
-- every concern. Each read writes one audit_events row per apprentice.
--
-- Not applied to the live database from this change. Review and apply it
-- separately.

create or replace function public.can_read_all_learner_concerns()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_portal_role('Administrator', 'Management')
    or exists (
      select 1
      from public.profiles profile
      where profile.id = (select auth.uid())
        and coalesce(profile.permissions, '{}'::text[]) && array[
          'safeguarding.workspace.view',
          'safeguarding.cases.view',
          'safeguarding.confidential.view',
          'employer.concerns.manage',
          'management.employer.concerns'
        ]::text[]
    )
    or exists (
      select 1
      from public.temporary_assignments assignment
      where assignment.profile_id = (select auth.uid())
        and assignment.starts_at <= now()
        and assignment.ends_at >= now()
        and coalesce(assignment.permissions, '{}'::text[]) && array[
          'safeguarding.workspace.view',
          'safeguarding.cases.view',
          'safeguarding.confidential.view',
          'employer.concerns.manage',
          'management.employer.concerns'
        ]::text[]
    );
$$;

create or replace function public.tutor_can_read_learner_concern(p_gta_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.apprentice_tutors tutor
    join public.profiles profile on profile.id = tutor.tutor_id
    where tutor.apprentice_id = p_gta_id
      and tutor.tutor_id = (select auth.uid())
      and tutor.end_date is null
      and profile.archived_at is null
      and profile.portal_status is distinct from 'disabled'
  );
$$;

create or replace function public.get_learner_concerns(p_gta_id text default null)
returns table (
  id uuid, gta_id text, raised_on date, raised_by uuid, reason_id uuid, reason text, is_safeguarding boolean,
  notes text, resolved_on date, resolved_by uuid, resolution_note text, created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_full boolean := public.can_read_all_learner_concerns();
begin
  if v_uid is null then
    raise exception 'Staff role required' using errcode = '42501';
  end if;
  if not v_full and not exists (
    select 1
    from public.profiles profile
    where profile.id = v_uid
      and profile.archived_at is null
      and profile.portal_status is distinct from 'disabled'
      and (
        profile.base_role = 'Tutor'
        or 'Apprenticeship Tutor' = any (coalesce(profile.responsibilities, '{}'::text[]))
      )
  ) then
    raise exception 'Staff role required' using errcode = '42501';
  end if;

  return query
  with visible as (
    select c.id, c.gta_id, c.raised_on, c.raised_by, c.reason_id, r.label as reason,
           coalesce(r.is_safeguarding, false) as is_safeguarding,
           case when coalesce(r.is_safeguarding, false) and not v_full then null else c.notes end as notes,
           c.resolved_on, c.resolved_by,
           case when coalesce(r.is_safeguarding, false) and not v_full then null else c.resolution_note end as resolution_note,
           c.created_at
    from public.learner_concerns c
    left join public.reasons r on r.id = c.reason_id
    where (p_gta_id is null or c.gta_id = p_gta_id)
      and (v_full or public.tutor_can_read_learner_concern(c.gta_id))
  ),
  logged as (
    insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
    select v_uid, 'learner_concern', seen.gta_id, 'read',
           format('Viewed learner concerns for %s', seen.gta_id),
           jsonb_build_object('gta_id', seen.gta_id)
    from (select distinct visible.gta_id from visible) seen
    returning entity_id
  )
  select visible.id, visible.gta_id, visible.raised_on, visible.raised_by, visible.reason_id, visible.reason,
         visible.is_safeguarding, visible.notes, visible.resolved_on, visible.resolved_by, visible.resolution_note,
         visible.created_at
  from visible
  where (select count(*) from logged) >= 0
  order by visible.raised_on desc, visible.created_at desc, visible.id;
end;
$$;

drop policy if exists learner_concerns_select_admin_mgmt on public.learner_concerns;
drop policy if exists learner_concerns_select_reader on public.learner_concerns;
create policy learner_concerns_select_reader on public.learner_concerns
  for select to authenticated
  using (
    public.can_read_all_learner_concerns()
    or public.tutor_can_read_learner_concern(gta_id)
  );

revoke all on function public.can_read_all_learner_concerns() from public, anon, authenticated, service_role;
revoke all on function public.tutor_can_read_learner_concern(text) from public, anon, authenticated, service_role;
revoke all on function public.get_learner_concerns(text) from public, anon, authenticated, service_role;
grant execute on function public.can_read_all_learner_concerns() to authenticated;
grant execute on function public.tutor_can_read_learner_concern(text) to authenticated;
grant execute on function public.get_learner_concerns(text) to authenticated;

-- Rollback:
-- drop policy if exists learner_concerns_select_reader on public.learner_concerns;
-- create policy learner_concerns_select_admin_mgmt on public.learner_concerns
--   for select to authenticated
--   using ((select public.has_portal_role('Administrator','Management')));
-- Then restore public.get_learner_concerns(text) from
-- supabase/migrations/20261111200618_concerns_reasons_and_table.sql
-- (stable, Administrator/Management see notes, any Tutor sees every concern
-- with safeguarding notes hidden) and grant execute to authenticated and service_role.
-- drop function public.tutor_can_read_learner_concern(text);
-- drop function public.can_read_all_learner_concerns();
