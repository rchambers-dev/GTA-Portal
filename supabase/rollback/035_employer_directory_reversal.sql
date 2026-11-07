-- NOT a migration. Do not place this file in supabase/migrations.
-- Do not run it against the live database until 035_go_no_go.sql has been
-- read and a backup taken outside this repository has been restored to a
-- scratch database. This file does not prove that backup.
--
-- Write control: SHARE ROW EXCLUSIVE is taken on every affected table that
-- exists before any count. Inserts, updates, and deletes wait. Readers do not.
--
-- Undo reads public.migration_035_prestate. An object recorded existed=false
-- is dropped. An object recorded existed=true is put back with ordinary DDL:
-- CREATE OR REPLACE FUNCTION, CREATE TRIGGER, ALTER TABLE ... ENABLE or
-- DISABLE TRIGGER, COMMENT ON, ALTER TABLE row-security statements, and
-- GRANT or REVOKE. This script does not update pg_class, pg_proc, or any
-- other system catalog, and it does not grant superuser. Access lists that
-- were left unchanged are left untouched. A changed list is rebuilt with
-- GRANT and REVOKE. If that cannot reproduce the captured list, the
-- transaction raises and rolls back. public.apprentices, public.employers,
-- and public.apprentice_programmes are never dropped. The prestate table is
-- dropped only at the end, because this migration created it.

-- Same execution gate as migration 035. No BEGIN/COMMIT in this file.
-- Run it only as one transaction. Do not write supabase_migrations by hand.
select set_config('lock_timeout', '4s', true);
select set_config('statement_timeout', '120s', true);

do $$
declare
  super_now boolean;
  super_session boolean;
begin
  select rolsuper into super_now from pg_roles where rolname = current_user;
  select rolsuper into super_session from pg_roles where rolname = session_user;
  if coalesce(super_now, true) or coalesce(super_session, true) then
    raise exception
      'Refusing reversal 035. current_user=% (rolsuper=%) session_user=% (rolsuper=%) must both be non-superuser.',
      current_user, super_now, session_user, super_session;
  end if;
  if to_regclass('public.apprentices') is null
     or to_regclass('public.employers') is null
     or to_regclass('public.apprentice_programmes') is null then
    raise exception 'Refusing reversal 035. The three base registers must exist.';
  end if;
  if pg_get_userbyid((select relowner from pg_class where oid = 'public.apprentices'::regclass))
       is distinct from current_user
     or pg_get_userbyid((select relowner from pg_class where oid = 'public.employers'::regclass))
       is distinct from current_user
     or pg_get_userbyid((select relowner from pg_class where oid = 'public.apprentice_programmes'::regclass))
       is distinct from current_user
  then
    raise exception
      'Refusing reversal 035. current_user % does not own the three base registers.',
      current_user;
  end if;
  if not has_schema_privilege(current_user, 'public', 'CREATE') then
    raise exception 'Refusing reversal 035. current_user % lacks CREATE on schema public.', current_user;
  end if;
