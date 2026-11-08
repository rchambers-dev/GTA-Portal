import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, expect, it } from "vitest";
import { Client } from "pg";
import { emptyPageAccessConfig } from "@/features/staff-page-access/model";
import { PageAccessConflict, loadPageAccessRecord, savePageAccessConfig } from "@/features/staff-page-access/store";
import { getReviewRepository } from "./repository";

const PASSWORD = "review-contract-local-only";
const PROFILE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DATABASE = "review_contract_disposable";
const BUCKET_DATABASE = "review_contract_buckets";
const migrationDir = path.join(process.cwd(), "supabase/migrations");
const structureFile = path.join(migrationDir, "035_review_assistant_store.sql");
const portalFile = path.join(migrationDir, "036_review_assistant_portal.sql");
const structureRollback = path.join(migrationDir, "035_review_assistant_store_rollback.sql");
const portalRollback = path.join(migrationDir, "036_review_assistant_portal_rollback.sql");

function psql(database: string, args: string[]) {
  return execFileSync("sudo", ["-n", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", database, ...args], {
    encoding: "utf8",
  });
}

function psqlCommand(database: string, sql: string) {
  return psql(database, ["-c", sql]);
}

function applyMigration(database: string, file: string) {
  return psql(database, ["-1", "-f", file]);
}

function commandFailure(database: string, args: string[]) {
  try {
    psql(database, args);
    return "";
  } catch (error) {
    const failed = error as { stderr?: Buffer | string; message?: string };
    return `${failed.stderr?.toString() || ""} ${failed.message || ""}`;
  }
}

function adminUrl(database: string) {
  return `postgres://review_contract_owner:${encodeURIComponent(PASSWORD)}@127.0.0.1:5432/${database}`;
}

function serviceUrl(database: string) {
  return `postgres://service_role:${encodeURIComponent(PASSWORD)}@127.0.0.1:5432/${database}`;
}

async function query(connectionString: string, sql: string, params: unknown[] = []) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

function stubSql() {
  return `
    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key,
      name text,
      public boolean,
      file_size_limit bigint
    );
    create table if not exists storage.objects (
      id text primary key,
      bucket_id text,
      name text
    );
    create table if not exists public.profiles (id uuid primary key);
    create table if not exists public.apprentices (id uuid primary key);
    grant select on public.profiles, public.apprentices to service_role;
    insert into public.profiles (id) values ('${PROFILE_ID}') on conflict (id) do nothing;
  `;
}

afterAll(() => {
  for (const database of [DATABASE, BUCKET_DATABASE]) {
    try {
      psqlCommand("postgres", `drop database if exists ${database} with (force)`);
    } catch {
      // The local cluster may already be clean.
    }
  }
});

