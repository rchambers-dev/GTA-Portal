-- Recommendation provenance on Block↔KSB mappings (orthogonal to mapping_source).
-- Also documents ASSESS meaning and blocks-only rule at DB layer.

alter table public.gta_spine_item_ksbs
  add column if not exists recommendation_provider text,
  add column if not exists recommendation_feature text,
  add column if not exists recommended_intent text,
  add column if not exists recommendation_accepted boolean;

alter table public.gta_spine_item_ksbs
  drop constraint if exists gta_spine_item_ksbs_rec_provider_check;
alter table public.gta_spine_item_ksbs
  add constraint gta_spine_item_ksbs_rec_provider_check
  check (
    recommendation_provider is null
    or recommendation_provider in ('portal_ai', 'heuristic')
  );

alter table public.gta_spine_item_ksbs
  drop constraint if exists gta_spine_item_ksbs_recommended_intent_check;
alter table public.gta_spine_item_ksbs
  add constraint gta_spine_item_ksbs_recommended_intent_check
  check (
    recommended_intent is null
    or recommended_intent in (
      'introduce',
      'practise',
      'apply',
      'reinforce',
      'consolidate',
      'assess'
    )
  );

-- KSBs may only be mapped to block spine items (not gateway / EPA / etc.).
create or replace function public.gta_spine_item_ksbs_require_block()
returns trigger
language plpgsql
as $$
declare
  item_type text;
begin
  select si.item_type into item_type
  from public.gta_spine_items si
  where si.id = new.spine_item_id;

  if item_type is distinct from 'block' then
    raise exception 'KSB mappings are only allowed on block spine items (got %)',
      coalesce(item_type, 'missing');
  end if;
  return new;
end;
$$;

drop trigger if exists gta_spine_item_ksbs_require_block_trg
  on public.gta_spine_item_ksbs;
create trigger gta_spine_item_ksbs_require_block_trg
  before insert or update of spine_item_id
  on public.gta_spine_item_ksbs
  for each row
  execute function public.gta_spine_item_ksbs_require_block();

comment on column public.gta_spine_item_ksbs.recommendation_provider is
  'Suggestion engine that helped choose LearningIntent (portal_ai | heuristic); kept on override.';
comment on column public.gta_spine_item_ksbs.learning_intent is
  'Educational use in this block. ASSESS = checked/evidenced here, not formal exam ownership.';
