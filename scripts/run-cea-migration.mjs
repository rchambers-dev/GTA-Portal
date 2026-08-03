/**
 * Apply 010_cea_apprentice_states.sql using f:/.env.local (preferred) or ./.env.local.
 * This project’s DB is IPv6-only on the direct host; use aws-1-eu-west-2 pooler.
 */
import fs from "fs";
import pg from "pg";

function parseEnv(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const envPath = fs.existsSync("f:/.env.local") ? "f:/.env.local" : ".env.local";
const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const password = env.SUPABASE_DB_PASSWORD;
if (!url || !password) {
  console.error(`Missing URL or DB password in ${envPath}`);
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
const sql = fs.readFileSync(
  "supabase/migrations/010_cea_apprentice_states.sql",
  "utf8",
);

const client = new pg.Client({
  host: "aws-1-eu-west-2.pooler.supabase.com",
  port: 6543,
  user: `postgres.${ref}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

await client.connect();
await client.query(sql);
const check = await client.query(
  "select to_regclass('public.cea_apprentice_states') as t",
);
console.log("OK via pooler eu-west-2 — table:", check.rows[0]?.t);
await client.end();
