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

const EXPECTED = new Set(
  "K3 K4 K5 K6 K8 K9 K10 K11 K14 K15 K16 K17 K19 K22 K25 K26 K27 K28 K32 K33 S5 S6 S8 S9 S10 S16 S17 S18 S21 S22 S24 B1 B2 B3 B4".split(
    " ",
  ),
);
const GAPS = new Set(
  "B5 K1 K2 K7 K13 K18 K20 K31 K34 S7 S11 S20 S23 S25".split(" "),
);

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const PV = "231a8a32-d876-4312-a178-960d19dcf938";
const { data: ver } = await sb
  .from("gta_programme_versions")
  .select("standard_version_id")
  .eq("id", PV)
  .single();
const { data: official, error } = await sb
  .from("se_ksbs")
  .select("id, ksb_code, ksb_type, description")
  .eq("standard_version_id", ver.standard_version_id);
if (error) throw error;
const { data: maps } = await sb
  .from("gta_spine_item_ksbs")
  .select("ksb_id, is_primary")
  .eq("programme_version_id", PV);
const codeById = new Map(
  (official || []).map((r) => [r.id, String(r.ksb_code).toUpperCase()]),
);
const approved = new Set(
  (maps || [])
    .filter((m) => m.is_primary)
    .map((m) => codeById.get(m.ksb_id))
    .filter(Boolean),
);
const all = (official || []).map((r) => String(r.ksb_code).toUpperCase());
const unresolved = all
  .filter((c) => !approved.has(c) && !GAPS.has(c))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const missingFromActual = [...EXPECTED].filter((c) => !unresolved.includes(c));
const extraInActual = unresolved.filter((c) => !EXPECTED.has(c));
const defs = Object.fromEntries(
  (official || []).map((r) => [
    String(r.ksb_code).toUpperCase(),
    { type: r.ksb_type, statement: r.description },
  ]),
);
const report = {
  match:
    missingFromActual.length === 0 &&
    extraInActual.length === 0 &&
    unresolved.length === 35 &&
    all.length === 64 &&
    approved.size === 15,
  official: all.length,
  approvedCount: approved.size,
  approved: [...approved].sort(),
  gapCount: GAPS.size,
  unresolvedCount: unresolved.length,
  unresolved,
  missingFromActual,
  extraInActual,
  definitions: defs,
};
writeFileSync(".tmp-v1-unresolved-verify.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  match: report.match,
  official: report.official,
  approvedCount: report.approvedCount,
  gapCount: report.gapCount,
  unresolvedCount: report.unresolvedCount,
  missingFromActual,
  extraInActual,
}, null, 2));
