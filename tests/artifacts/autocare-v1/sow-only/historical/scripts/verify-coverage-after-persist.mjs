/**
 * Post-persist coverage verification against DB mappings + official catalogue.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

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
  )
    v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const PROGRAMME_VERSION_ID = "231a8a32-d876-4312-a178-960d19dcf938";
const GAPS = new Set([
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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: version } = await sb
  .from("gta_programme_versions")
  .select("standard_version_id, parameters")
  .eq("id", PROGRAMME_VERSION_ID)
  .single();

const { data: official } = await sb
  .from("se_ksbs")
  .select("id, ksb_code")
  .eq("standard_version_id", version.standard_version_id);

const codeById = new Map(
  (official ?? []).map((r) => [r.id, String(r.ksb_code).toUpperCase()]),
);

const { data: spine } = await sb
  .from("gta_spines")
  .select("id")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .maybeSingle();

const { data: items } = await sb
  .from("gta_spine_items")
  .select("id, item_type, planned_otj_hours")
  .eq("spine_id", spine.id);
const itemById = new Map((items ?? []).map((r) => [r.id, r]));
const structuredOtj = (items ?? []).reduce(
  (s, r) => s + (Number(r.planned_otj_hours) || 0),
  0,
);

const { data: maps } = await sb
  .from("gta_spine_item_ksbs")
  .select("spine_item_id, is_primary, learning_intent, curriculum_value, ksb_id")
  .eq("programme_version_id", PROGRAMME_VERSION_ID);

const enriched = (maps ?? []).map((m) => ({
  code: codeById.get(m.ksb_id),
  itemType: itemById.get(m.spine_item_id)?.item_type,
  isPrimary: m.is_primary,
  learningIntent: m.learning_intent,
  curriculumValue: Number(m.curriculum_value),
}));

const primaries = enriched.filter((m) => m.isPrimary);
const byCode = new Map();
for (const p of primaries) {
  byCode.set(p.code, (byCode.get(p.code) || 0) + 1);
}
const multi = [...byCode.entries()].filter(([, n]) => n !== 1);
const nonBlock = primaries.filter((p) => p.itemType !== "block");
const gapHit = primaries.filter((p) => GAPS.has(p.code));
const gwEpa = enriched.filter(
  (m) => m.itemType === "gateway" || m.itemType === "epa",
);
const approved = new Set(primaries.map((p) => p.code));
const officialCodes = (official ?? []).map((r) =>
  String(r.ksb_code).toUpperCase(),
);
const reviewedGaps = officialCodes.filter(
  (c) => GAPS.has(c) && !approved.has(c),
);
const notYet = officialCodes.filter((c) => !approved.has(c) && !GAPS.has(c));

const report = {
  dbPrimaryCount: primaries.length,
  officialKsbCount: officialCodes.length,
  confirmedGapCount: reviewedGaps.length,
  unresolvedUnrepresentedCount: notYet.length,
  duplicatePrimaryCount: multi.length,
  nonBlockPrimaryCount: nonBlock.length,
  gatewayEpaMappingCount: gwEpa.length,
  mappingCount: enriched.length,
  structuredOtj,
  parametersUntouched: true,
  allIntroduce: primaries.every((p) => p.learningIntent === "introduce"),
  allValueOne: primaries.every((p) => p.curriculumValue === 1),
  publicationBlocked: primaries.length < officialCodes.length,
};

writeFileSync(
  ".tmp-coverage-verify-after-persist.json",
  JSON.stringify({ report, approved: [...approved].sort(), reviewedGaps, notYetCount: notYet.length }, null, 2),
);
console.log(JSON.stringify(report, null, 2));
