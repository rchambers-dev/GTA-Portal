/**
 * Extra read-only facts for PB cleanup gate.
 */
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const out = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
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

const env = { ...process.env, ...loadEnvLocal() };
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  { auth: { persistSession: false } },
);

async function count(table) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });
  return { table, count: error ? null : count, error: error?.message || null };
}

const more = [
  "course_pack_task_forms",
  "profiles",
  "cohorts",
  "employers",
  "staff_assignments",
  "tutor_groups",
  "otj_entries",
  "otj",
  "attendance_sessions",
  "action_plans",
];

console.log("=== EXTRA TABLE COUNTS ===");
for (const t of more) console.log(await count(t));

const { data: versions } = await sb
  .from("se_standard_versions")
  .select("id, external_version, standard_id, se_standards(standard_code, title)");
console.log("\n=== STANDARD VERSIONS DETAIL ===");
console.log(JSON.stringify(versions, null, 2));

const { data: ksbs } = await sb
  .from("se_ksbs")
  .select("id, ksb_code, standard_version_id");
const by = {};
for (const k of ksbs || []) {
  by[k.standard_version_id] = (by[k.standard_version_id] || 0) + 1;
}
console.log("\n=== KSB COUNTS BY standard_version_id ===");
console.log(by);

const { data: mapSample } = await sb.from("gta_spine_item_ksbs").select("*").limit(1);
console.log("\n=== MAPPING COLUMNS ===");
console.log(mapSample?.[0] ? Object.keys(mapSample[0]) : "none");

const { count: primaryCount } = await sb
  .from("gta_spine_item_ksbs")
  .select("*", { count: "exact", head: true })
  .eq("is_primary", true);
console.log("is_primary=true count:", primaryCount);

// profiles roles if present
const { data: profiles, error: pErr } = await sb
  .from("profiles")
  .select("id, role, email")
  .limit(50);
console.log("\n=== PROFILES SAMPLE (no learner PII beyond role/email if present) ===");
if (pErr) console.log("ERROR", pErr.message);
else {
  const roles = {};
  for (const p of profiles || []) roles[p.role || "(null)"] = (roles[p.role || "(null)"] || 0) + 1;
  console.log("sample_count", profiles?.length, "roles", roles);
}
