-- NOT APPLIED. Portal additions. Parent reviews this file separately from 035.
-- Requires 035_review_assistant_store.sql. No source rows, no source connection,
-- no Auth hook, no is_admin helper, and no change to public.rls_auto_enable().
-- This file does not add reviews_private to the Data API.
-- The hosted exposed-schema list is still unverified. That is not a reason to expose
-- reviews_private. PostgREST can call only the public SECURITY INVOKER wrappers below.
--
-- History retention inside reviews_private.record_app_state_history is copied from
-- source public.record_app_state_history: delete Portal snapshots older than 30 days,
-- then keep at most 500. It is not a new Portal policy. This migration inserts no
-- source history. A later import would be pruned on the next Portal save unless
-- retention is reviewed before that import. There is no import in this file.
--
-- Null actor_id is deliberate and means the save is unattributed. A non-null actor_id
-- must already be public.profiles.id. There is no two-argument save overload.
-- reviews_private.record_app_state_history is owner-only. service_role cannot call it.

CREATE TABLE reviews_private.storage_provision (
  bucket_id text NOT NULL,
  created_by_this_migration boolean NOT NULL,
  file_size_limit bigint NOT NULL,
  recorded_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT storage_provision_pkey PRIMARY KEY (bucket_id)
);

REVOKE ALL ON TABLE reviews_private.storage_provision FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE reviews_private.storage_provision IS
  'Records whether this migration created a Reviews bucket. Rollback deletes only buckets this migration created, and only when they are empty.';

