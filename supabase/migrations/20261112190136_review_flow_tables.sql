-- Review flow, part 1: new columns and tables (13 Nov 2026).
--  * reviews.interval_weeks: the interval (10, or 5 while a concern was open) the review's planned date was worked out with.
--    It is SET from review_interval_weeks(); nothing here works the interval out a second time (see part 3).
--  * review_attachments.kind
--  * review_packs (one per review), review_pack_events (append-only), review_tutor_forms, review_progress_rows,
--    review_targets, review_signatures
-- RLS and the tutor helpers are in part 2, the transition functions and hooks in part 3, the daily job in part 4.

-- ---------- columns on existing tables ----------
alter table public.reviews
  add column interval_weeks integer not null default 10,
  add constraint reviews_interval_weeks_valid check (interval_weeks between 1 and 52);

-- Open reviews with an open concern are on the 5-week interval. Everything else keeps the default of 10.
-- (updated_at is left alone: this is a backfill of a new column, not an edit.)
alter table public.reviews disable trigger touch_reviews_updated_at;
update public.reviews r
   set interval_weeks = public.review_interval_weeks(r.gta_id)
 where r.status = 'open' and public.review_interval_weeks(r.gta_id) <> r.interval_weeks;
alter table public.reviews enable trigger touch_reviews_updated_at;

alter table public.review_attachments
  add column kind text not null default 'other',
  add constraint review_attachments_kind_valid check (kind in ('review_pack','previous_review','returned_form','signed_review','other'));

-- A pack must belong to the same learner as its review.
alter table public.reviews add constraint reviews_id_gta_id_key unique (id, gta_id);

-- ---------- helpers for the limits ----------
create or replace function public.review_word_count(p text)
returns integer
language sql
immutable
parallel safe
set search_path to ''
as $$
  select case when btrim(coalesce(p, '')) = '' then 0 else cardinality(regexp_split_to_array(btrim(p), '\s+')) end
$$;
revoke all on function public.review_word_count(text) from public, anon, authenticated;
grant execute on function public.review_word_count(text) to service_role;

-- ---------- review_packs ----------
create table public.review_packs (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null,
  gta_id text not null,
  stage text not null default 'waiting',
  stage_since timestamptz not null default now(),
  -- the tutor the pack was released to; frozen at release, not changed when the learner is later reassigned
  tutor_id uuid references public.profiles(id) on delete restrict,
  -- what the tutor is shown about the learner; frozen at release
  learner_snapshot jsonb,
  snapshot_at timestamptz,
  hold_reason text,
  held_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_packs_review_key unique (review_id),
  constraint review_packs_review_fkey foreign key (review_id, gta_id)
    references public.reviews (id, gta_id) on delete restrict,
  constraint review_packs_apprentice_fkey foreign key (gta_id)
    references public.apprentices (gta_id) on delete restrict,
  constraint review_packs_stage_valid check (stage in ('waiting','with_tutor','to_book','booked','reviewed','completed')),
  constraint review_packs_tutor_once_released check (stage in ('waiting','completed') or tutor_id is not null),
  constraint review_packs_snapshot_once_released check (stage in ('waiting','completed') or learner_snapshot is not null),
  constraint review_packs_snapshot_object check (learner_snapshot is null or jsonb_typeof(learner_snapshot) = 'object'),
  constraint review_packs_snapshot_pair check ((learner_snapshot is null) = (snapshot_at is null)),
  constraint review_packs_hold_reason_not_blank check (hold_reason is null or btrim(hold_reason) <> ''),
  constraint review_packs_held_until_needs_hold check (held_until is null or hold_reason is not null),
  constraint review_packs_hold_only_before_booking check (hold_reason is null or stage in ('waiting','with_tutor','to_book'))
);
create index review_packs_gta_id_idx on public.review_packs (gta_id);
create index review_packs_tutor_id_idx on public.review_packs (tutor_id) where tutor_id is not null;
create index review_packs_stage_idx on public.review_packs (stage) where stage <> 'completed';
create trigger touch_review_packs_updated_at
  before update on public.review_packs
  for each row execute function public.touch_updated_at();

