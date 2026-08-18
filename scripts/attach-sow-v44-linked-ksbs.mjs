/**
 * Attach SOW v4.4 Linked KSBs to Autocare blocks 2–10.
 * Jon's 15 approved Primaries stay Primary; all other linked codes are
 * non-primary (reinforce) on that block. B1 / gateway / EPA unchanged.
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

function expandLinkedList(spec) {
  const codes = new Set();
  for (const part of spec.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
    const range = /^(K|S|B)(\d+)\s*-\s*(?:(K|S|B))?(\d+)$/i.exec(part);
    if (range) {
      const letter = range[1].toUpperCase();
      const from = Number(range[2]);
      const to = Number(range[4]);
      if (from > to) die(`Bad range ${part}`);
      for (let n = from; n <= to; n++) codes.add(`${letter}${n}`);
      continue;
    }
    const single = /^(K|S|B)(\d+)$/i.exec(part);
    if (!single) die(`Unparsed token: ${part}`);
    codes.add(`${single[1].toUpperCase()}${single[2]}`);
  }
  return [...codes];
}

const VERSION_ID = "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";
const SOW_LINKED = {
  2: "K2, K5-K16, K19, K20, K25-K34; S1, S2, S5, S7, S8, S10, S11, S13, S15-S26; B1-B5",
  3: "K1-K16, K19-K34; S1-S8, S10-S26; B1-B5",
  4: "K1-K16, K19, K21-K34; S1-S6, S10-S14, S16-S26; B1-B5",
  5: "K1-K16, K19-K34; S1-S8, S10-S26; B1-B5",
  6: "K1-K16, K19-K34; S1-S8, S10-S26; B1-B5",
  7: "K1-K16, K19-K34; S1-S8, S10-S26; B1-B5",
  8: "K1-K16, K19-K34; S1-S8, S10-S26; B1-B5",
  9: "K1-K17, K19, K21-K29; S1, S5-S7, S10-S14, S16-S20, S22-S24, S26; B1-B5",
  10: "K1-K34; S1-S8, S10-S26; B1-B5",
};

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
const jonPrimaryByCode = new Map(
  Object.entries(decisions.approvedPrimaries).map(([code, row]) => [
    code.toUpperCase(),
    Number(row.primaryBlock),
  ]),
);

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
  for (const [blockNumberRaw, spec] of Object.entries(SOW_LINKED)) {
    const blockNumber = Number(blockNumberRaw);
    const block = blockByNumber.get(blockNumber);
    if (!block) die(`Missing block ${blockNumber}`);
    for (const code of expandLinkedList(spec)) {
      const ksb = ksbByCode.get(code);
      if (!ksb) {
        skipped.push({ code, blockNumber, reason: "not in official ST0499 v1.3" });
        continue;
      }
      const jonBlock = jonPrimaryByCode.get(code);
      planned.push({
        blockNumber,
        spineItemId: block.id,
        ksbCode: code,
        ksbId: ksb.id,
        isPrimary: jonBlock === blockNumber,
        learningIntent: jonBlock === blockNumber ? "practise" : "reinforce",
      });
    }
  }

  const existing = (
    await client.query(
      `
      select m.id, m.spine_item_id, m.ksb_id, m.is_primary, k.ksb_code
      from public.gta_spine_item_ksbs m
      join public.se_ksbs k on k.id = m.ksb_id
      where m.programme_version_id = $1
      `,
      [VERSION_ID],
    )
  ).rows;
  const existingKey = new Set(
    existing.map((row) => `${row.spine_item_id}:${row.ksb_id}`),
  );
  const existingPrimaries = existing.filter((row) => row.is_primary).length;
  if (existingPrimaries !== 15) {
    die(`Expected 15 existing Primaries, found ${existingPrimaries}`);
  }

  const toInsert = planned.filter(
    (row) => !existingKey.has(`${row.spineItemId}:${row.ksbId}`),
  );

  console.log(
    JSON.stringify(
      {
        planned: planned.length,
        alreadyPresent: planned.length - toInsert.length,
        toInsert: toInsert.length,
        skipped,
        primariesInPlan: planned.filter((r) => r.isPrimary).length,
      },
      null,
      2,
    ),
  );

  await client.query("begin");
  try {
    for (const row of toInsert) {
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
          'SOW v4.4 Linked KSBs',
          $6
        )
        `,
        [
          VERSION_ID,
          row.spineItemId,
          row.ksbId,
          row.isPrimary,
          row.learningIntent,
          row.isPrimary
            ? "Jon approved Primary"
            : `SOW v4.4 Linked KSB on Block ${row.blockNumber}`,
        ],
      );
    }
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
  console.log("OK — SOW linked KSBs attached. Jon Primaries unchanged. Draft not published.");
} finally {
  await client.end();
}
