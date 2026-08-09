-- Versioned formula/finance configuration on GTA programme versions.
-- JSONB holds the full ProgrammeDeliveryParameters snapshot (formula-specific
-- shapes validated in application code). DB is source of truth; localStorage
-- is cache only.

alter table public.gta_programme_versions
  add column if not exists parameters jsonb not null default '{}'::jsonb;

comment on column public.gta_programme_versions.parameters is
  'Versioned RPL/finance/formula configuration JSON (ProgrammeDeliveryParameters). Validated per formulaKey in application code. Never invent defaults on read.';
