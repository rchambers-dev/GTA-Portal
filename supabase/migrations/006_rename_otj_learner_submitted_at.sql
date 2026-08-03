-- Rename remaining learner_* column on otj_entries.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'otj_entries'
      and column_name = 'learner_submitted_at'
  ) then
    alter table public.otj_entries
      rename column learner_submitted_at to apprentice_submitted_at;
  end if;
end $$;
