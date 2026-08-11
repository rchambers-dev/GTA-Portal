/**
 * Seed controlled Autocare ST0499 v1.3 Programme Builder Phase 1 structure.
 *
 * Creates NEW programme/version (does not restore deleted Golden A id).
 * Idempotent: refuses if a Phase-1 controlled Autocare programme already exists
 * unless --replace-phase1 is passed (then deletes only that tagged programme).
 *
 * Guards:
 * - ALLOW_HOSTED_PB_AUTHORING_RESET=1 for hosted execute
 * - --confirm
 * - project ref match
 * - apprentices must be 0 (or no pin to target)
 * - never touches profiles
 * - never deletes ST0499 catalogue
 *
 * Usage:
 *   node scripts/seed-autocare-phase1-controlled.mjs
 *   ALLOW_HOSTED_PB_AUTHORING_RESET=1 node scripts/seed-autocare-phase1-controlled.mjs --confirm
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const EXPECTED_PROJECT_REF = "cjtgjxgghfiskqnuttzd";
const PHASE1_TAG = "autocare-st0499-v1.3-phase1-controlled";
const FIXTURE_PATH = path.resolve(
  "data/curriculum-control/autocare-st0499-v1.3-phase1-fixture.json",
);

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
const execute = args.has("--confirm");
const replacePhase1 = args.has("--replace-phase1");

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

const ref = projectRef(url);
const looksCloud = /supabase\.co/i.test(url);
const expectedRef = env.OVERRIDE_PB_PROJECT_REF?.trim() || EXPECTED_PROJECT_REF;

console.log("=== AUTOCARE PHASE 1 CONTROLLED SEED ===");
console.log("mode:", execute ? "EXECUTE" : "DRY-RUN");
console.log("supabase:", redactUrl(url), "ref:", ref);

if (ref !== expectedRef) die(`Unexpected project ref ${ref}`);
if (execute && looksCloud && env.ALLOW_HOSTED_PB_AUTHORING_RESET !== "1") {
  die("Hosted execute requires ALLOW_HOSTED_PB_AUTHORING_RESET=1");
}

if (!fs.existsSync(FIXTURE_PATH)) {
  die(`Missing fixture ${FIXTURE_PATH} — run scripts/build-autocare-phase1-fixture.py`);
}
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
if (fixture.flags?.length) {
  die(`Fixture has unresolved flags: ${fixture.flags.join("; ")}`);
}
if (fixture.sessions.length !== 113) {
  die(`Fixture sessions ${fixture.sessions.length} != 113`);
}
if (Math.abs(fixture.plannedEligibleOtjHours - 611.5) > 0.001) {
  die("Fixture OTJ is not 611.5");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function count(table, build) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (build) q = build(q);
  const { count: c, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return c ?? 0;
}

const profilesBefore = await count("profiles");
const apprentices = await count("apprentices");
if (apprentices > 0) die("apprentices table not empty");

const { data: standards, error: sErr } = await supabase
  .from("se_standards")
  .select("id, standard_code, title")
  .eq("standard_code", "ST0499")
  .maybeSingle();
if (sErr) throw sErr;
if (!standards) die("ST0499 standard missing — catalogue must be preserved");

const { data: stdVersion, error: svErr } = await supabase
  .from("se_standard_versions")
  .select("id, external_version, is_current")
  .eq("standard_id", standards.id)
  .eq("external_version", "1.3")
  .maybeSingle();
if (svErr) throw svErr;
if (!stdVersion) die("ST0499 v1.3 standard version missing");

const ksbCount = await count("se_ksbs", (q) =>
  q.eq("standard_version_id", stdVersion.id),
);
if (ksbCount !== 64) die(`ST0499 KSB count ${ksbCount} != 64`);

// Detect existing Phase 1 tagged programmes via programme version parameters note / metadata
const { data: existingProgrammes } = await supabase
  .from("gta_programmes")
  .select("id, title, created_at");
const existingVersions = (
  await supabase
    .from("gta_programme_versions")
    .select("id, programme_id, status, parameters, internal_version")
).data || [];

const phase1Versions = existingVersions.filter((v) => {
  const p = v.parameters;
  return p && typeof p === "object" && p.controlTag === PHASE1_TAG;
});

console.log("profiles:", profilesBefore);
console.log("ST0499 KSBs:", ksbCount);
console.log("existing gta_programmes:", existingProgrammes?.length ?? 0);
console.log("existing phase1 tagged versions:", phase1Versions.length);
console.log("fixture sessions:", fixture.sessions.length);
console.log("fixture tasks:", fixture.tasks.length);

if (phase1Versions.length && !replacePhase1) {
  die(
    "Phase 1 programme already exists. Re-run with --replace-phase1 to rebuild that tagged programme only.",
  );
}

if (!execute) {
  console.log("\nDRY-RUN OK. Would create:");
  console.log("- programme:", fixture.programmeTitle);
  console.log("- version: draft, expectedOtjHours 611.5, controlTag", PHASE1_TAG);
  console.log("- spine: 10 blocks + gateway + epa + 2 delivery milestones");
  console.log("- sessions: 113");
  console.log("- tasks: 50 (B1–B10 × 5)");
  console.log("- NO Primary KSB mappings");
  process.exit(0);
}

// Replace prior phase1 if requested
if (replacePhase1 && phase1Versions.length) {
  for (const v of phase1Versions) {
    console.log("Replacing prior Phase 1 version", v.id);
    // cascade via programme delete
    const progId = v.programme_id;
    // delete tasks/sessions first if restrict
    await supabase.from("gta_course_tasks").delete().eq("programme_version_id", v.id);
    await supabase.from("gta_programme_sessions").delete().eq("programme_version_id", v.id);
    await supabase.from("gta_spine_item_ksbs").delete().eq("programme_version_id", v.id);
    const { data: spines } = await supabase
      .from("gta_spines")
      .select("id")
      .eq("programme_version_id", v.id);
    const spineIds = (spines || []).map((s) => s.id);
    if (spineIds.length) {
      await supabase.from("gta_spine_items").delete().in("spine_id", spineIds);
    }
    await supabase.from("gta_spines").delete().eq("programme_version_id", v.id);
    await supabase.from("gta_programme_versions").delete().eq("id", v.id);
    // delete programme if no remaining versions
    const remaining = (
      await supabase
        .from("gta_programme_versions")
        .select("id")
        .eq("programme_id", progId)
    ).data;
    if (!remaining?.length) {
      await supabase.from("gta_programmes").delete().eq("id", progId);
    }
  }
}

const programmeId = randomUUID();
const versionId = randomUUID();
const spineId = randomUUID();

const parameters = {
  expectedOtjHours: 611.5,
  formulaKey: "block_ksb_value_v1",
  formulaStatus: "draft",
  includeAplK: true,
  includeAplS: true,
  includeAplB: true,
  aplWeightK: 0.3,
  aplWeightS: 0.5,
  aplWeightB: 0.2,
  aplMaxFraction: 0.3,
  includeRplKnowledge: true,
  includeRplSkills: true,
  includeRplBehaviours: true,
  fundingBandPounds: 13000,
  fixedCostLines: [],
  rplNotes:
    "Phase 1 controlled Autocare. Curriculum OTJ uses equal-KSB unit 611.5/64. Learner K/S/B weights 0.30/0.50/0.20 are for individual coverage/progress only — not Primary/master OTJ. controlTag=" +
    PHASE1_TAG,
  controlTag: PHASE1_TAG,
  publishedMinimumOtjHours: 605,
  calendarWeeks: 112,
  plannedSessions: 113,
  phase: 1,
  decisionsLog:
    "tests/artifacts/autocare-v1/evidence-enriched/staging/structure-reconciliation/AUTOCARE-CONTROLLED-STRUCTURE-DECISIONS-H1-H9.md",
};

console.log("\nInserting programme...");
{
  const { error } = await supabase.from("gta_programmes").insert({
    id: programmeId,
    standard_id: standards.id,
    title: fixture.programmeTitle,
  });
  if (error) throw error;
}
{
  const { error } = await supabase.from("gta_programme_versions").insert({
    id: versionId,
    programme_id: programmeId,
    standard_version_id: stdVersion.id,
    internal_version: "phase1-1",
    status: "draft",
    parameters,
  });
  if (error) throw error;
}
{
  const { error } = await supabase.from("gta_spines").insert({
    id: spineId,
    programme_version_id: versionId,
    title: "Controlled Autocare spine (Phase 1)",
  });
  if (error) throw error;
}

// Curriculum spine items: blocks 1-10, gateway 11, epa 12
const blockIdByNumber = {};
const spineRows = [];
for (const b of fixture.blocks) {
  const id = randomUUID();
  if (b.itemType === "block" || b.itemType === "gateway" || b.itemType === "epa") {
    blockIdByNumber[b.blockNumber] = id;
  }
  const plannedWeeks =
    b.weekStart != null && b.weekEnd != null
      ? b.weekEnd - b.weekStart + 1
      : null;
  spineRows.push({
    id,
    spine_id: spineId,
    item_type: b.itemType,
    gateway_type: b.gatewayType ?? null,
    title: b.title,
    sequence: b.blockNumber,
    planned_weeks: plannedWeeks,
    planned_otj_hours: b.plannedOtjHours,
    counts_towards_learning_hours: b.plannedOtjHours > 0,
    metadata: {
      blockNumber: b.blockNumber,
      weekStart: b.weekStart,
      weekEnd: b.weekEnd,
      plannedNonOtjHours: b.plannedNonOtjHours,
      monthHint: b.monthHint,
      foundationSkills: Boolean(b.foundationSkills),
      controlSource: "SOW_v4.4+H1-H9",
      ...(b.foundationSkills
        ? {
            foundationSkillsRef: {
              programme: "Motor Vehicle Foundation Skills",
              sowVersion: "v1.2",
              codes: [
                "FS01",
                "FS02",
                "FS03",
                "FS04",
                "FS05",
                "FS06",
                "FS07",
                "FS08",
                "FS09",
                "FS10",
              ],
            },
          }
        : {}),
    },
  });
}

// Delivery milestones after curriculum (sequence 101+)
let milestoneSeq = 101;
for (const m of fixture.deliveryMilestones) {
  spineRows.push({
    id: randomUUID(),
    spine_id: spineId,
    item_type: "milestone",
    gateway_type: null,
    title: m.title,
    sequence: milestoneSeq++,
    planned_weeks: null,
    planned_otj_hours: 0,
    counts_towards_learning_hours: false,
    metadata: {
      deliveryMilestone: true,
      milestoneKey: m.key,
      afterBlock: m.afterBlock,
      monthsFromStart: m.monthsFromStart,
      description: m.description,
      controlSource: "H5_delivery_only",
    },
  });
}

{
  const { error } = await supabase.from("gta_spine_items").insert(spineRows);
  if (error) throw error;
}
console.log("spine items:", spineRows.length);

// Sessions
const sessionRows = fixture.sessions.map((s) => ({
  id: randomUUID(),
  programme_version_id: versionId,
  spine_item_id: blockIdByNumber[s.blockNumber] ?? null,
  session_key: s.sessionKey,
  sequence: s.sequence,
  calendar_week: s.calendarWeek,
  session_index_in_week: s.sessionIndexInWeek,
  title: s.title,
  topic: s.topic,
  foundation_skill_code: s.foundationSkillCode,
  planned_otj_hours: null,
  metadata: {
    sourceLine: s.sourceLine,
    resourceBindings: null,
    note: "resource→session intentionally NULL in Phase 1",
  },
}));
{
  // insert in chunks
  for (let i = 0; i < sessionRows.length; i += 50) {
    const chunk = sessionRows.slice(i, i + 50);
    const { error } = await supabase.from("gta_programme_sessions").insert(chunk);
    if (error) throw new Error(`sessions insert: ${error.message}`);
  }
}
console.log("sessions:", sessionRows.length);

// Tasks B1-B10
const taskRows = fixture.tasks.map((t) => {
  const spineItemId = blockIdByNumber[t.blockNumber];
  if (!spineItemId) throw new Error(`No spine block for task B${t.blockNumber}`);
  return {
    id: randomUUID(),
    programme_version_id: versionId,
    spine_item_id: spineItemId,
    task_key: `b${t.blockNumber}-t${t.taskNumber}`,
    sequence: t.taskNumber,
    task_number: t.taskNumber,
    kind: t.kind,
    title: t.title,
    scenario: "",
    objectives: [],
    instructions: [],
    knowledge_questions: [],
    estimated_minutes: t.kind === "reflection" ? 45 : 60,
    block_ordinal: t.blockNumber,
    form_title: t.title,
    form_scenario: "",
    form_status: "ready",
    form_modules: [],
    publish_status: "draft",
    source_pdf: t.sourcePdf,
    evidence_ref: t.evidenceRef,
    curriculum_purposes: t.curriculumPurposes,
  };
});
{
  for (let i = 0; i < taskRows.length; i += 25) {
    const chunk = taskRows.slice(i, i + 25);
    const { error } = await supabase.from("gta_course_tasks").insert(chunk);
    if (error) throw new Error(`tasks insert: ${error.message}`);
  }
}
console.log("tasks:", taskRows.length);

// Verify
const profilesAfter = await count("profiles");
if (profilesAfter !== profilesBefore) die("profiles count changed");
const ksbAfter = await count("se_ksbs", (q) =>
  q.eq("standard_version_id", stdVersion.id),
);
if (ksbAfter !== 64) die("ST0499 KSB count changed");
const mappingCount = await count("gta_spine_item_ksbs", (q) =>
  q.eq("programme_version_id", versionId),
);
if (mappingCount !== 0) die("unexpected Primary mappings created");

const report = {
  executed_at: new Date().toISOString(),
  environment: { supabase: redactUrl(url), project_ref: ref },
  programmeId,
  programmeVersionId: versionId,
  spineId,
  title: fixture.programmeTitle,
  plannedEligibleOtjHours: 611.5,
  blocks: fixture.blocks.length,
  deliveryMilestones: fixture.deliveryMilestones.length,
  sessions: sessionRows.length,
  tasks: taskRows.length,
  primaryMappings: 0,
  st0499Ksbs: 64,
  profiles: profilesAfter,
  controlTag: PHASE1_TAG,
};
const reportPath = path.resolve(".tmp-autocare-phase1-seed-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log("\nPHASE 1 SEED COMPLETE");
console.log(JSON.stringify(report, null, 2));
console.log("Wrote", reportPath);
