-- READ ONLY. Run after a successful apply, in a new session.
-- Every row is a measurement. This file does not decide that a backup exists
-- and it does not write migration history.

select 'executor' as measurement,
       concat(
         'current_user=', current_user,
         ' session_user=', session_user,
         ' current_super=', (select rolsuper::text from pg_roles where rolname = current_user),
         ' session_super=', (select rolsuper::text from pg_roles where rolname = session_user)
       ) as observed

union all
select 'prestate_rls',
       concat(
         'present=', (to_regclass('public.migration_035_prestate') is not null)::text,
         ' rls=', coalesce((
           select c.relrowsecurity::text from pg_class c
           where c.oid = to_regclass('public.migration_035_prestate')
         ), 'absent'),
         ' anon_select=', case
           when exists (select 1 from pg_roles where rolname = 'anon')
             and to_regclass('public.migration_035_prestate') is not null
           then has_table_privilege('anon', 'public.migration_035_prestate', 'select')::text
           else 'role_or_table_absent'
         end
       )

union all
select 'directory_counts',
       concat(
         'details=', case when to_regclass('public.review_apprentice_details') is null then 'absent'
           else (xpath('//*[local-name()="c"]/text()', query_to_xml('select count(*)::text as c from public.review_apprentice_details', false, true, '')))[1]::text end,
         ' sites=', case when to_regclass('public.employer_sites') is null then 'absent'
           else (xpath('//*[local-name()="c"]/text()', query_to_xml('select count(*)::text as c from public.employer_sites', false, true, '')))[1]::text end
       )

union all
select 'function_fingerprint',
       coalesce((
         select string_agg(p.proname || ':' || md5(pg_get_functiondef(p.oid)), ',' order by p.proname)
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in (
             'create_review_apprentice',
             'apply_review_apprentice_change',
             'rename_apprentice'
           )
       ), 'functions_absent')
;
