-- NOT APPLIED. Parent reviews this file, then applies it to cjtgjxgghfiskqnuttzd only.
-- No source connection. No rows copied. Do not replace public.rls_auto_enable().
--
-- SECTION A is the empty structure transfer. Column names and types match live
-- source gzeeofbhcgbgcbykdvez. Names stay public.app_state, public.app_state_history
-- and public.tutor_reword_rate because the target inventory found no collision.
--
-- SECTION B is the Portal addition: compare-and-swap, history retention and
-- rate limit live in reviews_private, which must stay out of the Data API
-- exposed schemas. Attachment rows and the two private buckets are also
-- additions. Source kept files only in storage and authorised them with
-- is_admin_or_office(); those policies are not copied.

-- ---------------------------------------------------------------------------
-- SECTION A. Exact empty structure. No seed row.
-- ---------------------------------------------------------------------------

CREATE TABLE public.app_state (
  id text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT app_state_pkey PRIMARY KEY (id)
);

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_state FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_state TO service_role;

COMMENT ON TABLE public.app_state IS
  'Empty Portal copy of the Reviews document. Version is payload.version, not a column. Not seeded.';

CREATE TABLE public.app_state_history (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  version integer NOT NULL,
  saved_at timestamp with time zone DEFAULT now() NOT NULL,
  payload jsonb NOT NULL,
  CONSTRAINT app_state_history_pkey PRIMARY KEY (id)
);

ALTER TABLE public.app_state_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_state_history FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.app_state_history TO service_role;

CREATE INDEX app_state_history_saved_at_desc
  ON public.app_state_history USING btree (saved_at DESC);

COMMENT ON TABLE public.app_state_history IS
  'Append-only snapshots. user_id is a Portal profiles.id when the server has one. No source rows.';

COMMENT ON COLUMN public.app_state_history.user_id IS
  'Nullable Portal profile id. No foreign key, matching the source column.';

REVOKE ALL ON SEQUENCE public.app_state_history_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.app_state_history_id_seq TO service_role;

CREATE TABLE public.tutor_reword_rate (
  user_id uuid NOT NULL,
  bucket_key text DEFAULT 'reword'::text NOT NULL,
  bucket timestamp with time zone NOT NULL,
  hits integer DEFAULT 0 NOT NULL,
  CONSTRAINT tutor_reword_rate_pkey PRIMARY KEY (user_id, bucket_key, bucket)
);

ALTER TABLE public.tutor_reword_rate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tutor_reword_rate FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tutor_reword_rate TO service_role;

COMMENT ON TABLE public.tutor_reword_rate IS
  'Per-user rate buckets. No learner data.';

CREATE SCHEMA reviews_private;
REVOKE ALL ON SCHEMA reviews_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA reviews_private TO service_role;

CREATE FUNCTION reviews_private.app_state_history_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $guard$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'app_state_history is append-only';
  END IF;
  IF TG_OP = 'DELETE' AND current_setting('app.history_prune', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'app_state_history is append-only';
END;
$guard$;

REVOKE ALL ON FUNCTION reviews_private.app_state_history_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER app_state_history_append_only
  BEFORE DELETE OR UPDATE ON public.app_state_history
  FOR EACH ROW EXECUTE FUNCTION reviews_private.app_state_history_guard();

CREATE TRIGGER app_state_history_no_truncate
  BEFORE TRUNCATE ON public.app_state_history
  FOR EACH STATEMENT EXECUTE FUNCTION reviews_private.app_state_history_guard();

-- ---------------------------------------------------------------------------
-- SECTION B. Portal additions. Not a copy of source public functions.
-- Source is_admin(), is_admin_or_office(), staff_password_change_default()
-- and the auth.users hook are intentionally absent.
-- Confirm reviews_private is not in the Data API exposed schemas before apply.
-- ---------------------------------------------------------------------------

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
  IF (
    SELECT h.payload
    FROM public.app_state_history h
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
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reviews_private.record_app_state_history(uuid, integer, jsonb)
  TO service_role;

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
  next_version := coalesce(
    CASE
      WHEN next_payload->>'version' ~ '^\d+$'
        AND (next_payload->>'version')::integer > 0
      THEN (next_payload->>'version')::integer
      ELSE NULL
    END,
    expected_version
  );

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
    ) = expected_version;

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

CREATE FUNCTION reviews_private.save_app_state_if_version(
  expected_version integer,
  next_payload jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $save2$
BEGIN
  RETURN reviews_private.save_app_state_if_version(expected_version, next_payload, NULL);
END;
$save2$;

REVOKE ALL ON FUNCTION reviews_private.save_app_state_if_version(integer, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reviews_private.save_app_state_if_version(integer, jsonb)
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

-- Attachment catalogue. Source had no such table; files lived only in storage.
-- portal_apprentice_id stays null when there is no canonical apprentice.
-- actor_id is a Portal profiles.id. No source object is inserted.
CREATE TABLE public.review_assistant_attachments (
  id text NOT NULL,
  portal_apprentice_id uuid,
  actor_id uuid,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_bucket text DEFAULT 'review-attachments'::text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT review_assistant_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT review_assistant_attachments_size_check CHECK (
    size_bytes > 0 AND size_bytes <= 26214400
  ),
  CONSTRAINT review_assistant_attachments_type_check CHECK (
    content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  )
);

ALTER TABLE public.review_assistant_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.review_assistant_attachments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.review_assistant_attachments TO service_role;

COMMENT ON TABLE public.review_assistant_attachments IS
  'Portal addition. Binds a private storage object to a Portal profile and, when known, apprentices.id.';

-- Private buckets. Source policies are not copied. Service role bypasses storage RLS.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('review-app', 'review-app', false, 52428800)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('review-attachments', 'review-attachments', false, 26214400)
ON CONFLICT (id) DO NOTHING;
