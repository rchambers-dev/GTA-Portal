-- NOT APPLIED. Manual recovery for 036_review_assistant_portal.sql only.
-- Run this file by itself. One transaction. It refuses when attachment rows,
-- page-access config, or objects in the Reviews buckets exist. It deletes a
-- bucket only when reviews_private.storage_provision says this migration
-- created it. Pre-existing buckets stay. Structure tables from 035 stay.

BEGIN;

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
