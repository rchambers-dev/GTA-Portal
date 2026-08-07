-- Allow Primary-move and version-fork audit events in shared activity log.

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
      'version_forked'
    )
  );
