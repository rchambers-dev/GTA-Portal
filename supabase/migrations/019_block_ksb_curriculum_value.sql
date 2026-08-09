-- Block ↔ KSB curriculum valuation (Phase 1).
-- curriculum_value is per mapping occurrence; Primary / LearningIntent stay orthogonal.
-- Also extends activity log for curriculum-value audits.

alter table public.gta_spine_item_ksbs
  add column if not exists curriculum_value numeric not null default 1.0;

alter table public.gta_spine_item_ksbs
  drop constraint if exists gta_spine_item_ksbs_curriculum_value_check;

alter table public.gta_spine_item_ksbs
  add constraint gta_spine_item_ksbs_curriculum_value_check
  check (curriculum_value > 0);

comment on column public.gta_spine_item_ksbs.curriculum_value is
  'GTA curriculum contribution of this Block↔KSB occurrence. Not official SE metadata.';

alter table public.gta_programme_activity
  drop constraint if exists gta_programme_activity_kind_check;

alter table public.gta_programme_activity
  add constraint gta_programme_activity_kind_check check (
    kind in (
      'api_request',
      'api_ok',
      'api_error',
      'new_version',
      'official_cached',
      'draft_reopened',
      'programme_created',
      'spine_saved',
      'parameters_saved',
      'formula_published',
      'spine_published',
      'title_saved',
      'primary_moved',
      'version_forked',
      'ksb_curriculum_value_changed'
    )
  );