end $$;

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
  enabled_state text;
  trigger_comment text;
  current_acl text;
  grant_row record;
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

  if exists (
    select 1
    from public.migration_035_prestate state
    where state.object_kind = 'trigger'
      and state.existed
      and not exists (
        select 1 from public.migration_035_prestate enabled
        where enabled.object_kind = 'trigger_enabled'
          and enabled.object_name = state.object_name
      )
  ) or exists (
    select 1
    from public.migration_035_prestate enabled
    where enabled.object_kind = 'trigger_enabled'
      and enabled.existed
      and coalesce(enabled.definition, '') not in ('O', 'D', 'R', 'A')
  ) then
    raise exception
      'Refusing reversal before any change. A trigger enabled state is missing or is not O, D, R, or A, so ALTER TABLE cannot restore it.';
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
    if to_regprocedure(row_record.object_name) is null then
      continue;
    end if;
    select p.proacl::text into current_acl
    from pg_proc p
    where p.oid = to_regprocedure(row_record.object_name);
    if current_acl is not distinct from row_record.definition then
      continue;
    end if;
    if row_record.definition is null then
      raise exception
        'Refusing reversal. % has no captured grant list, and GRANT/REVOKE cannot recreate a default function access list. No system catalog will be updated.',
        row_record.object_name;
    end if;
    execute format('revoke all on function %s from public', row_record.object_name);
    for grant_row in
      select distinct case
        when exploded.grantee = 0 then 'public'
        else quote_ident(pg_get_userbyid(exploded.grantee))
      end as who
      from aclexplode((
        select p.proacl from pg_proc p where p.oid = to_regprocedure(row_record.object_name)
      )) as exploded
    loop
      execute format('revoke all on function %s from %s', row_record.object_name, grant_row.who);
    end loop;
    for grant_row in
      select exploded.privilege_type,
             exploded.is_grantable,
             case
               when exploded.grantee = 0 then 'public'
               else quote_ident(pg_get_userbyid(exploded.grantee))
             end as who
      from aclexplode(row_record.definition::aclitem[]) as exploded
    loop
      execute format(
        'grant %s on function %s to %s%s',
        grant_row.privilege_type,
        row_record.object_name,
        grant_row.who,
        case when grant_row.is_grantable then ' with grant option' else '' end
      );
    end loop;
    select p.proacl::text into current_acl
    from pg_proc p
    where p.oid = to_regprocedure(row_record.object_name);
    if current_acl is distinct from row_record.definition then
      raise exception
        'Refusing reversal. GRANT/REVOKE did not restore the function access list for %.',
        row_record.object_name;
    end if;
  end loop;

  for row_record in
    select object_name, definition
    from public.migration_035_prestate
    where object_kind = 'trigger' and existed = true and definition is not null
  loop
    trg_name := split_part(row_record.object_name, '|', 1);
    trg_table := split_part(row_record.object_name, '|', 2);
    if to_regclass(trg_table) is null then
      continue;
    end if;
    select state.definition into enabled_state
    from public.migration_035_prestate state
    where state.object_kind = 'trigger_enabled'
      and state.object_name = row_record.object_name;
    select state.definition into trigger_comment
    from public.migration_035_prestate state
    where state.object_kind = 'trigger_comment'
      and state.object_name = row_record.object_name;
    execute format('drop trigger if exists %I on %s', trg_name, trg_table);
    execute row_record.definition;
    if enabled_state = 'D' then
      execute format('alter table %s disable trigger %I', trg_table, trg_name);
    elsif enabled_state = 'R' then
      execute format('alter table %s enable replica trigger %I', trg_table, trg_name);
    elsif enabled_state = 'A' then
      execute format('alter table %s enable always trigger %I', trg_table, trg_name);
    else
      execute format('alter table %s enable trigger %I', trg_table, trg_name);
    end if;
    execute format(
      'comment on trigger %I on %s is %L',
      trg_name,
      trg_table,
      trigger_comment
    );
  end loop;

  for row_record in
    select object_name
    from public.migration_035_prestate
    where object_kind = 'index' and existed = false
  loop
    execute format('drop index if exists %s', row_record.object_name);
  end loop;

  -- Child tables first. No CASCADE: a later foreign key or view aborts the transaction.
  for row_record in
    select drop_name as object_name
    from unnest(array[
      'public.review_apprentice_details',
      'public.employer_manager_roles',
      'public.employer_site_memberships',
      'public.employer_managers',
      'public.employer_sites'
    ]) as drop_name
    join public.migration_035_prestate state
      on state.object_kind = 'table'
     and state.object_name = drop_name
     and state.existed = false
    where not (drop_name = any (kept_tables))
  loop
    execute format('drop table if exists %s', row_record.object_name);
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
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'apprentice_programmes'
          and column_name = 'employer_uuid'
      ) and exists (
        select 1 from public.apprentice_programmes where employer_uuid is not null
      ) then
        raise exception
          'Refusing reversal. apprentice_programmes.employer_uuid has values, so the column added by migration 035 will not be dropped.';
      end if;
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
    select c.relacl::text into current_acl
    from pg_class c
    where c.oid = to_regclass(row_record.object_name);
    if current_acl is not distinct from row_record.definition then
      continue;
    end if;
    if row_record.definition is null then
      raise exception
        'Refusing reversal. % has no captured grant list, and GRANT/REVOKE cannot recreate a default table access list. No system catalog will be updated.',
        row_record.object_name;
    end if;
    execute format('revoke all privileges on table %s from public', row_record.object_name);
    for grant_row in
      select distinct case
        when exploded.grantee = 0 then 'public'
        else quote_ident(pg_get_userbyid(exploded.grantee))
      end as who
      from aclexplode((
        select c.relacl from pg_class c where c.oid = to_regclass(row_record.object_name)
      )) as exploded
    loop
      execute format(
        'revoke all privileges on table %s from %s',
        row_record.object_name,
        grant_row.who
      );
    end loop;
    for grant_row in
      select exploded.privilege_type,
             exploded.is_grantable,
             case
               when exploded.grantee = 0 then 'public'
               else quote_ident(pg_get_userbyid(exploded.grantee))
             end as who
      from aclexplode(row_record.definition::aclitem[]) as exploded
    loop
      execute format(
        'grant %s on table %s to %s%s',
        grant_row.privilege_type,
        row_record.object_name,
        grant_row.who,
        case when grant_row.is_grantable then ' with grant option' else '' end
      );
    end loop;
    select c.relacl::text into current_acl
    from pg_class c
    where c.oid = to_regclass(row_record.object_name);
    if current_acl is distinct from row_record.definition then
      raise exception
        'Refusing reversal. GRANT/REVOKE did not restore the table access list for %.',
        row_record.object_name;
    end if;
  end loop;

  drop table public.migration_035_prestate;
end $$;
