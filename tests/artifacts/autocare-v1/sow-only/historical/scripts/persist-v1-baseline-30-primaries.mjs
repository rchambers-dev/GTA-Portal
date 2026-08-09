/**
 * Persist Autocare V1 golden baseline Primaries (30 new; keep existing 15).
 * REVIEW provenance written separately. Does not touch OTJ/parameters/spine.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const raw = readFileSync(resolve(".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const PROGRAMME_VERSION_ID = "231a8a32-d876-4312-a178-960d19dcf938";

/** Block number → spine item id (from preflight). */
const BLOCK_BY_NUM = {
  1: "8434da7b-1783-4430-9cb7-bd5884bbda9d",
  2: "dfdf81db-7ed0-46ba-856a-df0f87b07782",
  3: "06873abc-907b-4f07-a360-44afc76d2843",
  4: "fe75972c-69c5-466b-819e-65eeb8ce7666",
  5: "997300c5-ee32-4ef4-b562-e0571e436a6a",
  6: "41b13e4c-a689-4a0a-b883-51139a0537cc",
  7: "677a5a43-df92-4c9d-92ae-30e2c2979c40",
  8: "1975e5ce-49fe-4baa-944a-a637a1f4d9be",
  9: "358fb8a6-e2a3-42e9-bee1-28873a0643ef",
  10: "93f19eef-9378-4e90-a913-510382777ac5",
};

const EXISTING_15 = new Set([
  "K12",
  "K24",
  "S12",
  "S15",
  "K29",
  "K30",
  "S1",
  "S2",
  "S3",
  "S19",
  "S4",
  "K21",
  "K23",
  "S13",
  "S14",
]);

const GAPS_18 = new Set([
  "B5",
  "K1",
  "K2",
  "K7",
  "K13",
  "K18",
  "K20",
  "K31",
  "K34",
  "S7",
  "S11",
  "S20",
  "S23",
  "S25",
  "K8",
  "S9",
  "K10",
  "K28",
]);

const DISTRIBUTED = new Set(["S10"]);

