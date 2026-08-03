import fs from "fs";
import path from "path";
import dns from "node:dns";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

// Prefer IPv6 when available (Supabase direct DB is often IPv6-only).
dns.setDefaultResultOrder("ipv6first");
// Local resolvers sometimes refuse AAAA; fall back to public DNS.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // ignore
}

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

async function resolveHosts(hostname) {
  const hosts = [];
  try {
    for (const addr of await dns.promises.resolve6(hostname)) {
      hosts.push({ host: addr, display: `${hostname} [IPv6 ${addr}]` });
    }
  } catch {
    // no AAAA
  }
  try {
    for (const addr of await dns.promises.resolve4(hostname)) {
      hosts.push({ host: addr, display: `${hostname} [IPv4 ${addr}]` });
    }
  } catch {
    // no A
  }
  if (hosts.length === 0) {
    hosts.push({ host: hostname, display: hostname });
  }
  return hosts;
}

const candidateSpecs = [
  // Direct DB — IPv6-only on many Supabase projects
  {
    hostname: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
  },
  // IPv4-friendly pooler (session then transaction)
  {
    hostname: `aws-1-eu-west-2.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
  },
  {
    hostname: `aws-1-eu-west-2.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${ref}`,
  },
  {
    hostname: `aws-0-eu-west-2.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
  },
  {
    hostname: `aws-0-eu-west-2.pooler.supabase.com`,
    port: 6543,
    user: `postgres.${ref}`,
  },
];

let client;
let lastError;
const attemptNotes = [];

for (const spec of candidateSpecs) {
  const resolvedHosts = await resolveHosts(spec.hostname);
  for (const resolved of resolvedHosts) {
    const next = new pg.Client({
      host: resolved.host,
      port: spec.port,
      user: spec.user,
      password: dbPassword,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
    try {
      await next.connect();
      client = next;
      console.log(
        `Connected via ${resolved.display}:${spec.port} as ${spec.user}`,
      );
      break;
    } catch (err) {
      lastError = err;
      const note = `${resolved.display}:${spec.port} → ${err.code || err.message}`;
      attemptNotes.push(note);
      console.log(`Skip ${note}`);
      try {
        await next.end();
      } catch {
        // ignore
      }
    }
  }
  if (client) break;
}

if (!client) {
  const ipv6Unreachable = attemptNotes.some((n) => n.includes("ENETUNREACH"));
  const authFailed = attemptNotes.some((n) => n.includes("28P01"));
  let hint = "";
  if (ipv6Unreachable) {
    hint +=
      " Direct DB is IPv6-only and this machine has no IPv6 route (ENETUNREACH).";
  }
  if (authFailed) {
    hint +=
      " Pooler reached over IPv4 but rejected SUPABASE_DB_PASSWORD (28P01) — reset the Database password in Supabase → Project Settings → Database, update .env.local, then retry.";
  }
  hint +=
    " Fallback: paste supabase/seeds/apply-009-course-builder-autocare.sql in the Supabase SQL Editor.";
  throw new Error(
    `Could not connect to Postgres: ${lastError?.message || lastError}.${hint}`,
  );
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
  ["course_pack_task_forms", "id"],
];

for (const [table, column] of probes) {
  let probe = await supabase.from(table).select(column).limit(1);
  // PostgREST schema cache can lag a few seconds after DDL.
  if (probe.error?.message?.includes("schema cache")) {
    await new Promise((r) => setTimeout(r, 2500));
    probe = await supabase.from(table).select(column).limit(1);
  }
  if (probe.error) {
    if (table === "course_pack_task_forms") {
      console.log(
        `${table}: migration applied; API schema cache still refreshing (${probe.error.message})`,
      );
      continue;
    }
    throw new Error(`Post-migration probe failed on ${table}: ${probe.error.message}`);
  }
  console.log(`${table} table OK`);
}
