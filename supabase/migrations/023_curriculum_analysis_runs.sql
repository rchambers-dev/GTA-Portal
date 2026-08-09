-- AI-1: Curriculum analysis runs/results (recommendations only — never programme truth).

create table if not exists public.gta_curriculum_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  programme_version_id uuid not null
    references public.gta_programme_versions (id) on delete cascade,
  official_standard_version_id uuid not null
    references public.se_standard_versions (id) on delete restrict,
  feature_key text not null
    default 'programme.baseline_curriculum_analysis@1',
  provider text not null,
  model text not null,
  prompt_version text not null,
  analysis_mode text not null default 'full_baseline',
  copied_from_run_id uuid
    references public.gta_curriculum_analysis_runs (id) on delete set null,
  source_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  error_summary text,
  stats jsonb not null default '{}'::jsonb,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint gta_curriculum_analysis_runs_mode_check check (
    analysis_mode in ('full_baseline', 'delta')
  ),
  constraint gta_curriculum_analysis_runs_status_check check (
    status in ('queued', 'running', 'completed', 'failed', 'cancelled')
  ),
  constraint gta_curriculum_analysis_runs_provider_check check (
    provider in ('portal_ai', 'heuristic', 'stub')
  )
);

create index if not exists gta_curriculum_analysis_runs_version_idx
  on public.gta_curriculum_analysis_runs (programme_version_id, created_at desc);

create table if not exists public.gta_curriculum_analysis_results (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid not null
    references public.gta_curriculum_analysis_runs (id) on delete cascade,
  ksb_code text not null,
  classification text not null,
  confidence text not null,
  confidence_score numeric(6, 3),
  proposed_primary_spine_item_id uuid
    references public.gta_spine_items (id) on delete set null,
  proposed_primary_block_number integer,
  reinforcement_candidates jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  reasoning_summary text not null default '',
  warnings jsonb not null default '[]'::jsonb,
  provider_raw_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint gta_curriculum_analysis_results_class_check check (
    classification in (
      'primary_candidate',
      'curriculum_gap',
      'distributed_skill',
      'ambiguous'
    )
  ),
  constraint gta_curriculum_analysis_results_confidence_check check (
    confidence in ('high', 'medium', 'low')
  ),
  constraint gta_curriculum_analysis_results_run_ksb_unique
    unique (analysis_run_id, ksb_code)
);

create index if not exists gta_curriculum_analysis_results_run_idx
  on public.gta_curriculum_analysis_results (analysis_run_id);

create index if not exists gta_curriculum_analysis_results_class_idx
  on public.gta_curriculum_analysis_results (analysis_run_id, classification);

-- Results may only reference block spine items when a Primary is proposed.
create or replace function public.gta_curriculum_analysis_results_require_block()
returns trigger
language plpgsql
as $$
declare
  item_type text;
begin
  if new.proposed_primary_spine_item_id is null then
    return new;
  end if;

  select si.item_type into item_type
  from public.gta_spine_items si
  where si.id = new.proposed_primary_spine_item_id;

  if item_type is null then
    raise exception 'proposed_primary_spine_item_id % does not exist',
      new.proposed_primary_spine_item_id;
  end if;

  if item_type <> 'block' then
    raise exception
      'Analysis Primary candidates may only reference block spine items (got %)',
      item_type;
  end if;

  return new;
end;
$$;

drop trigger if exists gta_curriculum_analysis_results_require_block_trg
  on public.gta_curriculum_analysis_results;
create trigger gta_curriculum_analysis_results_require_block_trg
  before insert or update of proposed_primary_spine_item_id
  on public.gta_curriculum_analysis_results
  for each row
  execute function public.gta_curriculum_analysis_results_require_block();

alter table public.gta_curriculum_analysis_runs enable row level security;
alter table public.gta_curriculum_analysis_results enable row level security;

drop policy if exists gta_curriculum_analysis_runs_select_authenticated
  on public.gta_curriculum_analysis_runs;
create policy gta_curriculum_analysis_runs_select_authenticated
  on public.gta_curriculum_analysis_runs
  for select to authenticated
  using (true);

drop policy if exists gta_curriculum_analysis_results_select_authenticated
  on public.gta_curriculum_analysis_results;
create policy gta_curriculum_analysis_results_select_authenticated
  on public.gta_curriculum_analysis_results
  for select to authenticated
  using (true);

comment on table public.gta_curriculum_analysis_runs is
  'AI-1 curriculum analysis runs. Recommendations only — never programme coverage truth.';
comment on table public.gta_curriculum_analysis_results is
  'Per-KSB analysis recommendations. Must not be counted as approved Primaries.';
