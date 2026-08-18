/**
 * Replace Autocare block Linked-KSB dump with:
 * - Block 1: AF1.34 Foundation Skills cross-reference
 * - Blocks 2–10: unique official KSBs from SOW v4.4 weekly session cells
 *   (catalogue-dump weeks 111–112 excluded)
 * Jon's 15 approved Primaries stay Primary.
 * Does not publish.
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

const parsed = JSON.parse(
  fs.readFileSync(
    path.resolve(
      "tests/artifacts/autocare-v1/sow-only/weekly-coverage/parsed-ksb-sources.json",
    ),
    "utf8",
  ),
);
const decisions = JSON.parse(
  fs.readFileSync(
    path.resolve(
      "tests/artifacts/autocare-v1/sow-only/golden-baseline/primary-decisions.json",
    ),
    "utf8",
  ),
);
const jonPrimaryByCode = new Map(
  Object.entries(decisions.approvedPrimaries).map(([code, row]) => [
    code.toUpperCase(),
    Number(row.primaryBlock),
  ]),
);
if (jonPrimaryByCode.size !== 15) {
  die(`Expected 15 Jon-approved Primaries, found ${jonPrimaryByCode.size}`);
}

const coverageByBlock = new Map();
for (const [block, row] of Object.entries(parsed.sowWeeklyCoverage || {})) {
  coverageByBlock.set(Number(block), [...(row.codes || [])]);
}
coverageByBlock.set(1, [...(parsed.block1FoundationSkills || [])]);
if ((coverageByBlock.get(1) || []).length < 30) {
  die("Block 1 Foundation Skills list missing or too short");
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
  if (version.parameters?.controlTag !== "autocare-st0499-v1.3-phase1-controlled") {
    die("Refusing: unexpected controlTag");
  }

  const blocks = (
    await client.query(
      `
      select si.id, si.title, si.sequence, si.metadata
      from public.gta_spine_items si
      join public.gta_spines s on s.id = si.spine_id
      where s.programme_version_id = $1 and si.item_type = 'block'
      `,
      [VERSION_ID],
    )
  ).rows;
  const blockByNumber = new Map();
  for (const row of blocks) {
    blockByNumber.set(Number(row.metadata?.blockNumber ?? row.sequence), row);
  }

  const official = (
    await client.query(
      `select id, ksb_code from public.se_ksbs where standard_version_id = $1`,
      [version.standard_version_id],
    )
  ).rows;
  const ksbByCode = new Map(
    official.map((row) => [row.ksb_code.toUpperCase(), row]),
  );

  const skipped = [];
  const planned = [];
  const plannedKey = new Set();
  for (const [blockNumber, codes] of coverageByBlock) {
    if (blockNumber > 10) continue;
    const block = blockByNumber.get(blockNumber);
    if (!block) die(`Missing block ${blockNumber}`);
    for (const raw of codes) {
      const code = String(raw).toUpperCase();
      const ksb = ksbByCode.get(code);
      if (!ksb) {
        skipped.push({
          code,
          blockNumber,
          reason: "not in official ST0499 v1.3",
        });
        continue;
      }
      const key = `${block.id}:${ksb.id}`;
      if (plannedKey.has(key)) continue;
      plannedKey.add(key);
      const jonBlock = jonPrimaryByCode.get(code);
      planned.push({
        blockNumber,
        spineItemId: block.id,
        ksbCode: code,
        ksbId: ksb.id,
        isPrimary: jonBlock === blockNumber,
        learningIntent: jonBlock === blockNumber ? "practise" : "reinforce",
        source:
          blockNumber === 1
            ? "AF1.34 Block 1 Foundation Skills cross-reference"
            : `SOW v4.4 weekly coverage on Block ${blockNumber}`,
      });
    }
  }

  for (const [code, primaryBlock] of jonPrimaryByCode) {
    const block = blockByNumber.get(primaryBlock);
    const ksb = ksbByCode.get(code);
    if (!block || !ksb) die(`Jon Primary ${code} → B${primaryBlock} unresolved`);
    const key = `${block.id}:${ksb.id}`;
    if (plannedKey.has(key)) continue;
    plannedKey.add(key);
    planned.push({
      blockNumber: primaryBlock,
      spineItemId: block.id,
      ksbCode: code,
      ksbId: ksb.id,
      isPrimary: true,
      learningIntent: "practise",
      source: "Jon approved Primary (not in weekly union for this block)",
    });
  }

  const existingPrimaries = (
    await client.query(
      `select count(*)::int as n from public.gta_spine_item_ksbs
       where programme_version_id = $1 and is_primary = true`,
      [VERSION_ID],
    )
  ).rows[0].n;
  if (existingPrimaries !== 15) {
    die(`Expected 15 existing Primaries, found ${existingPrimaries}`);
  }

  console.log(
    JSON.stringify(
      {
        planned: planned.length,
        primariesInPlan: planned.filter((r) => r.isPrimary).length,
        skipped,
        byBlock: Object.fromEntries(
          [...coverageByBlock.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([n, codes]) => [n, codes.length]),
        ),
      },
      null,
      2,
    ),
  );

  await client.query("begin");
  try {
    const deleted = await client.query(
      `delete from public.gta_spine_item_ksbs
       where programme_version_id = $1 and is_primary = false`,
      [VERSION_ID],
    );
    console.log(`DELETED_NON_PRIMARY ${deleted.rowCount}`);

    const remaining = (
      await client.query(
        `select spine_item_id, ksb_id from public.gta_spine_item_ksbs
         where programme_version_id = $1`,
        [VERSION_ID],
      )
    ).rows;
    const existingKey = new Set(
      remaining.map((row) => `${row.spine_item_id}:${row.ksb_id}`),
    );

    let inserted = 0;
    for (const row of planned) {
      if (existingKey.has(`${row.spineItemId}:${row.ksbId}`)) continue;
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
          $1, $2, $3, $4, $5, 'imported', 1.0,
          $6,
          $7
        )
        `,
        [
          VERSION_ID,
          row.spineItemId,
          row.ksbId,
          row.isPrimary,
          row.learningIntent,
          row.isPrimary
            ? "Jon — golden-baseline approvedPrimaries"
            : row.blockNumber === 1
              ? "AF1.34 26-27 Block 1 FS cross-reference"
              : "SOW v4.4 weekly session KSB coverage",
          row.source,
        ],
      );
      inserted += 1;
    }
    console.log(`INSERTED ${inserted}`);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  }

  const summary = (
    await client.query(
      `
      select
        (si.metadata->>'blockNumber')::int as block_number,
        count(*)::int as total,
        count(*) filter (where m.is_primary)::int as primaries
      from public.gta_spine_item_ksbs m
      join public.gta_spine_items si on si.id = m.spine_item_id
      where m.programme_version_id = $1
      group by 1
      order by 1
      `,
      [VERSION_ID],
    )
  ).rows;
  const totals = (
    await client.query(
      `
      select
        count(*)::int as mappings,
        count(*) filter (where is_primary)::int as primaries,
        count(distinct ksb_id) filter (where is_primary)::int as distinct_primary_ksbs
      from public.gta_spine_item_ksbs
      where programme_version_id = $1
      `,
      [VERSION_ID],
    )
  ).rows[0];
  console.log("BY_BLOCK", JSON.stringify(summary, null, 2));
  console.log("TOTALS", JSON.stringify(totals));
  if (totals.primaries !== 15 || totals.distinct_primary_ksbs !== 15) {
    die("Primary count drifted");
  }
  console.log(
    "OK — weekly SOW coverage + AF1.34 Block 1 FS attached. Jon Primaries unchanged. Draft not published.",
  );
} finally {
  await client.end();
}
