/**
 * Independent post-persist authoritative verification for Autocare V1 baseline.
 */
import { createClient } from "@supabase/supabase-js";
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

const PV = "231a8a32-d876-4312-a178-960d19dcf938";
const GAPS = new Set([
  "B5","K1","K2","K7","K13","K18","K20","K31","K34","S7","S11","S20","S23","S25",
  "K8","S9","K10","K28",
]);
const DIST = new Set(["S10"]);

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: ver } = await sb
  .from("gta_programme_versions")
  .select("id, standard_version_id, parameters")
  .eq("id", PV)
  .single();
const { data: spine } = await sb
  .from("gta_spines")
  .select("id")
  .eq("programme_version_id", PV)
  .single();
const { data: items } = await sb
  .from("gta_spine_items")
  .select("id, item_type, title, planned_otj_hours")
  .eq("spine_id", spine.id);
const { data: maps } = await sb
  .from("gta_spine_item_ksbs")
  .select("id, spine_item_id, is_primary, learning_intent, curriculum_value, ksb_id, created_by")
  .eq("programme_version_id", PV);
const { data: ksbs } = await sb
  .from("se_ksbs")
  .select("id, ksb_code")
  .eq("standard_version_id", ver.standard_version_id);

const codeById = new Map(ksbs.map((k) => [k.id, String(k.ksb_code).toUpperCase()]));
const itemById = new Map(items.map((i) => [i.id, i]));
const otj = items.reduce((s, i) => s + (Number(i.planned_otj_hours) || 0), 0);

const primaries = maps.filter((m) => m.is_primary).map((m) => {
  const item = itemById.get(m.spine_item_id);
  return {
    code: codeById.get(m.ksb_id),
    blockId: m.spine_item_id,
    itemType: item?.item_type,
    intent: m.learning_intent,
    value: Number(m.curriculum_value),
    createdBy: m.created_by,
  };
});

const byCode = new Map();
for (const p of primaries) {
  byCode.set(p.code, (byCode.get(p.code) || 0) + 1);
}
const dups = [...byCode.entries()].filter(([, n]) => n !== 1).map(([c]) => c);
const nonBlock = primaries.filter((p) => p.itemType !== "block");
const gwEpa = maps.filter((m) => {
  const t = itemById.get(m.spine_item_id)?.item_type;
  return t === "gateway" || t === "epa";
});

const primarySet = new Set(primaries.map((p) => p.code));
const issues = [];
for (const k of ksbs) {
  const code = String(k.ksb_code).toUpperCase();
  const n =
    (primarySet.has(code) ? 1 : 0) +
    (GAPS.has(code) ? 1 : 0) +
    (DIST.has(code) ? 1 : 0);
  if (n !== 1) issues.push({ code, n });
}

const byCreator = {};
for (const p of primaries) {
  byCreator[p.createdBy] = (byCreator[p.createdBy] || 0) + 1;
}

const report = {
  programmeVersionId: PV,
  official: ksbs.length,
  approvedPrimaries: primaries.length,
  reviewedGaps: 18,
  distributedSkill: 1,
  unresolved: 0,
  sum: primaries.length + 18 + 1,
  duplicatePrimaries: dups.length,
  nonBlockPrimaries: nonBlock.length,
  gatewayEpaMappings: gwEpa.length,
  mappingRows: maps.length,
  structuredOtj: otj,
  publicationBlocked: primaries.length < 64,
  provenanceCounts: byCreator,
  classificationIssues: issues,
  ok:
    ksbs.length === 64 &&
    primaries.length === 45 &&
    maps.length === 45 &&
    dups.length === 0 &&
    nonBlock.length === 0 &&
    gwEpa.length === 0 &&
    issues.length === 0 &&
    otj === 611.5 &&
    primaries.length + 18 + 1 === 64,
};

writeFileSync(
  ".tmp-persist-v1-baseline-postverify.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