-- ---------- review_pack_events (append-only) ----------
create table public.review_pack_events (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  pack_id uuid not null references public.review_packs(id) on delete restrict,
  event_type text not null,
  from_stage text,
  to_stage text,
  actor_profile_id uuid references public.profiles(id) on delete restrict,
  actor_role text,
  system boolean not null default false,
  source text not null,
  -- when it really happened (a backfill uses the real time) and when the row was written
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb,
  constraint review_pack_events_seq_key unique (seq),
  constraint review_pack_events_type_valid check (event_type in (
    'created','released','draft_saved','submitted','recalled','booked','booking_cleared',
    'reviewed','completed','held','hold_released','signature_recorded')),
  constraint review_pack_events_from_valid check (from_stage is null or from_stage in ('waiting','with_tutor','to_book','booked','reviewed','completed')),
  constraint review_pack_events_to_valid check (to_stage is null or to_stage in ('waiting','with_tutor','to_book','booked','reviewed','completed')),
  constraint review_pack_events_source_valid check (source in ('auto','user','backfill')),
  constraint review_pack_events_user_has_actor check (source <> 'user' or (actor_profile_id is not null and not system)),
  constraint review_pack_events_system_is_auto check (not system or (source = 'auto' and actor_profile_id is null)),
  constraint review_pack_events_role_needs_actor check (actor_role is null or actor_profile_id is not null),
  constraint review_pack_events_role_not_blank check (actor_role is null or btrim(actor_role) <> ''),
  constraint review_pack_events_detail_object check (jsonb_typeof(detail) = 'object')
);
create index review_pack_events_pack_idx on public.review_pack_events (pack_id, seq);
create index review_pack_events_actor_idx on public.review_pack_events (actor_profile_id) where actor_profile_id is not null;

create or replace function public.review_pack_events_append_only()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'review_pack_events is append-only: rows cannot be updated, deleted or truncated' using errcode = '23001';
end;
$$;
create trigger review_pack_events_no_update_delete
  before update or delete on public.review_pack_events
  for each row execute function public.review_pack_events_append_only();
create trigger review_pack_events_no_truncate
  before truncate on public.review_pack_events
  for each statement execute function public.review_pack_events_append_only();

-- ---------- review_tutor_forms (one per pack) ----------
create table public.review_tutor_forms (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.review_packs(id) on delete restrict,
  previous_summary text,
  tutor_comment text,
  -- the next four are filled in at the review itself, not by the tutor
  apprentice_comment text,
  employer_comment text,
  reviewer_comment text,
  agreed_summary text,
  differing_views text,
  -- 'paper' marks a form that came back on paper before this flow existed (the content is not in these tables)
  entry_method text not null default 'portal',
  draft_saved_at timestamptz,
  draft_saved_by uuid references public.profiles(id) on delete restrict,
  submitted_at timestamptz,
  submitted_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_tutor_forms_pack_key unique (pack_id),
  constraint review_tutor_forms_entry_method_valid check (entry_method in ('portal','paper')),
  constraint review_tutor_forms_previous_summary_limit check (public.review_word_count(previous_summary) <= 65),
  constraint review_tutor_forms_tutor_comment_limit check (public.review_word_count(tutor_comment) <= 400),
  constraint review_tutor_forms_text_not_blank check (
    (previous_summary is null or btrim(previous_summary) <> '') and (tutor_comment is null or btrim(tutor_comment) <> '')
    and (apprentice_comment is null or btrim(apprentice_comment) <> '') and (employer_comment is null or btrim(employer_comment) <> '')
    and (reviewer_comment is null or btrim(reviewer_comment) <> '') and (agreed_summary is null or btrim(agreed_summary) <> '')
    and (differing_views is null or btrim(differing_views) <> ''))
);
create index review_tutor_forms_draft_saved_by_idx on public.review_tutor_forms (draft_saved_by) where draft_saved_by is not null;
create index review_tutor_forms_submitted_by_idx on public.review_tutor_forms (submitted_by) where submitted_by is not null;
create trigger touch_review_tutor_forms_updated_at
  before update on public.review_tutor_forms
  for each row execute function public.touch_updated_at();

