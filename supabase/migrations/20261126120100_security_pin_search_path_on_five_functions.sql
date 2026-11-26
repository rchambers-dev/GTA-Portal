-- Interstellar Security already applied this on live (cjtgjxgghfiskqnuttzd).
-- Recorded so the repo matches live. Do not apply it again if this version is already in schema_migrations.

alter function public.candidate_review_due(date, text) set search_path = '';
alter function public.gta_spine_item_ksbs_require_block() set search_path = '';
alter function public.gta_course_tasks_assert_block_ownership() set search_path = '';
alter function public.gta_curriculum_analysis_results_require_block() set search_path = '';

-- This repository does not define gta_session_ksbs_require_parent. Live does.
-- The statement Interstellar ran is the alter below; skip it only when the function is absent.
do $$
begin
  if to_regprocedure('public.gta_session_ksbs_require_parent()') is not null then
    execute 'alter function public.gta_session_ksbs_require_parent() set search_path = ''''';
  end if;
end $$;
