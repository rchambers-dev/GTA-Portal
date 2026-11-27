-- PORTAL-009: a tutor whose access is only that of a tutor can read learner
-- concerns for apprentices they are currently assigned to. The assignment
-- counts when the tutor profile is invited or active, the same rule as tutor
-- reviews (archived and disabled profiles do not count), and only once the
-- assignment has started in London. Managers, safeguarding staff, and anyone
-- with a concerns or safeguarding permission still read every concern.
--
-- Tutors do not receive table SELECT. Safeguarding notes and resolution notes
-- stay behind get_learner_concerns, which hides them unless the caller can
-- read every concern. The existing Admin/Management select policy is unchanged.
--
-- Each call writes at most one audit_events row per apprentice. A failed audit
-- insert does not block the read.
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
      and tutor.start_date <= (now() at time zone 'Europe/London')::date
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

  begin
    insert into public.audit_events (actor_profile_id, entity_type, entity_id, action, summary, payload)
    select distinct v_uid, 'learner_concern', c.gta_id, 'read',
           format('Viewed learner concerns for %s', c.gta_id),
           jsonb_build_object('gta_id', c.gta_id)
    from public.learner_concerns c
    where (p_gta_id is null or c.gta_id = p_gta_id)
      and (v_full or public.tutor_can_read_learner_concern(c.gta_id));
  exception
    when others then
      null;
  end;

  return query
  select c.id, c.gta_id, c.raised_on, c.raised_by, c.reason_id, r.label,
         coalesce(r.is_safeguarding, false),
         case when coalesce(r.is_safeguarding, false) and not v_full then null else c.notes end,
         c.resolved_on, c.resolved_by,
         case when coalesce(r.is_safeguarding, false) and not v_full then null else c.resolution_note end,
         c.created_at
  from public.learner_concerns c
  left join public.reasons r on r.id = c.reason_id
  where (p_gta_id is null or c.gta_id = p_gta_id)
    and (v_full or public.tutor_can_read_learner_concern(c.gta_id))
  order by c.raised_on desc, c.created_at desc, c.id;
end;
$$;

revoke all on function public.can_read_all_learner_concerns() from public, anon;
revoke all on function public.tutor_can_read_learner_concern(text) from public, anon;
revoke all on function public.get_learner_concerns(text) from public, anon;
grant execute on function public.can_read_all_learner_concerns() to authenticated, service_role;
grant execute on function public.tutor_can_read_learner_concern(text) to authenticated, service_role;
grant execute on function public.get_learner_concerns(text) to authenticated, service_role;

-- Rollback:
-- Restore public.get_learner_concerns(text) from
-- supabase/migrations/20261111200618_concerns_reasons_and_table.sql
-- (stable, Administrator/Management see notes, any Tutor sees every concern
-- with safeguarding notes hidden).
-- revoke all on function public.get_learner_concerns(text) from public, anon;
-- grant execute on function public.get_learner_concerns(text) to authenticated, service_role;
-- drop function public.tutor_can_read_learner_concern(text);
-- drop function public.can_read_all_learner_concerns();
-- The learner_concerns_select_admin_mgmt policy is left as it is.