it("proves the public service-role wrapper on a disposable database", async () => {
  psqlCommand(
    "postgres",
    `
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role login password '${PASSWORD}' bypassrls;
      else
        alter role service_role login password '${PASSWORD}' bypassrls;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'review_contract_owner') then
        create role review_contract_owner login superuser password '${PASSWORD}';
      else
        alter role review_contract_owner login superuser password '${PASSWORD}';
      end if;
    end $$;
    `,
  );
  psqlCommand("postgres", `drop database if exists ${DATABASE} with (force)`);
  psqlCommand("postgres", `drop database if exists ${BUCKET_DATABASE} with (force)`);
  psqlCommand("postgres", `create database ${DATABASE}`);
  psqlCommand("postgres", `create database ${BUCKET_DATABASE}`);
  psqlCommand(DATABASE, stubSql());
  applyMigration(DATABASE, structureFile);
  applyMigration(DATABASE, portalFile);

  const service = serviceUrl(DATABASE);
  const admin = adminUrl(DATABASE);
  const previousDatabase = process.env.REVIEW_DATABASE_URL;
  const previousStore = process.env.STAFF_PAGE_ACCESS_STORE;
  process.env.REVIEW_DATABASE_URL = service;
  process.env.STAFF_PAGE_ACCESS_STORE = "postgres";
  try {
    const anon = new Client({ connectionString: admin });
    await anon.connect();
    try {
      await anon.query("begin");
      await anon.query("set local role anon");
      await expect(
        anon.query("select public.save_app_state_if_version(1, '{\"version\":2}'::jsonb, null)"),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await anon.query("rollback");
      await anon.end();
    }

    await expect(
      query(service, "select reviews_private.record_app_state_history(null, 1, '{}'::jsonb)"),
    ).rejects.toMatchObject({ code: "42501" });

    const repo = getReviewRepository();
    expect(repo.kind).toBe("postgres");
    await expect(repo.saveDocument({ learners: [{ id: PROFILE_ID, name: "Example" }] }, 1, "not-a-uuid")).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      repo.saveDocument({ learners: [{ id: PROFILE_ID, name: "Example" }] }, 1, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
    ).rejects.toMatchObject({ status: 400 });

    const first = repo.saveDocument({ learners: [{ id: PROFILE_ID, name: "Example Learner" }] }, 1, PROFILE_ID);
    const second = repo.saveDocument({ learners: [{ id: PROFILE_ID, name: "Other Learner" }] }, 1, PROFILE_ID);
    const [saved, raced] = await Promise.all([first, second]);
    expect([saved.status, raced.status].sort()).toEqual([200, 409]);
    const current = await getReviewRepository().readDocument();
    expect(current.version).toBe(2);
    expect(["Example Learner", "Other Learner"]).toContain(current.learners?.[0]?.name);
    const history = await getReviewRepository().documentHistory();
    expect(history.map((entry) => entry.version)).toEqual([2]);
    expect(history[0]?.actorId).toBe(PROFILE_ID);

    const blank = await repo.saveDocument({ learners: [{ id: PROFILE_ID, name: "Unattributed" }] }, 2, "");
    expect(blank.status).toBe(200);
    const attributed = await getReviewRepository().documentHistory();
    expect(attributed.at(-1)?.actorId).toBe("");

    await expect(
      query(service, "select public.save_app_state_if_version(2, '{\"version\":5}'::jsonb, null)"),
    ).rejects.toThrow(/plus one/);

    const winner = emptyPageAccessConfig();
    const pageSaves = await Promise.allSettled([
      savePageAccessConfig(winner, 0, PROFILE_ID),
      savePageAccessConfig(
        { ...winner, bundles: [{ id: "bundle-1", name: "Readers", grants: [], staffIds: [] }] },
        0,
        PROFILE_ID,
      ),
    ]);
    expect(pageSaves.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(pageSaves.filter((item) => item.status === "rejected" && item.reason instanceof PageAccessConflict)).toHaveLength(1);
    expect((await loadPageAccessRecord()).version).toBe(1);

    await query(admin, "alter table public.app_state_history disable trigger user");
    await query(
      admin,
      "insert into public.app_state_history (user_id, version, saved_at, payload) values (null, 1, now() - interval '40 days', '{\"version\":1}'::jsonb)",
    );
    await query(admin, "alter table public.app_state_history enable trigger user");
    await query(admin, "select reviews_private.record_app_state_history(null, 9, '{\"version\":9,\"marker\":\"prune\"}'::jsonb)");
    const pruned = await query(
      admin,
      "select count(*)::int as count from public.app_state_history where saved_at < now() - interval '31 days'",
    );
    expect(Number(pruned.rows[0]?.count)).toBe(0);

    await expect(
      query(
        service,
        "insert into public.review_assistant_attachments (id, portal_apprentice_id, actor_id, filename, content_type, size_bytes, storage_path) values ('file-1', null, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'note.pdf', 'application/pdf', 12, 'file-1')",
      ),
    ).rejects.toThrow(/not a Portal profile/);
    await query(
      service,
      "insert into public.review_assistant_attachments (id, portal_apprentice_id, actor_id, filename, content_type, size_bytes, storage_path) values ('file-2', null, $1, 'note.pdf', 'application/pdf', 12, 'file-2')",
      [PROFILE_ID],
    );
  } finally {
    if (previousDatabase) process.env.REVIEW_DATABASE_URL = previousDatabase;
    else delete process.env.REVIEW_DATABASE_URL;
    if (previousStore) process.env.STAFF_PAGE_ACCESS_STORE = previousStore;
    else delete process.env.STAFF_PAGE_ACCESS_STORE;
  }

  expect(commandFailure(DATABASE, ["-f", portalRollback])).toMatch(/holds rows|holds objects/);
  await query(admin, "delete from public.review_assistant_attachments");
  await query(admin, "delete from public.staff_page_access");
  await query(admin, "insert into storage.objects (id, bucket_id, name) values ('object-1', 'review-attachments', 'file-2')");
  expect(commandFailure(DATABASE, ["-f", portalRollback])).toMatch(/holds objects/);
  await query(admin, "delete from storage.objects");
  psql(DATABASE, ["-f", portalRollback]);
  const buckets = await query(admin, "select id from storage.buckets order by id");
  expect(buckets.rows).toEqual([]);
  expect(commandFailure(DATABASE, ["-f", structureRollback])).toMatch(/holds rows/);
  await query(admin, "alter table public.app_state_history disable trigger user");
  await query(admin, "delete from public.app_state_history");
  await query(admin, "delete from public.app_state");
  await query(admin, "delete from public.tutor_reword_rate");
  psql(DATABASE, ["-f", structureRollback]);
  const tables = await query(admin, "select to_regclass('public.app_state') as app_state");
  expect(tables.rows[0]?.app_state).toBeNull();

  psqlCommand(BUCKET_DATABASE, stubSql());
  await query(
    adminUrl(BUCKET_DATABASE),
    "insert into storage.buckets (id, name, public, file_size_limit) values ('review-app', 'review-app', true, 52428800)",
  );
  applyMigration(BUCKET_DATABASE, structureFile);
  expect(commandFailure(BUCKET_DATABASE, ["-1", "-f", portalFile])).toMatch(/incompatible settings/);
  await query(
    adminUrl(BUCKET_DATABASE),
    "update storage.buckets set public = false, file_size_limit = 1 where id = 'review-app'",
  );
  expect(commandFailure(BUCKET_DATABASE, ["-1", "-f", portalFile])).toMatch(/incompatible settings/);
  await query(
    adminUrl(BUCKET_DATABASE),
    "update storage.buckets set file_size_limit = 52428800 where id = 'review-app'",
  );
  applyMigration(BUCKET_DATABASE, portalFile);
  const provision = await query(
    adminUrl(BUCKET_DATABASE),
    "select bucket_id, created_by_this_migration from reviews_private.storage_provision order by bucket_id",
  );
  expect(provision.rows).toEqual([
    { bucket_id: "review-app", created_by_this_migration: false },
    { bucket_id: "review-attachments", created_by_this_migration: true },
  ]);
  psql(BUCKET_DATABASE, ["-f", portalRollback]);
  const remaining = await query(
    adminUrl(BUCKET_DATABASE),
    "select id, public, file_size_limit from storage.buckets",
  );
  expect(remaining.rows).toEqual([{ id: "review-app", public: false, file_size_limit: "52428800" }]);
  expect(readFileSync(structureFile, "utf8")).not.toMatch(/^\s*(alter|set)\s+.*pgrst/im);
});
