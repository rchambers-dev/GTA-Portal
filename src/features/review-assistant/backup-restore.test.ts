import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, expect, it } from "vitest";
import { Client } from "pg";
import { backupReviewData, restoreReviewData } from "../../../scripts/review-data-preserve.mjs";

const PASSWORD = "review-backup-local-only";
const SOURCE = "review_backup_source";
const TARGET = "review_backup_restore";

function psql(database: string, sql: string) {
  execFileSync("sudo", ["-n", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", database, "-c", sql], {
    encoding: "utf8",
  });
}

function url(database: string) {
  return `postgres://review_backup_owner:${encodeURIComponent(PASSWORD)}@127.0.0.1:5432/${database}`;
}

afterAll(() => {
  for (const database of [SOURCE, TARGET]) {
    try {
      psql("postgres", `drop database if exists ${database} with (force)`);
    } catch {
      // The disposable databases may already be gone.
    }
  }
});

it("backs up and restores synthetic review rows on a disposable local database", async () => {
  psql(
    "postgres",
    `
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'review_backup_owner') then
        create role review_backup_owner login superuser password '${PASSWORD}';
      else
        alter role review_backup_owner login superuser password '${PASSWORD}';
      end if;
    end $$;
    `,
  );
  psql("postgres", `drop database if exists ${SOURCE} with (force)`);
  psql("postgres", `drop database if exists ${TARGET} with (force)`);
  psql("postgres", `create database ${SOURCE}`);
  psql("postgres", `create database ${TARGET}`);
  const shape = `
    create table public.app_state (
      id text primary key,
      payload jsonb not null,
      updated_at timestamptz not null default now()
    );
  `;
  psql(SOURCE, shape);
  psql(TARGET, shape);
  const source = new Client({ connectionString: url(SOURCE) });
  await source.connect();
  await source.query("insert into public.app_state (id, payload) values ('default', '{\"version\":2,\"label\":\"synthetic-fixture\"}'::jsonb)");
  await source.end();

  const out = mkdtempSync(path.join(tmpdir(), "review-backup-"));
  const saved = await backupReviewData(url(SOURCE), out);
  expect(saved.counts["public.app_state"]).toBe(1);
  await restoreReviewData(url(TARGET), out);
  const restored = new Client({ connectionString: url(TARGET) });
  await restored.connect();
  const rows = await restored.query("select payload->>'label' as label from public.app_state");
  await restored.end();
  expect(rows.rows[0]?.label).toBe("synthetic-fixture");
  await expect(backupReviewData("postgres://postgres.cjtgjxgghfiskqnuttzd@127.0.0.1/postgres", out)).rejects.toThrow(/cjtgjxgghfiskqnuttzd/);
});
