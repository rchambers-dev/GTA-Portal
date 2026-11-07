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
});
