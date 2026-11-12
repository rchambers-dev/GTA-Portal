-- MANUAL ONLY. scripts/run-migration.mjs will not run this file.
-- Quiesce Portal writers before starting. This file does not lock storage.objects or storage.buckets.
-- A table lock there would block every bucket and can fail when postgres is not the storage owner.
-- Only the Portal tables this script drops are locked. Reviews object rows are locked only when
-- this role already has UPDATE on storage.objects.
-- Refuses when attachment rows, page-access config, or Reviews bucket objects exist.
-- Deletes a bucket only when this migration created it and it is empty.
-- Does not drop the applied 035 structure. History is not a backup.
-- Export first with supabase/manual/review-assistant-export-restore.sql.

BEGIN;

DO $lock$
BEGIN
  IF to_regclass('public.review_assistant_attachments') IS NOT NULL THEN
    LOCK TABLE public.review_assistant_attachments IN ACCESS EXCLUSIVE MODE;
  END IF;
  IF to_regclass('public.staff_page_access') IS NOT NULL THEN
    LOCK TABLE public.staff_page_access IN ACCESS EXCLUSIVE MODE;
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL
     AND has_table_privilege(current_user, 'storage.objects', 'UPDATE') THEN
    PERFORM 1
    FROM storage.objects
    WHERE bucket_id IN ('review-app', 'review-attachments')
    FOR UPDATE;
  END IF;
END;
$lock$;

DO $refuse$
BEGIN
  IF to_regclass('public.review_assistant_attachments') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.review_assistant_attachments) THEN
    RAISE EXCEPTION 'rollback refused: public.review_assistant_attachments holds rows';
  END IF;
  IF to_regclass('public.staff_page_access') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.staff_page_access) THEN
    RAISE EXCEPTION 'rollback refused: public.staff_page_access holds rows';
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id IN ('review-app', 'review-attachments')
  ) THEN
    RAISE EXCEPTION 'rollback refused: a Reviews bucket holds objects';
  END IF;
END;
$refuse$;

DELETE FROM storage.buckets AS buckets
USING reviews_private.storage_provision AS provision
WHERE buckets.id = provision.bucket_id
  AND provision.created_by_this_migration = true
  AND buckets.id IN ('review-app', 'review-attachments');

DROP TRIGGER IF EXISTS review_assistant_attachments_binding ON public.review_assistant_attachments;
DROP FUNCTION IF EXISTS reviews_private.attachment_binding_guard();
DROP FUNCTION IF EXISTS public.save_staff_page_access(integer, jsonb, uuid);
DROP FUNCTION IF EXISTS reviews_private.save_staff_page_access(integer, jsonb, uuid);
DROP FUNCTION IF EXISTS public.rate_limit_hit(uuid, text, timestamp with time zone, integer);
DROP FUNCTION IF EXISTS reviews_private.rate_limit_hit(uuid, text, timestamp with time zone, integer);
DROP FUNCTION IF EXISTS public.save_app_state_if_version(integer, jsonb, uuid);
DROP FUNCTION IF EXISTS reviews_private.save_app_state_if_version(integer, jsonb, uuid);
DROP FUNCTION IF EXISTS reviews_private.record_app_state_history(uuid, integer, jsonb);
DROP FUNCTION IF EXISTS reviews_private.ensure_private_bucket(text, bigint);
DROP TABLE IF EXISTS public.review_assistant_attachments;
DROP TABLE IF EXISTS public.staff_page_access;
DROP TABLE IF EXISTS reviews_private.storage_provision;

COMMIT;
