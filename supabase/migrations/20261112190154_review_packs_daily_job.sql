-- Review flow, part 4: the daily job (13 Nov 2026).
-- pg_cron is available on this project and was not installed, so it is enabled here. The job runs
-- public.review_packs_run_daily() at 06:00 UTC every day: it releases waiting packs to the tutor at planned date minus
-- 14 days and lifts holds that have reached their date (see part 3). Pause it with
--   select cron.alter_job((select jobid from cron.job where jobname = 'review-packs-daily'), active := false);
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('review-packs-daily', '0 6 * * *', $job$select public.review_packs_run_daily()$job$);
