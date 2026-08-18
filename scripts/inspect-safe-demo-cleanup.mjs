/**
 * Read-only inventory of SAFE DEMO operational records on hosted Supabase.
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

const env = { ...process.env, ...loadEnvLocal() };
const dbPassword = env.SUPABASE_DB_PASSWORD?.trim();
const ref = "cjtgjxgghfiskqnuttzd";
if (!dbPassword) {
  console.log("STOP: missing SUPABASE_DB_PASSWORD");
  process.exit(2);
}

async function resolveHosts(hostname) {
  const hosts = [];
  try {
    for (const addr of await dns.promises.resolve6(hostname)) {
      hosts.push({ host: addr, display: `${hostname} [IPv6]` });
    }
  } catch {
    // no AAAA
  }
  try {
    for (const addr of await dns.promises.resolve4(hostname)) {
      hosts.push({ host: addr, display: `${hostname} [IPv4]` });
    }
  } catch {
    // no A
  }
  if (hosts.length === 0) hosts.push({ host: hostname, display: hostname });
  return hosts;
}

const candidateSpecs = [
  { hostname: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
  {
    hostname: `aws-1-eu-west-2.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
  },
];

let client;
for (const spec of candidateSpecs) {
  for (const resolved of await resolveHosts(spec.hostname)) {
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
      console.log(`CONNECTED via ${resolved.display}:${spec.port}`);
      break;
    } catch {
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
  console.log("CONNECT_FAILED");
  process.exit(3);
}

const q = async (label, sql, params) => {
  try {
    const result = params
      ? await client.query(sql, params)
      : await client.query(sql);
    console.log(label, JSON.stringify(result.rows, null, 2));
    return result.rows;
  } catch (err) {
    console.log(label + "_ERROR", err.message);
    return [];
  }
};

try {
  await q(
    "COHORTS",
    `select id, name, programme_name, standard_code, standard_version, delivery_spine,
            start_date, status, locked, tutor_name, teaching_group, college_days, notes
     from public.cohorts order by created_at`,
  );
  await q(
    "TEACHING_GROUPS",
    `select id, name, cohort_id, tutor_name, college_days, capacity, status,
            gta_programme_version_id, version_review_required, notes
     from public.cohort_teaching_groups order by created_at`,
  );
  await q(
    "APPRENTICES_DEMO",
    `select id, display_name, apprentice_reference, email, town, postcode, intake_status, pack, notes, support_notes
     from public.apprentices
     where display_name ilike '%SAFE DEMO%'
        or display_name ilike '%[TEST]%'
        or apprentice_reference ilike 'TEST%'
        or email ilike '%example.invalid%'
        or notes ilike '%SAFE DEMO%'
        or support_notes ilike '%SAFE DEMO%'
     order by created_at`,
  );
  await q(
    "ALL_APPRENTICES",
    `select id, display_name, apprentice_reference, email from public.apprentices order by created_at`,
  );
  await q(
    "ALL_ENROLMENTS",
    `select id, apprentice_id, programme_name, status, cohort_id, cohort_uuid, teaching_group_id,
            gta_programme_version_id, employer_name, tutor_name, start_date, notes
     from public.apprentice_programmes order by created_at`,
  );
  await q(
    "MEMBERSHIPS",
    `select * from public.teaching_group_memberships`,
  );
  await q(
    "LEARNING_RELEASES",
    `select id, session_id, apprentice_id, apprentice_programme_id, teaching_group_id, source, released_at, note
     from public.gta_session_learning_releases`,
  );
  await q(
    "REVIEW_RELEASES",
    `select id, session_id, apprentice_id, apprentice_programme_id, teaching_group_id, source, note
     from public.gta_session_review_releases`,
  );
  await q(
    "DELIVERY_RECORDS",
    `select id, session_id, apprentice_id, apprentice_programme_id, note
     from public.gta_session_delivery_records`,
  );
  await q(
    "PROFILES_DEMO",
    `select id, email, display_name, role, department, notes
     from public.profiles
     where email ilike '%example.invalid%'
        or display_name ilike '%SAFE DEMO%'
        or department ilike '%SAFE DEMO%'
        or notes ilike '%SAFE DEMO%'
        or notes ilike '%SAFE TEST%'`,
  );
  await q(
    "STAFF_ASSIGNMENTS_DEMO",
    `select sa.*
     from public.staff_assignments sa
     join public.profiles p on p.id = sa.staff_id
     where p.email ilike '%example.invalid%'
        or p.display_name ilike '%SAFE DEMO%'`,
  );
  await q(
    "EMPLOYERS",
    `select id, name, status, notes from public.employers
     where name ilike '%SAFE DEMO%' or name ilike '%TEST%' or notes ilike '%SAFE DEMO%'`,
  );
  await q(
    "COHORT_CHANGE_LOG",
    `select id, cohort_id, summary, actor_name, created_at
     from public.cohort_change_log
     order by created_at`,
  );
  await q(
    "AUTH_DEMO_USERS",
    `select id, email, created_at
     from auth.users
     where email ilike '%example.invalid%'
        or email ilike 'test-autocare%'
        or email ilike 'test-block1%'`,
  );

  const tables = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);
  console.log("PUBLIC_TABLES", tables.rows.map((r) => r.table_name).join(", "));

  const demoIds = await client.query(`
    select
      (select id from public.cohorts where name ilike '%SAFE DEMO%' or programme_name ilike '%[TEST]%' limit 1) as cohort_id,
      (select id from public.apprentices where apprentice_reference = 'TEST-GTA-2026-B1DELIVERY' limit 1) as apprentice_id,
      (select id from public.apprentice_programmes where notes ilike '%SAFE TEST%' or tutor_name ilike '%SAFE DEMO%' or employer_name ilike '%SAFE DEMO%' limit 1) as enrolment_id,
      (select id from public.cohort_teaching_groups where name ilike '%SAFE DEMO%' limit 1) as group_id
  `);
  console.log("DEMO_IDS", JSON.stringify(demoIds.rows[0], null, 2));
  const ids = demoIds.rows[0];

  const fks = await client.query(`
    select
      tc.table_name,
      kcu.column_name,
      ccu.table_name as foreign_table
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name in (
        'cohorts', 'cohort_teaching_groups', 'apprentices', 'apprentice_programmes',
        'profiles', 'teaching_group_memberships'
      )
    order by ccu.table_name, tc.table_name
  `);
  console.log("INBOUND_FKS", JSON.stringify(fks.rows, null, 2));

  if (ids.apprentice_id) {
    for (const row of fks.rows.filter((r) => r.foreign_table === "apprentices")) {
      await q(
        `REF_apprentices_${row.table_name}.${row.column_name}`,
        `select count(*)::int as n from public.${row.table_name} where ${row.column_name} = $1`,
        [ids.apprentice_id],
      );
    }
  }
  if (ids.enrolment_id) {
    for (const row of fks.rows.filter((r) => r.foreign_table === "apprentice_programmes")) {
      await q(
        `REF_enrolment_${row.table_name}.${row.column_name}`,
        `select count(*)::int as n from public.${row.table_name} where ${row.column_name} = $1`,
        [ids.enrolment_id],
      );
    }
  }
  if (ids.group_id) {
    for (const row of fks.rows.filter((r) => r.foreign_table === "cohort_teaching_groups")) {
      await q(
        `REF_group_${row.table_name}.${row.column_name}`,
        `select count(*)::int as n from public.${row.table_name} where ${row.column_name} = $1`,
        [ids.group_id],
      );
    }
  }
  if (ids.cohort_id) {
    for (const row of fks.rows.filter((r) => r.foreign_table === "cohorts")) {
      await q(
        `REF_cohort_${row.table_name}.${row.column_name}`,
        `select count(*)::int as n from public.${row.table_name} where ${row.column_name} = $1`,
        [ids.cohort_id],
      );
    }
  }

  await q(
    "DEMO_RESOURCES",
    `select id, resource_key, title, filename
     from public.gta_programme_resources
     where title ilike '%SAFE DEMO%' or resource_key ilike 'test_%' or filename ilike 'TEST_%'`,
  );
  await q(
    "DEMO_ATTACHMENTS",
    `select a.id, a.audience, a.role, r.title
     from public.gta_programme_resource_attachments a
     join public.gta_programme_resources r on r.id = a.resource_id
     where r.title ilike '%SAFE DEMO%' or r.resource_key ilike 'test_%'`,
  );
  await q(
    "REFERENCE_COUNTS",
    `
    select
      (select count(*)::int from public.gta_programmes) as gta_programmes,
      (select count(*)::int from public.gta_programme_versions) as gta_versions,
      (select count(*)::int from public.gta_programme_sessions) as sessions,
      (select count(*)::int from public.gta_spine_items) as spine_items,
      (select count(*)::int from public.se_standards) as se_standards,
      (select count(*)::int from public.se_standard_versions) as se_versions,
      (select count(*)::int from public.programmes) as programmes,
      (select count(*)::int from public.gta_programme_resources) as resources,
      (select count(*)::int from public.profiles) as profiles,
      (select count(*)::int from public.cohorts) as cohorts,
      (select count(*)::int from public.apprentices) as apprentices,
      (select count(*)::int from public.cohort_teaching_groups) as groups
    `,
  );
  await q(
    "CEA_OTJ_WORKSPACE",
    `
    select
      to_regclass('public.cea_apprentice_states') as cea,
      to_regclass('public.otj_entries') as otj,
      to_regclass('public.apprentice_workspace_items') as workspace
    `,
  );
} finally {
  await client.end();
}
