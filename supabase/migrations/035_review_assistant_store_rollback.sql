-- NOT APPLIED. Manual recovery for 035_review_assistant_store.sql only.
-- Run this file by itself. It opens one transaction and stops before any drop
-- when a structure table holds a row, or when 036 objects are still present.
-- It does not delete buckets, attachment rows, or staff page-access config.
-- Roll back 036 first. Do not use this after live use without a fresh empty check.

BEGIN;

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
