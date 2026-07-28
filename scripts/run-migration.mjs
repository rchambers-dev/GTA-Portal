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

const env = { ...loadEnvLocal(), ...process.env };
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

const sql = fs.readFileSync(
  path.resolve("supabase/migrations/001_portal_bootstrap.sql"),
  "utf8",
);

const candidates = [
  {
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
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
  await client.query(sql);
  console.log("Migration applied.");
} finally {
  await client.end();
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const probe = await supabase.from("profiles").select("id").limit(1);
if (probe.error) {
  throw new Error(`Post-migration probe failed: ${probe.error.message}`);
}
console.log("profiles table OK");
