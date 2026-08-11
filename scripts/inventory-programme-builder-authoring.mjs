/**
 * READ-ONLY Programme Builder authoring inventory.
 * Never deletes. Never writes.
 *
 * Usage: node scripts/inventory-programme-builder-authoring.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

function redactUrl(url) {
  if (!url) return "(empty)";
  const m = String(url).match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (m) {
    const ref = m[1];
    return `https://${ref.slice(0, 6)}…${ref.slice(-4)}.supabase.co (ref_len=${ref.length})`;
  }
  if (/localhost|127\.0\.0\.1/i.test(url)) return url;
  return `(non-supabase host; len=${url.length})`;
}

function projectRef(url) {
  const m = String(url || "").match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const ref = projectRef(url);
const looksLocal = /localhost|127\.0\.0\.1/i.test(url);
const looksCloud = /supabase\.co/i.test(url);

console.log("=== ENVIRONMENT (read-only) ===");
console.log("supabase_url:", redactUrl(url));
console.log("project_ref:", ref || "(unknown)");
console.log("looks_localhost:", looksLocal);
console.log("looks_supabase_cloud:", looksCloud);
console.log("service_role_key_len:", serviceRoleKey.length);
console.log(
  "NOTE: Hardcoded wipe-training-data.mjs ref cjtgjxgghfiskqnuttzd —",
  ref === "cjtgjxgghfiskqnuttzd" ? "MATCHES this env" : "does NOT match this env",
);

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function count(table, filter) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: c, error } = await q;
  if (error) return { error: error.message, count: null };
  return { count: c ?? 0 };
}

async function select(table, columns, limit = 50) {
  const { data, error } = await supabase.from(table).select(columns).limit(limit);
  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

const tables = [
  "se_standards",
  "se_standard_versions",
  "se_ksbs",
  "se_duties",
  "gta_programmes",
  "gta_programme_versions",
  "gta_spines",
  "gta_spine_items",
  "gta_spine_item_ksbs",
  "gta_course_tasks",
  "curriculum_analysis_runs",
  "curriculum_analysis_results",
  "programme_activity_log",
  "apprentice_programmes",
  "apprentices",
];

console.log("\n=== TABLE COUNTS (read-only) ===");
const counts = {};
for (const t of tables) {
  const r = await count(t);
  counts[t] = r;
  console.log(
    `${t}: ${r.error ? `ERROR ${r.error}` : r.count}`,
  );
}

console.log("\n=== STANDARDS ===");
const standards = await select(
  "se_standards",
  "id, standard_code, title, occupation_code, created_at",
  100,
);
if (standards.error) console.log("ERROR", standards.error);
else console.log(JSON.stringify(standards.data, null, 2));

console.log("\n=== STANDARD VERSIONS ===");
const versions = await select(
  "se_standard_versions",
  "id, standard_id, external_version, level, status, is_current, imported_at",
  100,
);
if (versions.error) console.log("ERROR", versions.error);
else console.log(JSON.stringify(versions.data, null, 2));

console.log("\n=== GTA PROGRAMMES ===");
const programmes = await select(
  "gta_programmes",
  "id, standard_id, title, created_at, updated_at",
  100,
);
if (programmes.error) console.log("ERROR", programmes.error);
else console.log(JSON.stringify(programmes.data, null, 2));

console.log("\n=== GTA PROGRAMME VERSIONS ===");
const pvs = await select(
  "gta_programme_versions",
  "id, programme_id, standard_version_id, internal_version, status, published_at, created_at, updated_at",
  200,
);
if (pvs.error) console.log("ERROR", pvs.error);
else console.log(JSON.stringify(pvs.data, null, 2));

const goldenId = "231a8a32-d876-4312-a178-960d19dcf938";
const golden = (pvs.data || []).find((v) => v.id === goldenId);
console.log("\n=== GOLDEN A PROGRAMME VERSION PRESENT? ===");
console.log(golden ? JSON.stringify(golden, null, 2) : "NOT FOUND in gta_programme_versions");

console.log("\n=== ENROLMENT PINS TO GTA VERSIONS ===");
const pins = await select(
  "apprentice_programmes",
  "id, apprentice_id, gta_programme_version_id",
  500,
);
if (pins.error) console.log("ERROR", pins.error);
else {
  const withPin = (pins.data || []).filter((r) => r.gta_programme_version_id);
  const byVersion = {};
  for (const r of withPin) {
    byVersion[r.gta_programme_version_id] =
      (byVersion[r.gta_programme_version_id] || 0) + 1;
  }
  console.log("enrolment_rows_sampled:", pins.data.length);
  console.log("enrolments_with_gta_programme_version_id:", withPin.length);
  console.log("pins_by_version:", byVersion);
  console.log(
    "golden_version_enrolment_pins:",
    byVersion[goldenId] || 0,
  );
}

console.log("\n=== SPINE ITEM TYPE BREAKDOWN (sample via versions) ===");
const items = await select(
  "gta_spine_items",
  "id, spine_id, item_type, title, sequence",
  500,
);
if (items.error) console.log("ERROR", items.error);
else {
  const byType = {};
  for (const it of items.data || []) {
    byType[it.item_type] = (byType[it.item_type] || 0) + 1;
  }
  console.log("spine_items_sampled:", items.data.length);
  console.log("by_type:", byType);
  const titles = [...new Set((items.data || []).map((i) => i.title))].slice(0, 40);
  console.log("sample_titles:", titles);
}

console.log("\n=== ANALYSIS RUNS ===");
const runs = await select(
  "curriculum_analysis_runs",
  "id, programme_version_id, status, created_at, provider",
  100,
);
if (runs.error) console.log("ERROR", runs.error);
else console.log(JSON.stringify(runs.data, null, 2));

const outPath = path.resolve(".tmp-pb-authoring-inventory.json");
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      inspected_at: new Date().toISOString(),
      environment: {
        supabase_url_redacted: redactUrl(url),
        project_ref: ref,
        looks_localhost: looksLocal,
        looks_supabase_cloud: looksCloud,
        service_role_key_len: serviceRoleKey.length,
        matches_hardcoded_wipe_ref: ref === "cjtgjxgghfiskqnuttzd",
      },
      counts,
      programmes: programmes.data || [],
      programme_versions: pvs.data || [],
      standards: standards.data || [],
      standard_versions: versions.data || [],
      golden_a_version_present: Boolean(golden),
      enrolment_pins_by_version: pins.error
        ? { error: pins.error }
        : Object.fromEntries(
            Object.entries(
              (pins.data || [])
                .filter((r) => r.gta_programme_version_id)
                .reduce((acc, r) => {
                  acc[r.gta_programme_version_id] =
                    (acc[r.gta_programme_version_id] || 0) + 1;
                  return acc;
                }, {}),
            ),
          ),
      analysis_runs: runs.data || [],
    },
    null,
    2,
  ),
);
console.log("\nWrote", outPath);
console.log("\nNO DELETES PERFORMED.");
