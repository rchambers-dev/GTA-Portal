/**
 * Fresh start for the new Programme Builder setup.
 *
 * KEEPS: all staff portal accounts (auth.users + profiles that are not apprentices)
 * REMOVES: apprentice portal accounts, apprentices, enrolments, cohorts, employers (garages),
 *          Skills England imports (se_*), GTA programme definition drafts (gta_*)
 *
 * Usage: node scripts/wipe-training-data.mjs --confirm
 */
import fs from "fs";
import path from "path";
import dns from "node:dns";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

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

if (!process.argv.includes("--confirm")) {
  console.error(
    "Refusing to run without --confirm.\nUsage: node scripts/wipe-training-data.mjs --confirm",
  );
  process.exit(1);
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
  throw new Error("Missing SUPABASE_DB_PASSWORD");
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
      console.log(
        `Skip ${resolved.display}:${spec.port} → ${err.code || err.message}`,
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
  throw new Error(
    `Could not connect to Postgres: ${lastError?.message || lastError}`,
  );
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function tableExists(name) {
  const { rows } = await client.query(
    `select 1 from information_schema.tables
     where table_schema = 'public' and table_name = $1`,
    [name],
  );
  return rows.length > 0;
}

async function count(table) {
  if (!(await tableExists(table))) return null;
  const { rows } = await client.query(`select count(*)::int as n from public.${table}`);
  return rows[0].n;
}

async function main() {
  console.log("\n=== Before wipe ===");
  for (const t of [
    "profiles",
    "apprentices",
    "apprentice_programmes",
    "cohorts",
    "employers",
    "se_standards",
    "gta_programmes",
  ]) {
    const n = await count(t);
    console.log(`  ${t}: ${n === null ? "(missing)" : n}`);
  }

  const { rows: apprenticeProfiles } = await client.query(`
    select id, email, base_role, workspace
    from public.profiles
    where lower(coalesce(workspace, '')) in ('apprentice', 'learner')
       or lower(coalesce(base_role, '')) in ('apprentice', 'learner')
  `);
  console.log(`\nApprentice portal accounts to delete: ${apprenticeProfiles.length}`);

  let deletedUsers = 0;
  for (const row of apprenticeProfiles) {
    const { error } = await supabase.auth.admin.deleteUser(row.id);
    if (error) {
      console.warn(`  Could not delete auth user ${row.email || row.id}: ${error.message}`);
      await client.query(`delete from public.profiles where id = $1`, [row.id]);
    } else {
      deletedUsers += 1;
    }
  }
  console.log(`Deleted/cleared apprentice auth accounts: ${deletedUsers}`);

  // Optional operational tables (may not exist on all projects)
  const optionalTables = [
    "otj_entries",
    "task_submissions",
    "evidence_links",
    "evidence_versions",
    "evidence_records",
    "document_form_instances",
    "apprentice_block_rpl",
    "apprentice_gateway_status",
    "apprentice_requirements",
  ];

  await client.query("begin");
  try {
    for (const t of optionalTables) {
      if (await tableExists(t)) {
        await client.query(`truncate table public.${t} restart identity cascade`);
        console.log(`Truncated ${t}`);
      }
    }

    if (await tableExists("staff_assignments")) {
      await client.query(`truncate table public.staff_assignments restart identity cascade`);
      console.log("Truncated staff_assignments");
    }
    if (await tableExists("cea_apprentice_states")) {
      await client.query(
        `truncate table public.cea_apprentice_states restart identity cascade`,
      );
      console.log("Truncated cea_apprentice_states");
    }
    if (await tableExists("proxy_write_audit")) {
      await client.query(`truncate table public.proxy_write_audit restart identity cascade`);
      console.log("Truncated proxy_write_audit");
    }
    if (await tableExists("apprentice_programmes")) {
      // Never CASCADE here — can wipe unrelated tables via FK edges.
      await client.query(`delete from public.apprentice_programmes`);
      console.log("Deleted apprentice_programmes");
    }
    if (await tableExists("apprentices")) {
      // profiles.linked_apprentice_id → apprentices; TRUNCATE CASCADE would wipe staff profiles.
      await client.query(
        `update public.profiles set linked_apprentice_id = null where linked_apprentice_id is not null`,
      );
      await client.query(`delete from public.apprentices`);
      console.log("Deleted apprentices (staff profiles preserved)");
    }

    // Cohorts (children CASCADE)
    if (await tableExists("cohorts")) {
      await client.query(`truncate table public.cohorts restart identity cascade`);
      console.log("Truncated cohorts (+ teaching groups / change log)");
    }

    // Garages
    if (await tableExists("employers")) {
      await client.query(`truncate table public.employers restart identity cascade`);
      console.log("Truncated employers (garages)");
    }

    // Programme Builder official + GTA drafts
    const programmeTables = [
      "gta_spine_item_ksbs",
      "gta_spine_items",
      "gta_spines",
      "gta_programme_versions",
      "gta_programmes",
      "se_duty_ksb_mappings",
      "se_duties",
      "se_ksbs",
      "se_standard_versions",
      "se_standards",
    ];
    const existing = [];
    for (const t of programmeTables) {
      if (await tableExists(t)) existing.push(`public.${t}`);
    }
    if (existing.length) {
      await client.query(
        `truncate table ${existing.join(", ")} restart identity cascade`,
      );
      console.log(`Truncated programme definition tables (${existing.length})`);
    }

    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  }

  console.log("\n=== After wipe ===");
  for (const t of [
    "profiles",
    "apprentices",
    "apprentice_programmes",
    "cohorts",
    "employers",
    "se_standards",
    "gta_programmes",
  ]) {
    const n = await count(t);
    console.log(`  ${t}: ${n === null ? "(missing)" : n}`);
  }

  const { rows: staffLeft } = await client.query(`
    select count(*)::int as n from public.profiles
    where not (
      lower(coalesce(workspace, '')) in ('apprentice', 'learner')
      or lower(coalesce(base_role, '')) in ('apprentice', 'learner')
    )
  `);
  console.log(`\nStaff profiles remaining: ${staffLeft[0].n}`);
  console.log("Wipe complete. Staff accounts kept.");
}

try {
  await main();
} finally {
  await client.end();
}
