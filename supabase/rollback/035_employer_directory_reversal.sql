-- NOT a migration. Do not place this file in supabase/migrations.
-- Do not run it against the live database until 035_go_no_go.sql has been
-- read and a backup taken outside this repository has been restored to a
-- scratch database. This file does not prove that backup.
--
-- Write control: SHARE ROW EXCLUSIVE is taken on every affected table that
-- exists before any count. Inserts, updates, and deletes wait. Readers do not.
--
-- Undo reads public.migration_035_prestate. An object recorded existed=false
-- is dropped. An object recorded existed=true is put back from the captured
-- function body, trigger statement, index, comment, row-security flag, or
-- access list. public.apprentices, public.employers, and
-- public.apprentice_programmes are never dropped. The prestate table is
-- dropped only at the end, because this migration created it.

do $$
declare
  detail_count bigint := 0;
  role_count bigint := 0;
  manager_count bigint := 0;
  membership_count bigint := 0;
  site_count bigint := 0;
  reviews_people bigint := 0;
  row_record record;
  trg_name text;
  trg_table text;
  rls_parts text[];
  kept_tables text[] := array[
    'public.apprentices',
    'public.employers',
    'public.apprentice_programmes'
  ];
begin
  if to_regclass('public.apprentices') is not null then
    lock table public.apprentices in share row exclusive mode;
  end if;
  if to_regclass('public.employers') is not null then
    lock table public.employers in share row exclusive mode;
  end if;
  if to_regclass('public.apprentice_programmes') is not null then
    lock table public.apprentice_programmes in share row exclusive mode;
  end if;
  if to_regclass('public.employer_sites') is not null then
    lock table public.employer_sites in share row exclusive mode;
  end if;
  if to_regclass('public.employer_managers') is not null then
    lock table public.employer_managers in share row exclusive mode;
  end if;
  if to_regclass('public.employer_site_memberships') is not null then
    lock table public.employer_site_memberships in share row exclusive mode;
  end if;
  if to_regclass('public.employer_manager_roles') is not null then
    lock table public.employer_manager_roles in share row exclusive mode;
  end if;
  if to_regclass('public.review_apprentice_details') is not null then
    lock table public.review_apprentice_details in share row exclusive mode;
  end if;
  if to_regclass('public.migration_035_prestate') is null then
    raise exception 'Refusing reversal. migration_035_prestate was not captured.';
  end if;
  lock table public.migration_035_prestate in share row exclusive mode;

  if to_regclass('public.review_apprentice_details') is not null then
    execute 'select count(*) from public.review_apprentice_details' into detail_count;
  end if;
  if to_regclass('public.employer_manager_roles') is not null then
    execute 'select count(*) from public.employer_manager_roles' into role_count;
  end if;
  if to_regclass('public.employer_managers') is not null then
    execute 'select count(*) from public.employer_managers' into manager_count;
  end if;
  if to_regclass('public.employer_site_memberships') is not null then
    execute 'select count(*) from public.employer_site_memberships' into membership_count;
  end if;
  if to_regclass('public.employer_sites') is not null then
    execute 'select count(*) from public.employer_sites' into site_count;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'apprentices' and column_name = 'portal_entry'
  ) then
    execute $q$select count(*) from public.apprentices where portal_entry = 'reviews'$q$
      into reviews_people;
  end if;

  if detail_count <> 0
     or role_count <> 0
     or manager_count <> 0
     or membership_count <> 0
     or site_count <> 0
     or reviews_people <> 0 then
    raise exception
      'Refusing reversal. details=%, roles=%, managers=%, memberships=%, sites=%, reviews apprentices=%',
      detail_count, role_count, manager_count, membership_count, site_count, reviews_people;
  end if;

  for row_record in
    select object_name, definition
    from public.migration_035_prestate
    where object_kind = 'trigger' and existed = false
  loop
    trg_name := split_part(row_record.object_name, '|', 1);
    trg_table := split_part(row_record.object_name, '|', 2);
    if to_regclass(trg_table) is not null then
      execute format('drop trigger if exists %I on %s', trg_name, trg_table);
    end if;
  end loop;

  for row_record in
    select object_name
    from public.migration_035_prestate
    where object_kind = 'function' and existed = false
  loop
    execute format('drop function if exists %s', row_record.object_name);
  end loop;

  for row_record in
    select object_name, definition
    from public.migration_035_prestate
    where object_kind = 'function' and existed = true and definition is not null
  loop
    execute row_record.definition;
  end loop;

  for row_record in
    select object_name, definition
    from public.migration_035_prestate
    where object_kind = 'function_acl' and existed = true
  loop
    if to_regprocedure(row_record.object_name) is not null then
      if row_record.definition is null then
        update pg_proc set proacl = null where oid = to_regprocedure(row_record.object_name);
      else
        execute format(
          'update pg_proc set proacl = %L::aclitem[] where oid = to_regprocedure(%L)',
          row_record.definition,
          row_record.object_name
        );
      end if;
    end if;
  end loop;

  for row_record in
    select object_name, definition
    from public.migration_035_prestate
    where object_kind = 'trigger' and existed = true and definition is not null
  loop
    trg_name := split_part(row_record.object_name, '|', 1);
    trg_table := split_part(row_record.object_name, '|', 2);
    if to_regclass(trg_table) is not null then
      execute format('drop trigger if exists %I on %s', trg_name, trg_table);
      execute row_record.definition;
    end if;
  end loop;

  for row_record in
    select object_name
    from public.migration_035_prestate
    where object_kind = 'index' and existed = false
  loop
    execute format('drop index if exists %s', row_record.object_name);
  end loop;

  for row_record in
    select object_name
    from public.migration_035_prestate
    where object_kind = 'table'
      and existed = false
      and object_name <> 'public.migration_035_prestate'
      and not (object_name = any (kept_tables))
  loop
    execute format('drop table if exists %s cascade', row_record.object_name);
  end loop;

  for row_record in
    select object_name
    from public.migration_035_prestate
    where object_kind = 'constraint' and existed = false
  loop
    if row_record.object_name = 'apprentices_portal_entry_check'
       and to_regclass('public.apprentices') is not null then
      execute 'alter table public.apprentices drop constraint if exists apprentices_portal_entry_check';
    elsif row_record.object_name = 'apprentice_programmes_employer_uuid_fkey'
       and to_regclass('public.apprentice_programmes') is not null then
      execute 'alter table public.apprentice_programmes drop constraint if exists apprentice_programmes_employer_uuid_fkey';
    end if;
  end loop;

  for row_record in
    select object_name
    from public.migration_035_prestate
    where object_kind = 'column' and existed = false
  loop
    if row_record.object_name = 'public.apprentices.portal_entry'
       and to_regclass('public.apprentices') is not null then
      execute 'alter table public.apprentices drop column if exists portal_entry';
    elsif row_record.object_name = 'public.apprentice_programmes.employer_uuid'
       and to_regclass('public.apprentice_programmes') is not null then
      execute 'alter table public.apprentice_programmes drop column if exists employer_uuid';
    end if;
  end loop;

  for row_record in
    select object_name, definition, existed
    from public.migration_035_prestate
    where object_kind = 'comment'
  loop
    if row_record.object_name = 'table:public.review_apprentice_details'
       and to_regclass('public.review_apprentice_details') is not null then
      execute format(
        'comment on table public.review_apprentice_details is %L',
        row_record.definition
      );
    end if;
  end loop;

  for row_record in
    select object_name, definition, existed
    from public.migration_035_prestate
    where object_kind = 'column' and existed = true
  loop
    if row_record.object_name = 'public.apprentices.portal_entry' then
      execute format('comment on column public.apprentices.portal_entry is %L', row_record.definition);
    elsif row_record.object_name = 'public.apprentice_programmes.employer_uuid' then
      execute format(
        'comment on column public.apprentice_programmes.employer_uuid is %L',
        row_record.definition
      );
    end if;
  end loop;

  for row_record in
    select object_name, definition
    from public.migration_035_prestate
    where object_kind = 'rls' and existed = true and definition is not null
  loop
    if to_regclass(row_record.object_name) is null then
      continue;
    end if;
    rls_parts := string_to_array(row_record.definition, ',');
    if rls_parts[1] = 'true' then
      execute format('alter table %s enable row level security', row_record.object_name);
    else
      execute format('alter table %s disable row level security', row_record.object_name);
    end if;
    if rls_parts[2] = 'true' then
      execute format('alter table %s force row level security', row_record.object_name);
    else
      execute format('alter table %s no force row level security', row_record.object_name);
    end if;
  end loop;

  for row_record in
    select object_name, definition
    from public.migration_035_prestate
    where object_kind = 'acl' and existed = true
  loop
    if to_regclass(row_record.object_name) is null then
      continue;
    end if;
    if row_record.definition is null then
      execute format('update pg_class set relacl = null where oid = %L::regclass', row_record.object_name);
    else
      execute format(
        'update pg_class set relacl = %L::aclitem[] where oid = %L::regclass',
        row_record.definition,
        row_record.object_name
      );
    end if;
  end loop;

  drop table public.migration_035_prestate;
end $$;
