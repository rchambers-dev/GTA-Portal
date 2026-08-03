-- CEA / personal-tracking progress per apprentice + pack (groups spine).

create table if not exists public.cea_apprentice_states (
  id uuid primary key default gen_random_uuid(),
  apprentice_id uuid not null references public.apprentices (id) on delete cascade,
  pack_id text not null,
  mandatory_by_group jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  milestone_reflections jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cea_apprentice_states_apprentice_pack_key unique (apprentice_id, pack_id)
);

create index if not exists cea_apprentice_states_apprentice_id_idx
  on public.cea_apprentice_states (apprentice_id);

create index if not exists cea_apprentice_states_pack_id_idx
  on public.cea_apprentice_states (pack_id);

drop trigger if exists touch_cea_apprentice_states_updated_at
  on public.cea_apprentice_states;
create trigger touch_cea_apprentice_states_updated_at
before update on public.cea_apprentice_states
for each row execute function public.touch_updated_at();

alter table public.cea_apprentice_states enable row level security;

-- Service-role API uses the admin client; keep authenticated read blocked by default.
drop policy if exists cea_apprentice_states_deny_all on public.cea_apprentice_states;
create policy cea_apprentice_states_deny_all
on public.cea_apprentice_states
for all
to authenticated
using (false)
with check (false);

comment on table public.cea_apprentice_states is
  'Groups-spine CEA personal tracking state keyed by apprentice_id + pack_id. Accessed via portal API (service role).';
