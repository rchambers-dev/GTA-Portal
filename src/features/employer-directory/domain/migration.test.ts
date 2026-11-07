import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve("supabase/migrations/035_employer_directory_and_review_learners.sql"),
  "utf8",
);

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
    const countAt = rollback.indexOf("select count(*) into detail_count");
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
  });
});
