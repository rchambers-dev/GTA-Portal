-- NOT APPLIED. Structure only. Parent reviews this file before any target apply.
-- Target: cjtgjxgghfiskqnuttzd only. No source connection. No rows. No buckets.
-- Do not replace public.rls_auto_enable(). Do not change the Data API exposed schema list.
--
-- This file is the empty source-shaped copy:
--   public.app_state, public.app_state_history, public.tutor_reword_rate,
--   the history identity sequence, the saved_at index, and the append-only guard.
-- Portal functions, the public RPC wrappers, attachment metadata, buckets,
-- and staff page-access config are in 036_review_assistant_portal.sql.
-- Apply 035 before 036. Applying this file does not make saves callable.

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
  'Empty Portal copy of the Reviews document. Version lives in payload.version. Not seeded.';

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
  'Append-only snapshots. user_id is a Portal profiles.id when the save names one. No foreign key, matching the source column. No source rows.';

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

COMMENT ON SCHEMA reviews_private IS
  'Privileged Reviews routines. Must stay out of the Data API exposed schemas. Usage here is a database grant, not an API exposure.';

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
