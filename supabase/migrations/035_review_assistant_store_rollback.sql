-- MANUAL ONLY. scripts/run-migration.mjs will not run this file.
-- Quiesce Portal writers before starting. The locks below last for this transaction only.
-- app_state_history is not a backup. Export first with supabase/manual/review-assistant-export-restore.sql.
-- This script refuses when any row exists. It does not export and it does not delete rows.
-- The applied forward file 035_review_assistant_store.sql is unchanged.

BEGIN;

DO $lock$
BEGIN
  IF to_regclass('public.app_state') IS NOT NULL THEN
    LOCK TABLE public.app_state IN ACCESS EXCLUSIVE MODE;
  END IF;
  IF to_regclass('public.app_state_history') IS NOT NULL THEN
    LOCK TABLE public.app_state_history IN ACCESS EXCLUSIVE MODE;
  END IF;
  IF to_regclass('public.tutor_reword_rate') IS NOT NULL THEN
    LOCK TABLE public.tutor_reword_rate IN ACCESS EXCLUSIVE MODE;
  END IF;
END;
$lock$;

DO $refuse$
BEGIN
  IF to_regclass('public.app_state') IS NOT NULL AND EXISTS (SELECT 1 FROM public.app_state) THEN
    RAISE EXCEPTION 'rollback refused: public.app_state holds rows';
  END IF;
  IF to_regclass('public.app_state_history') IS NOT NULL AND EXISTS (SELECT 1 FROM public.app_state_history) THEN
    RAISE EXCEPTION 'rollback refused: public.app_state_history holds rows';
  END IF;
  IF to_regclass('public.tutor_reword_rate') IS NOT NULL AND EXISTS (SELECT 1 FROM public.tutor_reword_rate) THEN
    RAISE EXCEPTION 'rollback refused: public.tutor_reword_rate holds rows';
  END IF;
  IF to_regclass('public.review_assistant_attachments') IS NOT NULL THEN
    RAISE EXCEPTION 'rollback refused: roll back 036_review_assistant_portal.sql before the structure';
  END IF;
  IF to_regclass('public.staff_page_access') IS NOT NULL THEN
    RAISE EXCEPTION 'rollback refused: roll back 036_review_assistant_portal.sql before the structure';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc AS routine
    JOIN pg_namespace AS schema ON schema.oid = routine.pronamespace
    WHERE schema.nspname = 'reviews_private'
      AND routine.proname <> 'app_state_history_guard'
  ) THEN
    RAISE EXCEPTION 'rollback refused: reviews_private still has portal functions; roll back 036 first';
  END IF;
END;
$refuse$;

DROP TRIGGER IF EXISTS app_state_history_append_only ON public.app_state_history;
DROP TRIGGER IF EXISTS app_state_history_no_truncate ON public.app_state_history;
DROP FUNCTION IF EXISTS reviews_private.app_state_history_guard();
DROP TABLE IF EXISTS public.app_state_history;
DROP TABLE IF EXISTS public.app_state;
DROP TABLE IF EXISTS public.tutor_reword_rate;
DROP SCHEMA IF EXISTS reviews_private;

COMMIT;
