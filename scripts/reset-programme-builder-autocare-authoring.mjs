/**
 * Reset Programme Builder AUTOCARE authoring data only (plus unused demo SE imports).
 *
 * PRESERVES:
 * - all profiles/staff accounts
 * - ST0499 v1.3 catalog (64 KSBs) and Autocare official duties/reference
 * - file artefacts under tests/artifacts (never touched by this script)
 *
 * REMOVES (when confirmed):
 * - Autocare GTA programme + version 231a8a32… + spine + primary mappings
 * - unused ST0448 / ST0403 SE imports (no GTA programmes)
 *
 * Guards:
 * - refuses apprentices > 0 or enrolment pins to target version
 * - refuses unless --confirm and --i-understand-wipe-autocare-programme
 * - refuses unless ALLOW_HOSTED_PB_AUTHORING_RESET=1 (hosted Supabase)
 * - refuses if project ref != expected (unless OVERRIDE_PB_PROJECT_REF set)
 * - never deletes from profiles / auth
 *
 * Usage (dry-run):
 *   node scripts/reset-programme-builder-autocare-authoring.mjs
 *
 * Usage (execute):
 *   ALLOW_HOSTED_PB_AUTHORING_RESET=1 node scripts/reset-programme-builder-autocare-authoring.mjs --confirm --i-understand-wipe-autocare-programme
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_REF = "cjtgjxgghfiskqnuttzd";
const GOLDEN_VERSION_ID = "231a8a32-d876-4312-a178-960d19dcf938";
const ST0499_CODE = "ST0499";
const DEMO_STANDARD_CODES = ["ST0448", "ST0403"];

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

function projectRef(url) {
  const m = String(url || "").match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

function redactUrl(url) {
  const ref = projectRef(url);
  if (!ref) return "(unknown)";
  return `https://${ref.slice(0, 6)}…${ref.slice(-4)}.supabase.co`;
}

function die(msg) {
  console.error("REFUSING:", msg);
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const execute =
  args.has("--confirm") && args.has("--i-understand-wipe-autocare-programme");

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

const ref = projectRef(url);
const looksLocal = /localhost|127\.0\.0\.1/i.test(url);
const looksCloud = /supabase\.co/i.test(url);
const expectedRef = env.OVERRIDE_PB_PROJECT_REF?.trim() || EXPECTED_PROJECT_REF;

console.log("=== RESET PLAN (Programme Builder Autocare authoring) ===");
console.log("mode:", execute ? "EXECUTE" : "DRY-RUN (no deletes)");
console.log("supabase:", redactUrl(url));
console.log("project_ref:", ref);
console.log("looks_localhost:", looksLocal);
console.log("looks_supabase_cloud:", looksCloud);

if (ref !== expectedRef) {
  die(
    `Project ref ${ref} != expected ${expectedRef}. Set OVERRIDE_PB_PROJECT_REF only if intentional.`,
  );
}

if (execute && looksCloud && env.ALLOW_HOSTED_PB_AUTHORING_RESET !== "1") {
  die(
    "Hosted execute requires ALLOW_HOSTED_PB_AUTHORING_RESET=1 in the environment.",
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function count(table, build) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (build) q = build(q);
  const { count: c, error } = await q;
  if (error) return { error: error.message, count: null };
  return { count: c ?? 0 };
}

async function allRows(table, columns, build) {
  let q = supabase.from(table).select(columns);
  if (build) q = build(q);
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

async function del(table, build, label) {
  let q = supabase.from(table).delete();
  if (build) q = build(q);
  // supabase-js requires a filter; use neq impossible if needed — callers must filter
  const { error, count } = await q.select("*", { count: "exact" });
  if (error) throw new Error(`delete ${label || table}: ${error.message}`);
  console.log(`DELETED ${label || table}: ${count ?? "?"}`);
  return count ?? 0;
}

// --- inventory ---
const profileCount = await count("profiles");
const apprenticeCount = await count("apprentices");
const enrolmentCount = await count("apprentice_programmes");
const pinCount = await count("apprentice_programmes", (q) =>
  q.eq("gta_programme_version_id", GOLDEN_VERSION_ID),
);

const programmes = await allRows(
  "gta_programmes",
  "id, title, standard_id, created_at",
);
const versions = await allRows(
  "gta_programme_versions",
  "id, programme_id, status, internal_version, standard_version_id",
);
const targetVersion = versions.find((v) => v.id === GOLDEN_VERSION_ID);
const targetProgramme = programmes.find(
  (p) => p.id === targetVersion?.programme_id,
);

const mappingCount = await count("gta_spine_item_ksbs", (q) =>
  q.eq("programme_version_id", GOLDEN_VERSION_ID),
);
const taskCount = await count("gta_course_tasks", (q) =>
  q.eq("programme_version_id", GOLDEN_VERSION_ID),
);
const spines = targetVersion
  ? await allRows("gta_spines", "id, programme_version_id, title", (q) =>
      q.eq("programme_version_id", GOLDEN_VERSION_ID),
    )
  : [];
const spineIds = spines.map((s) => s.id);
const itemCount =
  spineIds.length === 0
    ? { count: 0 }
    : await count("gta_spine_items", (q) => q.in("spine_id", spineIds));

const standards = await allRows(
  "se_standards",
  "id, standard_code, title",
);
const st0499 = standards.find((s) => s.standard_code === ST0499_CODE);
const demoStandards = standards.filter((s) =>
  DEMO_STANDARD_CODES.includes(s.standard_code),
);

const stdVersions = await allRows(
  "se_standard_versions",
  "id, standard_id, external_version",
);
const st0499VersionIds = stdVersions
  .filter((v) => v.standard_id === st0499?.id)
  .map((v) => v.id);
const demoVersionIds = stdVersions
  .filter((v) => demoStandards.some((s) => s.id === v.standard_id))
  .map((v) => v.id);

const ksbSt0499 =
  st0499VersionIds.length === 0
    ? { count: 0 }
    : await count("se_ksbs", (q) => q.in("standard_version_id", st0499VersionIds));

// Demo programmes? must be none before deleting demo standards
const demoProgrammeCount = programmes.filter((p) =>
  demoStandards.some((s) => s.id === p.standard_id),
).length;

console.log("\n=== GUARD CHECKS ===");
console.log("profiles (MUST preserve):", profileCount.count, profileCount.error || "");
console.log("apprentices:", apprenticeCount.count, apprenticeCount.error || "");
console.log("apprentice_programmes:", enrolmentCount.count);
console.log("pins to Golden version:", pinCount.count);
console.log("target programme:", targetProgramme?.title || "(missing)");
console.log("target version:", GOLDEN_VERSION_ID, targetVersion?.status || "(missing)");
console.log("mappings:", mappingCount.count);
console.log("spine items:", itemCount.count);
console.log("course tasks:", taskCount.count);
console.log("ST0499 KSB count (preserve):", ksbSt0499.count);
console.log(
  "demo standards to remove:",
  demoStandards.map((s) => s.standard_code).join(", ") || "(none)",
);
console.log("demo GTA programmes referencing them:", demoProgrammeCount);

if ((apprenticeCount.count ?? 0) > 0) {
  die("apprentices table is not empty — refusing Autocare authoring wipe");
}
if ((pinCount.count ?? 0) > 0) {
  die("learner enrolments pin the Golden Autocare version — refusing");
}
if ((profileCount.count ?? 0) < 1) {
  die("profiles count unexpected — refusing (safety)");
}
if (demoProgrammeCount > 0) {
  die("demo standards still linked to GTA programmes — refusing demo SE delete");
}
if (!st0499 || (ksbSt0499.count ?? 0) !== 64) {
  die(`ST0499 catalogue unexpected (ksbs=${ksbSt0499.count}) — refusing`);
}

console.log("\n=== OUT OF SCOPE (will NOT be deleted) ===");
console.log("- profiles / staff accounts (", profileCount.count, ")");
console.log("- ST0499 +", ksbSt0499.count, "KSBs + Autocare official SE reference");
console.log("- tests/artifacts/** including H1–H9, Golden A files, evidence-enriched");
console.log("- Other Portal MySQL / teaching-resources");
console.log("- source code");

console.log("\n=== IN SCOPE DELETE ORDER ===");
console.log("1) gta_spine_item_ksbs where programme_version_id=", GOLDEN_VERSION_ID);
console.log("2) gta_course_tasks where programme_version_id=", GOLDEN_VERSION_ID);
console.log("3) gta_spine_items for spines of that version");
console.log("4) gta_spines for that version");
console.log("5) gta_programme_versions id=", GOLDEN_VERSION_ID);
console.log("6) gta_programmes Autocare title=", targetProgramme?.title);
console.log("7) unused SE cascade for", DEMO_STANDARD_CODES.join(", "));
console.log("   (duty mappings → duties/ksbs → standard_versions → standards)");

if (!execute) {
  console.log("\nDRY-RUN complete. No deletes.");
  console.log(
    "To execute:\n  ALLOW_HOSTED_PB_AUTHORING_RESET=1 node scripts/reset-programme-builder-autocare-authoring.mjs --confirm --i-understand-wipe-autocare-programme",
  );
  process.exit(0);
}

console.log("\n=== EXECUTING DELETES ===");

// 1 mappings
{
  const { error, count } = await supabase
    .from("gta_spine_item_ksbs")
    .delete({ count: "exact" })
    .eq("programme_version_id", GOLDEN_VERSION_ID);
  if (error) throw error;
  console.log("deleted mappings:", count);
}

// 2 tasks
{
  const { error, count } = await supabase
    .from("gta_course_tasks")
    .delete({ count: "exact" })
    .eq("programme_version_id", GOLDEN_VERSION_ID);
  if (error) throw error;
  console.log("deleted course tasks:", count);
}

// 3 spine items
if (spineIds.length) {
  const { error, count } = await supabase
    .from("gta_spine_items")
    .delete({ count: "exact" })
    .in("spine_id", spineIds);
  if (error) throw error;
  console.log("deleted spine items:", count);
}

// 4 spines
{
  const { error, count } = await supabase
    .from("gta_spines")
    .delete({ count: "exact" })
    .eq("programme_version_id", GOLDEN_VERSION_ID);
  if (error) throw error;
  console.log("deleted spines:", count);
}

// 5 programme version
{
  const { error, count } = await supabase
    .from("gta_programme_versions")
    .delete({ count: "exact" })
    .eq("id", GOLDEN_VERSION_ID);
  if (error) throw error;
  console.log("deleted programme version:", count);
}

// 6 programme
if (targetProgramme) {
  const { error, count } = await supabase
    .from("gta_programmes")
    .delete({ count: "exact" })
    .eq("id", targetProgramme.id);
  if (error) throw error;
  console.log("deleted programme:", count);
}

// 7 demo SE standards
for (const code of DEMO_STANDARD_CODES) {
  const std = standards.find((s) => s.standard_code === code);
  if (!std) {
    console.log("skip missing standard", code);
    continue;
  }
  const vIds = stdVersions.filter((v) => v.standard_id === std.id).map((v) => v.id);
  if (vIds.length) {
    // duty-ksb mappings via duties
    const duties = await allRows("se_duties", "id", (q) =>
      q.in("standard_version_id", vIds),
    );
    const dutyIds = duties.map((d) => d.id);
    if (dutyIds.length) {
      const { error, count } = await supabase
        .from("se_duty_ksb_mappings")
        .delete({ count: "exact" })
        .in("duty_id", dutyIds);
      if (error && !/schema cache|does not exist|Could not find/i.test(error.message)) {
        throw error;
      }
      console.log(code, "deleted duty_ksb_mappings:", count ?? "(n/a)", error?.message || "");
    }
    {
      const { error, count } = await supabase
        .from("se_duties")
        .delete({ count: "exact" })
        .in("standard_version_id", vIds);
      if (error) throw error;
      console.log(code, "deleted duties:", count);
    }
    {
      const { error, count } = await supabase
        .from("se_ksbs")
        .delete({ count: "exact" })
        .in("standard_version_id", vIds);
      if (error) throw error;
      console.log(code, "deleted ksbs:", count);
    }
    {
      const { error, count } = await supabase
        .from("se_standard_versions")
        .delete({ count: "exact" })
        .in("id", vIds);
      if (error) throw error;
      console.log(code, "deleted standard_versions:", count);
    }
  }
  {
    const { error, count } = await supabase
      .from("se_standards")
      .delete({ count: "exact" })
      .eq("id", std.id);
    if (error) throw error;
    console.log(code, "deleted standard:", count);
  }
}

// --- verify ---
console.log("\n=== AFTER ===");
const after = {
  profiles: await count("profiles"),
  apprentices: await count("apprentices"),
  gta_programmes: await count("gta_programmes"),
  gta_programme_versions: await count("gta_programme_versions"),
  gta_spines: await count("gta_spines"),
  gta_spine_items: await count("gta_spine_items"),
  gta_spine_item_ksbs: await count("gta_spine_item_ksbs"),
  gta_course_tasks: await count("gta_course_tasks"),
  se_standards: await count("se_standards"),
  se_ksbs: await count("se_ksbs"),
  se_duties: await count("se_duties"),
  golden_version_still_present: (
    await count("gta_programme_versions", (q) => q.eq("id", GOLDEN_VERSION_ID))
  ).count,
  st0499_ksbs: (
    await count("se_ksbs", (q) => q.in("standard_version_id", st0499VersionIds))
  ).count,
};

console.log(JSON.stringify(after, null, 2));

if ((after.profiles.count ?? 0) !== (profileCount.count ?? 0)) {
  die("profiles count changed — unexpected");
}
if ((after.st0499_ksbs ?? 0) !== 64) {
  die("ST0499 KSB count no longer 64");
}
if ((after.gta_programmes.count ?? 0) !== 0) {
  die("gta_programmes not empty after reset");
}
if ((after.golden_version_still_present ?? 0) !== 0) {
  die("Golden version still present");
}

const reportPath = path.resolve(
  "tests/artifacts/autocare-v1/evidence-enriched/staging/structure-reconciliation/PB-AUTHORING-RESET-REPORT.md",
);
// User said do not touch evidence-enriched except READ — so write report outside evidence-enriched
const altReport = path.resolve(".tmp-pb-authoring-reset-report.json");
fs.writeFileSync(
  altReport,
  JSON.stringify(
    {
      executed_at: new Date().toISOString(),
      environment: { supabase: redactUrl(url), project_ref: ref },
      preserved_profiles: after.profiles.count,
      preserved_st0499_ksbs: after.st0499_ksbs.count,
      removed_autocare_programme_version: GOLDEN_VERSION_ID,
      after,
    },
    null,
    2,
  ),
);
console.log("\nWrote", altReport);
console.log("CLEAN FOR CONTROLLED AUTOCARE BUILD: YES (authoring empty; ST0499 catalogue preserved)");
console.log("Staff profiles untouched. File artefacts untouched.");
