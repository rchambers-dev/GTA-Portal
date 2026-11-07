import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve("supabase/migrations/035_employer_directory_and_review_learners.sql"),
  "utf8",
);

const catalogSql = `
select kind, name, detail from (
  select 'table'::text as kind, c.relname as name,
         c.relrowsecurity::text || ',' || c.relforcerowsecurity::text || ',' || coalesce(c.relacl::text, '') as detail
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  union all
  select 'column', table_name || '.' || column_name,
         data_type || '|' || is_nullable || '|' || coalesce(column_default, '')
  from information_schema.columns
  where table_schema = 'public'
  union all
  select 'routine', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         md5(pg_get_functiondef(p.oid)) || '|' || coalesce(p.proacl::text, '')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  union all
  select 'trigger', c.relname || '.' || t.tgname,
         pg_get_triggerdef(t.oid) || '|enabled=' || t.tgenabled::text
           || '|comment=' || coalesce(obj_description(t.oid, 'pg_trigger'), '')
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  where not t.tgisinternal and c.relnamespace = 'public'::regnamespace
  union all
  select 'index', c.relname, pg_get_indexdef(c.oid)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'i'
  union all
  select 'constraint', conname, pg_get_constraintdef(oid)
  from pg_constraint
  where connamespace = 'public'::regnamespace
) catalog
order by 1, 2, 3
`;

async function catalog(db: PGlite): Promise<string> {
  const rows = await db.query<{ kind: string; name: string; detail: string }>(catalogSql);
  return JSON.stringify(rows.rows);
}

async function baseDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists public;
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
    end $$;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create table public.employers (
      id uuid primary key default gen_random_uuid(),
      name text not null
    );
    create table public.apprentices (
      id uuid primary key default gen_random_uuid(),
      display_name text not null,
      apprentice_reference text not null unique
    );
    create table public.apprentice_programmes (id uuid primary key default gen_random_uuid());
  `);
  return db;
}

async function database(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create schema if not exists public;
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated;
      end if;
    end $$;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create table public.employers (
      id uuid primary key default gen_random_uuid(),
      name text not null
    );
    create table public.apprentices (
      id uuid primary key default gen_random_uuid(),
      display_name text not null,
      apprentice_reference text not null unique
    );
    create table public.apprentice_programmes (id uuid primary key default gen_random_uuid());
  `);
  await db.exec(migration);
  return db;
}

