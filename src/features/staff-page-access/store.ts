import { withDirectPg } from "@/lib/db/direct-pool";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { canonicalActorId } from "@/lib/portal/actor-id";
import { emptyPageAccessConfig, type PageAccessConfig } from "./model";

export class PageAccessConfigUnavailable extends Error {
  status = 503;
  constructor() {
    super("Page access config is unreadable. Access is closed until it can be read.");
  }
}

export class PageAccessConflict extends Error {
  status = 409;
  constructor() {
    super("Page access was saved by someone else. Reload and try again.");
  }
}

export type PageAccessRecord = { config: PageAccessConfig; version: number };

/**
 * Disposable server file for page-access configuration.
 * It is not applied to production. An unconfigured file leaves current
 * capability checks unchanged. STAFF_PAGE_ACCESS_FILE is for tests.
 */
export function pageAccessFilePath() {
  const override = process.env.STAFF_PAGE_ACCESS_FILE;
  if (override) return override;
  return path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    ".staff-page-access",
    "config.json",
  );
}

function productionRuntime() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

function useFileStore() {
  if (process.env.STAFF_PAGE_ACCESS_STORE === "postgres") return false;
  if (process.env.STAFF_PAGE_ACCESS_STORE === "supabase") return false;
  if (process.env.REVIEW_DATABASE_URL?.trim() && process.env.STAFF_PAGE_ACCESS_STORE !== "file") return false;
  if (productionRuntime()) return false;
  return true;
}

function configShape(parsed: PageAccessConfig): PageAccessConfig {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !Array.isArray(parsed.workspaceDefaults) ||
    !Array.isArray(parsed.bundles) ||
    !Array.isArray(parsed.direct)
  ) {
    throw new PageAccessConfigUnavailable();
  }
  return {
    workspaceDefaults: parsed.workspaceDefaults,
    bundles: parsed.bundles,
    direct: parsed.direct,
  };
}

function readFileRecord(): PageAccessRecord {
  const target = pageAccessFilePath();
  let raw: string;
  try {
    raw = readFileSync(/*turbopackIgnore: true*/ target, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { config: emptyPageAccessConfig(), version: 0 };
    }
    throw new PageAccessConfigUnavailable();
  }
  try {
    const parsed = JSON.parse(raw) as PageAccessConfig & { version?: number; config?: PageAccessConfig };
    if (parsed?.config && typeof parsed.version === "number") {
      return { version: parsed.version, config: configShape(parsed.config) };
    }
    return { version: 1, config: configShape(parsed) };
  } catch (error) {
    if (error instanceof PageAccessConfigUnavailable) throw error;
    throw new PageAccessConfigUnavailable();
  }
}

export function readPageAccessConfig(): PageAccessConfig {
  return readFileRecord().config;
}

export function writePageAccessConfig(config: PageAccessConfig) {
  const target = pageAccessFilePath();
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(/*turbopackIgnore: true*/ temporary, JSON.stringify(config));
  renameSync(temporary, target);
}

async function withPagePostgres<T>(fn: (db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }) => Promise<T>): Promise<T> {
  if (!process.env.REVIEW_DATABASE_URL?.trim()) throw new PageAccessConfigUnavailable();
  try {
    return await withDirectPg(fn);
  } catch (error) {
    if (error instanceof PageAccessConflict || error instanceof PageAccessConfigUnavailable) throw error;
    const status = (error as { status?: number }).status;
    if (status === 400 || status === 409) throw error;
    throw new PageAccessConfigUnavailable();
  }
}

async function loadPostgresRecord(): Promise<PageAccessRecord> {
  return withPagePostgres(async (db) => {
    const result = await db.query(
      "select payload, version from public.staff_page_access where id = 'default'",
    );
    const row = result.rows[0];
    if (!row) return { config: emptyPageAccessConfig(), version: 0 };
    return { config: configShape(row.payload as PageAccessConfig), version: Number(row.version) };
  });
}

