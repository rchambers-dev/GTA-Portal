-- Performance Advisor: covering indexes for foreign keys without an index.
-- Unused-index INFO items left alone (cold DB / still useful for intended joins).
-- Auth absolute connection strategy is a Supabase project setting, not SQL.

create index if not exists apprentice_block_rpl_apprentice_programme_id_idx
  on public.apprentice_block_rpl (apprentice_programme_id);

create index if not exists apprentice_block_rpl_decided_by_idx
  on public.apprentice_block_rpl (decided_by);

create index if not exists apprentice_programmes_apprentice_id_idx
  on public.apprentice_programmes (apprentice_id);

create index if not exists apprentice_programmes_programme_id_idx
  on public.apprentice_programmes (programme_id);

create index if not exists apprentice_programmes_cohort_uuid_idx
  on public.apprentice_programmes (cohort_uuid);

create index if not exists apprentice_programmes_employer_uuid_idx
  on public.apprentice_programmes (employer_uuid);

create index if not exists apprentice_requirements_apprentice_programme_id_idx
  on public.apprentice_requirements (apprentice_programme_id);

create index if not exists audit_events_actor_profile_id_idx
  on public.audit_events (actor_profile_id);

create index if not exists cohorts_programme_id_idx
  on public.cohorts (programme_id);

create index if not exists document_form_instances_apprentice_programme_id_idx
  on public.document_form_instances (apprentice_programme_id);

create index if not exists document_form_instances_updated_by_idx
  on public.document_form_instances (updated_by);

create index if not exists evidence_links_evidence_id_idx
  on public.evidence_links (evidence_id);

create index if not exists evidence_links_linked_by_idx
  on public.evidence_links (linked_by);

create index if not exists evidence_records_apprentice_id_idx
  on public.evidence_records (apprentice_id);

create index if not exists evidence_records_created_by_idx
  on public.evidence_records (created_by);

create index if not exists evidence_versions_uploaded_by_idx
  on public.evidence_versions (uploaded_by);

create index if not exists otj_entries_apprentice_id_idx
  on public.otj_entries (apprentice_id);

create index if not exists otj_entries_apprentice_programme_id_idx
  on public.otj_entries (apprentice_programme_id);

create index if not exists profiles_linked_apprentice_id_idx
  on public.profiles (linked_apprentice_id);

create index if not exists proxy_write_audit_actor_profile_id_idx
  on public.proxy_write_audit (actor_profile_id);

create index if not exists proxy_write_audit_apprentice_id_idx
  on public.proxy_write_audit (apprentice_id);

create index if not exists staff_assignments_apprentice_programme_id_idx
  on public.staff_assignments (apprentice_programme_id);

create index if not exists task_submissions_apprentice_programme_id_idx
  on public.task_submissions (apprentice_programme_id);

create index if not exists task_submissions_force_completed_by_idx
  on public.task_submissions (force_completed_by);

create index if not exists temporary_assignments_granted_by_profile_id_idx
  on public.temporary_assignments (granted_by_profile_id);

create index if not exists temporary_assignments_profile_id_idx
  on public.temporary_assignments (profile_id);
