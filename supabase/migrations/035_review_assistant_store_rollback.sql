-- Rollback for 035_review_assistant_store.sql. Not applied by this repository.
-- Drops only the Reviews objects. Does not alter public.rls_auto_enable(),
-- profiles, apprentices, or Auth.

DROP FUNCTION IF EXISTS reviews_private.rate_limit_hit(uuid, text, timestamp with time zone, integer);
DROP FUNCTION IF EXISTS reviews_private.save_app_state_if_version(integer, jsonb);
DROP FUNCTION IF EXISTS reviews_private.save_app_state_if_version(integer, jsonb, uuid);
DROP FUNCTION IF EXISTS reviews_private.record_app_state_history(uuid, integer, jsonb);

DROP TRIGGER IF EXISTS app_state_history_append_only ON public.app_state_history;
DROP TRIGGER IF EXISTS app_state_history_no_truncate ON public.app_state_history;
DROP FUNCTION IF EXISTS reviews_private.app_state_history_guard();

DROP TABLE IF EXISTS public.review_assistant_attachments;
DROP TABLE IF EXISTS public.app_state_history;
DROP TABLE IF EXISTS public.app_state;
DROP TABLE IF EXISTS public.tutor_reword_rate;
DROP SCHEMA IF EXISTS reviews_private;

DELETE FROM storage.buckets WHERE id IN ('review-app', 'review-attachments');
