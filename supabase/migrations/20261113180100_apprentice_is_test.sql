-- A test apprentice can be used to try the Portal. Lists, totals, and reports leave them out.
-- No test apprentice is created here.

alter table public.apprentices
  add column if not exists is_test boolean not null default false;