/** 23 automated HIGH + 7 human-verified */
const NEW_PRIMARIES = [
  // automated HIGH
  { ksbCode: "B1", block: 1, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "B2", block: 3, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "B3", block: 6, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "B4", block: 10, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K3", block: 1, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K4", block: 3, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K5", block: 1, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K9", block: 7, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K11", block: 5, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K14", block: 6, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K17", block: 9, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K19", block: 2, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K22", block: 9, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K26", block: 2, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K27", block: 2, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "K33", block: 1, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "S5", block: 1, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "S6", block: 3, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "S8", block: 1, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "S17", block: 2, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "S18", block: 8, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "S22", block: 1, provenance: "AUTOMATED_HIGH" },
  { ksbCode: "S24", block: 10, provenance: "AUTOMATED_HIGH" },
  // human-verified
  { ksbCode: "K15", block: 2, provenance: "HUMAN_VERIFIED" },
  { ksbCode: "K16", block: 2, provenance: "HUMAN_VERIFIED" },
  { ksbCode: "K32", block: 5, provenance: "HUMAN_VERIFIED" },
  { ksbCode: "S21", block: 5, provenance: "HUMAN_VERIFIED" },
  { ksbCode: "S16", block: 3, provenance: "HUMAN_VERIFIED" },
  { ksbCode: "K6", block: 1, provenance: "HUMAN_VERIFIED" },
  { ksbCode: "K25", block: 6, provenance: "HUMAN_VERIFIED" },
];

async function main() {
  if (NEW_PRIMARIES.length !== 30) {
    throw new Error(`Expected 30 new Primaries, got ${NEW_PRIMARIES.length}`);
  }

  const codes = NEW_PRIMARIES.map((r) => r.ksbCode);
  if (new Set(codes).size !== 30) throw new Error("Duplicate codes in NEW_PRIMARIES");

  for (const row of NEW_PRIMARIES) {
    if (EXISTING_15.has(row.ksbCode)) {
      throw new Error(`Conflict: ${row.ksbCode} already in existing 15`);
    }
    if (GAPS_18.has(row.ksbCode)) {
      throw new Error(`Conflict: ${row.ksbCode} is a reviewed gap`);
    }
    if (DISTRIBUTED.has(row.ksbCode)) {
      throw new Error(`Conflict: ${row.ksbCode} is distributed-skill exception`);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: ver, error: vErr } = await sb
    .from("gta_programme_versions")
    .select("id, standard_version_id, parameters")
    .eq("id", PROGRAMME_VERSION_ID)
    .single();
  if (vErr) throw new Error(vErr.message);
  const paramsBefore = JSON.stringify(ver.parameters ?? null);

  const { data: spine, error: sErr } = await sb
    .from("gta_spines")
    .select("id")
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .single();
  if (sErr) throw new Error(sErr.message);

  const { data: items, error: iErr } = await sb
    .from("gta_spine_items")
    .select("id, item_type, title, sequence, planned_otj_hours, metadata")
    .eq("spine_id", spine.id);
  if (iErr) throw new Error(iErr.message);

  const itemById = new Map((items ?? []).map((r) => [r.id, r]));
  const otjBefore = (items ?? []).reduce(
    (s, r) => s + (Number(r.planned_otj_hours) || 0),
    0,
  );
  if (otjBefore !== 611.5) {
    throw new Error(`Abort: structured OTJ ${otjBefore}, want 611.5`);
  }

  for (const [n, id] of Object.entries(BLOCK_BY_NUM)) {
    const it = itemById.get(id);
    if (!it) throw new Error(`Abort: missing block ${n} ${id}`);
    if (it.item_type !== "block") {
      throw new Error(`Abort: ${id} is ${it.item_type}, not block`);
    }
  }

  const { data: existingMaps, error: emErr } = await sb
    .from("gta_spine_item_ksbs")
    .select("id, spine_item_id, is_primary, ksb_id, learning_intent, curriculum_value")
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (emErr) throw new Error(emErr.message);

  const { data: ksbs, error: kErr } = await sb
    .from("se_ksbs")
    .select("id, ksb_code")
    .eq("standard_version_id", ver.standard_version_id);
  if (kErr) throw new Error(kErr.message);
  if ((ksbs ?? []).length !== 64) {
    throw new Error(`Abort: official KSB count ${(ksbs ?? []).length}, want 64`);
  }

  const idByCode = new Map(
    (ksbs ?? []).map((r) => [String(r.ksb_code).toUpperCase(), r.id]),
  );
  const codeById = new Map(
    (ksbs ?? []).map((r) => [r.id, String(r.ksb_code).toUpperCase()]),
  );

  const existingPrimaries = (existingMaps ?? []).filter((m) => m.is_primary);
  const existingCodes = new Set(
    existingPrimaries.map((m) => codeById.get(m.ksb_id)),
  );

  if (existingPrimaries.length !== 15) {
    throw new Error(
      `Abort: expected exactly 15 existing Primaries before write, found ${existingPrimaries.length}`,
    );
  }
  for (const code of EXISTING_15) {
    if (!existingCodes.has(code)) {
      throw new Error(`Abort: missing expected existing Primary ${code}`);
    }
  }
  for (const code of existingCodes) {
    if (!EXISTING_15.has(code)) {
      throw new Error(`Abort: unexpected existing Primary ${code}`);
    }
  }

  // Abort if any new code already mapped as Primary
  for (const row of NEW_PRIMARIES) {
    if (existingCodes.has(row.ksbCode)) {
      throw new Error(`Abort: would overwrite existing Primary ${row.ksbCode}`);
    }
  }

  // Abort if any target KSB already has ANY mapping (should be none beyond 15)
  const mappedCodes = new Set(
    (existingMaps ?? []).map((m) => codeById.get(m.ksb_id)),
  );
  for (const row of NEW_PRIMARIES) {
    if (mappedCodes.has(row.ksbCode)) {
      throw new Error(`Abort: ${row.ksbCode} already has a mapping row`);
    }
  }

  const now = new Date().toISOString();
  const inserts = NEW_PRIMARIES.map((row) => {
    const ksbId = idByCode.get(row.ksbCode);
    if (!ksbId) throw new Error(`Official KSB missing: ${row.ksbCode}`);
    const blockId = BLOCK_BY_NUM[row.block];
    if (!blockId) throw new Error(`No block id for B${row.block}`);
    return {
      id: randomUUID(),
      spine_item_id: blockId,
      ksb_id: ksbId,
      programme_version_id: PROGRAMME_VERSION_ID,
      is_primary: true,
      learning_intent: "introduce",
      curriculum_value: 1.0,
      mapping_source: "manual",
      recommendation_provider:
        row.provenance === "AUTOMATED_HIGH" ? "portal_ai" : null,
      recommendation_feature:
        row.provenance === "AUTOMATED_HIGH" ? "v1_golden_baseline" : null,
      recommended_intent: row.provenance === "AUTOMATED_HIGH" ? "introduce" : null,
      recommendation_accepted: row.provenance === "AUTOMATED_HIGH" ? true : null,
      confidence: null,
      ai_reason_summary: `V1 golden baseline Primary (${row.provenance}) → B${row.block}`,
      created_by:
        row.provenance === "AUTOMATED_HIGH"
          ? "v1-baseline-auto-high-approved"
          : "v1-baseline-human-verified-approved",
      created_at: now,
      updated_at: now,
      _meta: row,
    };
  });

  const dbRows = inserts.map(({ _meta, ...row }) => row);

  const { error: insErr } = await sb.from("gta_spine_item_ksbs").insert(dbRows);
  if (insErr) throw new Error(insErr.message);

  // -------- post-write verification --------
  const { data: mapRows, error: rErr } = await sb
    .from("gta_spine_item_ksbs")
    .select(
      "id, spine_item_id, is_primary, learning_intent, curriculum_value, ksb_id, created_by, ai_reason_summary",
    )
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (rErr) throw new Error(rErr.message);

  const enriched = (mapRows ?? []).map((m) => {
    const code = codeById.get(m.ksb_id);
    const item = itemById.get(m.spine_item_id);
    return {
      id: m.id,
      ksbCode: code,
      blockId: m.spine_item_id,
      itemType: item?.item_type,
      title: item?.title,
      isPrimary: m.is_primary,
      learningIntent: m.learning_intent,
      curriculumValue: Number(m.curriculum_value),
      createdBy: m.created_by,
      aiReasonSummary: m.ai_reason_summary,
    };
  });

  const primaries = enriched.filter((m) => m.isPrimary);
  const counts = new Map();
  for (const p of primaries) {
    counts.set(p.ksbCode, (counts.get(p.ksbCode) || 0) + 1);
  }
  const multi = [...counts.entries()]
    .filter(([, n]) => n !== 1)
    .map(([c]) => c);
  const nonBlock = primaries.filter((m) => m.itemType !== "block");
  const gapHit = primaries.filter((m) => GAPS_18.has(m.ksbCode));
  const distHit = primaries.filter((m) => DISTRIBUTED.has(m.ksbCode));
  const gwEpa = enriched.filter(
    (m) => m.itemType === "gateway" || m.itemType === "epa",
  );

  const { data: ver2 } = await sb
    .from("gta_programme_versions")
    .select("parameters")
    .eq("id", PROGRAMME_VERSION_ID)
    .single();
  const paramsAfter = JSON.stringify(ver2?.parameters ?? null);

  const { data: itemsAfter } = await sb
    .from("gta_spine_items")
    .select("planned_otj_hours")
    .eq("spine_id", spine.id);
  const otjAfter = (itemsAfter ?? []).reduce(
    (s, r) => s + (Number(r.planned_otj_hours) || 0),
    0,
  );

  const primaryCodes = new Set(primaries.map((p) => p.ksbCode));
  const unclassified = [];
  for (const k of ksbs ?? []) {
    const code = String(k.ksb_code).toUpperCase();
    const n =
      (primaryCodes.has(code) ? 1 : 0) +
      (GAPS_18.has(code) ? 1 : 0) +
      (DISTRIBUTED.has(code) ? 1 : 0);
    if (n !== 1) unclassified.push({ code, classifications: n });
  }

  const written = inserts.map((r) => ({
    ksbCode: r._meta.ksbCode,
    block: r._meta.block,
    blockId: r.spine_item_id,
    provenance: r._meta.provenance,
    createdBy: r.created_by,
    isPrimary: true,
    learningIntent: "introduce",
    curriculumValue: 1.0,
  }));

  const report = {
    at: now,
    programmeVersionId: PROGRAMME_VERSION_ID,
    standardVersionId: ver.standard_version_id,
    before: {
      primaryCount: 15,
      mappingCount: (existingMaps ?? []).length,
      structuredOtj: otjBefore,
    },
    after: {
      primaryCount: primaries.length,
      mappingCount: enriched.length,
      structuredOtj: otjAfter,
    },
    rowsWritten: written,
    rowsWrittenCount: written.length,
    duplicatePrimaryCodes: multi,
    nonBlockPrimaryCount: nonBlock.length,
    gapPrimaryConflicts: gapHit.map((r) => r.ksbCode),
    distributedPrimaryConflicts: distHit.map((r) => r.ksbCode),
    gatewayEpaMappingCount: gwEpa.length,
    parametersUnchanged: paramsBefore === paramsAfter,
    otjUnchanged: otjBefore === otjAfter && otjAfter === 611.5,
    reconciliation: {
      official: 64,
      approvedPrimaries: primaries.length,
      reviewedGaps: 18,
      distributedSkill: 1,
      unresolved: unclassified.filter((u) => u.classifications === 0).length,
      multiClassified: unclassified.filter((u) => u.classifications > 1),
      sum: primaries.length + 18 + 1,
    },
    classificationAudit: unclassified,
    allPrimaries: enriched
      .filter((m) => m.isPrimary)
      .map((m) => ({
        ksbCode: m.ksbCode,
        blockId: m.blockId,
        title: m.title,
        createdBy: m.createdBy,
      }))
      .sort((a, b) => String(a.ksbCode).localeCompare(String(b.ksbCode))),
    ok:
      primaries.length === 45 &&
      enriched.length === 45 &&
      multi.length === 0 &&
      nonBlock.length === 0 &&
      gapHit.length === 0 &&
      distHit.length === 0 &&
      gwEpa.length === 0 &&
      unclassified.length === 0 &&
      primaries.length + 18 + 1 === 64 &&
      paramsBefore === paramsAfter &&
      otjAfter === 611.5,
  };

  writeFileSync(
    ".tmp-persist-v1-baseline-30-primaries-report.json",
    JSON.stringify(report, null, 2),
  );

  // Golden baseline provenance (not programme truth table — review artifact)
  const provenance = {
    status: "V1_GOLDEN_BASELINE_PERSISTED",
    programmeVersionId: PROGRAMME_VERSION_ID,
    persistedAt: now,
    classifications: {
      existingHumanApprovedPrimaries: [...EXISTING_15].sort(),
      automatedHighApprovedPrimaries: NEW_PRIMARIES.filter(
        (r) => r.provenance === "AUTOMATED_HIGH",
      ).map((r) => ({ ksbCode: r.ksbCode, primaryBlock: r.block })),
      humanVerifiedApprovedPrimaries: NEW_PRIMARIES.filter(
        (r) => r.provenance === "HUMAN_VERIFIED",
      ).map((r) => ({ ksbCode: r.ksbCode, primaryBlock: r.block })),
      reviewedCurriculumGaps: [...GAPS_18].sort(),
      distributedSkillPrimaryOwnershipReview: ["S10"],
    },
    notes: [
      "Reinforcement mappings were intentionally not created.",
      "AI Proposed Amendments remain advisory and contribute 0 to coverage.",
      "Publication remains blocked (45/64 Primaries).",
    ],
  };
  writeFileSync(
    ".tmp-autocare-v1-golden-baseline-provenance.json",
    JSON.stringify(provenance, null, 2),
  );

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
