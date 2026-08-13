-- Phase 2C: dedicated learner-facing Session content.
-- Separate from tutor LOR / lesson-plan extracts.
-- Only approved_published copy may appear to apprentices.

alter table public.gta_programme_sessions
  add column if not exists learner_facing_content jsonb not null default '{}'::jsonb;

comment on column public.gta_programme_sessions.learner_facing_content is
  'Learner summary / learning / activity. Candidates require curriculum-owner approval. Never auto-publish tutor lesson-plan prose.';
