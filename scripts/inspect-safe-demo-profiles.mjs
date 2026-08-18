/**
 * Extra SAFE DEMO identity / tutor / profile / assignment inspection.
 */
import fs from "fs";
import path from "path";
import dns from "node:dns";
import pg from "pg";

dns.setDefaultResultOrder("ipv6first");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {}

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
const dbPassword = env.SUPABASE_DB_PASSWORD?.trim();
const ref = "cjtgjxgghfiskqnuttzd";

async function resolveHosts(hostname) {
  const hosts = [];
  try {
    for (const addr of await dns.promises.resolve6(hostname)) hosts.push(addr);
  } catch {}
  try {
    for (const addr of await dns.promises.resolve4(hostname)) hosts.push(addr);
  } catch {}
  return hosts.length ? hosts : [hostname];
}

const next = new pg.Client({
  host: (await resolveHosts("aws-1-eu-west-2.pooler.supabase.com"))[0],
  port: 5432,
  user: `postgres.${ref}`,
  password: dbPassword,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
await next.connect();

const q = async (label, sql, params) => {
  try {
    const result = params ? await next.query(sql, params) : await next.query(sql);
    console.log(label, JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.log(label + "_ERROR", err.message);
  }
};

const tutorId = "d7f99919-c254-484a-9027-943480ad9a59";
const apprenticeAuthId = "a87c7478-ef61-4bf0-99ad-a7e0a260a3f2";
const apprenticeId = "ea587505-487a-4b81-aeec-963cda86e47d";
const enrolmentId = "a58f3062-cb5e-4614-8e24-92ea27d38875";

await q(
  "PROFILE_COLS",
  `select column_name from information_schema.columns
   where table_schema='public' and table_name='profiles' order by ordinal_position`,
);
await q(
  "STAFF_ASSIGNMENT_COLS",
  `select column_name from information_schema.columns
   where table_schema='public' and table_name='staff_assignments' order by ordinal_position`,
);
await q("PROFILES_DEMO", `select * from public.profiles where id = any($1::uuid[])`, [
  [tutorId, apprenticeAuthId],
]);
await q("STAFF_ASSIGNMENTS", `select * from public.staff_assignments where profile_id = any($1::uuid[]) or apprentice_programme_id = $2`, [
  [tutorId, apprenticeAuthId],
  enrolmentId,
]);
await q("TEMP_ASSIGNMENTS", `select * from public.temporary_assignments where profile_id = any($1::uuid[]) or granted_by_profile_id = any($1::uuid[])`, [
  [tutorId, apprenticeAuthId],
]);
await q("AUDIT", `select count(*)::int as n from public.audit_events where actor_profile_id = any($1::uuid[])`, [
  [tutorId, apprenticeAuthId],
]);
await q("ACTIVITY", `select count(*)::int as n from public.gta_programme_activity where actor_profile_id = any($1::uuid[])`, [
  [tutorId, apprenticeAuthId],
]);
await q("UNLOCKS", `select * from public.gta_enrolment_block_unlocks where unlocked_by = any($1::uuid[]) or apprentice_programme_id = $2`, [
  [tutorId, apprenticeAuthId],
  enrolmentId,
]);
await q("MATERIAL_ATTACH", `select count(*)::int as n from public.gta_session_material_attachments`);
await q("REAL_STAFF", `select count(*)::int as n from public.profiles where email ilike '%@doncastergta.co.uk'`);
await q("ALL_PROFILE_EMAILS", `select id, email, display_name, linked_apprentice_id from public.profiles order by email`);
await q("SESSION_KEYS", `
  select s.session_key, r.id
  from public.gta_session_learning_releases r
  join public.gta_programme_sessions s on s.id = r.session_id
  where r.apprentice_programme_id = $1
`, [enrolmentId]);
await q("DELIVERY_SIGNED", `
  select signed_off_by, signed_off_by_name from public.gta_session_delivery_records
  where apprentice_programme_id = $1
`, [enrolmentId]);
await q("LEARNING_RELEASED_BY", `
  select released_by, released_by_name from public.gta_session_learning_releases
  where apprentice_programme_id = $1
`, [enrolmentId]);

await next.end();
