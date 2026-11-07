-- READ ONLY. Do not apply migration 035 or its reversal from this file.
-- Each row is a check. Any row with decision = 'no-go' means do not migrate
-- and do not reverse. This script does not take locks and does not look at
-- a backup. live_backup_verified stays not_verified_by_this_script until a
-- person restores a backup to a scratch database and records that elsewhere.

select 'live_backup_verified' as check_name,
       'not_verified_by_this_script' as observed,
       'no-go' as decision,
       'A logical backup of apprentices, employers, apprentice_programmes, and any already-applied directory tables must be restored to a scratch database before a live apply or reversal. This script cannot see that backup.' as detail

union all
select 'maintenance_window',
       'writes_not_locked_by_this_script',
       'no-go',
       'Apply and reversal take SHARE ROW EXCLUSIVE on apprentices, employers, and apprentice_programmes, and on the directory tables when they exist. That blocks writes and allows reads. Confirm no other migration is running and staff can pause saves for the duration.'

union all
select 'prestate_captured',
       case when to_regclass('public.migration_035_prestate') is null then 'absent' else 'present' end,
       case when to_regclass('public.migration_035_prestate') is null then 'capture_during_apply' else 'go_for_reversal_only_if_counts_are_zero' end,
       'The apply script writes this table under its write lock. Reversal refuses to drop columns without it. Absence is expected before the first apply.'

union all
select 'directory_rows',
       concat(
         'details=', coalesce((select count(*) from public.review_apprentice_details), 0),
         ' sites=', coalesce((select count(*) from public.employer_sites), 0),
         ' memberships=', coalesce((select count(*) from public.employer_site_memberships), 0),
         ' managers=', coalesce((select count(*) from public.employer_managers), 0),
         ' roles=', coalesce((select count(*) from public.employer_manager_roles), 0)
       ),
       'inspect',
       'Reversal is no-go when any of these counts are not zero. Missing tables count as zero only after the apply has not created them; this query errors if a table is missing, which means reversal is not applicable yet.'

union all
select 'reviews_entry_apprentices',
       coalesce((
         select count(*)::text from public.apprentices where portal_entry = 'reviews'
       ), 'portal_entry_absent'),
       'inspect',
       'Reversal is no-go when this count is not zero. portal_entry_absent means the column is not there yet.'

union all
select 'preserved_registers',
       'apprentices_and_employers_not_dropped',
       'go',
       'Neither apply nor reversal drops public.apprentices, public.employers, programmes, or profiles. touch_updated_at is left unchanged when it already exists. employer_uuid is dropped only when prestate says this migration added it.'
;
