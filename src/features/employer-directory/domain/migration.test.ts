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
    create table public.employers (id uuid primary key default gen_random_uuid());
    create table public.apprentice_programmes (id uuid primary key default gen_random_uuid());
  `);
  await db.exec(migration);
  return db;
}

describe("employer directory migration", () => {
  it("stores two companies at one site, one company at two sites, and several managers", async () => {
    const db = await database();
    const alpha = await db.query<{ id: string }>(
      "insert into public.employer_companies (name) values ('Alpha Ltd') returning id",
    );
    const beta = await db.query<{ id: string }>(
      "insert into public.employer_companies (name) values ('Beta Ltd') returning id",
    );
    const yard = await db.query<{ id: string }>(
      "insert into public.employer_sites (label) values ('Shared yard') returning id",
    );
    const depot = await db.query<{ id: string }>(
      "insert into public.employer_sites (label) values ('Alpha depot') returning id",
    );
    const alphaId = alpha.rows[0].id;
    const betaId = beta.rows[0].id;
    const yardId = yard.rows[0].id;
    const depotId = depot.rows[0].id;
    await db.query(
      "insert into public.employer_company_sites (company_id, site_id) values ($1, $2), ($3, $2), ($1, $4)",
      [alphaId, yardId, betaId, depotId],
    );
    const managerA = await db.query<{ id: string }>(
      "insert into public.employer_managers (full_name) values ('Alex Manager') returning id",
    );
    const managerB = await db.query<{ id: string }>(
      "insert into public.employer_managers (full_name) values ('Blair Manager') returning id",
    );
    await db.query(
      `insert into public.employer_manager_roles (manager_id, company_id, site_id, responsibility)
       values ($1, $2, $3, 'Yard'), ($4, $2, null, 'Company')`,
      [managerA.rows[0].id, alphaId, yardId, managerB.rows[0].id],
    );

    const companiesAtYard = await db.query(
      "select company_id from public.employer_company_sites where site_id = $1 order by company_id",
      [yardId],
    );
    expect(companiesAtYard.rows).toHaveLength(2);
    const alphaSites = await db.query(
      "select site_id from public.employer_company_sites where company_id = $1",
      [alphaId],
    );
    expect(alphaSites.rows).toHaveLength(2);
    const alphaRoles = await db.query(
      "select id, site_id from public.employer_manager_roles where company_id = $1",
      [alphaId],
    );
    expect(alphaRoles.rows).toHaveLength(2);

    const learner = await db.query<{ id: string }>(
      "insert into public.review_learners (portal_reference, full_name) values ('GTA-2026-01001', 'Casey Learner') returning id",
    );
    expect(learner.rows[0].id).toBeTruthy();
    const stored = await db.query<{
      company_id: string | null;
      source_company_name: string;
    }>("select company_id, source_company_name from public.review_learners");
    expect(stored.rows[0].company_id).toBeNull();
    expect(stored.rows[0].source_company_name).toBe("");

    await expect(
      db.query(
        `insert into public.employer_manager_roles (manager_id, company_id, site_id)
         values ($1, $2, $3)`,
        [managerA.rows[0].id, betaId, depotId],
      ),
    ).rejects.toThrow(/not linked to that company/i);

    await expect(
      db.query(
        `update public.review_learners
         set company_id = $1, site_id = $2
         where id = $3`,
        [betaId, depotId, learner.rows[0].id],
      ),
    ).rejects.toThrow(/not linked to the selected company/i);
  });

  it("does not grant the new tables to anonymous or authenticated roles", async () => {
    const db = await database();
    const grants = await db.query<{ grantee: string; table_name: string }>(
      `select grantee, table_name
       from information_schema.role_table_grants
       where table_schema = 'public'
         and grantee in ('anon', 'authenticated')
         and table_name in (
           'employer_companies',
           'employer_sites',
           'employer_company_sites',
           'employer_managers',
           'employer_manager_roles',
           'review_learners'
         )`,
    );
    expect(grants.rows).toEqual([]);
  });
});