async function savePostgresRecord(config: PageAccessConfig, expectedVersion: number, actorId: string): Promise<PageAccessRecord> {
  const actor = canonicalActorId(actorId);
  return withPagePostgres(async (db) => {
    let saved = 0;
    try {
      const result = await db.query(
        "select public.save_staff_page_access($1, $2::jsonb, $3::uuid) as saved",
        [expectedVersion, JSON.stringify(config), actor],
      );
      saved = Number(result.rows[0]?.saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/not a Portal profile/i.test(message)) {
        throw Object.assign(new Error("Page access actor is not a Portal profile."), { status: 400 });
      }
      throw new PageAccessConfigUnavailable();
    }
    if (saved !== 1) throw new PageAccessConflict();
    const loaded = await db.query(
      "select payload, version from public.staff_page_access where id = 'default'",
    );
    const row = loaded.rows[0];
    if (!row) throw new PageAccessConfigUnavailable();
    return { config: configShape(row.payload as PageAccessConfig), version: Number(row.version) };
  });
}

function supabasePageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new PageAccessConfigUnavailable();
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function loadSupabaseRecord(): Promise<PageAccessRecord> {
  const client = supabasePageClient();
  const { data, error } = await client
    .from("staff_page_access")
    .select("payload, version")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new PageAccessConfigUnavailable();
  if (!data) return { config: emptyPageAccessConfig(), version: 0 };
  return { config: configShape(data.payload as PageAccessConfig), version: Number(data.version) };
}

async function saveSupabaseRecord(config: PageAccessConfig, expectedVersion: number, actorId: string): Promise<PageAccessRecord> {
  const client = supabasePageClient();
  const { data, error } = await client.rpc("save_staff_page_access", {
    expected_version: expectedVersion,
    next_payload: config,
    actor_id: canonicalActorId(actorId),
  });
  if (error) throw new PageAccessConfigUnavailable();
  if (Number(data) !== 1) throw new PageAccessConflict();
  return loadSupabaseRecord();
}

function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function refuseTestAdapterInProduction() {
  if (!productionRuntime()) return;
  const mode = process.env.STAFF_PAGE_ACCESS_STORE;
  if (mode === "postgres" || mode === "file" || mode === "memory") {
    throw new PageAccessConfigUnavailable();
  }
  if (!supabaseConfigured()) throw new PageAccessConfigUnavailable();
}

/** Missing config is version 0 and leaves legacy access. A read failure throws. Reads are not cached. */
export async function loadPageAccessRecord(): Promise<PageAccessRecord> {
  if (productionRuntime()) {
    refuseTestAdapterInProduction();
    return loadSupabaseRecord();
  }
  if (useFileStore()) return readFileRecord();
  if (process.env.STAFF_PAGE_ACCESS_STORE === "postgres") return loadPostgresRecord();
  if (supabaseConfigured()) return loadSupabaseRecord();
  if (process.env.REVIEW_DATABASE_URL?.trim()) return loadPostgresRecord();
  throw new PageAccessConfigUnavailable();
}

export async function savePageAccessConfig(
  config: PageAccessConfig,
  expectedVersion: number,
  actorId: string,
): Promise<PageAccessRecord> {
  if (productionRuntime()) {
    refuseTestAdapterInProduction();
    return saveSupabaseRecord(config, expectedVersion, actorId);
  }
  if (useFileStore()) {
    const current = readFileRecord();
    if (current.version !== expectedVersion) throw new PageAccessConflict();
    const next = { version: current.version + 1, config };
    const target = pageAccessFilePath();
    mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    writeFileSync(/*turbopackIgnore: true*/ temporary, JSON.stringify(next));
    renameSync(temporary, target);
    return { version: next.version, config };
  }
  if (process.env.STAFF_PAGE_ACCESS_STORE === "postgres") return savePostgresRecord(config, expectedVersion, actorId);
  if (supabaseConfigured()) return saveSupabaseRecord(config, expectedVersion, actorId);
  if (process.env.REVIEW_DATABASE_URL?.trim()) return savePostgresRecord(config, expectedVersion, actorId);
  throw new PageAccessConfigUnavailable();
}
