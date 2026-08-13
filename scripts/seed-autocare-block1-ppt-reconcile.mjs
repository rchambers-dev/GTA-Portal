/**
 * Block 1 PowerPoint reconciliation — HIGH-confidence tutor attachment only.
 *
 * Attaches G02 Features of Hybrid Vehicles.ppt → W003 as
 * Tutor delivery / Tutor only.
 *
 * Does NOT: attach MEDIUM/LOW/UNRESOLVED decks, make PPTs learner-visible,
 * alter FS01–FS10 lesson-plan mappings, invent learner content, touch staff.
 *
 *   ALLOW_BLOCK1_PPT_RECONCILE=1 node --env-file=.env.local scripts/seed-autocare-block1-ppt-reconcile.mjs --confirm
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const CONTROL_TAG = "autocare-st0499-v1.3-phase1-controlled";
const PROGRAMME_VERSION_ID =
  process.env.AUTOCARE_PHASE1_VERSION_ID?.trim() ||
  "e8e578d5-ec0d-4de7-b9e2-5f4fa480b662";

const HIGH = {
  evidenceId: "res_lm_b956dd2a0014_1",
  resourceKey: "res_lm_b956dd2a0014_1",
  title: "Features of Hybrid Vehicles",
  filename: "Features of Hybrid Vehicles.ppt",
  sessionKey: "W003",
  sourcePath:
    "G02 Electric Hybrid Awareness/Resources/Features of Hybrid Vehicles.ppt",
  phase2aExtract:
    "tests/artifacts/autocare-v1/evidence-enriched/staging/phase2a/ppt-extracts/ev__G02_Electric_Hybrid_Awareness_Resources_Features_of_Hybrid_Vehicles.ppt.txt",
  extractDest:
    "tests/artifacts/autocare-v1/evidence-enriched/staging/extracts/res_lm_b956dd2a0014_1.txt",
};

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (process.env.ALLOW_BLOCK1_PPT_RECONCILE !== "1") {
  die("Requires ALLOW_BLOCK1_PPT_RECONCILE=1");
}
if (!process.argv.includes("--confirm")) die("Requires --confirm");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) die("Missing Supabase env");
const sb = createClient(url, key, { auth: { persistSession: false } });

const src = path.resolve(HIGH.phase2aExtract);
const dest = path.resolve(HIGH.extractDest);
if (!fs.existsSync(src)) die(`Missing Phase 2A extract: ${src}`);
fs.copyFileSync(src, dest);

const { count: profilesBefore } = await sb
  .from("profiles")
  .select("*", { count: "exact", head: true });
const { count: sessionsBefore } = await sb
  .from("gta_programme_sessions")
  .select("*", { count: "exact", head: true });
const { count: tasksBefore } = await sb
  .from("gta_course_tasks")
  .select("*", { count: "exact", head: true });
const { count: deliveryBefore } = await sb
  .from("gta_session_delivery_records")
  .select("*", { count: "exact", head: true });
const { count: primaryBefore } = await sb
  .from("gta_block_ksb_mappings")
  .select("*", { count: "exact", head: true });

const { data: version, error: vErr } = await sb
  .from("gta_programme_versions")
  .select("id, parameters")
  .eq("id", PROGRAMME_VERSION_ID)
  .maybeSingle();
if (vErr) die(vErr.message);
if (!version) die("Programme version not found");
const params = version.parameters || {};
if (params.controlTag !== CONTROL_TAG) {
  die(`Refusing: controlTag is ${params.controlTag}`);
}
if (Number(params.expectedOtjHours) !== 611.5) {
  die(`Refusing: expectedOtjHours=${params.expectedOtjHours}`);
}

const { data: w003, error: sErr } = await sb
  .from("gta_programme_sessions")
  .select("id, session_key, spine_item_id, foundation_skill_code")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("session_key", HIGH.sessionKey)
  .maybeSingle();
if (sErr) die(sErr.message);
if (!w003) die("W003 not found");
if (w003.foundation_skill_code !== "FS03") {
  die(`W003 foundation_skill_code is ${w003.foundation_skill_code}`);
}

const { error: upErr } = await sb.from("gta_programme_resources").upsert(
  {
    programme_version_id: PROGRAMME_VERSION_ID,
    resource_key: HIGH.resourceKey,
    title: HIGH.title,
    filename: HIGH.filename,
    source_path: HIGH.sourcePath,
    evidence_resource_id: HIGH.evidenceId,
    extract_path: HIGH.extractDest,
    metadata: {
      phase: "block1-ppt-reconcile",
      confidence: "HIGH",
      roleDefault: "TUTOR_DELIVERY",
      audienceDefault: "TUTOR_ONLY",
      groupProvenance: "G02 Electric Hybrid Awareness (supporting only)",
      evidence: [
        "FS03 lesson plan names EV/hybrid presentation",
        "Extracted slides cover hybrid identification, orange cables, HEV/PHEV, components",
        "Quiz answer slides present — tutor only",
      ],
      learnerVisible: false,
      binaryHostedInPortal: false,
    },
  },
  { onConflict: "programme_version_id,resource_key" },
);
if (upErr) die(upErr.message);

const { data: resource, error: rErr } = await sb
  .from("gta_programme_resources")
  .select("id")
  .eq("programme_version_id", PROGRAMME_VERSION_ID)
  .eq("resource_key", HIGH.resourceKey)
  .maybeSingle();
if (rErr) die(rErr.message);
if (!resource) die("Resource upsert failed");

const { data: existing } = await sb
  .from("gta_programme_resource_attachments")
  .select("id")
  .eq("resource_id", resource.id)
  .eq("session_id", w003.id)
  .eq("role", "TUTOR_DELIVERY")
  .maybeSingle();

if (!existing) {
  const { error: attErr } = await sb
    .from("gta_programme_resource_attachments")
    .insert({
      programme_version_id: PROGRAMME_VERSION_ID,
      resource_id: resource.id,
      session_id: w003.id,
      spine_item_id: w003.spine_item_id,
      role: "TUTOR_DELIVERY",
      audience: "TUTOR_ONLY",
      sort_order: 30,
      metadata: {
        confidence: "HIGH",
        mapping: "W003 ↔ FS03 EV/hybrid presentation",
        learnerVisible: false,
      },
    });
  if (attErr) die(attErr.message);
}

const { count: profilesAfter } = await sb
  .from("profiles")
  .select("*", { count: "exact", head: true });
const { count: sessionsAfter } = await sb
  .from("gta_programme_sessions")
  .select("*", { count: "exact", head: true });
const { count: tasksAfter } = await sb
  .from("gta_course_tasks")
  .select("*", { count: "exact", head: true });
const { count: deliveryAfter } = await sb
  .from("gta_session_delivery_records")
  .select("*", { count: "exact", head: true });
const { count: primaryAfter } = await sb
  .from("gta_block_ksb_mappings")
  .select("*", { count: "exact", head: true });

const { data: fsAtt } = await sb
  .from("gta_programme_resource_attachments")
  .select("id, resource_id, session_id, role, audience")
  .eq("programme_version_id", PROGRAMME_VERSION_ID);

console.log(
  JSON.stringify(
    {
      ok: true,
      attached: {
        sessionKey: "W003",
        evidenceId: HIGH.evidenceId,
        filename: HIGH.filename,
        role: "TUTOR_DELIVERY",
        audience: "TUTOR_ONLY",
        alreadyPresent: Boolean(existing),
      },
      invariants: {
        profiles: [profilesBefore, profilesAfter],
        sessions: [sessionsBefore, sessionsAfter],
        tasks: [tasksBefore, tasksAfter],
        deliveryRecords: [deliveryBefore, deliveryAfter],
        primaries: [primaryBefore, primaryAfter],
        attachmentRows: (fsAtt || []).length,
      },
    },
    null,
    2,
  ),
);
