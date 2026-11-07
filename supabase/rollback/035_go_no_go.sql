-- READ ONLY. This file does not create, lock, or alter anything.
-- It is valid before migration 035 and after it. Missing directory tables
-- and a missing portal_entry column are reported as absent; they are not errors.
-- live_backup_verified stays not_verified_by_this_script. A parent-side
-- metadata snapshot is not a full backup and is not a verified restore.

select 'live_backup_verified' as check_name,
       'not_verified_by_this_script' as observed,
       'no-go' as decision,
       'Restore a logical backup of apprentices, employers, apprentice_programmes, profiles, and any directory tables to a scratch database before a live apply or reversal. This script cannot see that backup.' as detail

union all
select 'maintenance_window',
       'writes_not_locked_by_this_script',
       'no-go',
       'Apply and reversal take SHARE ROW EXCLUSIVE on the base registers and, when present, the directory tables. Writes wait. Reads continue. Confirm no other migration is running.'

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
       'Migration 035 locks these three tables. Apply is no-go when any of them is absent.'

union all
select 'prestate_captured',
       case when to_regclass('public.migration_035_prestate') is null then 'absent' else 'present' end,
       case
         when to_regclass('public.migration_035_prestate') is null then 'expected_before_apply'
         else 'present_after_apply'
       end,
       'Absence is expected before the first apply. Reversal refuses to run without this table. The table has row security enabled and no grants for anon, authenticated, or service_role.'

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
       'Before apply, absent is expected. After apply, reversal is no-go when any count is not zero.'

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
       'The count query runs only when portal_entry exists. Reversal is no-go when the count is not zero.'

union all
select 'preserved_registers',
       'apprentices_employers_and_programmes_are_not_dropped',
       'go',
       'Reversal never drops public.apprentices, public.employers, or public.apprentice_programmes. It restores captured function bodies, triggers, comments, row security, and access lists for objects that already existed.'
;
