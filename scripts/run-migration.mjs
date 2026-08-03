import fs from "fs";
import path from "path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const out = {};
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const dbPassword = env.SUPABASE_DB_PASSWORD?.trim();
const ref = "cjtgjxgghfiskqnuttzd";

if (!url || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

if (!dbPassword) {
  throw new Error(
    "Missing SUPABASE_DB_PASSWORD. Get it from Supabase → Project Settings → Database → Database password.",
  );
}

const migrationsDir = path.resolve("supabase/migrations");
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (migrationFiles.length === 0) {
  throw new Error("No SQL migrations found in supabase/migrations");
}

const candidates = [
  {
    host: `aws-1-eu-west-2.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
  },
  {
    host: `aws-1-eu-west-2.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${ref}`,
  },
  {
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
  },
  {
    host: `aws-0-eu-west-2.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
  },
  {
    host: `aws-0-eu-west-2.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${ref}`,
  },
  {
    host: `aws-0-eu-west-1.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${ref}`,
  },
  {
    host: `aws-0-eu-central-1.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${ref}`,
  },
];

let client;
let lastError;
for (const c of candidates) {
  const next = new pg.Client({
    ...c,
    password: dbPassword,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await next.connect();
    client = next;
    console.log(`Connected via ${c.host}:${c.port}`);
    break;
  } catch (err) {
    lastError = err;
    console.log(`Skip ${c.host}: ${err.code || err.message}`);
    try {
      await next.end();
    } catch {
      // ignore
    }
  }
}

if (!client) {
  throw new Error(`Could not connect to Postgres: ${lastError?.message || lastError}`);
}

try {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const applied = await client.query(
    `select filename from public.schema_migrations`,
  );
  const done = new Set(applied.rows.map((row) => row.filename));

  for (const filename of migrationFiles) {
    if (done.has(filename)) {
      console.log(`Skip (already applied): ${filename}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
    console.log(`Applying ${filename}…`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        `insert into public.schema_migrations (filename) values ($1)`,
        [filename],
      );
      await client.query("commit");
      console.log(`Applied ${filename}`);
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }
  console.log("Migrations complete.");
} finally {
  await client.end();
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const probes = [
  ["profiles", "id"],
  ["cohorts", "id"],
  ["cohort_teaching_groups", "id"],
  ["cohort_change_log", "id"],
  ["staff_assignments", "id"],
  ["programmes", "id"],
];

for (const [table, column] of probes) {
  const probe = await supabase.from(table).select(column).limit(1);
  if (probe.error) {
    throw new Error(`Post-migration probe failed on ${table}: ${probe.error.message}`);
  }
  console.log(`${table} table OK`);
}
