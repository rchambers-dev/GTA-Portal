/**
 * Apply a single migration file via Postgres (guarded).
 * Usage:
 *   ALLOW_HOSTED_PB_AUTHORING_RESET=1 node scripts/apply-one-migration.mjs 024_gta_programme_sessions.sql
 */
import fs from "fs";
import path from "path";
import dns from "node:dns";
import pg from "pg";

dns.setDefaultResultOrder("ipv6first");
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

const fileName = process.argv[2];
if (!fileName) {
  console.error("Usage: node scripts/apply-one-migration.mjs <file.sql>");
  process.exit(1);
}
if (process.env.ALLOW_HOSTED_PB_AUTHORING_RESET !== "1") {
  console.error("Requires ALLOW_HOSTED_PB_AUTHORING_RESET=1");
  process.exit(1);
}

const env = { ...process.env, ...loadEnvLocal() };
const dbPassword = env.SUPABASE_DB_PASSWORD?.trim();
const ref = "cjtgjxgghfiskqnuttzd";
if (!dbPassword) throw new Error("Missing SUPABASE_DB_PASSWORD");

const sqlPath = path.resolve("supabase/migrations", fileName);
if (!fs.existsSync(sqlPath)) throw new Error(`Missing ${sqlPath}`);
const sql = fs.readFileSync(sqlPath, "utf8");

const candidates = [
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
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
];

let lastErr;
for (const c of candidates) {
  const client = new pg.Client({
    host: c.host,
    port: c.port,
    user: c.user,
    password: dbPassword,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    console.log("Connected via", c.host, c.port);
    await client.query(sql);
    console.log("Applied", fileName);
    await client.end();
    process.exit(0);
  } catch (e) {
    lastErr = e;
    try {
      await client.end();
    } catch {
      // ignore
    }
    console.warn("Failed", c.host, c.port, e.message);
  }
}
throw lastErr;