CREATE FUNCTION reviews_private.record_app_state_history(
  actor_id uuid,
  next_version integer,
  next_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $record$
BEGIN
  -- Source parity: 30 days and 500 snapshots, Portal rows only.
  -- This is not a backup. Export before any rollback. See supabase/manual/review-assistant-export-restore.sql.
  IF (
    SELECT h.payload
    FROM public.app_state_history AS h
    ORDER BY h.id DESC
    LIMIT 1
  ) IS DISTINCT FROM next_payload THEN
    INSERT INTO public.app_state_history (user_id, version, saved_at, payload)
    VALUES (actor_id, next_version, now(), next_payload);
  END IF;
  PERFORM set_config('app.history_prune', 'on', true);
  DELETE FROM public.app_state_history
  WHERE saved_at < now() - interval '30 days';
  DELETE FROM public.app_state_history
  WHERE id IN (
    SELECT id
    FROM public.app_state_history
    ORDER BY saved_at DESC, id DESC
    OFFSET 500
  );
  PERFORM set_config('app.history_prune', 'off', true);
END;
$record$;

REVOKE ALL ON FUNCTION reviews_private.record_app_state_history(uuid, integer, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION reviews_private.save_app_state_if_version(
  expected_version integer,
  next_payload jsonb,
  actor_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $save$
DECLARE
  updated_count integer;
  next_version integer;
BEGIN
  IF next_payload IS NULL
     OR next_payload->>'version' !~ '^\d+$'
     OR (next_payload->>'version')::integer <> expected_version + 1 THEN
    RAISE EXCEPTION 'next review version must equal the expected version plus one';
  END IF;
  next_version := (next_payload->>'version')::integer;

  IF actor_id IS NOT NULL THEN
    IF to_regclass('public.profiles') IS NULL THEN
      RAISE EXCEPTION 'a Portal profile is required before a review save can name an actor';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor_id) THEN
      RAISE EXCEPTION 'review actor is not a Portal profile';
    END IF;
  END IF;

  UPDATE public.app_state
  SET payload = next_payload,
      updated_at = now()
  WHERE id = 'default'
    AND coalesce(
      CASE
        WHEN payload->>'version' ~ '^\d+$'
          AND (payload->>'version')::integer > 0
        THEN (payload->>'version')::integer
        ELSE NULL
      END,
      1
    ) = expected_version
    AND (next_payload->>'version')::integer = expected_version + 1;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    PERFORM reviews_private.record_app_state_history(actor_id, next_version, next_payload);
    RETURN updated_count;
  END IF;

  IF expected_version = 1 AND NOT EXISTS (
    SELECT 1 FROM public.app_state WHERE id = 'default'
  ) THEN
    INSERT INTO public.app_state (id, payload, updated_at)
    VALUES ('default', next_payload, now())
    ON CONFLICT (id) DO NOTHING;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
      PERFORM reviews_private.record_app_state_history(actor_id, next_version, next_payload);
    END IF;
    RETURN updated_count;
  END IF;

  RETURN 0;
END;
$save$;

REVOKE ALL ON FUNCTION reviews_private.save_app_state_if_version(integer, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reviews_private.save_app_state_if_version(integer, jsonb, uuid)
  TO service_role;

COMMENT ON FUNCTION reviews_private.save_app_state_if_version(integer, jsonb, uuid) IS
  'Privileged compare-and-swap. service_role may execute it only because the public invoker wrapper runs as service_role. Do not add reviews_private to exposed schemas.';

-- PostgREST calls this public wrapper. It does not call reviews_private.
CREATE FUNCTION public.save_app_state_if_version(
  expected_version integer,
  next_payload jsonb,
  actor_id uuid
) RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $wrap$
  SELECT reviews_private.save_app_state_if_version(expected_version, next_payload, actor_id);
$wrap$;

REVOKE ALL ON FUNCTION public.save_app_state_if_version(integer, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_app_state_if_version(integer, jsonb, uuid)
  TO service_role;

CREATE FUNCTION reviews_private.rate_limit_hit(
  actor_id uuid,
  bucket_key text,
  bucket_start timestamp with time zone,
  max_hits integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $rate$
DECLARE
  next_hits integer;
BEGIN
  IF actor_id IS NULL OR bucket_key IS NULL OR bucket_key = ''
     OR bucket_start IS NULL OR max_hits IS NULL OR max_hits < 1 THEN
    RETURN false;
  END IF;
  IF to_regclass('public.profiles') IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor_id) THEN
    RETURN false;
  END IF;

  DELETE FROM public.tutor_reword_rate
  WHERE bucket < bucket_start - interval '2 hours';

  INSERT INTO public.tutor_reword_rate (user_id, bucket_key, bucket, hits)
  VALUES (actor_id, bucket_key, bucket_start, 1)
  ON CONFLICT ON CONSTRAINT tutor_reword_rate_pkey
  DO UPDATE SET hits = public.tutor_reword_rate.hits + 1
  RETURNING hits INTO next_hits;

  RETURN next_hits <= max_hits;
END;
$rate$;

REVOKE ALL ON FUNCTION reviews_private.rate_limit_hit(uuid, text, timestamp with time zone, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reviews_private.rate_limit_hit(uuid, text, timestamp with time zone, integer)
  TO service_role;

CREATE FUNCTION public.rate_limit_hit(
  actor_id uuid,
  bucket_key text,
  bucket_start timestamp with time zone,
  max_hits integer
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $rate_wrap$
  SELECT reviews_private.rate_limit_hit(actor_id, bucket_key, bucket_start, max_hits);
$rate_wrap$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(uuid, text, timestamp with time zone, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(uuid, text, timestamp with time zone, integer)
  TO service_role;

-- Portal attachment catalogue. Source had no such table.
-- review_learner_id is the Review Assistant learner id exactly as submitted.
-- It is text because those ids are not portal UUIDs. Do not coerce it.
-- portal_apprentice_id is a separate optional canonical apprentices.id.
-- It stays null until a reviewed link is made. A non-null actor must be a Portal profile.
-- Migration number 035 is already applied as 20261108000601_review_assistant_empty_structure_035.
-- Do not renumber this file onto 035. This file is held and is not applied.
CREATE TABLE public.review_assistant_attachments (
  id text NOT NULL,
  review_learner_id text NOT NULL,
  portal_apprentice_id uuid,
  actor_id uuid,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_bucket text DEFAULT 'review-attachments'::text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT review_assistant_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT review_assistant_attachments_path_key UNIQUE (storage_bucket, storage_path),
  CONSTRAINT review_assistant_attachments_size_check CHECK (
    size_bytes > 0 AND size_bytes <= 26214400
  ),
  CONSTRAINT review_assistant_attachments_type_check CHECK (
    content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  CONSTRAINT review_assistant_attachments_learner_check CHECK (
    length(btrim(review_learner_id)) > 0
    AND length(review_learner_id) <= 200
    AND review_learner_id !~ '[[:cntrl:]]'
  )
);

ALTER TABLE public.review_assistant_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.review_assistant_attachments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.review_assistant_attachments TO service_role;

COMMENT ON COLUMN public.review_assistant_attachments.review_learner_id IS
  'Exact Review Assistant learner id. Not a portal apprentice id and not rewritten.';
COMMENT ON COLUMN public.review_assistant_attachments.portal_apprentice_id IS
  'Optional canonical apprentices.id. Leave null unless a reviewed link sets it. Do not copy review_learner_id here.';

CREATE FUNCTION reviews_private.attachment_binding_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $bind$
BEGIN
  IF NEW.actor_id IS NOT NULL AND to_regclass('public.profiles') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.actor_id) THEN
    RAISE EXCEPTION 'attachment actor is not a Portal profile';
  END IF;
  IF NEW.portal_apprentice_id IS NOT NULL AND to_regclass('public.apprentices') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.apprentices WHERE id = NEW.portal_apprentice_id) THEN
    RAISE EXCEPTION 'attachment learner is not a Portal apprentice';
  END IF;
  RETURN NEW;
END;
$bind$;

REVOKE ALL ON FUNCTION reviews_private.attachment_binding_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER review_assistant_attachments_binding
  BEFORE INSERT OR UPDATE ON public.review_assistant_attachments
  FOR EACH ROW EXECUTE FUNCTION reviews_private.attachment_binding_guard();

-- Absent row means the workspace page map is not configured. It is not an empty deny-all.
-- A failed read is closed by the application. This table is not part of the source copy.
CREATE TABLE public.staff_page_access (
  id text NOT NULL,
  payload jsonb NOT NULL,
  version integer NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid,
  CONSTRAINT staff_page_access_pkey PRIMARY KEY (id),
  CONSTRAINT staff_page_access_version_check CHECK (version > 0)
);

ALTER TABLE public.staff_page_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_page_access FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.staff_page_access TO service_role;

COMMENT ON TABLE public.staff_page_access IS
  'Portal page-access document. One absent row leaves legacy access in place. No seed.';

CREATE FUNCTION reviews_private.save_staff_page_access(
  expected_version integer,
  next_payload jsonb,
  actor_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $pages$
DECLARE
  updated_count integer;
BEGIN
  IF next_payload IS NULL
     OR jsonb_typeof(next_payload) <> 'object'
     OR NOT (next_payload ? 'workspaceDefaults' AND next_payload ? 'bundles' AND next_payload ? 'direct')
     OR jsonb_typeof(next_payload->'workspaceDefaults') <> 'array'
     OR jsonb_typeof(next_payload->'bundles') <> 'array'
     OR jsonb_typeof(next_payload->'direct') <> 'array' THEN
    RAISE EXCEPTION 'page access payload is missing its lists';
  END IF;
  IF actor_id IS NOT NULL THEN
    IF to_regclass('public.profiles') IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor_id) THEN
      RAISE EXCEPTION 'page access actor is not a Portal profile';
    END IF;
  END IF;

  UPDATE public.staff_page_access
  SET payload = next_payload,
      version = expected_version + 1,
      updated_at = now(),
      updated_by = actor_id
  WHERE id = 'default'
    AND version = expected_version;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RETURN updated_count;
  END IF;

  IF expected_version = 0 AND NOT EXISTS (
    SELECT 1 FROM public.staff_page_access WHERE id = 'default'
  ) THEN
    INSERT INTO public.staff_page_access (id, payload, version, updated_at, updated_by)
    VALUES ('default', next_payload, 1, now(), actor_id)
    ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
  END IF;

  RETURN 0;
END;
$pages$;

REVOKE ALL ON FUNCTION reviews_private.save_staff_page_access(integer, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reviews_private.save_staff_page_access(integer, jsonb, uuid)
  TO service_role;

CREATE FUNCTION public.save_staff_page_access(
  expected_version integer,
  next_payload jsonb,
  actor_id uuid
) RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $pages_wrap$
  SELECT reviews_private.save_staff_page_access(expected_version, next_payload, actor_id);
$pages_wrap$;

REVOKE ALL ON FUNCTION public.save_staff_page_access(integer, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_staff_page_access(integer, jsonb, uuid)
  TO service_role;

CREATE FUNCTION reviews_private.ensure_private_bucket(
  requested_bucket text,
  size_limit bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $bucket$
DECLARE
  existing_public boolean;
  existing_name text;
  existing_limit bigint;
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'storage.buckets is not available';
  END IF;
  SELECT buckets.public, buckets.name, buckets.file_size_limit
    INTO existing_public, existing_name, existing_limit
  FROM storage.buckets AS buckets
  WHERE buckets.id = requested_bucket;

  IF NOT FOUND THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES (requested_bucket, requested_bucket, false, size_limit);
    INSERT INTO reviews_private.storage_provision (bucket_id, created_by_this_migration, file_size_limit)
    VALUES (requested_bucket, true, size_limit);
    RETURN;
  END IF;

  IF existing_public IS DISTINCT FROM false
     OR existing_name IS DISTINCT FROM requested_bucket
     OR existing_limit IS DISTINCT FROM size_limit THEN
    RAISE EXCEPTION 'bucket % already exists with incompatible settings', requested_bucket;
  END IF;

  INSERT INTO reviews_private.storage_provision (bucket_id, created_by_this_migration, file_size_limit)
  VALUES (requested_bucket, false, size_limit)
  ON CONFLICT (bucket_id) DO NOTHING;
END;
$bucket$;

REVOKE ALL ON FUNCTION reviews_private.ensure_private_bucket(text, bigint)
  FROM PUBLIC, anon, authenticated, service_role;

-- The migration role must already be allowed to insert into storage.buckets.
-- This does not grant that privilege and does not weaken storage RLS.
-- On hosted Supabase the storage schema is owned by supabase_storage_admin.
-- Apply this file in one transaction as the postgres role. If INSERT is denied, stop.
DO $bucket_privilege$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'storage.buckets is not available';
  END IF;
  IF NOT has_table_privilege(current_user, 'storage.buckets', 'INSERT') THEN
    RAISE EXCEPTION 'role % cannot insert storage buckets; do not grant anon or authenticated to work around this', current_user;
  END IF;
END;
$bucket_privilege$;

SELECT reviews_private.ensure_private_bucket('review-app', 52428800);
SELECT reviews_private.ensure_private_bucket('review-attachments', 26214400);
