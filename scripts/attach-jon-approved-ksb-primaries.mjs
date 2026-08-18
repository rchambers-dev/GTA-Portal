/**
 * Attach Jon's human-approved Autocare Primary KSBs only.
 * Source: tests/artifacts/autocare-v1/sow-only/golden-baseline/primary-decisions.json
 * Does not attach AI/automated primaries, gaps, reinforcements, or publish.
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

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const VERSION_ID = "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";
const env = { ...process.env, ...loadEnvLocal() };
const dbPassword = env.SUPABASE_DB_PASSWORD?.trim();
const ref = "cjtgjxgghfiskqnuttzd";
if (!dbPassword) die("Missing SUPABASE_DB_PASSWORD");

const decisions = JSON.parse(
  fs.readFileSync(
    path.resolve(
      "tests/artifacts/autocare-v1/sow-only/golden-baseline/primary-decisions.json",
    ),
    "utf8",
  ),
);
const approved = decisions.approvedPrimaries;
const mappings = Object.entries(approved).map(([ksbCode, row]) => ({
  ksbCode,
  primaryBlock: Number(row.primaryBlock),
  rationale: String(row.rationale || ""),
}));
if (mappings.length !== 15) {
  die(`Expected 15 Jon-approved Primaries, found ${mappings.length}`);
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
if (!client) die("CONNECT_FAILED");

try {
  const version = (
    await client.query(
      `select id, status, parameters, standard_version_id
       from public.gta_programme_versions where id = $1`,
      [VERSION_ID],
    )
  ).rows[0];
  if (!version) die("Autocare programme version missing");
  if (version.status !== "draft") {
    die(`Refusing: version status is ${version.status}, expected draft`);
  }
  const params = version.parameters || {};
  if (params.controlTag !== "autocare-st0499-v1.3-phase1-controlled") {
    die(`Refusing: unexpected controlTag ${params.controlTag}`);
  }

  const existing = (
    await client.query(
      `select count(*)::int as n from public.gta_spine_item_ksbs
       where programme_version_id = $1`,
      [VERSION_ID],
    )
  ).rows[0].n;
  if (existing !== 0) {
    die(`Refusing: version already has ${existing} KSB mapping(s)`);
  }

  const blocks = (
    await client.query(
      `
      select si.id, si.title, si.sequence, si.item_type, si.metadata
      from public.gta_spine_items si
      join public.gta_spines s on s.id = si.spine_id
      where s.programme_version_id = $1
        and si.item_type = 'block'
      order by si.sequence
      `,
      [VERSION_ID],
    )
  ).rows;
  const blockByNumber = new Map();
  for (const row of blocks) {
    const n = Number(row.metadata?.blockNumber ?? row.sequence);
    blockByNumber.set(n, row);
  }

  const ksbs = (
    await client.query(
      `select id, ksb_code from public.se_ksbs where standard_version_id = $1`,
      [version.standard_version_id],
    )
  ).rows;
  const ksbByCode = new Map(ksbs.map((row) => [row.ksb_code.toUpperCase(), row]));

  const rows = [];
  for (const mapping of mappings) {
    const block = blockByNumber.get(mapping.primaryBlock);
    if (!block) die(`No block ${mapping.primaryBlock} on spine`);
    const ksb = ksbByCode.get(mapping.ksbCode.toUpperCase());
    if (!ksb) die(`Official KSB ${mapping.ksbCode} not in catalogue`);
    rows.push({
      ...mapping,
      spineItemId: block.id,
      blockTitle: block.title,
      ksbId: ksb.id,
    });
  }

  console.log("PLAN");
  for (const row of rows) {
    console.log(
      `${row.ksbCode} → B${row.primaryBlock} (${row.blockTitle}) primary`,
    );
  }

  await client.query("begin");
  try {
    for (const row of rows) {
      await client.query(
        `
        insert into public.gta_spine_item_ksbs (
          programme_version_id,
          spine_item_id,
          ksb_id,
          is_primary,
          learning_intent,
          mapping_source,
          curriculum_value,
          created_by,
          ai_reason_summary
        ) values (
          $1, $2, $3, true, 'practise', 'imported', 1.0,
          'Jon — golden-baseline approvedPrimaries',
          $4
        )
        `,
        [VERSION_ID, row.spineItemId, row.ksbId, row.rationale],
      );
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  }

  const after = (
    await client.query(
      `
      select
        k.ksb_code,
        si.metadata->>'blockNumber' as block_number,
        m.is_primary,
        m.learning_intent,
        m.mapping_source
      from public.gta_spine_item_ksbs m
      join public.se_ksbs k on k.id = m.ksb_id
      join public.gta_spine_items si on si.id = m.spine_item_id
      where m.programme_version_id = $1
      order by k.ksb_code
      `,
      [VERSION_ID],
    )
  ).rows;
  console.log("ATTACHED", after.length);
  console.log(JSON.stringify(after, null, 2));
  if (after.length !== 15) die(`Expected 15 attached, got ${after.length}`);
  console.log("OK — 15 Jon-approved Primaries only. Draft not published.");
} finally {
  await client.end();
}
