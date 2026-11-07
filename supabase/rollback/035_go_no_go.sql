-- READ ONLY. This file does not create, lock, or alter anything.
-- evidence_kind = measurement is computed from the database.
-- evidence_kind = attestation is a fixed operator statement. This script
-- cannot verify a backup, a maintenance window, or the live tool's transaction
-- mode. Those stay no-go until a person records proof outside this file.
-- A parent metadata snapshot is not a full backup and is not a verified restore.

select 'live_backup_verified' as check_name,
       'not_verified_by_this_script' as observed,
       'no-go' as decision,
       'attestation' as evidence_kind,
       'Operator must restore a logical backup to a scratch database. This row is not a measurement.' as detail

union all
select 'maintenance_window',
       'not_observed_by_this_script',
       'no-go',
       'attestation',
       'Operator must confirm writes can wait. This script does not take locks and does not see other sessions.'

union all
select 'tool_transaction',
       'not_observed_by_this_script',
       'no-go',
       'attestation',
       'Local files contain no BEGIN/COMMIT. A statement-split runner releases LOCK at statement end. apply_migration is the sanctioned history path. execute_sql atomicity is not proven here.'

union all
select 'base_registers',
       concat(
         'apprentices=', case when to_regclass('public.apprentices') is null then 'absent' else 'present' end,
         ' employers=', case when to_regclass('public.employers') is null then 'absent' else 'present' end,
         ' programmes=', case when to_regclass('public.apprentice_programmes') is null then 'absent' else 'present' end
       ),
       case
         when to_regclass('public.apprentices') is null
           or to_regclass('public.employers') is null
           or to_regclass('public.apprentice_programmes') is null
         then 'no-go'
         else 'go'
       end,
       'measurement',
       'Measured with to_regclass. Apply is no-go when any base register is absent.'

union all
select 'executor_privileges',
       concat(
         'current_user=', current_user,
         ' session_user=', session_user,
         ' current_super=', coalesce((select rolsuper::text from pg_roles where rolname = current_user), 'missing'),
         ' session_super=', coalesce((select rolsuper::text from pg_roles where rolname = session_user), 'missing'),
         ' public_create=', has_schema_privilege(current_user, 'public', 'CREATE')::text
       ),
       case
         when coalesce((select rolsuper from pg_roles where rolname = current_user), true)
           or coalesce((select rolsuper from pg_roles where rolname = session_user), true)
           or not has_schema_privilege(current_user, 'public', 'CREATE')
         then 'no-go'
         else 'measured'
       end,
       'measurement',
       'Measured from pg_roles and has_schema_privilege. Not an attestation of BYPASSRLS.'

union all
select 'prestate_captured',
       case when to_regclass('public.migration_035_prestate') is null then 'absent' else 'present' end,
       case
         when to_regclass('public.migration_035_prestate') is null then 'expected_before_apply'
         else 'present_after_apply'
       end,
       'measurement',
       'Absence is expected before the first apply. Reversal refuses without this table.'

union all
select 'directory_rows',
       concat(
         'details=', case
           when to_regclass('public.review_apprentice_details') is null then 'absent'
           else coalesce((xpath('//*[local-name()="c"]/text()', query_to_xml('select count(*)::text as c from public.review_apprentice_details', false, true, '')))[1]::text, '0')
         end,
         ' sites=', case
           when to_regclass('public.employer_sites') is null then 'absent'
           else coalesce((xpath('//*[local-name()="c"]/text()', query_to_xml('select count(*)::text as c from public.employer_sites', false, true, '')))[1]::text, '0')
         end,
         ' memberships=', case
           when to_regclass('public.employer_site_memberships') is null then 'absent'
           else coalesce((xpath('//*[local-name()="c"]/text()', query_to_xml('select count(*)::text as c from public.employer_site_memberships', false, true, '')))[1]::text, '0')
         end,
         ' managers=', case
           when to_regclass('public.employer_managers') is null then 'absent'
           else coalesce((xpath('//*[local-name()="c"]/text()', query_to_xml('select count(*)::text as c from public.employer_managers', false, true, '')))[1]::text, '0')
         end,
         ' roles=', case
           when to_regclass('public.employer_manager_roles') is null then 'absent'
           else coalesce((xpath('//*[local-name()="c"]/text()', query_to_xml('select count(*)::text as c from public.employer_manager_roles', false, true, '')))[1]::text, '0')
         end
       ),
       case
         when to_regclass('public.review_apprentice_details') is null then 'not_applied'
         else 'inspect_counts'
       end,
       'measurement',
       'Counts are measured only when the table exists. Absent is expected before apply.'

union all
select 'reviews_entry_apprentices',
       case
         when to_regclass('public.apprentices') is null then 'apprentices_absent'
         when not exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'apprentices' and column_name = 'portal_entry'
         ) then 'column_absent'
         else coalesce((xpath('//*[local-name()="c"]/text()', query_to_xml('select count(*)::text as c from public.apprentices where portal_entry = ''reviews''', false, true, '')))[1]::text, '0')
       end,
       case
         when to_regclass('public.apprentices') is null then 'no-go'
         when not exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'apprentices' and column_name = 'portal_entry'
         ) then 'column_absent_expected_before_apply'
         else 'inspect_count'
       end,
       'measurement',
       'The count runs only when portal_entry exists.'

union all
select 'employer_uuid_populated',
       case
         when to_regclass('public.apprentice_programmes') is null then 'programmes_absent'
         when not exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'apprentice_programmes' and column_name = 'employer_uuid'
         ) then 'column_absent'
         else coalesce((xpath('//*[local-name()="c"]/text()', query_to_xml('select count(*)::text as c from public.apprentice_programmes where employer_uuid is not null', false, true, '')))[1]::text, '0')
       end,
       case
         when to_regclass('public.apprentice_programmes') is null then 'no-go'
         else 'measured'
       end,
       'measurement',
       'Reversal will not drop a migration-added employer_uuid column while this count is not zero.'

union all
select 'preserved_registers',
       'apprentices_employers_and_programmes_are_not_dropped',
       'go',
       'attestation',
       'This sentence describes the script. It is not a live catalog measurement.'
;