describe("canonical directory migration", () => {
  it("shares one site between two employers and extends an apprentice instead of a second person", async () => {
    const db = await database();
    const alpha = await db.query<{ id: string }>(
      "insert into public.employers (name) values ('Alpha Ltd') returning id",
    );
    const beta = await db.query<{ id: string }>(
      "insert into public.employers (name) values ('Beta Ltd') returning id",
    );
    const yard = await db.query<{ id: string }>(
      "insert into public.employer_sites (label) values ('Shared yard') returning id",
    );
    const depot = await db.query<{ id: string }>(
      "insert into public.employer_sites (label) values ('Alpha depot') returning id",
    );
    await db.query(
      "insert into public.employer_site_memberships (employer_id, site_id) values ($1, $2), ($3, $2), ($1, $4)",
      [alpha.rows[0].id, yard.rows[0].id, beta.rows[0].id, depot.rows[0].id],
    );
    const person = await db.query<{ id: string }>(
      `insert into public.apprentices (display_name, apprentice_reference, portal_entry)
       values ('Casey Learner', 'GTA-2026-01001', 'reviews') returning id`,
    );
    await db.query(
      `insert into public.review_apprentice_details (apprentice_id, source_company_name)
       values ($1, 'Recorded company')`,
      [person.rows[0].id],
    );
    const companies = await db.query(
      "select employer_id from public.employer_site_memberships where site_id = $1",
      [yard.rows[0].id],
    );
    expect(companies.rows).toHaveLength(2);
    const detail = await db.query<{ employer_id: string | null; source_company_name: string }>(
      "select employer_id, source_company_name from public.review_apprentice_details",
    );
    expect(detail.rows[0].employer_id).toBeNull();
    expect(detail.rows[0].source_company_name).toBe("Recorded company");
    await expect(
      db.query(
        `update public.review_apprentice_details
         set employer_id = $1, site_id = $2, version = 2
         where apprentice_id = $3 and version = 1`,
        [beta.rows[0].id, depot.rows[0].id, person.rows[0].id],
      ),
    ).rejects.toThrow(/not linked to the selected employer/i);
    const tables = await db.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public'
         and tablename in ('review_learners', 'employer_companies')`,
    );
    expect(tables.rows).toEqual([]);
  });

  it("rolls a failed review create back and rejects a stale name change", async () => {
    const db = await database();
    await expect(
      db.query(
        `select public.create_review_apprentice($1::jsonb)`,
        [JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          display_name: "Broken Entry",
          apprentice_reference: "GTA-2026-01999",
          release_day: "Notaday",
        })],
      ),
    ).rejects.toThrow(/release_day/i);
    const people = await db.query("select id from public.apprentices");
    expect(people.rows).toHaveLength(0);

    const person = await db.query<{ id: string }>(
      `insert into public.apprentices (display_name, apprentice_reference, portal_entry)
       values ('Casey Learner', 'GTA-2026-01001', 'onboarding') returning id`,
    );
    await db.query(
      `insert into public.review_apprentice_details (apprentice_id, tutor_name)
       values ($1, 'First tutor')`,
      [person.rows[0].id],
    );
    await expect(
      db.query(
        `select public.apply_review_apprentice_change($1, 1, 'Changed Name', '{"tutor_name":"Second tutor"}'::jsonb)`,
        [person.rows[0].id],
      ),
    ).resolves.toBeTruthy();
    await expect(
      db.query(
        `select public.apply_review_apprentice_change($1, 1, 'Should Not Stick', '{"tutor_name":"Third tutor"}'::jsonb)`,
        [person.rows[0].id],
      ),
    ).rejects.toThrow(/version_conflict/);
    const row = await db.query<{ display_name: string; tutor_name: string; version: number }>(
      `select apprentice.display_name, detail.tutor_name, detail.version
       from public.apprentices apprentice
       join public.review_apprentice_details detail on detail.apprentice_id = apprentice.id`,
    );
    expect(row.rows[0]).toMatchObject({
      display_name: "Changed Name",
      tutor_name: "Second tutor",
      version: 2,
    });
  });

  it("refuses to remove a company-site link that an apprentice or manager still uses", async () => {
    const db = await database();
    const employer = await db.query<{ id: string }>(
      "insert into public.employers (name) values ('Alpha Ltd') returning id",
    );
    const site = await db.query<{ id: string }>(
      "insert into public.employer_sites (label) values ('Yard') returning id",
    );
    await db.query(
      "insert into public.employer_site_memberships (employer_id, site_id) values ($1, $2)",
      [employer.rows[0].id, site.rows[0].id],
    );
    const manager = await db.query<{ id: string }>(
      "insert into public.employer_managers (full_name) values ('Alex Manager') returning id",
    );
    await db.query(
      `insert into public.employer_manager_roles (manager_id, employer_id, site_id)
       values ($1, $2, $3)`,
      [manager.rows[0].id, employer.rows[0].id, site.rows[0].id],
    );
    await expect(
      db.query(
        "delete from public.employer_site_memberships where employer_id = $1 and site_id = $2",
        [employer.rows[0].id, site.rows[0].id],
      ),
    ).rejects.toThrow(/manager responsibility/i);
    const guard = await db.query<{ def: string }>(
      "select pg_get_functiondef('public.employer_manager_role_site_guard()'::regprocedure) as def",
    );
    expect(guard.rows[0].def.toLowerCase()).toContain("for key share");
  });

  it("refuses reversal while reviews rows exist and does not drop a pre-existing touch function or employer_uuid", async () => {
    const db = new PGlite();
    await db.exec(`
      create function public.touch_updated_at()
      returns trigger language plpgsql as $fn$
      begin
        new.updated_at = now();
        return new;
      end;
      $fn$;
      comment on function public.touch_updated_at() is 'preexisting';
      create table public.employers (id uuid primary key default gen_random_uuid(), name text not null);
      create table public.apprentices (
        id uuid primary key default gen_random_uuid(),
        display_name text not null,
        apprentice_reference text not null unique
      );
      create table public.apprentice_programmes (
        id uuid primary key default gen_random_uuid(),
        employer_uuid uuid
      );
    `);
    const beforeAcl = await db.query<{ acl: string | null }>(
      `select c.relacl::text as acl
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'apprentices'`,
    );
    const beforeTouch = await db.query<{ def: string }>(
      `select pg_get_functiondef('public.touch_updated_at()'::regprocedure) as def`,
    );
    await db.exec(migration);
    const comment = await db.query<{ comment: string | null }>(
      `select obj_description('public.touch_updated_at()'::regprocedure, 'pg_proc') as comment`,
    );
    expect(comment.rows[0].comment).toBe("preexisting");
    await db.query(
      `insert into public.apprentices (display_name, apprentice_reference, portal_entry)
       values ('Casey Learner', 'GTA-2026-01001', 'reviews')`,
    );
    const rollback = readFileSync(
      path.resolve("supabase/rollback/035_employer_directory_reversal.sql"),
      "utf8",
    );
    await expect(db.exec(rollback)).rejects.toThrow(/Refusing reversal/);
    await db.query(`delete from public.apprentices`);
    await db.exec(rollback);
    const portalEntry = await db.query(
      `select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'apprentices' and column_name = 'portal_entry'`,
    );
    expect(portalEntry.rows).toHaveLength(0);
    const employerUuid = await db.query(
      `select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'apprentice_programmes' and column_name = 'employer_uuid'`,
    );
    expect(employerUuid.rows).toHaveLength(1);
    const touch = await db.query<{ comment: string | null }>(
      `select obj_description('public.touch_updated_at()'::regprocedure, 'pg_proc') as comment`,
    );
    expect(touch.rows[0].comment).toBe("preexisting");
    const afterTouch = await db.query<{ def: string }>(
      `select pg_get_functiondef('public.touch_updated_at()'::regprocedure) as def`,
    );
    expect(afterTouch.rows[0].def).toBe(beforeTouch.rows[0].def);
    const afterAcl = await db.query<{ acl: string | null }>(
      `select c.relacl::text as acl
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'apprentices'`,
    );
    expect(afterAcl.rows[0].acl).toBe(beforeAcl.rows[0].acl);
    const fkey = await db.query(
      `select 1 from pg_constraint where conname = 'apprentice_programmes_employer_uuid_fkey'`,
    );
    expect(fkey.rows).toHaveLength(0);
    const prestate = await db.query(
      `select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'migration_035_prestate'`,
    );
    expect(prestate.rows).toHaveLength(0);
  });

  it("blocks a direct rename when review details exist and keeps the shared version", async () => {
    const db = await database();
    const person = await db.query<{ id: string }>(
      `insert into public.apprentices (display_name, apprentice_reference, portal_entry)
       values ('Casey Learner', 'GTA-2026-01001', 'onboarding') returning id`,
    );
    await db.query(
      `insert into public.review_apprentice_details (apprentice_id) values ($1)`,
      [person.rows[0].id],
    );
    await expect(
      db.query(`update public.apprentices set display_name = 'Direct Rename' where id = $1`, [
        person.rows[0].id,
      ]),
    ).rejects.toThrow(/version_conflict/);
    const renamed = await db.query<{ rename_apprentice: number }>(
      `select public.rename_apprentice($1, 'Versioned Rename', 1) as rename_apprentice`,
      [person.rows[0].id],
    );
    expect(renamed.rows[0].rename_apprentice).toBe(2);
    await expect(
      db.query(`select public.rename_apprentice($1, 'Stale Rename', 1)`, [person.rows[0].id]),
    ).rejects.toThrow(/version_conflict/);
    const kept = await db.query<{ display_name: string; version: number }>(
      `select apprentice.display_name, detail.version
       from public.apprentices apprentice
       join public.review_apprentice_details detail on detail.apprentice_id = apprentice.id
       where apprentice.id = $1`,
      [person.rows[0].id],
    );
    expect(kept.rows[0]).toEqual({ display_name: "Versioned Rename", version: 2 });

    const plain = await db.query<{ id: string }>(
      `insert into public.apprentices (display_name, apprentice_reference)
       values ('Plain Intake', 'GTA-2026-01002') returning id`,
    );
    await db.query(`update public.apprentices set display_name = 'Intake Edit' where id = $1`, [
      plain.rows[0].id,
    ]);
    await db.query(`select public.rename_apprentice($1, 'Intake Rename', null)`, [plain.rows[0].id]);
    const plainName = await db.query<{ display_name: string }>(
      `select display_name from public.apprentices where id = $1`,
      [plain.rows[0].id],
    );
    expect(plainName.rows[0].display_name).toBe("Intake Rename");
  });

  it("locks before counting in reversal and reports that no live backup was checked", async () => {
    const rollback = readFileSync(
      path.resolve("supabase/rollback/035_employer_directory_reversal.sql"),
      "utf8",
    );
    const lockAt = rollback.indexOf("lock table public.apprentices");
    const countAt = rollback.indexOf("select count(*) from public.review_apprentice_details");
    expect(lockAt).toBeGreaterThan(-1);
    expect(countAt).toBeGreaterThan(lockAt);
    const db = await database();
    const checklist = readFileSync(
      path.resolve("supabase/rollback/035_go_no_go.sql"),
      "utf8",
    );
    const checks = await db.query<{ check_name: string; observed: string; decision: string }>(
      checklist,
    );
    expect(checks.rows).toContainEqual(
      expect.objectContaining({
        check_name: "live_backup_verified",
        observed: "not_verified_by_this_script",
        decision: "no-go",
      }),
    );
    await db.exec(`
      do $$
      begin
        lock table public.review_apprentice_details in share row exclusive mode;
        if not exists (
          select 1 from pg_locks
          where relation = 'public.review_apprentice_details'::regclass
            and mode = 'ShareRowExclusiveLock'
        ) then
          raise exception 'write lock was not held';
        end if;
      end $$;
    `);
    const protectedTable = await db.query<{ secured: boolean; anon_select: boolean }>(`
      select c.relrowsecurity as secured,
             has_table_privilege('anon', 'public.migration_035_prestate', 'select') as anon_select
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'migration_035_prestate'
    `);
    expect(protectedTable.rows[0]).toEqual({ secured: true, anon_select: false });
    await expect(
      db.exec(`
        begin;
        set local role anon;
        select * from public.migration_035_prestate;
        rollback;
      `),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });

  it("runs the read-only checklist on an unmigrated database and after apply", async () => {
    const checklist = readFileSync(
      path.resolve("supabase/rollback/035_go_no_go.sql"),
      "utf8",
    );
    const empty = new PGlite();
    await empty.exec("create schema if not exists public");
    const before = await empty.query<{ check_name: string; observed: string }>(checklist);
    expect(before.rows.map((row) => row.check_name)).toEqual(
      expect.arrayContaining([
        "live_backup_verified",
        "directory_rows",
        "reviews_entry_apprentices",
        "base_registers",
      ]),
    );
    expect(before.rows.find((row) => row.check_name === "directory_rows")?.observed).toContain(
      "details=absent",
    );
    expect(before.rows.find((row) => row.check_name === "reviews_entry_apprentices")?.observed).toBe(
      "apprentices_absent",
    );
    const applied = await database();
    const after = await applied.query<{ check_name: string; observed: string }>(checklist);
    expect(after.rows.find((row) => row.check_name === "directory_rows")?.observed).toContain(
      "details=0",
    );
    expect(after.rows.find((row) => row.check_name === "reviews_entry_apprentices")?.observed).toBe(
      "0",
    );
    expect(after.rows.find((row) => row.check_name === "prestate_captured")?.observed).toBe(
      "present",
    );
  });

  it("restores an empty database catalog and a database that already had objects", async () => {
    const rollback = readFileSync(
      path.resolve("supabase/rollback/035_employer_directory_reversal.sql"),
      "utf8",
    );
    const fresh = await baseDatabase();
    const beforeFresh = await catalog(fresh);
    await fresh.exec(migration);
    await fresh.exec(rollback);
    expect(await catalog(fresh)).toBe(beforeFresh);

    const prior = await baseDatabase();
    await prior.exec(`
      create function public.touch_updated_at()
      returns trigger language plpgsql as $fn$
      begin
        new.updated_at = now();
        return new;
      end;
      $fn$;
      comment on function public.touch_updated_at() is 'preexisting-marker';
      alter table public.apprentice_programmes add column employer_uuid uuid;
      comment on column public.apprentice_programmes.employer_uuid is 'already here';
      create table public.employer_sites (
        id uuid primary key default gen_random_uuid(),
        legacy_marker text not null default 'keep'
      );
      create function public.employer_manager_role_site_guard()
      returns trigger language plpgsql as $fn$
      begin
        return new;
      end;
      $fn$;
      create function public.apprentice_display_name_version_guard()
      returns trigger language plpgsql as $fn$
      begin
        return new;
      end;
      $fn$;
      create trigger apprentice_display_name_version_guard
      before update of display_name on public.apprentices
      for each row execute function public.apprentice_display_name_version_guard();
      alter table public.apprentices disable trigger apprentice_display_name_version_guard;
      comment on trigger apprentice_display_name_version_guard
        on public.apprentices is 'disabled on purpose';
      grant select on public.apprentices to anon;
    `);
    const beforePrior = await catalog(prior);
    await prior.exec(migration);
    await prior.exec(rollback);
    expect(await catalog(prior)).toBe(beforePrior);
  });
});

const pgBin = "/usr/lib/postgresql/16/bin";

describe("migration 035 on PostgreSQL 16", () => {
  it("matches the catalog after apply and reverse on a real server", () => {
    let dataDir = "";
    try {
      dataDir = mkdtempSync(path.join(tmpdir(), "gta-pg-"));
      execFileSync(`${pgBin}/initdb`, ["-D", dataDir, "-U", "postgres", "--auth=trust"], {
        stdio: "ignore",
      });
      execFileSync(
        `${pgBin}/pg_ctl`,
        ["-D", dataDir, "-o", `-p 5434 -k ${dataDir}`, "-l", path.join(dataDir, "server.log"), "start"],
        { stdio: "ignore" },
      );
      const psql = (sql: string) =>
        execFileSync(
          "psql",
          ["-h", dataDir, "-p", "5434", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
          { encoding: "utf8" },
        );
      const reversal = readFileSync(
        path.resolve("supabase/rollback/035_employer_directory_reversal.sql"),
        "utf8",
      );
      expect(reversal).not.toMatch(/^\s*update\s+pg_(class|proc)\b/im);
      psql(`
        create role migration_owner nosuperuser nocreatedb nocreaterole login;
        create role staff_reader nosuperuser nocreatedb nocreaterole;
        grant usage, create on schema public to migration_owner;
      `);
      const asOwner = (sql: string) =>
        psql(`
          set role migration_owner;
          do $$
          begin
            if (select rolsuper from pg_roles where rolname = current_user) then
              raise exception 'migration executor is superuser';
            end if;
          end $$;
          ${sql}
        `);
      asOwner(`
        create table public.employers (id uuid primary key default gen_random_uuid(), name text not null);
        create table public.apprentices (
          id uuid primary key default gen_random_uuid(),
          display_name text not null,
          apprentice_reference text not null unique
        );
        create table public.apprentice_programmes (id uuid primary key default gen_random_uuid());
        create function public.touch_updated_at()
        returns trigger language plpgsql as $fn$
        begin
          new.updated_at = now();
          return new;
        end;
        $fn$;
        create function public.apprentice_display_name_version_guard()
        returns trigger language plpgsql as $fn$
        begin
          return new;
        end;
        $fn$;
        create trigger apprentice_display_name_version_guard
        before update of display_name on public.apprentices
        for each row execute function public.apprentice_display_name_version_guard();
        alter table public.apprentices disable trigger apprentice_display_name_version_guard;
        comment on trigger apprentice_display_name_version_guard
          on public.apprentices is 'disabled on purpose';
        grant select on table public.apprentices to staff_reader;
      `);
      const before = psql(catalogSql);
      asOwner(migration);
      asOwner(readFileSync(path.resolve("supabase/rollback/035_go_no_go.sql"), "utf8"));
      asOwner(reversal);
      expect(psql(catalogSql)).toBe(before);
    } finally {
      if (dataDir) {
        try {
          execFileSync(`${pgBin}/pg_ctl`, ["-D", dataDir, "stop", "-m", "immediate"], { stdio: "ignore" });
        } catch {
          // The server may not have started.
        }
        rmSync(dataDir, { recursive: true, force: true });
      }
    }
  });
});
