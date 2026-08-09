/**
 * Direct Supabase persist of ONLY the 15 human-approved Primaries.
 * Does not touch spine items, OTJ, or parameters.
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
const STANDARD_VERSION_HINT = null; // resolved from programme version

const FORBIDDEN = new Set([
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
]);

const APPROVED = [
  { ksbCode: "K12", blockId: "dfdf81db-7ed0-46ba-856a-df0f87b07782" },
  { ksbCode: "K24", blockId: "dfdf81db-7ed0-46ba-856a-df0f87b07782" },
  { ksbCode: "S12", blockId: "dfdf81db-7ed0-46ba-856a-df0f87b07782" },
  { ksbCode: "S15", blockId: "dfdf81db-7ed0-46ba-856a-df0f87b07782" },
  { ksbCode: "K29", blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "K30", blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "S1", blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "S2", blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "S3", blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "S19", blockId: "06873abc-907b-4f07-a360-44afc76d2843" },
  { ksbCode: "S4", blockId: "fe75972c-69c5-466b-819e-65eeb8ce7666" },
  { ksbCode: "K21", blockId: "41b13e4c-a689-4a0a-b883-51139a0537cc" },
  { ksbCode: "K23", blockId: "41b13e4c-a689-4a0a-b883-51139a0537cc" },
  { ksbCode: "S13", blockId: "41b13e4c-a689-4a0a-b883-51139a0537cc" },
  { ksbCode: "S14", blockId: "41b13e4c-a689-4a0a-b883-51139a0537cc" },
];

async function main() {
  if (APPROVED.length !== 15) throw new Error("need exactly 15");
  for (const r of APPROVED) {
    if (FORBIDDEN.has(r.ksbCode)) throw new Error(`forbidden ${r.ksbCode}`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: version, error: vErr } = await supabase
    .from("gta_programme_versions")
    .select("id, standard_version_id, parameters")
    .eq("id", PROGRAMME_VERSION_ID)
    .single();
  if (vErr) throw new Error(vErr.message);

  const paramsBefore = JSON.stringify(version.parameters ?? null);

  const { data: spine, error: sErr } = await supabase
    .from("gta_spines")
    .select("id")
    .eq("programme_version_id", PROGRAMME_VERSION_ID)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!spine?.id) throw new Error("No spine for programme version");

  const { data: items, error: iErr } = await supabase
    .from("gta_spine_items")
    .select("id, item_type, title, sequence, planned_otj_hours")
    .eq("spine_id", spine.id);
  if (iErr) throw new Error(iErr.message);
  const itemById = new Map((items ?? []).map((r) => [r.id, r]));
  const structuredOtj = (items ?? []).reduce(
    (sum, r) => sum + (Number(r.planned_otj_hours) || 0),
    0,
  );
  if (structuredOtj !== 611.5) {
    throw new Error(
      `Refusing: structured spine OTJ is ${structuredOtj}, want 611.5 (parameters left untouched)`,
    );
  }

  const blockIds = APPROVED.map((r) => r.blockId);
  for (const id of blockIds) {
    const it = itemById.get(id);
    if (!it) throw new Error(`Missing spine item ${id}`);
    if (it.item_type !== "block") {
      throw new Error(`Target ${id} is ${it.item_type}, not block`);
    }
  }

  const { data: existingMaps, error: emErr } = await supabase
    .from("gta_spine_item_ksbs")
    .select("id, spine_item_id, is_primary, ksb_id")
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (emErr) throw new Error(emErr.message);

  if ((existingMaps ?? []).length > 0) {
    // Allow only if they are exactly our 15 already (idempotent re-run check later)
    console.log(
      "Existing mappings:",
      existingMaps.length,
      "— will abort unless zero before exclusive write",
    );
    throw new Error(
      `Refusing: already have ${existingMaps.length} mappings on this version`,
    );
  }

  const { data: ksbRows, error: kErr } = await supabase
    .from("se_ksbs")
    .select("id, ksb_code")
    .eq("standard_version_id", version.standard_version_id);
  if (kErr) throw new Error(kErr.message);
  const idByCode = new Map(
    (ksbRows ?? []).map((r) => [String(r.ksb_code).toUpperCase(), r.id]),
  );

  const now = new Date().toISOString();
  const inserts = APPROVED.map((row) => {
    const ksbId = idByCode.get(row.ksbCode);
    if (!ksbId) throw new Error(`Official KSB missing: ${row.ksbCode}`);
    return {
      id: randomUUID(),
      spine_item_id: row.blockId,
      ksb_id: ksbId,
      programme_version_id: PROGRAMME_VERSION_ID,
      is_primary: true,
      learning_intent: "introduce",
      curriculum_value: 1.0,
      mapping_source: "manual",
      recommendation_provider: null,
      recommendation_feature: null,
      recommended_intent: null,
      recommendation_accepted: null,
      confidence: null,
      ai_reason_summary: null,
      created_by: "human-approved-primary-batch",
      created_at: now,
      updated_at: now,
    };
  });

  const { error: insErr } = await supabase
    .from("gta_spine_item_ksbs")
    .insert(inserts);
  if (insErr) throw new Error(insErr.message);

  // Read back
  const { data: mapRows, error: rErr } = await supabase
    .from("gta_spine_item_ksbs")
    .select(
      "id, spine_item_id, is_primary, learning_intent, curriculum_value, ksb_id",
    )
    .eq("programme_version_id", PROGRAMME_VERSION_ID);
  if (rErr) throw new Error(rErr.message);

  const codeById = new Map(
    (ksbRows ?? []).map((r) => [r.id, String(r.ksb_code).toUpperCase()]),
  );

  const enriched = (mapRows ?? []).map((m) => {
    const code = codeById.get(m.ksb_id);
    const item = itemById.get(m.spine_item_id);
    return {
      ksbCode: code,
      blockId: m.spine_item_id,
      itemType: item?.item_type,
      title: item?.title,
      isPrimary: m.is_primary,
      learningIntent: m.learning_intent,
      curriculumValue: Number(m.curriculum_value),
    };
  });

  const primaries = enriched.filter((m) => m.isPrimary);
  const counts = new Map();
  for (const p of primaries) {
    counts.set(p.ksbCode, (counts.get(p.ksbCode) || 0) + 1);
  }
  const multi = [...counts.entries()].filter(([, n]) => n !== 1).map(([c]) => c);
  const nonBlock = primaries.filter((m) => m.itemType !== "block");
  const gapHit = primaries.filter((m) => FORBIDDEN.has(m.ksbCode));
  const gwEpa = enriched.filter(
    (m) => m.itemType === "gateway" || m.itemType === "epa",
  );

  // Confirm parameters untouched
  const { data: ver2 } = await supabase
    .from("gta_programme_versions")
    .select("parameters")
    .eq("id", PROGRAMME_VERSION_ID)
    .single();
  const paramsAfter = JSON.stringify(ver2?.parameters ?? null);

  const { data: itemsAfter } = await supabase
    .from("gta_spine_items")
    .select("planned_otj_hours")
    .eq("spine_id", spine.id);
  const structuredOtjAfter = (itemsAfter ?? []).reduce(
    (sum, r) => sum + (Number(r.planned_otj_hours) || 0),
    0,
  );

  const report = {
    at: new Date().toISOString(),
    programmeVersionId: PROGRAMME_VERSION_ID,
    standardVersionId: version.standard_version_id,
    structuredOtjBefore: structuredOtj,
    structuredOtjAfter,
    parametersUnchanged: paramsBefore === paramsAfter,
    mappingCount: enriched.length,
    primaryCount: primaries.length,
    duplicatePrimaryCodes: multi,
    nonBlockPrimaryCount: nonBlock.length,
    forbiddenGapPrimaryCount: gapHit.length,
    gatewayEpaMappingCount: gwEpa.length,
    officialKsbCountOnStandard: ksbRows?.length ?? null,
    rows: enriched.sort((a, b) =>
      String(a.ksbCode).localeCompare(String(b.ksbCode)),
    ),
    ok:
      enriched.length === 15 &&
      primaries.length === 15 &&
      multi.length === 0 &&
      nonBlock.length === 0 &&
      gapHit.length === 0 &&
      gwEpa.length === 0 &&
      structuredOtjAfter === 611.5 &&
      paramsBefore === paramsAfter,
  };

  writeFileSync(
    ".tmp-persist-15-approved-primaries-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