-- ---------- review_progress_rows (the 7 areas) ----------
create table public.review_progress_rows (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.review_packs(id) on delete restrict,
  area text not null,
  evidence text,
  action_ref text,
  rag text,
  -- off-the-job hours only; the rag for that area is worked out from them (under 80% red, under 95% amber, under 120% green, else blue)
  target_hours numeric(6,1),
  current_hours numeric(6,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_progress_rows_pack_area_key unique (pack_id, area),
  constraint review_progress_rows_area_valid check (area in (
    'overall_progress','knowledge_theory','practical_skills','behaviours_attendance','english_maths','off_the_job','epa_gateway')),
  constraint review_progress_rows_rag_valid check (rag is null or rag in ('red','amber','green','blue','na')),
  constraint review_progress_rows_hours_only_off_the_job check (area = 'off_the_job' or (target_hours is null and current_hours is null)),
  constraint review_progress_rows_hours_not_negative check ((target_hours is null or target_hours >= 0) and (current_hours is null or current_hours >= 0)),
  constraint review_progress_rows_evidence_limit check (public.review_word_count(evidence) <= 90),
  constraint review_progress_rows_action_ref_limit check (public.review_word_count(action_ref) <= 15),
  constraint review_progress_rows_text_not_blank check (
    (evidence is null or btrim(evidence) <> '') and (action_ref is null or btrim(action_ref) <> ''))
);
create trigger touch_review_progress_rows_updated_at
  before update on public.review_progress_rows
  for each row execute function public.touch_updated_at();

-- ---------- review_targets (3 slots) ----------
-- kind 'previous': the targets from the last review, which the tutor marks met / partly / not met / carry forward.
-- kind 'new': up to 3 slots for the next cycle. A carried-forward target is copied into a new slot and points back with carried_from_id.
create table public.review_targets (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.review_packs(id) on delete restrict,
  kind text not null,
  slot smallint not null,
  action text,
  owner text,
  measure text,
  target_date date,
  status text not null default 'open',
  carried_from_id uuid references public.review_targets(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_targets_pack_kind_slot_key unique (pack_id, kind, slot),
  constraint review_targets_kind_valid check (kind in ('previous','new')),
  constraint review_targets_slot_valid check (slot between 1 and 3),
  constraint review_targets_status_valid check (status in ('open','met','partly','not-met','carry-forward')),
  constraint review_targets_new_is_open check (kind = 'previous' or status = 'open'),
  constraint review_targets_not_self_carried check (carried_from_id is null or carried_from_id <> id),
  constraint review_targets_action_limit check (public.review_word_count(action) <= 38),
  constraint review_targets_measure_limit check (public.review_word_count(measure) <= 47),
  constraint review_targets_text_not_blank check (
    (action is null or btrim(action) <> '') and (owner is null or btrim(owner) <> '') and (measure is null or btrim(measure) <> ''))
);
create index review_targets_carried_from_idx on public.review_targets (carried_from_id) where carried_from_id is not null;
create trigger touch_review_targets_updated_at
  before update on public.review_targets
  for each row execute function public.touch_updated_at();

-- ---------- review_signatures ----------
create table public.review_signatures (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.review_packs(id) on delete restrict,
  party text not null,
  signer_name text not null,
  signature_image text not null,
  signed_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint review_signatures_pack_party_key unique (pack_id, party),
  constraint review_signatures_party_valid check (party in ('apprentice','employer','reviewer')),
  constraint review_signatures_name_not_blank check (btrim(signer_name) <> ''),
  constraint review_signatures_image_valid check (signature_image like 'data:image/%' and length(signature_image) <= 300000)
);
create index review_signatures_recorded_by_idx on public.review_signatures (recorded_by);

-- ---------- RLS on and grants (policies are in part 2) ----------
alter table public.review_packs enable row level security;
alter table public.review_pack_events enable row level security;
alter table public.review_tutor_forms enable row level security;
alter table public.review_progress_rows enable row level security;
alter table public.review_targets enable row level security;
alter table public.review_signatures enable row level security;

revoke all on table public.review_packs, public.review_pack_events, public.review_tutor_forms,
  public.review_progress_rows, public.review_targets, public.review_signatures from public, anon, authenticated;
grant select on table public.review_packs, public.review_pack_events, public.review_tutor_forms,
  public.review_progress_rows, public.review_targets, public.review_signatures to authenticated;
grant select, insert, update, delete on table public.review_packs, public.review_tutor_forms,
  public.review_progress_rows, public.review_targets, public.review_signatures to service_role;
-- the event log: no update or delete for anyone (the trigger also blocks them)
grant select, insert on table public.review_pack_events to service_role;
