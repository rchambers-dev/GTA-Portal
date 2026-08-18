/**
 * Post-cleanup integrity check. Read-only.
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

const client = new pg.Client({
  host: (await resolveHosts("aws-1-eu-west-2.pooler.supabase.com"))[0],
  port: 5432,
  user: `postgres.${ref}`,
  password: dbPassword,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
await client.connect();

const q = async (label, sql) => {
  const result = await client.query(sql);
  console.log(label, JSON.stringify(result.rows, null, 2));
};

await q(
  "OPERATIONAL",
  `select
     (select count(*)::int from public.cohorts) as cohorts,
     (select count(*)::int from public.cohort_teaching_groups) as teaching_groups,
     (select count(*)::int from public.apprentices) as apprentices,
     (select count(*)::int from public.apprentice_programmes) as enrolments,
     (select count(*)::int from public.teaching_group_memberships) as memberships,
     (select count(*)::int from public.gta_session_learning_releases) as learning_releases,
     (select count(*)::int from public.gta_session_review_releases) as review_releases,
     (select count(*)::int from public.employers) as employers`,
);
await q(
  "ORPHANS",
  `select
     (select count(*)::int from public.apprentice_programmes ap
       left join public.cohort_teaching_groups g on g.id = ap.teaching_group_id
       where ap.teaching_group_id is not null and g.id is null) as orphan_group_pointers,
     (select count(*)::int from public.teaching_group_memberships m
       left join public.apprentice_programmes ap on ap.id = m.apprentice_programme_id
       where ap.id is null) as orphan_memberships,
     (select count(*)::int from public.gta_session_learning_releases r
       left join public.apprentice_programmes ap on ap.id = r.apprentice_programme_id
       where ap.id is null) as orphan_learning_releases,
     (select count(*)::int from public.cohort_teaching_groups g
       left join public.cohorts c on c.id = g.cohort_id
       where g.cohort_id is not null and c.id is null) as orphan_group_cohorts`,
);
await q(
  "REFERENCE",
  `select
     (select count(*)::int from public.gta_programmes) as gta_programmes,
     (select id from public.gta_programme_versions) as gta_version_id,
     (select status from public.gta_programme_versions) as gta_version_status,
     (select count(*)::int from public.gta_programme_sessions) as sessions,
     (select count(*)::int from public.gta_spine_items) as spine_items,
     (select count(*)::int from public.gta_course_tasks) as tasks,
     (select count(*)::int from public.se_standards) as se_standards,
     (select standard_code from public.se_standards) as se_code,
     (select external_version from public.se_standard_versions) as se_version,
     (select count(*)::int from public.gta_programme_resources) as resources,
     (select count(*)::int from public.gta_programme_resources where title ilike '%SAFE DEMO%') as curriculum_demo_resources,
     (select count(*)::int from public.profiles where email ilike '%@doncastergta.co.uk') as real_staff`,
);
await q(
  "MIGRATIONS_TAIL",
  `select filename from public.schema_migrations where filename >= '032' order by filename`,
);

await client.end();
