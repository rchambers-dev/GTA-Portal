-- Pin enrolments to an exact GTA programme version for RPL/TNP integrity.
-- Publishing a newer programme version must not move existing learners.

alter table public.apprentice_programmes
  add column if not exists gta_programme_version_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'apprentice_programmes_gta_programme_version_fk'
  ) then
    if to_regclass('public.gta_programme_versions') is not null then
      alter table public.apprentice_programmes
        add constraint apprentice_programmes_gta_programme_version_fk
        foreign key (gta_programme_version_id)
        references public.gta_programme_versions (id)
        on delete set null;
    end if;
  end if;
end $$;

create index if not exists apprentice_programmes_gta_programme_version_id_idx
  on public.apprentice_programmes (gta_programme_version_id);

comment on column public.apprentice_programmes.gta_programme_version_id is
  'Pinned GTA programme version for curriculum valuation, RPL and TNP. Null until explicitly bound.';
