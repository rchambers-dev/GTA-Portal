-- Rename remaining learner_* tables/columns to apprentice_*.
-- Covers tables present in live DB beyond the core portal bootstrap.

-- ---------------------------------------------------------------------------
-- Helper: rename column if present
-- ---------------------------------------------------------------------------
do $$
declare
  pairs text[][] := array[
    array['document_form_instances', 'learner_id', 'apprentice_id'],
    array['document_form_instances', 'learner_programme_id', 'apprentice_programme_id'],
    array['evidence_records', 'learner_id', 'apprentice_id'],
    array['otj_entries', 'learner_id', 'apprentice_id'],
    array['otj_entries', 'learner_programme_id', 'apprentice_programme_id'],
    array['task_submissions', 'learner_id', 'apprentice_id'],
    array['task_submissions', 'learner_programme_id', 'apprentice_programme_id'],
    array['learner_block_rpl', 'learner_id', 'apprentice_id'],
    array['learner_block_rpl', 'learner_programme_id', 'apprentice_programme_id'],
    array['learner_gateway_status', 'learner_programme_id', 'apprentice_programme_id'],
    array['learner_requirements', 'learner_id', 'apprentice_id'],
    array['learner_requirements', 'learner_programme_id', 'apprentice_programme_id']
  ];
  p text[];
begin
  foreach p slice 1 in array pairs loop
    if to_regclass('public.' || p[1]) is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = p[1]
           and column_name = p[2]
       ) then
      execute format(
        'alter table public.%I rename column %I to %I',
        p[1], p[2], p[3]
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Rename learner_* tables
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.learner_block_rpl') is not null
     and to_regclass('public.apprentice_block_rpl') is null then
    alter table public.learner_block_rpl rename to apprentice_block_rpl;
  end if;

  if to_regclass('public.learner_gateway_status') is not null
     and to_regclass('public.apprentice_gateway_status') is null then
    alter table public.learner_gateway_status rename to apprentice_gateway_status;
  end if;

  if to_regclass('public.learner_requirements') is not null
     and to_regclass('public.apprentice_requirements') is null then
    alter table public.learner_requirements rename to apprentice_requirements;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Rename obvious FK constraint names (best-effort)
-- ---------------------------------------------------------------------------
do $$
declare
  renames text[][] := array[
    array['document_form_instances', 'document_form_instances_learner_id_fkey', 'document_form_instances_apprentice_id_fkey'],
    array['document_form_instances', 'document_form_instances_learner_programme_id_fkey', 'document_form_instances_apprentice_programme_id_fkey'],
    array['evidence_records', 'evidence_records_learner_id_fkey', 'evidence_records_apprentice_id_fkey'],
    array['otj_entries', 'otj_entries_learner_id_fkey', 'otj_entries_apprentice_id_fkey'],
    array['otj_entries', 'otj_entries_learner_programme_id_fkey', 'otj_entries_apprentice_programme_id_fkey'],
    array['task_submissions', 'task_submissions_learner_id_fkey', 'task_submissions_apprentice_id_fkey'],
    array['task_submissions', 'task_submissions_learner_programme_id_fkey', 'task_submissions_apprentice_programme_id_fkey'],
    array['apprentice_block_rpl', 'learner_block_rpl_learner_id_fkey', 'apprentice_block_rpl_apprentice_id_fkey'],
    array['apprentice_block_rpl', 'learner_block_rpl_learner_programme_id_fkey', 'apprentice_block_rpl_apprentice_programme_id_fkey'],
    array['apprentice_block_rpl', 'learner_block_rpl_decided_by_fkey', 'apprentice_block_rpl_decided_by_fkey'],
    array['apprentice_block_rpl', 'learner_block_rpl_pkey', 'apprentice_block_rpl_pkey'],
    array['apprentice_gateway_status', 'learner_gateway_status_learner_programme_id_fkey', 'apprentice_gateway_status_apprentice_programme_id_fkey'],
    array['apprentice_gateway_status', 'learner_gateway_status_pkey', 'apprentice_gateway_status_pkey'],
    array['apprentice_requirements', 'learner_requirements_learner_id_fkey', 'apprentice_requirements_apprentice_id_fkey'],
    array['apprentice_requirements', 'learner_requirements_learner_programme_id_fkey', 'apprentice_requirements_apprentice_programme_id_fkey'],
    array['apprentice_requirements', 'learner_requirements_pkey', 'apprentice_requirements_pkey']
  ];
  r text[];
begin
  foreach r slice 1 in array renames loop
    if to_regclass('public.' || r[1]) is not null
       and exists (select 1 from pg_constraint where conname = r[2]) then
      execute format(
        'alter table public.%I rename constraint %I to %I',
        r[1], r[2], r[3]
      );
    end if;
  end loop;
end $$;
