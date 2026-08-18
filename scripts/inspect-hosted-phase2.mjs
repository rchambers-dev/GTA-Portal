/**
 * Read-only hosted Supabase inspection for Phase 2.5.
 * Does not apply migrations or mutate data.
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
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const dbPassword = env.SUPABASE_DB_PASSWORD?.trim();
const ref = "cjtgjxgghfiskqnuttzd";

console.log(
  JSON.stringify({
    env_file: fs.existsSync(".env.local") ? "present" : "missing",
    NEXT_PUBLIC_SUPABASE_URL: url ? "set" : "missing",
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ? "set" : "missing",
    SUPABASE_DB_PASSWORD: dbPassword ? "set" : "missing",
    supabase_host: url ? new URL(url).host : null,
  }),
);

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
  if (hosts.length === 0) {
    hosts.push({ host: hostname, display: hostname });
  }
  return hosts;
}

const candidateSpecs = [
  { hostname: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
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
      console.log(`CONNECTED via ${resolved.display}:${spec.port}`);
      break;
    } catch (err) {
      lastError = err;
      attemptNotes.push(
        `${resolved.display}:${spec.port} → ${err.code || "ERR"}`,
      );
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
  for (const note of attemptNotes) console.log("attempt:", note);
  console.log("last_error_code:", lastError?.code || "");
  process.exit(3);
}

const mode = process.argv[2] || "schema";

try {
  if (mode === "post") {
    const q = async (label, sql) => {
      const result = await client.query(sql);
      console.log(label, JSON.stringify(result.rows, null, 2));
      return result.rows;
    };
    await q(
      "HOSTED_MIGRATIONS_TAIL",
      `select filename, applied_at from public.schema_migrations
       where filename >= '032' order by filename`,
    );
    await q(
      "CTG_COLUMNS",
      `
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = 'cohort_teaching_groups'
      order by ordinal_position
      `,
    );
    await q(
      "MEMBERSHIP_EXISTS",
      `select to_regclass('public.teaching_group_memberships') as teaching_group_memberships`,
    );
    await q(
      "REVIEW_EXISTS",
      `select to_regclass('public.gta_session_review_releases') as review_releases`,
    );
  }

  if (mode === "schema") {
    const migrationsDir = path.resolve("supabase/migrations");
    const localFiles = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    console.log("LOCAL_MIGRATIONS", JSON.stringify(localFiles));

    const migrationTable = await client.query(`
      select to_regclass('public.schema_migrations') as schema_migrations,
             to_regclass('supabase_migrations.schema_migrations') as supabase_migrations
    `);
    console.log("MIGRATION_TABLES", JSON.stringify(migrationTable.rows[0]));

    let hosted = [];
    if (migrationTable.rows[0].schema_migrations) {
      const applied = await client.query(
        `select filename, applied_at from public.schema_migrations order by filename`,
      );
      hosted = applied.rows;
      console.log("HOSTED_PUBLIC_SCHEMA_MIGRATIONS", JSON.stringify(hosted));
    }
    if (migrationTable.rows[0].supabase_migrations) {
      try {
        const official = await client.query(
          `select version, name from supabase_migrations.schema_migrations order by version`,
        );
        console.log(
          "HOSTED_SUPABASE_MIGRATIONS",
          JSON.stringify(official.rows),
        );
      } catch (err) {
        console.log("HOSTED_SUPABASE_MIGRATIONS_ERROR", err.message);
      }
    }

    const tables = [
      "cohort_teaching_groups",
      "apprentice_programmes",
      "gta_programme_versions",
      "gta_programmes",
      "se_standards",
      "se_standard_versions",
      "gta_session_learning_releases",
      "gta_session_review_releases",
      "teaching_group_memberships",
      "cohorts",
    ];
    const cols = await client.query(
      `
      select table_name, column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = any($1::text[])
      order by table_name, ordinal_position
      `,
      [tables],
    );
    console.log("COLUMNS", JSON.stringify(cols.rows));

    const fks = await client.query(
      `
      select
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name as foreign_table,
        ccu.column_name as foreign_column,
        rc.delete_rule,
        rc.update_rule
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      join information_schema.referential_constraints rc
        on rc.constraint_name = tc.constraint_name
       and rc.constraint_schema = tc.table_schema
      where tc.table_schema = 'public'
        and tc.constraint_type = 'FOREIGN KEY'
        and tc.table_name = any($1::text[])
      order by tc.table_name, tc.constraint_name
      `,
      [tables],
    );
    console.log("FOREIGN_KEYS", JSON.stringify(fks.rows));

    const checks = await client.query(
      `
      select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as def
      from pg_constraint
      where contype = 'c'
        and conrelid::regclass::text = any($1::text[])
      order by 1, 2
      `,
      [tables],
    );
    console.log("CHECK_CONSTRAINTS", JSON.stringify(checks.rows));

    const indexes = await client.query(
      `
      select tablename, indexname, indexdef
      from pg_indexes
      where schemaname = 'public'
        and tablename = any($1::text[])
      order by tablename, indexname
      `,
      [tables],
    );
    console.log("INDEXES", JSON.stringify(indexes.rows));
  }

  if (mode === "detail") {
    const q = async (label, sql, params) => {
      const result = params
        ? await client.query(sql, params)
        : await client.query(sql);
      console.log(label, JSON.stringify(result.rows, null, 2));
      return result.rows;
    };

    await q(
      "CTG_COLUMNS",
      `
      select column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = 'cohort_teaching_groups'
      order by ordinal_position
      `,
    );
    await q(
      "CTG_FKS",
      `
      select tc.constraint_name, kcu.column_name, ccu.table_name as foreign_table,
             ccu.column_name as foreign_column, rc.delete_rule, rc.update_rule
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      join information_schema.referential_constraints rc
        on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
      where tc.table_schema = 'public' and tc.table_name = 'cohort_teaching_groups'
        and tc.constraint_type = 'FOREIGN KEY'
      `,
    );
    await q(
      "GPV_COLUMNS",
      `
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = 'gta_programme_versions'
      order by ordinal_position
      `,
    );
    await q(
      "SE_COLUMNS",
      `
      select table_name, column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('gta_programmes', 'se_standards', 'se_standard_versions', 'cohorts')
      order by table_name, ordinal_position
      `,
    );
    await q(
      "LEARNING_RELEASE_COLUMNS",
      `
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public' and table_name = 'gta_session_learning_releases'
      order by ordinal_position
      `,
    );
    await q(
      "AP_FKS",
      `
      select tc.constraint_name, kcu.column_name, ccu.table_name as foreign_table,
             rc.delete_rule
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      join information_schema.referential_constraints rc
        on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
      where tc.table_schema = 'public' and tc.table_name = 'apprentice_programmes'
        and tc.constraint_type = 'FOREIGN KEY'
      `,
    );
    await q(
      "033_PREREQS",
      `
      select
        to_regclass('public.gta_programme_resource_attachments') as attachments,
        to_regclass('public.gta_session_review_releases') as review_releases,
        to_regprocedure('public.touch_updated_at()') as touch_updated_at
      `,
    );
    await q(
      "ATTACHMENT_AUDIENCE",
      `
      select audience, count(*)::int as n
      from public.gta_programme_resource_attachments
      group by audience
      `,
    ).catch((err) => {
      console.log("ATTACHMENT_AUDIENCE_ERROR", err.message);
    });
    await q(
      "ALL_ENROLMENTS",
      `
      select
        ap.id,
        ap.status,
        ap.teaching_group_id is not null as has_group,
        ap.gta_programme_version_id is not null as has_pin,
        ap.cohort_uuid is not null as has_cohort,
        a.display_name,
        a.email
      from public.apprentice_programmes ap
      left join public.apprentices a on a.id = ap.apprentice_id
      order by ap.created_at
      `,
    );
    await q(
      "COHORT_COUNTS",
      `select count(*)::int as n from public.cohorts`,
    );
    await q(
      "GTA_VERSION_COUNTS",
      `select status, count(*)::int as n from public.gta_programme_versions group by status`,
    );
    await q(
      "GROUPS_DETAIL",
      `
      select id, name, cohort_id, tutor_name, college_days, capacity, notes
      from public.cohort_teaching_groups
      `,
    );
    await q(
      "MEMBERS_DETAIL",
      `
      select
        ap.id as enrolment_id,
        ap.status,
        ap.teaching_group_id,
        ap.gta_programme_version_id,
        ap.cohort_uuid,
        ap.start_date,
        ap.original_planned_end_date,
        c.standard_code as cohort_standard_code,
        c.standard_version as cohort_standard_version,
        gpv.status as version_status,
        gp.standard_id,
        ss.standard_code as gta_standard_code,
        ssv.external_version as gta_external_version
      from public.apprentice_programmes ap
      left join public.cohorts c on c.id = ap.cohort_uuid
      left join public.gta_programme_versions gpv on gpv.id = ap.gta_programme_version_id
      left join public.gta_programmes gp on gp.id = gpv.programme_id
      left join public.se_standards ss on ss.id = gp.standard_id
      left join public.se_standard_versions ssv on ssv.id = gpv.standard_version_id
      where ap.teaching_group_id is not null
         or ap.status not in ('withdrawn', 'completed')
      `,
    );
    await q(
      "LEARNING_RELEASE_PROVENANCE",
      `
      select
        count(*)::int as total,
        count(*) filter (where teaching_group_id is not null)::int as with_group,
        count(distinct teaching_group_id)::int as distinct_groups,
        count(*) filter (where source = 'teaching_group')::int as source_group,
        count(*) filter (where source = 'individual')::int as source_individual,
        count(*) filter (where source = 'migrated_from_delivery')::int as source_migrated
      from public.gta_session_learning_releases
      `,
    );
    await q(
      "TEST_APPRENTICES",
      `
      select count(*)::int as n
      from public.apprentices
      where lower(coalesce(full_name, '')) like '%test%'
         or lower(coalesce(email, '')) like '%test%'
      `,
    ).catch(async (err) => {
      console.log("TEST_APPRENTICES_FALLBACK", err.message);
      const cols = await client.query(`
        select column_name from information_schema.columns
        where table_schema='public' and table_name='apprentices'
        order by ordinal_position
      `);
      console.log("APPRENTICES_COLUMNS", JSON.stringify(cols.rows));
    });
  }

  if (mode === "data") {
    const q = async (label, sql) => {
      const result = await client.query(sql);
      console.log(label, JSON.stringify(result.rows));
      return result.rows;
    };

    await q(
      "GROUP_TOTALS",
      `select count(*)::int as total from public.cohort_teaching_groups`,
    );
    await q(
      "GROUP_MEMBER_STATS",
      `
      with members as (
        select
          g.id,
          g.name,
          g.tutor_name,
          g.college_days,
          g.capacity,
          g.cohort_id,
          count(ap.id) filter (
            where ap.status not in ('withdrawn', 'completed')
          )::int as live_members,
          count(ap.id) filter (
            where ap.status not in ('withdrawn', 'completed')
              and ap.gta_programme_version_id is null
          )::int as unpinned_live,
          count(distinct ap.gta_programme_version_id) filter (
            where ap.status not in ('withdrawn', 'completed')
              and ap.gta_programme_version_id is not null
          )::int as distinct_pins,
          count(*)::int as all_pointer_members
        from public.cohort_teaching_groups g
        left join public.apprentice_programmes ap
          on ap.teaching_group_id = g.id
        group by g.id, g.name, g.tutor_name, g.college_days, g.capacity, g.cohort_id
      )
      select
        count(*)::int as total,
        count(*) filter (where live_members > 0)::int as with_live_members,
        count(*) filter (where live_members = 0)::int as empty_live,
        count(*) filter (
          where live_members > 0 and unpinned_live = 0 and distinct_pins = 1
        )::int as safely_pinnable,
        count(*) filter (where unpinned_live > 0)::int as unpinned_member_groups,
        count(*) filter (where distinct_pins > 1)::int as mixed_version_groups,
        count(*) filter (where tutor_name is null or btrim(tutor_name) = '')::int as missing_tutor,
        count(*) filter (where college_days is null or btrim(college_days) = '')::int as missing_days,
        count(*) filter (where capacity is not null and live_members >= capacity)::int as at_or_over_capacity,
        count(*) filter (where cohort_id is not null)::int as with_cohort
      from members
      `,
    );
    await q(
      "POINTER_COUNT",
      `select count(*)::int as pointers
       from public.apprentice_programmes
       where teaching_group_id is not null`,
    );
    await q(
      "RELEASE_COUNTS",
      `
      select
        (select count(*)::int from public.gta_session_learning_releases) as learning_releases,
        (select to_regclass('public.gta_session_review_releases') is not null) as review_table_exists
      `,
    );
    if (
      (
        await client.query(
          `select to_regclass('public.gta_session_review_releases') is not null as exists`,
        )
      ).rows[0].exists
    ) {
      await q(
        "REVIEW_RELEASE_COUNT",
        `select count(*)::int as review_releases from public.gta_session_review_releases`,
      );
    }
    await q(
      "UNPINNED_ENROLMENTS",
      `
      select count(*)::int as unpinned_active
      from public.apprentice_programmes
      where gta_programme_version_id is null
        and status not in ('withdrawn', 'completed')
      `,
    );
    await q(
      "PHASE2_COLUMNS_PRESENT",
      `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'cohort_teaching_groups'
        and column_name in ('gta_programme_version_id', 'status', 'version_review_required')
      order by column_name
      `,
    );
    await q(
      "MEMBERSHIP_TABLE",
      `select to_regclass('public.teaching_group_memberships') as teaching_group_memberships`,
    );
  }
} finally {
  await client.end();
}
